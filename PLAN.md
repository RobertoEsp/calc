# MVP Calc — Implementation Plan

Status: **planned, not started**

Source requirements: `requirements.md`

---

## 1. Decisions

| Area | Choice |
|---|---|
| API | Single `POST /api/v1/calculate` accepting a nested operation tree |
| Evaluation | One HTTP request per `=` press; server evaluates the whole tree |
| Operand shape | Number or nested operation; percentage is an operand property |
| Operations | Basic: `+`, `−`, `×`, `÷` in Phase 1–2. Optional: `^`, `sqrt`, `percent` in Phase 3 |
| Percentage | Contextual: `200 + 10% = 220` (full rules below) |
| Frontend | React + TypeScript (Vite), hybrid keypad + editable expression line |
| Backend | Go, standard library only (`net/http`), no web framework |
| Docker | Single multi-stage image; Go binary serves the built SPA and `/api` on one port |
| Tests | Go table-driven + `httptest`; Vitest + React Testing Library + MSW |
| Persistence | None (no DB, no auth, no calculation history) |

### Assumptions

- `float64` arithmetic; display rounded to 12 significant digits to avoid `0.1 + 0.2` artifacts.
- Tests compare floats with an epsilon tolerance.
- `percent` applies only where explicitly permitted (see table); all other uses are rejected.
- Input accepts decimal and scientific notation; empty/whitespace is invalid.
- No i18n, no themes beyond light/dark-free plain styling.

---

## 2. API Contract

### Request

```json
{
  "operation": "add",
  "operands": [
    2,
    { "operation": "multiply", "operands": [3, 4] }
  ]
}
```

A flat request is simply a tree of depth one:

```json
{ "operation": "divide", "operands": [10, 4] }
```

### Success

```json
{ "result": 14 }
```

### Error

```json
{
  "error": {
    "code": "division_by_zero",
    "message": "cannot divide by zero",
    "path": "operands[1]"
  }
}
```

- `path` identifies the failing sub-node (`operands[1].operands[0]`).
- Status codes: `400` malformed JSON / invalid schema, `422` domain error, `500` unexpected.
- Error codes: `invalid_json`, `invalid_operation`, `invalid_operand_count`, `division_by_zero`,
  `negative_sqrt`, `non_finite_result`, `invalid_percent_usage`, `expression_too_deep`,
  `expression_too_large`.

### Percentage semantics

Percentage is an operand property: `{ "value": 10, "percent": true }`.

Valid only as a **leaf, right-hand operand of a binary operation**, or as the single operand of the
unary `percent` operation. Anything else → `422 invalid_percent_usage`.

| Operation | With `percent: true` |
|---|---|
| `add` | `a + a·b/100` → `200 + 10% = 220` |
| `subtract` | `a − a·b/100` → `200 − 10% = 180` |
| `multiply` | `a · b/100` → `200 × 10% = 20` |
| `divide` | `a ÷ (b/100)` → `200 ÷ 10% = 2000`; `b = 0` → `division_by_zero` |
| `exponentiate` | rejected → `invalid_percent_usage` |
| `sqrt` | rejected → `invalid_percent_usage` |
| `percent` (unary) | `v/100` → `25% = 0.25` |

### Guards

- Max nesting depth: **16**
- Max total nodes per request: **64**
- Both validated before evaluation; no recursion blow-up on hostile input.

---

## 3. Repository Layout

```
calc/
├── backend/
│   ├── cmd/server/main.go
│   ├── internal/calculator/
│   │   ├── node.go              # Operation, Node, Operand union
│   │   ├── evaluate.go          # recursive evaluation, path-aware errors
│   │   ├── operations.go        # per-operation definitions incl. percent rules
│   │   ├── errors.go            # sentinel errors
│   │   └── *_test.go
│   ├── internal/api/
│   │   ├── handler.go           # POST /api/v1/calculate, GET /healthz
│   │   ├── decode.go            # custom UnmarshalJSON for operand union
│   │   ├── middleware.go        # logging, recovery, dev CORS
│   │   └── *_test.go
│   ├── internal/web/static.go   # SPA serving + history fallback
│   └── go.mod
├── frontend/
│   ├── src/api/client.ts        # typed client, timeout, abort, error mapping
│   ├── src/expr/
│   │   ├── tokenizer.ts
│   │   ├── parser.ts            # expression → AST
│   │   ├── serialize.ts         # AST → nested request payload
│   │   └── *.test.ts
│   ├── src/components/
│   │   ├── Calculator.tsx
│   │   ├── Display.tsx
│   │   ├── ExpressionInput.tsx
│   │   └── Keypad.tsx
│   ├── src/hooks/useCalculator.ts
│   ├── src/styles/*
│   └── src/**/*.test.{ts,tsx}
├── Dockerfile
├── Makefile
├── .gitignore
└── README.md
```

---

## 4. Phases

### Phase 0 — Skeleton

1. `git init` (folder is not currently a repo).
2. Create directory layout, `go.mod`, Vite React-TS scaffold, `.gitignore`.
3. Stub `Makefile` targets.

