#!/bin/bash
set -e

# Start Next.js first so port 3000 binds ASAP for Replit Reserved VM & Autoscale health probes.
# Unbuffer output streams so logs appear immediately in Replit Deployment console.

ARTIFACT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_ROOT="$(cd "$ARTIFACT_DIR/../.." && pwd)"
PORT="${PORT:-3000}"

export PYTHONUNBUFFERED=1
export NODE_PRESERVE_SYMLINKS=1
export MPLBACKEND="${MPLBACKEND:-Agg}"
export MPLCONFIGDIR="${MPLCONFIGDIR:-$WORKSPACE_ROOT/.cache/matplotlib}"
mkdir -p "$MPLCONFIGDIR"

echo "[myface] Launcher starting production services on port ${PORT}..."

# 1. Start Next.js first to open public PORT 3000 ASAP for health probes
cd "$ARTIFACT_DIR"
echo "[myface] Starting Next.js server on 0.0.0.0:${PORT}..."
./node_modules/.bin/next start -p "$PORT" --hostname 0.0.0.0 &
NEXT_PID=$!

# 2. Start FastAPI backend on port 8000
cd "$WORKSPACE_ROOT"
echo "[myface] Starting FastAPI backend on 0.0.0.0:8000..."
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --no-access-log &
BACKEND_PID=$!

cleanup() {
  echo "[myface] Terminating background production services..."
  kill "$NEXT_PID" "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Prefer waiting on Next (public surface); if it exits, tear down.
wait "$NEXT_PID"
