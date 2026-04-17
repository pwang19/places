# @places/shared

Shared constants and pure validation helpers used by the Vite client (ESM `import` or path alias to `src/`). The package also builds CommonJS output in `dist/` (TypeScript → CommonJS + `.d.ts`) for tooling that expects `require`.

**Build:** `npm run build` (runs automatically via `prepare` on `npm install` from the repo root).

Put only stable, environment-agnostic rules here (bounds, messages, string limits). Keep API client code and React in `client/`.
