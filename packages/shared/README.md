# @places/shared

Shared constants and pure validation helpers used by the Express server (CommonJS `require`) and the Vite client (ESM `import`). Built output lives in `dist/` (TypeScript → CommonJS + `.d.ts`).

**Build:** `npm run build` (runs automatically via `prepare` on `npm install` from the repo root).

Put only stable, environment-agnostic rules here (bounds, messages, string limits). Keep API client code and React in `client/`.
