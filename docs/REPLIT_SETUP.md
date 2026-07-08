# Replit Deployment Runbook

AuraScan is now feature-complete through Sprint 13. Use this runbook for the final Sprint 14 Replit setup and handover.

## Local Preflight

Run these locally before pushing to GitHub/Replit:

```powershell
cd "D:\AWS\AWS Projects\Facial AI Tejash\FaceAnalysis"
.\venv\Scripts\python.exe -m compileall backend
npm run build
python scripts/smoke_test.py
```

Expected smoke result:

```text
[PASS] health - mongodb=connected
[PASS] login - role=admin
[PASS] my assessments - count=...
[PASS] my payments - count=...
[PASS] payment config - stripe=... paypal=...
[PASS] admin review guard - status=404 ...
```

## Replit Import

1. Push latest code to GitHub.
2. In Replit, create/import a project from the GitHub repo.
3. Pick a Node.js/Python-capable Replit environment.
4. Add the secrets below in Replit Secrets.
5. Open the Replit shell and install dependencies:

```bash
npm install
python -m pip install -r backend/requirements.txt
```

6. Click Run. `.replit` executes:

```bash
bash scripts/replit-start.sh
```

The script starts:

- FastAPI on `BACKEND_PORT` or `8000`
- Next.js on `PORT` or `3000`

## Required Secrets

```text
MONGODB_URI=mongodb+srv://USER:PASSWORD@HOST/aurascan?retryWrites=true&w=majority
AUTH_SECRET=long-random-secret
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=strong-admin-password
NEXT_PUBLIC_API_URL=https://YOUR-REPLIT-BACKEND-URL
PUBLIC_APP_URL=https://YOUR-REPLIT-FRONTEND-URL
CORS_ORIGINS=http://localhost:3000,https://YOUR-REPLIT-FRONTEND-URL
CORS_ORIGIN_REGEX=https://.*\.(replit\.dev|repl\.co)
PORT=3000
BACKEND_PORT=8000
```

Optional but needed for live integrations:

```text
OPENAI_API_KEY=sk-...
OPENAI_IMAGE_MODEL=gpt-image-1
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
SMTP_HOST=...
SMTP_PORT=587
SMTP_USERNAME=...
SMTP_PASSWORD=...
SMTP_USE_TLS=true
SMTP_FROM_EMAIL=no-reply@yourdomain.com
SMTP_FROM_NAME=AuraScan
NEXT_PUBLIC_META_PIXEL_ID=...
NEXT_PUBLIC_GTM_ID=...
```

## Replit URL Notes

- `NEXT_PUBLIC_API_URL` must be the browser-reachable FastAPI URL, not an internal-only host.
- `PUBLIC_APP_URL` must be the browser-reachable frontend URL.
- `CORS_ORIGINS` must include the frontend URL exactly.
- Keep `CORS_ORIGIN_REGEX` for Replit preview domains.
- Do not commit `.env`, `.env.local`, or `backend/.env`.

## Post-Deploy Smoke Test

In the Replit shell:

```bash
python scripts/smoke_test.py --base-url https://YOUR-REPLIT-BACKEND-URL
```

In the browser:

1. Open the frontend URL.
2. Sign in as admin.
3. Open Dashboard and confirm reports/payments load.
4. Run one assessment with valid demo photos.
5. Confirm MongoDB Atlas has a new `assessments` document.
6. Open History, click Review, save admin notes, approve, then publish.
7. Open the report and download PDF after approval/publish.
8. Test Beauty Assistant fallback response.
9. Test AI Visuals prompt fallback.
10. If service credentials are present, test Stripe/PayPal, SMTP test email, Meta Pixel, GTM, and OpenAI live output.

## Production Reminders

- Replace local admin credentials before client handover.
- Keep MongoDB Atlas IP access restricted for production if possible.
- Enable OpenAI billing before live narrative/image/assistant tests.
- Use payment sandbox before live mode.
- Keep MediaPipe/OpenCV measurements as the source of truth; AI content is narrative only.
