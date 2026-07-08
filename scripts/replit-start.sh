#!/usr/bin/env bash
set -euo pipefail

python -m uvicorn backend.main:app --host 0.0.0.0 --port "${BACKEND_PORT:-8000}" &
npm run dev -- --hostname 0.0.0.0 --port "${PORT:-3000}"
