#!/bin/bash
set -e

# Start Next.js and FastAPI in parallel.
# Next must bind ASAP for Replit Autoscale `/` probes; backend must also bind
# ASAP so /api/* is not ECONNREFUSED (DB connect runs after bind — see lifespan).

ARTIFACT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_ROOT="$(cd "$ARTIFACT_DIR/../.." && pwd)"
PORT="${PORT:-3000}"

export PYTHONUNBUFFERED=1
# Persist matplotlib font cache across restarts (mediapipe pulls matplotlib).
export MPLBACKEND="${MPLBACKEND:-Agg}"
export MPLCONFIGDIR="${MPLCONFIGDIR:-$WORKSPACE_ROOT/.cache/matplotlib}"
mkdir -p "$MPLCONFIGDIR"

cd "$WORKSPACE_ROOT"
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --no-access-log &
BACKEND_PID=$!

cd "$ARTIFACT_DIR"
./node_modules/.bin/next start -p "$PORT" --hostname 0.0.0.0 &
NEXT_PID=$!

cleanup() {
  kill "$NEXT_PID" "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Prefer waiting on Next (public surface); if it exits, tear down.
wait "$NEXT_PID"