Done when: both toolchains build empty projects and `requirements.md` is tracked.

### Phase 1 — Backend, basic operations

Backend-first, recursive from the start.

1. `internal/calculator`
   - `Operation` registry keyed by name (`add`, `subtract`, `multiply`, `divide`).
   - `Node{Operation string; Operands []Operand}`; `Operand` = `Value{Number float64; Percent bool}` or child `*Node`.
   - One recursive `Evaluate` returning `(float64, error)`, wrapping errors with the failing path.
   - Arity validation per operation (binary = 2).
   - Sentinel errors: unknown op, wrong arity, division by zero, non-finite result, invalid percent usage.
2. `internal/api`
   - `POST /api/v1/calculate`: strict decoding (`DisallowUnknownFields`), schema validation, error envelope.
   - `GET /healthz` → `{"status":"ok"}`.
   - Depth/size guards before evaluation.
3. `cmd/server`
   - `PORT` env config, graceful shutdown, logging + panic-recovery middleware, dev CORS.
4. Tests
   - Table-driven domain tests: each op, wrong arity, division by zero, overflow → non-finite, unknown op.
   - Nested-tree tests and path assertions at multiple levels.
   - `httptest` API tests asserting status **and** JSON body for success and every error code.
   - Depth/size limit tests.
5. Run instructions provisional: `go run ./cmd/server`.

Done when: `go test ./... -cover` is green and `curl` examples behave as documented.

### Phase 2 — Frontend, basic operations

1. Vite + TypeScript strict, ESLint/Prettier, dev proxy `/api` → `http://localhost:8080`.
2. `api/client.ts`: typed request/response, timeout, `AbortController` support, API error-code → user message mapping.
3. `expr/`: tokenizer + recursive-descent parser producing an AST; `serialize.ts` converts the AST into the nested request shape. Precedence: `× ÷` over `+ −`; parentheses; unary minus.
4. `hooks/useCalculator.ts`: input editing, keyboard handling, evaluation lifecycle, in-flight cancellation when a new calculation starts, error state.
5. UI: display, editable expression line, keypad, keyboard support, loading/error states, mobile-first CSS grid that reflows on narrow screens.
6. Tests
   - Tokenizer/parser/serializer unit tests.
   - Component interaction tests (typing, keypad, equals, error display).
   - Exactly one HTTP request per evaluation (assert call count).
   - MSW handlers for success and each error code.
7. Dev commands in `Makefile`: `dev-api`, `dev-web`.

Done when: `npm test` and `npm run build` pass, and the app works against the live backend.

### Phase 3 — Optional operations, end to end

1. Backend
   - `exponentiate` (binary), `sqrt` (unary, reject negative), `percent` (unary).
   - Contextual percentage rules for `+ − × ÷`; reject for `^` and `sqrt`.
   - Validation for non-finite results (overflow, `0^-1`, etc.).
   - Tests: every new operation, the full percentage table, invalid percent positions.
2. Frontend
   - Grammar/UI for `^`, `√`, `%`; keypad buttons; serializer support for percent operands.
   - Tests for new tokens, operator precedence with `^` (right-associative), percent serialization, error rendering.
3. `README` operation table updated.

Done when: both suites are green and every operation is exercisable from the UI.

### Phase 4 — Packaging & documentation

1. Multi-stage `Dockerfile`
   - Stage 1: Node build of the frontend.
   - Stage 2: Go build (static binary).
   - Stage 3: slim runtime with binary + `frontend/dist`; `STATIC_DIR` serves SPA with history fallback; `/api` handled by the binary.
   - One container, one port.
2. `README.md`
   - Prerequisites and setup.
   - How to run backend, frontend, and the Docker image.
   - API examples: flat call, nested call, percentage call, error responses.
   - Design decisions: single endpoint, nested operands, percentage rules, `float64` + rounding, SPA served by Go.
   - Assumptions and known limitations.
   - Coverage commands and current results.
3. `Makefile`: `dev-api`, `dev-web`, `test`, `cover`, `docker`, `lint`.

### Phase 5 — Verification

1. `go test ./... -cover` and `npm test -- --coverage`; capture results for the README.
2. `docker build` and `docker run`; smoke test `/healthz` and `/api/v1/calculate`.
3. Curl checks for every error code.
4. Browser check at desktop and mobile widths, plus keyboard-only flow.

---

## 5. Risks and Notes

- **JSON operand union** (`number | object`) requires a custom unmarshaler in Go and mirrored types in TS. Keep both in one small module and test them directly.
- **Contextual `%` in `divide`** (`a ÷ b%`) is the least intuitive rule. Document it explicitly and cover it with tests rather than leaving it implicit.
- **Error paths** must remain accurate as nesting grows; build them during recursion instead of post-processing.
- **Local vs server validation** is deliberately split: syntax locally, arithmetic and domain rules on the server.
- **No git repo exists yet**, so Phase 0 initializes one.
- **Stateless backend** keeps Docker and scaling simple; no session state is introduced.
