# Client — Places UI

React single-page app for the Places API: list and filter places, open details, manage reviews and tags.

Bootstrapped with [Create React App](https://github.com/facebook/create-react-app). Full-stack setup (database, API, env vars) lives in the **repository root** [README.md](../README.md) and [SETUP.md](../SETUP.md).

## Requirements

- Node.js and npm  
- API running (default expects `http://localhost:5001/api/v1`)

Override the API base URL with `REACT_APP_API_URL` in a `.env` file in this directory (no trailing slash):

```env
REACT_APP_API_URL=http://localhost:5001/api/v1
```

Restart `npm start` after editing `.env`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Dev server at [http://localhost:3000](http://localhost:3000) with hot reload |
| `npm test` | Jest test runner ([CRA testing docs](https://create-react-app.dev/docs/running-tests)) |
| `npm run build` | Production build in `build/` |
| `npm run eject` | Exposes webpack/Babel config (irreversible) |

## Learn more

- [Create React App documentation](https://create-react-app.dev/)  
- [React documentation](https://react.dev/)
