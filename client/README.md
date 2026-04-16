# Client — Places UI

React + TypeScript SPA for Places: list and filter places, details, reviews, tags, and private notes (Supabase).

This package is part of an **npm workspace** monorepo. Install dependencies from the **repository root** (`npm install`), which also builds [`@places/shared`](../packages/shared) for shared constants used by the client and server.

## Requirements

- Node.js and npm (LTS)
- Supabase project and env vars below (see [SUPABASE.md](../SUPABASE.md))

## Environment variables

Create `client/.env` from `.env.example`. All client variables are prefixed with **`VITE_`** (Vite exposes only these to the browser).

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `VITE_GOOGLE_CLIENT_ID` | Yes | Google OAuth Web client ID |
| `VITE_ALLOWED_EMAIL_DOMAIN` | No | Allowed email domain after sign-in (default `acts2.network`) |

Restart the dev server after changing `.env`.

If you are upgrading from Create React App, rename **`REACT_APP_*`** keys in `client/.env` to **`VITE_*`** (same suffixes).

## Scripts

From the **repo root**:

| Command | Description |
|---------|-------------|
| `npm run dev -w client` | Vite dev server at [http://localhost:3000](http://localhost:3000) |
| `npm run build -w client` | Production build in **`client/dist/`** |
| `npm run preview -w client` | Preview the production build locally |

`/api` is proxied to `http://localhost:5001` in dev (legacy Express); the default Supabase client does not need it.

## Deploy (e.g. Cloudflare Pages)

- **Root directory:** `client` (or build from monorepo root with `npm run build -w client` and publish `client/dist`)
- **Build output:** `dist` (not `build`)
- Set the same `VITE_*` variables in the host environment. See [`.env.production.example`](.env.production.example).
- **Cloudflare Pages:** no extra file — SPA fallback when no root `404.html`.
- **Netlify:** [`netlify.toml`](netlify.toml).

## Layout

- [`src/features/`](src/features/) — domain UI (`places`, `auth`, `shell`, `tags`)
- [`src/components/ui/`](src/components/ui/) — shared presentational components
- [`src/pages/`](src/pages/) — route-level screens
- [`src/api/`](src/api/) — Supabase-backed “PlaceFinder” / tag clients
