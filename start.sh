#!/usr/bin/env bash
# Start the React client. Data and auth come from Supabase (see SUPABASE.md).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT_PID=""

cleanup() {
  if [[ -n "${CLIENT_PID}" ]] && kill -0 "${CLIENT_PID}" 2>/dev/null; then
    kill "${CLIENT_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

command -v npm >/dev/null 2>&1 || {
  echo "npm is not installed or not on PATH." >&2
  exit 1
}

echo "Starting client at http://localhost:3000 (Supabase: set VITE_SUPABASE_* and VITE_* in client/.env)."
if [[ ! -f "${ROOT}/client/.env" ]]; then
  echo "Note: client/.env is missing. Copy client/.env.example and set Supabase + Google vars." >&2
fi
echo "Press Ctrl+C to stop."

(cd "${ROOT}" && npm run dev -w client) &
CLIENT_PID=$!

wait
