# Places

A small full-stack app for listing **places**, **reviews**, and **tags**. It uses PostgreSQL, Express, React, and Node (PERN). The UI is built with React and Bootstrap; the API is versioned under `/api/v1`.

## Features

- Browse places with sortable columns, average rating, and review counts  
- Add, update, and delete places (name, location, price range)  
- Add reviews with star ratings  
- Tag places with autocomplete suggestions; filter the list by tag name  
- Location is a free-text field on add/edit place forms

## Repository layout

| Path | Role |
|------|------|
| `server/` | Express API, database scripts, `server/.env` |
| `client/` | React app (Create React App) |
| `SETUP.md` | Step-by-step local setup and troubleshooting |
| `start.sh` | Optional: run API + client together (from repo root) |

## Prerequisites

- Node.js and npm  
- PostgreSQL (local or hosted, e.g. Neon, Supabase, ElephantSQL)  
- Two terminals (or use `./start.sh` on macOS/Linux)

## Quick start

### 1. Install dependencies

```bash
git clone <your-repo-url>
cd yelp-clone-pern-stack
cd server && npm install
cd ../client && npm install
```

### 2. Configure the database

Create a database, then add `server/.env` with either `DATABASE_URL` or the usual `PG*` variables. See [SETUP.md](SETUP.md) for examples.

Set `PORT` if you do not want the default **5001**.

### 3. Create tables

From `server/`:

```bash
npm run createPlacesTable
npm run createReviewsTable
npm run createTagsTables
```

If you are upgrading a database that still used the old `restaurants` / `restaurant_id` schema, run once:

```bash
npm run migrateToPlaces
```

### 4. Run the app

**Option A — two terminals**

```bash
# Terminal 1
cd server && npm start

# Terminal 2
cd client && npm start
```

**Option B — one shell (repo root)**

```bash
chmod +x start.sh   # first time only
./start.sh
```

- API default: `http://localhost:5001` (or whatever you set in `PORT`)  
- App: [http://localhost:3000](http://localhost:3000)

### 5. Point the client at the API (optional)

If the API is not on `http://localhost:5001/api/v1`, create `client/.env`:

```env
REACT_APP_API_URL=http://localhost:5001/api/v1
```

Restart the React dev server after changing env vars.

### 6. Google sign-in (acts2.network)

The app expects users to sign in with Google using an **@acts2.network** address (configurable). In [Google Cloud Console](https://console.cloud.google.com/), create an OAuth **Web client ID** and add **Authorized JavaScript origins** (e.g. `http://localhost:3000` and your production URL).

**Server** — add to `server/.env` (see [`server/.env.example`](server/.env.example)):

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` | Same Web client ID as the React app |
| `SESSION_SECRET` | Long random string used to sign the session cookie |
| `CLIENT_ORIGIN` | Browser origin allowed for CORS (default `http://localhost:3000`; comma-separate multiple) |
| `ALLOWED_EMAIL_DOMAIN` | Email must end with `@` + this domain (default `acts2.network`) |
| `TRUST_PROXY` | Set to `true` when the API sits behind a reverse proxy (HTTPS) |

**Client** — add to `client/.env` (see [`client/.env.example`](client/.env.example)):

| Variable | Purpose |
|----------|---------|
| `REACT_APP_GOOGLE_CLIENT_ID` | Same value as `GOOGLE_CLIENT_ID` on the server |
| `REACT_APP_ALLOWED_EMAIL_DOMAIN` | Optional; must match server `ALLOWED_EMAIL_DOMAIN` for the sign-in hint (default `acts2.network`) |

## API (short reference)

Base path: `/api/v1`

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/places` | List places; query `tag` filters by tag substring |
| POST | `/places` | Create a place |
| GET | `/places/:id` | Place detail + reviews |
| PUT | `/places/:id` | Update a place |
| DELETE | `/places/:id` | Delete a place (cascades reviews and tag links) |
| POST | `/places/:id/addReview` | Add a review |
| POST | `/places/:id/tags` | Add or link a tag (`{ "name": "..." }`) |
| DELETE | `/places/:id/tags/:tagId` | Remove tag from place |
| GET | `/tags?q=...` | Tag name search (autocomplete) |
| POST | `/auth/google` | Exchange Google ID token for session cookie (`{ "credential": "<jwt>" }`) |
| GET | `/auth/me` | Current user or 401 |
| POST | `/auth/logout` | Clear session |

All routes except `/auth/*` require a valid session cookie.

## Tech stack

- **Frontend:** React 18, React Router, Axios, Bootstrap 5  
- **Backend:** Express, `pg`, CORS, Morgan (non-production)  
- **Database:** PostgreSQL