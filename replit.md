# MyFace — AI Facial Analysis

AI-powered facial analysis platform: users upload a photo, complete an onboarding questionnaire, and receive a structured report analyzing facial symmetry, proportions, shapes, and features.

## Run & Operate

- **Frontend (Next.js 15):** `pnpm --filter @workspace/myface run dev` — runs on port 3000 (via artifact workflow `artifacts/myface: web`)
- **Backend (Python FastAPI):** `python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir backend` — runs on port 8000 (workflow `Python Backend`)
- **DB migrations:** `python -m alembic upgrade head` — run from project root
- **Smoke test:** `python scripts/smoke_test.py`
- **Health check:** `GET /api/health`

## Stack

- **Frontend:** Next.js 15 (App Router), React 18, Tailwind CSS, MediaPipe Tasks Vision
- **Backend:** Python FastAPI + SQLAlchemy (async) + asyncpg + PostgreSQL
- **DB ORM/migrations:** SQLAlchemy models + Alembic
- **CV:** Google MediaPipe Face Mesh (478 landmarks), OpenCV, Canvas pixel analysis
- **AI (optional):** Groq / OpenAI / OpenRouter for narrative reports
- **Payments (optional):** Stripe + PayPal
- **Media storage:** Replit Object Storage (`MEDIA_STORAGE_BACKEND=replit`)
- **PDF:** ReportLab

## Required Secrets

- `AUTH_SECRET` — JWT signing key (any long random string)
- `ADMIN_PASSWORD` — password for the bootstrap admin account (min 8 chars)

## Environment Variables (already set)

- `ADMIN_EMAIL=admin@myface.local`
- `CORS_ORIGINS` — localhost origins
- `CORS_ORIGIN_REGEX` — allows all `*.replit.dev` and `*.repl.co`
- `MEDIA_STORAGE_BACKEND=replit`
- `LLM_PROVIDER=groq`

## Optional Secrets (for AI features)

- `GROQ_API_KEY` — for AI narrative reports (free tier available)
- `OPENAI_API_KEY` — alternative LLM provider
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` — for payment gating
- `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET` — PayPal payments

## Where things live

- `artifacts/myface/` — Next.js frontend (app/, components/, utils/)
- `backend/` — FastAPI backend (routers/, models, analysis modules)
- `backend/alembic/` — DB migration scripts
- `docs/` — architecture docs, ADRs, domain models, sprint logs
- `scripts/` — startup scripts, smoke test

## Architecture decisions

- Next.js `next.config.js` proxies `/api/*` → `http://localhost:8000/api/*` (no separate NEXT_PUBLIC_API_URL needed)
- Backend auto-detects Replit PG env vars (PGHOST/PGUSER/PGDATABASE) over DATABASE_URL
- Media served at `/api/media/{key}` by FastAPI, same URL for local and Replit Object Storage backends
- `python -m uvicorn` (not bare `uvicorn`) required on Replit — packages install to `.pythonlibs/bin/` which isn't on PATH

## Gotchas

- Use `python -m uvicorn` not `uvicorn` — the binary isn't on PATH in Replit workflows
- Do not set `PORT` as a shared env var — it conflicts with the artifact's PORT=22039 for the Next.js service
- After any code/package change, restart both workflows
- See AGENTS.md for documentation maintenance rules (update relevant .md files after every change)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._
