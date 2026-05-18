#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
DASHBOARD="$ROOT/dashboard"

BACKEND_PORT=8000
DASHBOARD_PORT=5173

printf '\n  JobTrack — starting services\n\n'

# ── Backend ───────────────────────────────────────────────────
(
  cd "$BACKEND"
  # shellcheck disable=SC1091
  source venv/bin/activate
  uvicorn app.main:app --reload --port "$BACKEND_PORT" --log-level warning
) &
BACKEND_PID=$!

# Wait up to 6 s; abort immediately if the process dies before becoming ready
BACKEND_READY=0
printf '  Waiting for backend'
for _ in $(seq 1 20); do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    printf '\n  ERROR: backend process exited. Check output above.\n'
    exit 1
  fi
  if curl -sf "http://localhost:${BACKEND_PORT}/profiles" > /dev/null 2>&1; then
    printf ' ✓\n'
    BACKEND_READY=1
    break
  fi
  sleep 0.3
  printf '.'
done

if [ "$BACKEND_READY" -eq 0 ]; then
  printf '\n  WARNING: backend did not respond within 6 s. Continuing anyway.\n'
fi

# ── Dashboard ─────────────────────────────────────────────────
(
  cd "$DASHBOARD"
  npm run dev -- --port "$DASHBOARD_PORT"
) &
DASHBOARD_PID=$!

printf '\n  Backend:    http://localhost:%s/docs\n' "$BACKEND_PORT"
printf '  Dashboard:  http://localhost:%s\n\n' "$DASHBOARD_PORT"
printf '  Press Ctrl+C to stop both\n\n'

cleanup() {
  printf '\n  Stopping services…\n'
  kill "$BACKEND_PID" "$DASHBOARD_PID" 2>/dev/null || true
  wait "$BACKEND_PID" "$DASHBOARD_PID" 2>/dev/null || true
  printf '  Done.\n'
}

trap cleanup INT TERM
wait
