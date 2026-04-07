# Supabase + Cloudflare Pages (Places)

The app uses **Supabase** for Postgres, **Row Level Security**, **Auth (Google)**, **RPCs**, and an **Edge Function** for encrypted private notes. The **React client** is deployed to **Cloudflare Pages** (or any static host).

Below is an **expanded cloud checklist**. Order matters where noted.

---

## A. Supabase: create the project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → **New project**.
2. Choose org, name, database password (save it somewhere safe), and region.
3. Wait until the project is **healthy** (green).
4. Open **Settings → General** and copy the **Reference ID** (e.g. `abcdxyz123`) — you need it for the CLI and for URLs.
5. Open **Settings → API** and copy:
   - **Project URL** (e.g. `https://abcdxyz123.supabase.co`) → this is `REACT_APP_SUPABASE_URL`.
   - **anon public** key → this is `REACT_APP_SUPABASE_ANON_KEY` (safe in the browser).
   - **service_role** key → **never** put this in the React app or Pages. Use only for CLI/admin or one-off scripts.

---

## B. Supabase: apply the database migration

This creates tables, RLS policies, RPCs (`list_places`, `get_place_detail`, `link_tag_to_place`), and the `profiles` trigger on new users.

**Option 1 — Supabase CLI (recommended for repeatability)**

1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli).
2. Log in: `supabase login`.
3. From the **repo root** (`places/`):

   ```bash
   supabase link --project-ref <your-reference-id>
   supabase db push
   ```

4. In the Dashboard, open **Table Editor** and confirm tables exist: `places`, `reviews`, `tags`, `place_tags`, `place_private_notes`, `profiles`.

**Option 2 — SQL Editor (no CLI)**

1. Dashboard → **SQL Editor** → New query.
2. Paste the full contents of [`supabase/migrations/20260404120000_initial_schema_rls_rpc.sql`](supabase/migrations/20260404120000_initial_schema_rls_rpc.sql).
3. Run once. Fix any error (e.g. if a trigger on `auth.users` already exists from a template, adjust or drop the duplicate).

---

## C. Google Cloud: OAuth Web client (used by Supabase + your React app)

You need **one** OAuth 2.0 **Web application** client (unless you intentionally split dev/prod clients).

