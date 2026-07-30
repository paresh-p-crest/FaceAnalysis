#!/bin/bash
set -e

# Unbuffer outputs for Replit Reserved VM deployment log streaming
export PYTHONUNBUFFERED=1
export NODE_PRESERVE_SYMLINKS=1
export MPLBACKEND="${MPLBACKEND:-Agg}"

ARTIFACT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_ROOT="$(cd "$ARTIFACT_DIR/../.." && pwd)"
PORT="${PORT:-3000}"

export MPLCONFIGDIR="${MPLCONFIGDIR:-$WORKSPACE_ROOT/.cache/matplotlib}"
mkdir -p "$MPLCONFIGDIR"
export PYTHONPATH="$WORKSPACE_ROOT:$WORKSPACE_ROOT/.pythonlibs/lib/python3.11/site-packages:${PYTHONPATH:-}"

PYTHON_BIN="$(command -v python3 || command -v python || echo python)"

echo "[myface] Launcher starting production services on port ${PORT}..." >&1

cd "$ARTIFACT_DIR"
echo "[myface] Launching Next.js server on 0.0.0.0:${PORT}..." >&1

if [ -f "./node_modules/.bin/next" ]; then
  ./node_modules/.bin/next start -p "$PORT" --hostname 0.0.0.0 &
elif [ -f "$WORKSPACE_ROOT/node_modules/.bin/next" ]; then
  "$WORKSPACE_ROOT/node_modules/.bin/next" start -p "$PORT" --hostname 0.0.0.0 &
elif [ -f "$WORKSPACE_ROOT/node_modules/next/dist/bin/next" ]; then
  node "$WORKSPACE_ROOT/node_modules/next/dist/bin/next" start -p "$PORT" --hostname 0.0.0.0 &
else
  npx next start -p "$PORT" --hostname 0.0.0.0 &
fi
NEXT_PID=$!

cd "$WORKSPACE_ROOT"
echo "[myface] Launching FastAPI backend on 0.0.0.0:8000 using ${PYTHON_BIN}..." >&1
"$PYTHON_BIN" -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --no-access-log &
BACKEND_PID=$!

cleanup() {
  echo "[myface] Terminating background production services..." >&1
  kill "$NEXT_PID" "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait "$NEXT_PID"
