#!/bin/bash
set -e

# This script starts both the Python FastAPI backend and the Next.js frontend
# inside the same production container. The frontend rewrites /api/* to
# localhost:8000, so both services share the same origin.
#
# Start Next immediately (no pre-sleep): Replit Autoscale healthchecks
# previewPath (/healthz) as soon as the artifact process starts.

ARTIFACT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_ROOT="$(cd "$ARTIFACT_DIR/../.." && pwd)"

# Start Python backend in the background from the workspace root.
cd "$WORKSPACE_ROOT"
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --no-access-log &
BACKEND_PID=$!

# Ensure the backend is killed when this script exits.
trap 'kill $BACKEND_PID 2>/dev/null || true' EXIT

# Start Next.js frontend. Replit provides PORT in production.
cd "$ARTIFACT_DIR"
exec ./node_modules/.bin/next start -p "${PORT:-3000}" --hostname 0.0.0.0
