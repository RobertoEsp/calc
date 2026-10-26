# MVP Calc

A full-stack calculator: a React + TypeScript single-page app backed by a Go HTTP API. The frontend
keeps a hybrid keypad/expression editor and sends one nested expression to the server per evaluation.
The server is the arithmetic source of truth.

## Features

- Basic arithmetic: addition, subtraction, multiplication, division.
- Optional operations: exponentiation, square root, percentage.
- Contextual percentages: `200 + 10% = 220`, `200 − 10% = 180`, `200 × 10% = 20`,
  `200 ÷ 10% = 2000`.
- Editable expression line with caret insertion, keypad input, keyboard shortcuts, validation, and
  readable errors.
- Responsive layout for desktop and mobile widths.
- One HTTP request per evaluation, with a nested operation tree.
- Single production container: the Go binary serves both `/api` and the built SPA.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, oxlint, Vitest + React Testing Library + MSW |
| Backend | Go 1.27, standard library only (`net/http`, `encoding/json`, `log/slog`) |
| Packaging | Multi-stage Dockerfile, Alpine runtime, non-root user |
| Persistence | None |

## Quick start with Docker

Prerequisites: Docker Desktop or colima.

```sh
docker build -t mvp-calc .
docker run --rm -p 8080:8080 mvp-calc
```

Or use the Make target:

```sh
make docker-run
```

Open <http://localhost:8080>. The same process serves the SPA and the API. Check health with:

```sh
curl http://localhost:8080/healthz
# {"status":"ok"}
```

## Development

### Frontend and backend in separate terminals

```sh
# Terminal 1: Go API in the official Go container on :8080
make dev-api

# Terminal 2: Vite dev server on :5173 with /api proxied to :8080
make dev-web
```

Open <http://localhost:5173>.

If Go and Node are installed locally, the equivalent commands are:

```sh
cd backend && go run ./cmd/server
cd frontend && npm install && npm run dev
```

### Serving the production build locally

```sh
cd frontend && npm run build
cd backend && STATIC_DIR=../frontend/dist go run ./cmd/server
```

`STATIC_DIR` enables SPA serving with history fallback. When it is unset, the server exposes only
the API and `/healthz`, which is the development setup.

## Testing and quality

```sh
make test          # Go + frontend tests
make test-api      # Go tests in the container
make test-web      # Vitest
make cover         # coverage for both layers
make lint          # go vet + oxlint
make build-api     # compile the server into backend/bin/
```

Current results (2026-10-27):

- Frontend: **82 tests** across 6 files; **96.4% statements**, **97.6% lines**, **100% functions**.
- Backend: **93.5%** coverage in `internal/api`, **98.7%** in `internal/calculator`, **92.9%** in
  `internal/web`; **86.1%** total.
- `go vet`, `gofmt`, oxlint, and the production build are clean.

`make cover` writes `backend/coverage.out` and an HTML report under `frontend/coverage/`.

Release verification on 2026-10-27 built and ran the container, curl-checked every client-reachable
error code and all operations, and exercised a keyboard-only browser flow at 1280px and 390px. The
container ran as UID 10001 with a healthy Docker healthcheck.

## API

### Endpoint

```http
POST /api/v1/calculate
Content-Type: application/json
```

A request is an operation plus its operands. An operand is one of:

- a number: `2`
- a nested expression: `{"operation":"multiply","operands":[3,4]}`
- a value object, optionally marked as a percentage: `{"value":10,"percent":true}`

### Operations

| `operation` | Arity | Meaning |
|---|---|---|
| `add` | 2 | `a + b` |
| `subtract` | 2 | `a − b` |
| `multiply` | 2 | `a × b` |
| `divide` | 2 | `a ÷ b`; `b = 0` → `division_by_zero` |
| `exponentiate` | 2 | `a^b` via `math.Pow` |
| `sqrt` | 1 | `√a`; negative input → `negative_sqrt` |
| `percent` | 1 | `a / 100` |

### Examples

Flat calculation:

```sh
curl -s http://localhost:8080/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation":"add","operands":[2,3]}'
# {"result":5}
```

Nested expression (`2 + 3 × 4`):

```sh
curl -s http://localhost:8080/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation":"add","operands":[2,{"operation":"multiply","operands":[3,4]}]}'
# {"result":14}
```

Exponentiation and square root:

```sh
curl -s http://localhost:8080/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation":"exponentiate","operands":[2,10]}'
# {"result":1024}

curl -s http://localhost:8080/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation":"sqrt","operands":[81]}'
# {"result":9}
```

Contextual percentage and standalone percentage:

```sh
curl -s http://localhost:8080/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation":"add","operands":[200,{"value":10,"percent":true}]}'
# {"result":220}

curl -s http://localhost:8080/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation":"percent","operands":[25]}'
# {"result":0.25}
```

### Percentage semantics

