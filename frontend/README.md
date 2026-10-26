# MVP Calc frontend

React + TypeScript + Vite single-page calculator. See the [root README](../README.md) for the full
project overview, API contract, and Docker setup.

## Commands

```sh
npm install
npm run dev       # Vite on :5173, /api proxied to :8080
npm test          # Vitest
npm run lint      # oxlint
npm run build     # type-check and production build
npm run preview   # preview the built app
```

The dev server expects the Go API on `http://localhost:8080`; run `make dev-api` from the repository
root, or start the backend manually.

## Structure

- `src/api/` — typed HTTP client and API error mapping.
- `src/expr/` — tokenizer, recursive-descent parser, request serializer, display formatting.
- `src/components/` — calculator shell, display, and keypad.
- `src/hooks/` — expression editing and evaluation lifecycle.
- `src/test/` — Vitest setup and MSW handlers.
