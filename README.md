# Places

A small app for listing **places**, **reviews**, and **tags**. The default stack is **React** (Vite + TypeScript) + **Supabase** (Postgres, Auth, RLS, RPCs) + an **Edge Function** for encrypted private notes. You can deploy the UI to **Cloudflare Pages** or any static host.

## Features

- Browse places with sortable columns, average rating, and review counts  
- Add, update, and delete places (name, location, price range)  
- Add reviews with star ratings  
- Tag places with autocomplete suggestions; filter the list by tag name  
- Location is a free-text field on add/edit place forms  
- Per-user private notes (AES-256-GCM via Supabase Edge Function)

## Prerequisites

- **Node.js** and **npm** (LTS recommended)  
- A **Supabase** project; for migrations and Edge deploys, the [Supabase CLI](https://supabase.com/docs/guides/cli) is recommended (see [SUPABASE.md](SUPABASE.md))

## Repository layout

| Path | Role |
|------|------|
| `client/` | React app (Vite + TypeScript) |
| `packages/shared/` | Shared constants and validation (`@places/shared`; TypeScript → CJS for Node) |
| `supabase/migrations/` | Postgres schema, RLS, RPCs |
| `supabase/functions/private-note/` | Edge Function for private notes |
| [SUPABASE.md](SUPABASE.md) | **Start here:** Supabase, Google Auth, Edge deploy, Cloudflare Pages |
| `server/` | **Legacy** Express API + `pg` (optional; uses `@places/shared`) |
| [SETUP.md](SETUP.md) | Legacy local setup for Express + Postgres |

## Quick start (Supabase)

1. Create a Supabase project and apply migrations: **`supabase link`** + **`supabase db push`** from the repo root, or paste SQL from `supabase/migrations/` in the Dashboard. Details in [SUPABASE.md](SUPABASE.md).
2. Enable **Google** in Supabase Auth. Deploy **`private-note`** and set **`supabase secrets set PRIVATE_NOTES_KEY=...`**, then **`supabase functions deploy private-note`**. See [SUPABASE.md](SUPABASE.md).
3. From the **repository root**:

```bash
npm install
cp client/.env.example client/.env
# Edit client/.env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_GOOGLE_CLIENT_ID
# Optional: VITE_ALLOWED_EMAIL_DOMAIN (default acts2.network)
npm run dev -w client
```

4. Open [http://localhost:3000](http://localhost:3000).

**One shell** — same as step 3, or:

```bash
chmod +x start.sh   # first time only
./start.sh
```

## Production build (e.g. Cloudflare Pages)

- **Install:** from repo root, `npm ci` (workspaces install `@places/shared` and run its `prepare` build).  
- **Build:** `npm run build -w client`  
- **Output:** `client/dist` (not `build`)  
- Set **`VITE_*`** variables in the host (see [`client/.env.production.example`](client/.env.production.example)).  
- **Cloudflare Pages:** SPA routing is automatic when there is no top-level `404.html` (Vite build has none). Do not add `/* /index.html 200` in `_redirects` — Cloudflare flags it as an infinite loop.
- **Netlify:** [`client/netlify.toml`](client/netlify.toml) provides the same fallback.

## Legacy Express API (optional)

The **PERN** stack in `server/` uses **`npm run start -w server`** from the root after `npm install`. It depends on **`@places/shared`** (built on install). See [SETUP.md](SETUP.md) and [server/.env.example](server/.env.example). The default React client talks to **Supabase only**.

## Tech stack

- **Frontend:** React 18, TypeScript, Vite, React Router, Bootstrap 5, `@supabase/supabase-js`, `@react-oauth/google`  
- **Backend (default):** Supabase Postgres, PostgREST, RLS, RPCs, Edge Functions  
- **Legacy backend:** Express, `pg` (`server/`)
