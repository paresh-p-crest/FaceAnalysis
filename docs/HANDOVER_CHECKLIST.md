# AuraScan Handover Checklist

## Current Status

Feature sprints 1-13 are complete:

- MongoDB persistence and assessment retrieval
- Auth with user/admin roles
- Local/Replit environment readiness
- Report workflow: draft, pending review, approved, published
- Cloud report history
- OpenAI narrative layer with quota-safe fallback behavior
- Approved/published PDF export
- Stripe and PayPal foundation
- SMTP, Meta Pixel, and GTM foundation
- AI visuals prompts/images layer
- Beauty Assistant grounded on stored `cvReport`
- Admin review workspace
- Client dashboard

## Local Run Commands

Backend:

```powershell
cd "D:\AWS\AWS Projects\Facial AI Tejash\FaceAnalysis"
.\venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Frontend:

```powershell
cd "D:\AWS\AWS Projects\Facial AI Tejash\FaceAnalysis"
npm run dev
```

Open:

```text
http://localhost:3000
http://localhost:8000/api/health
```

If Next.js starts on `localhost:3001` because `3000` is busy, use that frontend URL. The backend `CORS_ORIGINS` must include the exact frontend origin.

## Quality Gate

Run before every deploy:

```powershell
.\venv\Scripts\python.exe -m compileall backend
npm run build
python scripts/smoke_test.py
```

## Browser QA

- Register/login user
- Admin login
- Upload valid front image and optional pose images
- Confirm report has deterministic `cvReport`
- Submit draft for review
- Admin reviews, edits narrative, approves, publishes
- Approved/published report PDF downloads
- Dashboard shows reports and payment records
- Beauty Assistant responds without inventing measurements
- AI Visuals shows prompt fallback when image credits are unavailable
- Billing page shows Stripe/PayPal configuration state

## External Services Still Requiring Live Credentials

- OpenAI billing/credits for live narrative, assistant, and image generation
- Stripe sandbox/live keys and webhook secret
- PayPal sandbox/live app credentials
- SMTP account credentials
- Meta Pixel ID
- Google Tag Manager ID

See `docs/SERVICE_SETUP.md` for setup details.

## Deployment

Use `docs/REPLIT_SETUP.md` for Replit import, secrets, run command, and post-deploy smoke tests.

## Safety Notes

- Do not commit `.env`, `.env.local`, or `backend/.env`.
- Rotate any credentials that were shared in chat or screenshots.
- Change local/default admin credentials before production handover.
- Keep `analysis.cvReport` immutable during AI/admin review; edit only narrative/review fields.
