#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
DASHBOARD="$ROOT/dashboard"

printf '\n  JobTrack — starting services\n\n'

# ── Backend ───────────────────────────────────────────────────
(
  cd "$BACKEND"
  # shellcheck disable=SC1091
  source venv/bin/activate
  uvicorn app.main:app --reload --port 8000 --log-level warning
) &
BACKEND_PID=$!

# Wait up to 6 s for the backend to accept connections
printf '  Waiting for backend'
for _ in $(seq 1 20); do
  if curl -sf http://localhost:8000/profiles > /dev/null 2>&1; then
    printf ' ✓\n'
    break
  fi
  sleep 0.3
  printf '.'
done

# ── Dashboard ─────────────────────────────────────────────────
(
  cd "$DASHBOARD"
  npm run dev -- --port 5173
) &
DASHBOARD_PID=$!

printf '\n  Backend:    http://localhost:8000/docs\n'
printf '  Dashboard:  http://localhost:5173\n\n'
printf '  Press Ctrl+C to stop both\n\n'

cleanup() {
  printf '\n  Stopping services…\n'
  kill "$BACKEND_PID" "$DASHBOARD_PID" 2>/dev/null || true
  wait "$BACKEND_PID" "$DASHBOARD_PID" 2>/dev/null || true
  printf '  Done.\n'
}

trap cleanup INT TERM
wait
