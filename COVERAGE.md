# Coverage Report

Snapshot from 2026-10-27. Generated reports are intentionally gitignored; this file is the
checked-in summary.

## Reproduce

```sh
make cover
```

This runs both test suites with coverage and writes:

- `backend/coverage.out` — Go coverage profile
- `frontend/coverage/index.html` — browsable frontend report

Lint can be checked separately with `make lint`.

## Summary

| Layer | Tests | Statements | Branches | Functions | Lines |
|---|---|---|---|---|---|
| Frontend | 82 passing across 6 files | 96.44% (326/338) | 88.00% (176/200) | 100% (70/70) | 97.55% (319/327) |
| Backend | All Go packages passing | 86.1% total | — | — | — |

## Backend packages

| Package | Statements |
|---|---|
| `internal/api` | 93.5% |
| `internal/calculator` | 98.7% |
| `internal/web` | 92.9% |
| `cmd/server` | 0.0% |
| **Total** | **86.1%** |

`cmd/server` is the process entry point. Its wiring is exercised by the Docker and browser smoke
tests rather than unit tests.

## Frontend files

| File | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| `src/api/client.ts` | 97.29% | 88.46% | 100% | 97.14% |
| `src/components/Calculator.tsx` | 95.83% | 79.16% | 100% | 100% |
| `src/expr/parser.ts` | 94.36% | 90.00% | 100% | 94.36% |
| `src/expr/serialize.ts` | 92.30% | 85.10% | 100% | 92.30% |
| `src/hooks/useCalculator.ts` | 96.07% | 58.33% | 100% | 100% |

Frontend coverage excludes `src/main.tsx`, test setup, MSW handlers, and test files. Backend coverage
is produced by `go test ./...` across the API, calculator, and web packages.
