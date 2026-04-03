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

## Tech stack

- **Frontend:** React 18, React Router, Axios, Bootstrap 5  
- **Backend:** Express, `pg`, CORS, Morgan (non-production)  
- **Database:** PostgreSQL