1. Open [Google Cloud Console](https://console.cloud.google.com/) → select or create a project.
2. **APIs & Services → OAuth consent screen**: configure (Internal or External, test users if External).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
4. Application type: **Web application**.
5. **Authorized JavaScript origins** — add every origin where the React app runs, for example:
   - `http://localhost:3000` (local `npm start`)
   - `https://<your-pages-subdomain>.pages.dev` (Cloudflare Pages default URL)
   - `https://your-custom-domain.com` (if you add one later)
6. **Authorized redirect URIs** — Supabase needs its callback URL here. In Supabase go to **Authentication → Providers → Google** (next section): copy the **Callback URL** they show (it looks like `https://<ref>.supabase.co/auth/v1/callback`) and paste it into **Authorized redirect URIs** in Google Cloud.
7. Save and copy the **Client ID** and **Client secret**.

---

## D. Supabase: enable Google sign-in and URLs

1. Dashboard → **Authentication → Providers → Google** → enable.
2. Paste **Client ID** and **Client secret** from Google Cloud.
3. Copy the **Callback URL** shown on that page and ensure it is listed under **Authorized redirect URIs** in Google (step C.6).
4. **Authentication → URL configuration**:
   - **Site URL**: your primary production URL (e.g. `https://your-app.pages.dev` or custom domain).
   - **Redirect URLs**: add the same URLs you use in practice, e.g.  
     `http://localhost:3000/**`, `https://*.pages.dev/**`, or explicit preview URLs if you use fixed preview hostnames.

Without matching URLs, sign-in can fail with redirect or cookie issues.

---

## E. Supabase: deploy the `private-note` Edge Function

Private notes are encrypted with the same AES-GCM format as the old Express server; the key stays in **Supabase secrets**, not in the browser.

1. From the **repo root**, with CLI linked (`supabase link`):

   ```bash
   openssl rand -hex 32
   ```

   Copy the output (64 hex characters).

2. Set the secret (replace the value):

   ```bash
   supabase secrets set PRIVATE_NOTES_KEY=<paste 64 hex chars>
   ```

3. Deploy the function:

   ```bash
   supabase functions deploy private-note
   ```

4. Confirm in Dashboard → **Edge Functions** that `private-note` appears.  
   [`supabase/config.toml`](supabase/config.toml) should keep `verify_jwt = true` for this function so only authenticated callers can use it.

5. **Smoke test** (optional): with a valid user JWT, call  
   `GET https://<ref>.supabase.co/functions/v1/private-note?place_id=1`  
   with headers `Authorization: Bearer <access_token>` and `apikey: <anon key>`. Expect JSON (or 401 if not signed in).

---

## F. Cloudflare Pages: connect repo and build

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Select the repo and branch (usually `main`).
3. **Build configuration:**
   - **Framework preset:** None, or Create React App if offered (either is fine if commands match).
   - **Root directory:** `client`
   - **Build command:** `npm ci && npm run build`
   - **Build output directory:** `build`
4. **Environment variables** (Pages → your project → **Settings → Environment variables**). Add for **Production** (and **Preview** if you want previews to work against Supabase):

   | Name | Value | Notes |
   |------|--------|--------|
   | `REACT_APP_SUPABASE_URL` | `https://<ref>.supabase.co` | No trailing slash |
   | `REACT_APP_SUPABASE_ANON_KEY` | anon key | Public in the bundle; RLS protects data |
   | `REACT_APP_GOOGLE_CLIENT_ID` | Same Web client ID as in Supabase Google provider | |
   | `REACT_APP_ALLOWED_EMAIL_DOMAIN` | e.g. `acts2.network` | Optional; omit to rely on default in code |

   Do **not** set `PRIVATE_NOTES_KEY` or `service_role` here.

5. **Save and deploy**. Open the assigned `*.pages.dev` URL.

6. **SPA routing:** the repo includes [`client/public/_redirects`](client/public/_redirects) so direct loads of `/places/123` rewrite to `index.html`. If routes 404 on refresh, confirm `_redirects` is present in the built output under `build/`.

---

## G. After deploy: align Google + Supabase with your real URL

1. Add your **production Pages URL** (and preview URL if needed) to **Authorized JavaScript origins** in Google Cloud.
2. Ensure **Supabase → Authentication → URL configuration** includes those origins in **Redirect URLs** / **Site URL** as appropriate.
3. Redeploy Pages if you changed only Cloudflare env vars is not needed for Google, but you must update Google/Supabase whenever you add a new public origin.

---

## H. Optional: stricter domain control (server-side)

The React app signs users out if the email does not end with `@REACT_APP_ALLOWED_EMAIL_DOMAIN`. For **server-side** enforcement, add a Supabase **Auth Hook** (e.g. reject user creation or session for wrong domain). See [Supabase Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks).

---

## I. Migrating data from the old Express + `user_sub` schema

The new schema uses **`auth.users` UUIDs** on `reviews.user_id` and `place_private_notes.user_id`, not Google `sub` strings.

- **Greenfield:** create places/reviews in the new project after signing in.
- **Import:** restore or copy rows into `places` / `tags` / etc., then map each legacy `user_sub` to a Supabase `auth.users.id` (e.g. after users sign in once, match by email) and update `reviews.user_id` / `place_private_notes.user_id`.

Legacy `server/` scripts assume the old schema; use them only if you still run Express against an old database.

---

## J. Local development

```bash
cd client && npm install && npm start
```

Use a `client/.env` with the same variables as production (localhost in Google origins). The Express API in `server/` is **not** required for this client.

---

## Quick reference: what lives where

| Secret / key | Where it goes |
|----------------|----------------|
| Anon key | React env / Cloudflare Pages |
| Service role | CLI, server-side scripts only — **not** in the browser |
| `PRIVATE_NOTES_KEY` | `supabase secrets set` for Edge Function only |
| Google Client ID | Supabase Google provider + `REACT_APP_GOOGLE_CLIENT_ID` |
| Google Client secret | Supabase Google provider only |
