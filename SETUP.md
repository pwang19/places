# Quick Start Guide

## Prerequisites
- Node.js and npm installed
- PostgreSQL installed and running
- Database created (default: `yelp_clone`)

## Setup Steps

### 1. Database Configuration
The `.env` file in the `server/` directory should be configured with your database credentials. If you need to update it, edit `server/.env`:

```env
PGUSER=postgres
PGHOST=localhost
PGDATABASE=yelp_clone
PGPASSWORD=your_password
PGPORT=5432
PORT=5001
```

Or use `DATABASE_URL` for services like ElephantSQL:
```env
DATABASE_URL=postgresql://user:password@host:port/database
PORT=5001
```

### 2. Create Database (if not exists)
```bash
createdb yelp_clone
```

### 3. Create Database Tables
```bash
cd server
npm run createPlacesTable
npm run createReviewsTable
npm run createTagsTables
```

If you previously used the old database table names (`restaurants`, `restaurant_id`, `restaurant_tags`), run once before starting the app:

```bash
npm run migrateToPlaces
```

### 4. Start the Backend Server
```bash
cd server
npm start
```
The server will run on `http://localhost:5001` unless you change `PORT` in `server/.env`.

### 5. Start the Frontend (in a new terminal)
```bash
cd client
npm start
```
The React app will open in your browser at `http://localhost:3000`

## Troubleshooting

- **Database connection errors**: Check your `.env` file has the correct database credentials
- **Port already in use**: Change the `PORT` in `server/.env` or free the port the API uses (default 5001)
- **Tables already exist**: The scripts use `CREATE TABLE IF NOT EXISTS`, so it's safe to run them multiple times

