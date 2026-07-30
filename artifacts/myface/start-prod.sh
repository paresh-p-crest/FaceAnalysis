#!/bin/bash
set -e

echo "==================================================" >&1
echo "=== MYFACE RESERVED VM DEPLOYMENT LAUNCHER OK ===" >&1
echo "==================================================" >&1
echo "[myface] Boot time: $(date)" >&1
echo "[myface] Current working dir: $(pwd)" >&1
echo "[myface] User: $(whoami)" >&1
echo "==================================================" >&1

# Unbuffer outputs for Replit Reserved VM deployment log streaming
export PYTHONUNBUFFERED=1
# pnpm dependencies use symlinked package directories; preserving the symlink
# path makes Node miss next-intl's transitive runtime dependencies.
unset NODE_PRESERVE_SYMLINKS
export MPLBACKEND="${MPLBACKEND:-Agg}"

ARTIFACT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$ARTIFACT_DIR/../.." 2>/dev/null && pwd || echo "/home/runner/workspace")"
WEB_PORT="${WEB_PORT:-${PORT:-3000}}"

echo "[myface] Resolved ARTIFACT_DIR: ${ARTIFACT_DIR}" >&1
echo "[myface] Resolved WORKSPACE_ROOT: ${WORKSPACE_ROOT}" >&1

export MPLCONFIGDIR="${MPLCONFIGDIR:-$WORKSPACE_ROOT/.cache/matplotlib}"
mkdir -p "$MPLCONFIGDIR"
export PYTHONPATH="$WORKSPACE_ROOT:$WORKSPACE_ROOT/.pythonlibs/lib/python3.11/site-packages:${PYTHONPATH:-}"

PYTHON_BIN="$(command -v python3 || command -v python || echo python)"

echo "[myface] Launcher starting production services on port ${WEB_PORT}..." >&1

cd "$ARTIFACT_DIR"
echo "[myface] Launching Next.js server on 0.0.0.0:${WEB_PORT}..." >&1

if [ -f "./node_modules/.bin/next" ]; then
  ./node_modules/.bin/next start -p "$WEB_PORT" --hostname 0.0.0.0 &
elif [ -f "$WORKSPACE_ROOT/node_modules/.bin/next" ]; then
  "$WORKSPACE_ROOT/node_modules/.bin/next" start -p "$WEB_PORT" --hostname 0.0.0.0 &
elif [ -f "$WORKSPACE_ROOT/node_modules/next/dist/bin/next" ]; then
  node "$WORKSPACE_ROOT/node_modules/next/dist/bin/next" start -p "$WEB_PORT" --hostname 0.0.0.0 &
else
  npx next start -p "$WEB_PORT" --hostname 0.0.0.0 &
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
