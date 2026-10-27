# Prompt History

Chronological log of user prompts for this project, kept verbatim. Newest entries are appended at
the bottom.

- **Project:** MVP Calc
- **Session date:** 2026-10-25
- **Maintained by:** the agent, appended after each prompt

---

## 1. Plan request

> read the @requirements.md to create a plan to make this in steps, for instance I want the backend
> first and then proceed with frontend, at the end the optionals. Ask for clarification if need it

Clarification answers given:

- API shape: single `/calculate` endpoint
- Optional operations: include all three (exponentiation, square root, percentage)
- Percentage semantics: `a op (b%)`
- UI model: hybrid (keypad + expression line)
- Docker: one image, Go serves the SPA

## 2. Alternatives to per-node HTTP calls

> what other options do we have to avoid "means one HTTP call per AST node"

Clarification answer given:

- Evaluator strategy: nested operands (recursive AST), one request per evaluation, percentage as an
  operand property

## 3. Save the plan

> save this plan. Do not start the implentation yet

## 4. Prompt history file

> create a new file to create a historical of the promnts I'm giving

## 5. First commit

> prepare a first commit with our changes, do not push it yet

## 6. Start Phase 0

> start with phase 0

## 7. Go toolchain

Clarification answer given:

> Can we use docker?

## 8. Start Phase 1

> Start with phase 1

## 9. Start Phase 2

> Start with phase 2

Implementation notes:

- Frontend stack: React 19 + TypeScript strict, Vite 8, oxlint, Vitest 5 + React Testing Library +
  MSW 3.
- Local expression parser produces an AST, then a single nested request per evaluation.
- Visual direction: pine/bone/phosphor palette, monospace numbers, full-width ember equals bar.
- Verified against the live Go API through the Vite proxy at desktop and mobile widths.

## 10. Start Phase 3

> Start with phase 3

Implementation notes:

- Backend adds `exponentiate`, `sqrt`, and `percent`; nested operands keep one request per evaluation.
- Percentages are contextual only on the right of `+ − × ÷`; `^` and `sqrt` reject them with
  `invalid_percent_usage`, and standalone percentages use the unary `percent` operation.
- Frontend grammar adds right-associative `^`, prefix `√`, and postfix `%`; the keypad gains a
  `√ xʸ % ÷` row, the operator column keeps `÷ × − +` aligned, and `=` moves into the bottom row so
  the 4-column grid stays full.
- Error messages cover `negative_sqrt` and the updated percent rule.
- Verified `2^10`, `√81`, `200+10%`, `25%`, and the negative-square-root error against the live
  backend through the Vite proxy at desktop and mobile widths.

## 11. Start Phase 4

> Start with phase 4

Implementation notes:

- Added `internal/web`: SPA file serving, history fallback for client routes, immutable caching for
  hashed assets, and a router that keeps `/api` and `/healthz` on the Go handler.
- Added a three-stage `Dockerfile` (Node build, Go static build, Alpine runtime as UID 10001) plus
  `.dockerignore`; `STATIC_DIR` makes the binary serve the built SPA.
- Added the root `README.md` with setup, Docker, API examples, percentage rules, error codes, limits,
  design rationale, and coverage results; replaced the Vite boilerplate frontend README.
- Added `make docker-run` and verified the image on port 8081, including static fallback, asset
  caching, API calls, and the non-root user.

## 12. Start Phase 5

> Start with phase 5

Implementation notes:

- Re-ran coverage for both layers and lint; recorded final results in the README.
- Rebuilt the Docker image and ran a fresh container with a healthy healthcheck and UID 10001.
- Curl-checked all client-reachable API error codes and every operation.
- Ran a keyboard-only browser flow (Tab, typing, Enter, Escape, Tab + Space) at desktop and mobile
  widths, with no horizontal overflow.
- Documented that `invalid_expression` and `invalid_operand` are evaluator guards rather than
  decoder-reachable API errors.

## 13. Add coverage report

> yes

Context: follow-up to the requirements audit; accepted the proposal to add a checked-in coverage
report and remove leftover `.gitkeep` files.

Implementation notes:

- Added `COVERAGE.md` with reproduction commands, summary metrics, backend package breakdown, and
  frontend file breakdown; linked it from the README.
- Removed the three obsolete `.gitkeep` files from backend packages that now contain source files.
