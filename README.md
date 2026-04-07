# Places

A small app for listing **places**, **reviews**, and **tags**. The default stack is **React** (Create React App) + **Supabase** (Postgres, Auth, RLS, RPCs) + an **Edge Function** for encrypted private notes. You can deploy the UI to **Cloudflare Pages** or any static host.

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
| `client/` | React app (Create React App) |
| `supabase/migrations/` | Postgres schema, RLS, RPCs |
| `supabase/functions/private-note/` | Edge Function for private notes |
| [SUPABASE.md](SUPABASE.md) | **Start here:** Supabase, Google Auth, Edge deploy, Cloudflare Pages |
| `server/` | **Legacy** Express API + `pg` (optional; not used by the default client) |
| [SETUP.md](SETUP.md) | Legacy local setup for Express + Postgres |

## Quick start (Supabase)

1. Create a Supabase project and apply the migration: **`supabase link`** + **`supabase db push`** from the repo root, or paste the SQL from `supabase/migrations/` in the Dashboard SQL Editor. Details in [SUPABASE.md](SUPABASE.md) (section B).
2. Enable **Google** in Supabase Auth. Deploy the **`private-note`** Edge Function and set the secret: **`supabase secrets set PRIVATE_NOTES_KEY=<64 hex chars>`** (generate with `openssl rand -hex 32`), then **`supabase functions deploy private-note`**. See [SUPABASE.md](SUPABASE.md) (section E).
3. From `client/`:

```bash
npm install
cp .env.example .env
# Edit .env: REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY, REACT_APP_GOOGLE_CLIENT_ID
# Optional: REACT_APP_ALLOWED_EMAIL_DOMAIN (default acts2.network)
npm start
```

4. Open [http://localhost:3000](http://localhost:3000).

**One shell (repo root)** — starts only the React app (data and auth are Supabase):

```bash
chmod +x start.sh   # first time only
./start.sh
```

## Production build (e.g. Cloudflare Pages)

- **Root directory:** `client`  
- **Build:** `npm ci && npm run build`  
- **Output:** `build`  
- Set the same `REACT_APP_*` variables in the host’s build environment. Variable names match [`client/.env.production.example`](client/.env.production.example); a full Pages checklist is in [SUPABASE.md](SUPABASE.md) (section F).  
- SPA fallback: [`client/public/_redirects`](client/public/_redirects).

## Google sign-in

Use a Google OAuth **Web client ID** configured in both **Google Cloud Console** and **Supabase → Authentication → Google**. Authorized JavaScript origins must include your app origin (e.g. `http://localhost:3000` and your Pages URL).

The client can restrict sign-in to **`@REACT_APP_ALLOWED_EMAIL_DOMAIN`** (default `acts2.network`) after token exchange. For stricter enforcement, add a Supabase Auth Hook (see [SUPABASE.md](SUPABASE.md)).

## Legacy Express API (optional)

The previous **PERN** stack (`server/` + cookie sessions + `/api/v1`) is still in the repo for reference or gradual migration. See [SETUP.md](SETUP.md) and [server/.env.example](server/.env.example). The current React client talks to **Supabase only**; it does not use `REACT_APP_API_URL` unless you restore an older client build.

## Tech stack

- **Frontend:** React 18, React Router, Bootstrap 5, `@supabase/supabase-js`, `@react-oauth/google`  
- **Backend (default):** Supabase Postgres, PostgREST, RLS, RPCs, Edge Functions  
- **Legacy backend:** Express, `pg` (`server/`)
