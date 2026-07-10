<!-- Migrated from docs/MONGODB_SETUP.md, docs/REPLIT_SETUP.md, docs/SERVICE_SETUP.md, and docs/HANDOVER_CHECKLIST.md -->
# Standard Operating Procedures (SOP)

This document contains standard step-by-step procedures for local environment setup, testing, external service integrations, and production deployment on Replit.

---

## 1. Local Environment Setup

### Prerequisites
- Node.js (v18+)
- Python (v3.10 to v3.12)
- MongoDB Atlas cluster (free tier M0 is sufficient)

### Steps
1. **Clone the Repository**
2. **Frontend Setup:**
   ```powershell
   npm install
   ```
3. **Backend Setup:**
   ```powershell
   cd backend
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   
   pip install -r requirements.txt
   ```
4. **Environment Configuration:**
   - Copy `.env.example` to `.env` in the **project root** (single file for backend + Next.js).
   - Set `MONGODB_URI`, `AUTH_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.
   - Set `NEXT_PUBLIC_API_URL=http://localhost:8000` so the frontend calls the FastAPI backend.
   - For AI narratives/protocol: set `LLM_PROVIDER=groq` + `GROQ_API_KEY`, or `LLM_PROVIDER=openai` + `OPENAI_API_KEY`. AI visuals require `OPENAI_API_KEY` regardless of text provider.

---

## 2. Running Locally

Start both servers locally:
```powershell
# Backend (FastAPI)
.\venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload

# Frontend (Next.js)
npm run dev
```

Verify service is up by accessing:
- Frontend: `http://localhost:3000`
- Backend health check: `http://localhost:8000/api/health` (verify that `"mongodb": "connected"` is reported).

---

## 3. QA Preflight Checklist (Run Before Every Deploy)
Run these commands locally to prevent compiling or runtime regression errors:
```powershell
# Check Python files compilation
.\venv\Scripts\python.exe -m compileall backend

# Build frontend production bundle
npm run build

# Execute smoke test script
python scripts/smoke_test.py
```

Expected output from the smoke test script:
```text
[PASS] health - mongodb=connected
[PASS] login - role=admin
[PASS] my assessments - count=...
[PASS] my payments - count=...
[PASS] payment config - stripe=... paypal=...
[PASS] admin review guard - status=404 ...
```

---

## 4. Replit Deployment Guide

1. **GitHub Setup:** Push the verified code to your repository.
2. **Import to Replit:** Create a new project in Replit by importing your GitHub repository.
3. **Configure Secrets:** Open the **Secrets** tool in Replit and add:
   ```text
   MONGODB_URI=mongodb+srv://USER:PASSWORD@HOST/myface?retryWrites=true&w=majority
   AUTH_SECRET=long-random-secret-key
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=strong-admin-password
   NEXT_PUBLIC_API_URL=https://YOUR-REPLIT-BACKEND-URL
   PUBLIC_APP_URL=https://YOUR-REPLIT-FRONTEND-URL
   CORS_ORIGINS=http://localhost:3000,https://YOUR-REPLIT-FRONTEND-URL
   CORS_ORIGIN_REGEX=https://.*\.(replit\.dev|repl\.co)
   PORT=3000
   BACKEND_PORT=8000
   ```
4. **Install Packages in Replit Shell:**
   ```bash
   npm install
   python -m pip install -r backend/requirements.txt
   ```
5. **Run the Project:** Click **Run**. Replit will read `.replit` and execute `bash scripts/replit-start.sh` to start FastAPI and Next.js concurrently.
6. **Verify Replit Deploy:** Run the smoke tests against the public backend:
   ```bash
   python scripts/smoke_test.py --base-url https://YOUR-REPLIT-BACKEND-URL
   ```

---

## 5. Third-Party Integrations Setup

### Stripe Checkout
1. Go to Stripe Developer Dashboard and copy your sandbox API Secret Key.
2. Set in backend environment variables:
   ```env
   STRIPE_SECRET_KEY=sk_test_...
   ```
3. Set up a Webhook in Stripe for `checkout.session.completed` pointing to:
   `https://YOUR_BACKEND_URL/api/payments/stripe/webhook`
4. Copy the signing secret into backend env:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

### PayPal Orders
1. Go to PayPal Developer dashboard -> Apps & Credentials.
2. Create REST app in sandbox, and copy credentials to backend env:
   ```env
   PAYPAL_ENV=sandbox
   PAYPAL_CLIENT_ID=...
   PAYPAL_CLIENT_SECRET=...
   ```
3. Change `PAYPAL_ENV=live` when swapping to production.

### SMTP Email Alerts
To enable email notifications, configure:
```env
SMTP_HOST=smtp.mailprovider.com
SMTP_PORT=587
SMTP_USERNAME=your-username
SMTP_PASSWORD=your-password
SMTP_FROM_EMAIL=no-reply@yourdomain.com
SMTP_FROM_NAME=MyFace
```

### Meta Pixel & Google Tag Manager
Add container IDs to the frontend environment keys:
```env
NEXT_PUBLIC_META_PIXEL_ID=your-pixel-id
NEXT_PUBLIC_GTM_ID=your-gtm-container-id
```
These scripts will load dynamically on the frontend when loaded with active IDs.
