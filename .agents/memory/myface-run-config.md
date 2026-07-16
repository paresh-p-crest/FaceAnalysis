---
name: MyFace run config
description: Replit-specific quirks for running the MyFace FastAPI + Next.js stack
---

## Rule
Use `python -m uvicorn` (not bare `uvicorn`) for the backend workflow — pip installs to `.pythonlibs/bin/` which is not on the workflow PATH.

**Why:** `uvicorn` binary at `/home/runner/workspace/.pythonlibs/bin/uvicorn` is not on PATH when workflows execute; `python -m uvicorn` always resolves correctly.

**How to apply:** Any workflow or shell command that starts the FastAPI backend must use `python -m uvicorn backend.main:app ...`.

## Rule
Do NOT set `PORT` as a shared env var — it conflicts with the artifact's `PORT=22039` injected by `artifacts/myface/.replit-artifact/artifact.toml` for the Next.js service.

**Why:** Shared `PORT=8000` overrides the artifact-level env, causing Next.js to try binding port 8000 (already taken by FastAPI) and crash.

**How to apply:** The uvicorn command passes `--port 8000` explicitly, so no PORT env var is needed for the backend. Leave PORT unset in shared env.

## API proxy
`artifacts/myface/next.config.js` rewrites `/api/*` → `http://localhost:8000/api/*`. No `NEXT_PUBLIC_API_URL` needed in the browser — all API calls are relative.

## Required secrets
- `AUTH_SECRET` — JWT signing key
- `ADMIN_PASSWORD` — bootstrap admin account (min 8 chars); `ADMIN_EMAIL` defaults to `admin@myface.local`
