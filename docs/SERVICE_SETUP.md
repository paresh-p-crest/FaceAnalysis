# AuraScan service setup

Use this when enabling third-party services locally, on Replit, or in production. Keep all secret values in environment variables only.

## Stripe

1. Open Stripe Dashboard -> Developers -> API keys.
2. Use sandbox/test mode first.
3. Copy a server-side secret key into `backend/.env`:

```env
STRIPE_SECRET_KEY=sk_test_...
```

4. In Stripe Dashboard -> Developers -> Webhooks, add endpoint:

```text
https://YOUR_BACKEND_URL/api/payments/stripe/webhook
```

5. Subscribe at least to:

```text
checkout.session.completed
checkout.session.expired
```

6. Copy the webhook signing secret:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

## PayPal

1. Go to PayPal Developer Dashboard -> Apps & Credentials.
2. Create a REST app in Sandbox.
3. Copy the Client ID and Secret:

```env
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
```

4. For live payments later, switch to live credentials and set:

```env
PAYPAL_ENV=live
```

## App URL

Set the public frontend URL used for payment redirects:

```env
PUBLIC_APP_URL=http://localhost:3000
```

Use the Replit or production frontend URL after deployment.

## Email / SMTP

Use any SMTP provider such as SendGrid, Mailgun, Gmail App Password, Amazon SES, or a hosting SMTP server.

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=no-reply@aurascan.local
SMTP_FROM_NAME=AuraScan
```

Leave these empty locally if email is not ready. The backend will report email as not configured instead of failing startup.

## Meta Pixel

1. Open Meta Events Manager.
2. Create/select a Pixel.
3. Copy the Pixel ID into frontend env:

```env
NEXT_PUBLIC_META_PIXEL_ID=
```

## Google Tag Manager

1. Go to `https://tagmanager.google.com`.
2. Create an account and Web container.
3. Copy the container ID, usually `GTM-XXXXXXX`, into frontend env:

```env
NEXT_PUBLIC_GTM_ID=
```

## Local retest

After changing env values, restart both servers:

```powershell
.\venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8000
npm run dev
```

Then check:

```text
http://localhost:8000/api/health
http://localhost:3000
```
