#!/usr/bin/env bash
# Start the API (server) and React app (client) together.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_PID=""
CLIENT_PID=""

cleanup() {
  if [[ -n "${SERVER_PID}" ]] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    kill "${SERVER_PID}" 2>/dev/null || true
  fi
  if [[ -n "${CLIENT_PID}" ]] && kill -0 "${CLIENT_PID}" 2>/dev/null; then
    kill "${CLIENT_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

command -v npm >/dev/null 2>&1 || {
  echo "npm is not installed or not on PATH." >&2
  exit 1
}

echo "Starting server (default http://localhost:5001 — set PORT in server/.env) and client (http://localhost:3000)..."
if [[ ! -f "${ROOT}/server/.env" ]]; then
  echo "Note: server/.env is missing. Copy server/.env.example and set GOOGLE_CLIENT_ID, SESSION_SECRET, and CLIENT_ORIGIN." >&2
elif ! grep -q '^[[:space:]]*GOOGLE_CLIENT_ID=[^[:space:]]' "${ROOT}/server/.env" 2>/dev/null; then
  echo "Note: GOOGLE_CLIENT_ID is not set in server/.env — Google sign-in will fail until you add it (same value as REACT_APP_GOOGLE_CLIENT_ID)." >&2
fi
echo "Press Ctrl+C to stop both."

(cd "${ROOT}/server" && npm start) &
SERVER_PID=$!

(cd "${ROOT}/client" && npm start) &
CLIENT_PID=$!

# Block until both dev servers exit. Ctrl+C runs cleanup and stops both.
wait