A percentage is a property of a value, valid only as the **right-hand leaf** of `add`, `subtract`,
`multiply`, or `divide`, or as the single operand of the unary `percent` operation. Other positions
return `422 invalid_percent_usage`.

| Operation | With `percent: true` |
|---|---|
| `add` | `a + a·b/100` → `200 + 10% = 220` |
| `subtract` | `a − a·b/100` → `200 − 10% = 180` |
| `multiply` | `a · b/100` → `200 × 10% = 20` |
| `divide` | `a ÷ (b/100)` → `200 ÷ 10% = 2000`; `b = 0` → `division_by_zero` |
| `exponentiate` | rejected → `invalid_percent_usage` |
| `sqrt` | rejected → `invalid_percent_usage` |
| `percent` | `a/100` → `25% = 0.25` |

### Error responses

```json
{
  "error": {
    "code": "division_by_zero",
    "message": "cannot divide by zero",
    "path": "operands[1]"
  }
}
```

`path` is present when the failure belongs to a nested operand.

| Code | Status | Meaning |
|---|---|---|
| `invalid_json` | 400 | Malformed JSON, unknown field, or invalid request schema |
| `request_too_large` | 413 | Body exceeds 1 MiB |
| `invalid_expression` | 422 | Missing expression (evaluator guard) |
| `invalid_operation` | 422 | Unknown operation name |
| `invalid_operand` | 422 | Empty or ambiguous operand (evaluator guard) |
| `invalid_operand_count` | 422 | Wrong number of operands for the operation |
| `division_by_zero` | 422 | Divisor is zero, including a zero percentage divisor |
| `negative_sqrt` | 422 | Square root of a negative number |
| `non_finite_result` | 422 | Result is `NaN` or infinite |
| `invalid_percent_usage` | 422 | Percentage in an unsupported position |
| `expression_too_deep` | 422 | More than 16 nested levels |
| `expression_too_large` | 422 | More than 64 nodes |
| `internal_error` | 500 | Unexpected server failure |

`invalid_expression` and `invalid_operand` are evaluator guards covered by domain tests; the HTTP
decoder rejects malformed operands earlier as `invalid_json`. `internal_error` is a safety net for
unexpected server failures.

### Limits

- Maximum request body: **1 MiB**
- Maximum nesting depth: **16**
- Maximum operation nodes per request: **64**

## Frontend expression grammar

The editable line accepts:

- numbers, including decimals and scientific notation
- `+`, `-`, `*`, `/`, `^`
- parentheses
- prefix `√`
- postfix `%`

`^` is right-associative and binds more tightly than a leading sign, so `2^3^2 = 512` and
`-2^2 = -(2^2) = -4`. Percentages are contextual only where the API allows them; elsewhere they are
sent as the unary `percent` operation. The display rounds to 12 significant digits.

Keyboard shortcuts: `Enter` evaluates, `Escape` clears.

## Design decisions

- **One endpoint, one nested tree.** The client parses the expression into an AST, serializes it, and
  makes exactly one request per evaluation. This avoids per-node HTTP calls and keeps the API small.
- **Server owns arithmetic.** The frontend validates syntax locally for fast feedback; all arithmetic,
  percentage rules, and domain errors are enforced by the Go evaluator.
- **Percentage as an operand property.** It preserves the contextual meaning of `%` without adding a
  separate operation for every combination.
- **`float64` plus display rounding.** Standard Go/JavaScript floating point is sufficient here; the UI
  rounds to 12 significant digits to hide representation artifacts such as `0.30000000000000004`.
- **Standard library backend.** No framework, router, or database; `net/http` and `encoding/json` cover
  the whole API.
- **SPA served by the same binary.** In production the Go process serves `frontend/dist` with history
  fallback and long-lived caching for hashed assets. One image, one port.
- **Strict input handling.** JSON decoding rejects unknown fields, the body is size-limited, and the
  evaluator enforces depth and node limits before arithmetic.

## Project layout

```text
calc/
├── backend/
│   ├── cmd/server/            # entry point, PORT/STATIC_DIR config
│   └── internal/
│       ├── api/               # calculate endpoint, decoding, middleware
│       ├── calculator/        # operations, validation, evaluation
│       └── web/               # SPA serving, history fallback, router
├── frontend/
│   └── src/
│       ├── api/               # typed API client and error mapping
│       ├── components/        # calculator, display, keypad
│       ├── expr/              # tokenizer, parser, serializer, formatting
│       ├── hooks/             # evaluation lifecycle and input state
│       └── test/              # Vitest setup and MSW server
├── Dockerfile                 # frontend build → Go build → Alpine runtime
├── Makefile
└── README.md
```

## Assumptions and limitations

- Arithmetic uses `float64`; results outside its finite range return `non_finite_result`.
- Percentages are only supported in the contextual forms documented above; there is no natural-language
  “X% of Y” input.
- No calculation history, accounts, persistence, or server-side sessions.
- CORS is open (`*`) to support the Vite dev server. Restrict it if the API is exposed separately in a
  production deployment.
- The UI is English-only.
