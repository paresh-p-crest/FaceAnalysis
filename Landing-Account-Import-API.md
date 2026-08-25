# MyFace Landing Account Import API & Password Setup Redirect

**Status:** In progress (proposal — endpoint and password-setup flow are not implemented yet)  
**Date:** 2026-08-25  
**Audience:** Landing site (`myface.de`) engineering and MyFace app implementers  
**Base URL:** `https://app.myface.de`  
**Scope:** Server-to-server customer/order import after a verified landing-page payment, plus browser password-setup redirect.

This is the **single canonical** document for the landing ↔ app integration. Do not maintain a second copy.

---

## Summary (implementers)

### Problem

Payment has moved from `app.myface.de` to `myface.de`. The landing-page backend must tell the MyFace app that a customer has paid and provide the account details needed to let that customer enter the app. The browser must not send payment credentials, integration secrets, or account-creation requests directly to the app.

### Approach

The landing backend verifies the payment with Stripe, then calls a new MyFace server-to-server endpoint with customer details, non-sensitive payment metadata, and a stable idempotency key (Stripe Checkout Session id). MyFace creates or reconciles the customer account (no password yet), records the external order for audit, and returns a short-lived one-time password-setup URL. The customer is redirected to that URL, sets a password immediately (**no** welcome / set-password email), is logged in automatically, and is sent to the dashboard.

No images or questionnaire answers are transferred by this API. The customer later starts the existing seven-pose facial-analysis flow inside `app.myface.de`.

### Code and data changes when implemented

- Add a protected import router under `/api/import`.
- Persist the paid order using the existing `payments` table (inert for in-app checkout; reused as an external-order ledger) with `provider = myface_landing` and a unique constraint on the import idempotency key (for example `provider_ref` plus `sourceSystem` in `raw`).
- Add a password-setup token flow separate from ordinary login and from forgot-password email. Reuse the existing one-time-token principles: store only a token hash, enforce expiry, and mark the token used atomically.
- Do not reactivate the removed Stripe/PayPal checkout router in the MyFace app.
- Add a public `/auth/setup?token=...` page and a public `POST /api/auth/set-password` endpoint that returns a normal app JWT.
- Keep public Sign up enabled until cutover; then disable it so accounts are created only after a paid import.

### Warnings and risks

- The current `users.password_hash` column is non-nullable. An imported account must therefore receive an unusable random placeholder hash until the customer sets a real password, or the schema must gain an explicit account-setup state.
- An existing MyFace user must never have their password overwritten by a payment import.
- A redirect URL containing a token can appear in browser history, proxy logs, or referral data. The setup page must consume it immediately, replace the URL, use `Referrer-Policy: no-referrer`, and avoid third-party scripts on that page.
- A successful payment and a failed app import are different states. The landing backend must retain a retryable pending/failed transfer record and must not redirect the customer to an account that was not confirmed by MyFace.
- Existing users can be sent to `https://app.myface.de/auth`. Direct automatic entry into `/dashboard` from `myface.de` requires a separate SSO or shared-cookie design; the current app stores its bearer session in browser storage.

---

## 1. Overview

Payment will happen on **myface.de** (landing page) only. After a verified checkout, the **landing-page backend** must tell the MyFace app that the customer has paid, so the app can create (or reconcile) the account and let the customer enter.

This integration has two parts:

1. **Server-to-server import API** — landing backend → `app.myface.de` (customer + order/payment metadata only)
2. **Browser redirect to password setup** — short-lived one-time URL on `app.myface.de` so the customer sets a password, is logged in, and lands on the dashboard

It can be used to:

- Provision accounts only after a successful checkout on `myface.de`
- Store non-sensitive order / payment metadata for audit (`provider = myface_landing`)
- Retry a failed import safely without creating duplicate users or orders
- Redirect new customers to password setup (no welcome / set-password email)
- Send returning customers who already have a password to normal login

**Important:**

- This API does **not** transfer photos, questionnaire answers, or start facial analysis.
- After password setup / login, the customer uses the existing in-app flow on `app.myface.de`: questionnaire → 7 poses → processing → admin review → report.
- The browser must **never** call the import endpoint or hold the import secret. Only the landing backend **server** calls the import API, after Stripe has confirmed payment.

---

## 2. End-to-End Flow

```text
myface.de checkout
        ↓
Stripe webhook verified (landing backend)
        ↓
POST /api/import/myface-session  (server → server)
        ↓
2xx success?
   ├─ No  → keep customer on landing retry page (pending/failed)
   └─ Yes →
         ├─ passwordSetup.required = true
         │     → redirect browser to /auth/setup?token=…
         │     → customer sets password
         │     → app logs them in → /dashboard
         └─ passwordSetup.required = false
               → send customer to /auth (normal login)
```

Local transfer status on the landing side:

```text
pending → sent
       ↘ failed → retryable
```

---

## 3. Import Endpoint Details

| Item | Value |
| --- | --- |
| Method | `POST` |
| Endpoint | `/api/import/myface-session` |
| Base URL | `https://app.myface.de` |
| Full URL | `https://app.myface.de/api/import/myface-session` |
| Content-Type | `application/json` |

In this version, `myface-session` means the verified landing-page checkout / customer session. The request does **not** contain images and does **not** create a facial-analysis assessment. The endpoint name preserves the earlier integration proposal.

### Required headers

| Header | Required | Description |
| --- | --- | --- |
| `Authorization` | Yes | `Bearer <server-only-myface-import-secret>` — shared secret in Replit Secrets / env on **both** deployments. Never in React or browser code. |
| `Idempotency-Key` | Yes | **Must be the Stripe Checkout Session id** (`cs_…` or `cs_test_…`). Non-empty, 1–128 characters. Identical on every retry of the same paid checkout. Must match `payment.checkoutSessionId` in the body. Mismatch → `400`. |
| `Content-Type` | Yes | `application/json` |

### Idempotency key = Stripe Checkout Session id

Use the Checkout Session id from `checkout.session.completed` (after `payment_status` is `paid`) as both:

- HTTP header `Idempotency-Key`
- JSON field `payment.checkoutSessionId`

| Use this | Do not use |
| --- | --- |
| `cs_…` / `cs_test_…` (Checkout Session id) | Email |
| | `cus_…` (Stripe Customer — person, many checkouts) |
| | `evt_…` (Stripe Event id — fine for *landing* webhook dedupe, not for this import key) |
| | Landing person / user id |

### Idempotency rules

| Situation | Result |
| --- | --- |
| First accepted request | One import/payment record, one user/order association, at most one active setup token |
| Same key + same body (retry) | Same user and order; may return the same unused setup URL, or a replacement if the token expired/was used |
| Same key + **different** body | `409 Conflict` — no account change |
| New key (new purchase) | New payment record; same email → same MyFace user |
| Email already registered | Attach order; `created: false`; **never** overwrite password |

The target compares the secret safely and applies normal request rate limiting.

---

## 4. Request Body Fields

### Required vs optional (Postgres mapping)

| Postgres target | Filled from | Notes |
| --- | --- | --- |
| `users.email` | `customer.email` | Required for login / account match |
| `users.first_name` / `last_name` | `customer.firstName` / `lastName` | Optional; stored as `""` if omitted |
| `users.password_hash` | *(server)* | Placeholder until `/auth/setup`; not sent by landing |
| `payments.user_id` | *(server)* | From created/found user |
| `payments.provider` | fixed `myface_landing` | Server may set this even if omitted in body |
| `payments.provider_ref` | `Idempotency-Key` / `payment.checkoutSessionId` | Unique paid-checkout key |
| `payments.amount_cents` | `order.amountCents` | Required |
| `payments.currency` | `order.currency` | Required |
| `payments.plan_id` | `order.productId` | Required |
| `payments.status` | `payment.status` | Must be `paid` |
| `payments.assessment_id` | — | Left `null` at import |
| `payments.checkout_url` | — | Left `null` (not used for landing import) |
| `payments.raw` (JSONB) | remaining metadata | `orderNumber`, Stripe ids, `sourceCustomerId`, `paidAt`, `locale`, etc. |

No extra request fields are required beyond the table below to write valid `users` + `payments` rows. Password hash, `payments.user_id`, timestamps, and `assessment_id = null` are set by the server.

### Field list

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `sourceSystem` | string | Optional | Default `myface.de` if omitted. If sent, must be allowlisted `myface.de`. |
| `sourceCustomerId` | string | Optional | Landing DB customer / user id, if you have one. Preferred when available. Omit if you do not have a stable person id. Do **not** use email, `cs_…`, or `pi_…`. See §14. |
| `sourceSessionId` | string | Optional | Your own checkout/session reference if different from Stripe. If omitted, the app may treat `payment.checkoutSessionId` as the session reference. |
| `order.orderNumber` | string | Optional | Human-readable order reference for support; stored in payment metadata (`payments.raw`) when supplied. |
| `order.productId` | string | Yes | Product or plan id → `payments.plan_id` (e.g. `myface_report`). |
| `order.currency` | string | Yes | ISO-4217 currency → `payments.currency` (e.g. `EUR`); app normalizes consistently. |
| `order.amountCents` | integer | Yes | Integer cents → `payments.amount_cents` (e.g. `4990` = €49.90). No floats. |
| `customer.email` | string | Yes | Normalized and validated → `users.email` (MyFace login). |
| `customer.firstName` | string | Optional | → `users.first_name` when supplied; empty allowed. |
| `customer.lastName` | string | Optional | → `users.last_name` when supplied; empty allowed. |
| `customer.locale` | string | Optional | `de` or `en`; defaults to app default (`de`). Stored in metadata only (no locale column on `users`). |
| `payment.provider` | string | Optional | If sent, must be `myface_landing`. App stores `payments.provider = myface_landing` either way. |
| `payment.status` | string | Yes | Only `paid` is accepted → `payments.status`. Call only after your webhook has verified payment. |
| `payment.checkoutSessionId` | string | Yes | Stripe Checkout Session id (`cs_…`). **Must equal** the `Idempotency-Key` header → `payments.provider_ref`. |
| `payment.paymentIntentId` | string | Optional | Stripe PaymentIntent id (`pi_…`); stored in metadata when supplied. |
| `payment.stripeCustomerId` | string | Yes | Stripe Customer id (`cus_…`). Missing/empty → `400`. Create/reuse a Stripe Customer before Checkout. Stored in metadata for reconciliation. Not a substitute for a landing `sourceCustomerId` when that exists. |
| `payment.paidAt` | string | Optional | ISO-8601 paid timestamp; stored in metadata. If omitted, the app may record import time. |

### Do not send

- Card numbers, CVC, or full Stripe customer/payment objects
- Stripe secret keys or raw webhook signatures
- Images or questionnaire answers
- The import bearer secret in any browser request

### Where the app stores the order

One row in MyFace `payments` with:

- `provider = myface_landing`
- amount / currency / plan from `order.*`
- `provider_ref` (or equivalent) keyed by the import idempotency key for retries
- Stripe ids, order number, optional `sourceCustomerId`, `paidAt`, etc. in structured metadata / `raw`

---

## 5. Sample Import Request

```http
POST /api/import/myface-session HTTP/1.1
Host: app.myface.de
Authorization: Bearer <server-only-myface-import-secret>
Idempotency-Key: cs_123456789
Content-Type: application/json
```

```json
{
  "sourceSystem": "myface.de",
  "sourceCustomerId": "mf_cust_123456789",
  "sourceSessionId": "cs_123456789",
  "order": {
    "orderNumber": "MF-2026-000123",
    "productId": "myface_report",
    "currency": "EUR",
    "amountCents": 4990
  },
  "customer": {
    "email": "customer@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "locale": "de"
  },
  "payment": {
    "provider": "myface_landing",
    "status": "paid",
    "checkoutSessionId": "cs_123456789",
    "paymentIntentId": "pi_123456789",
    "stripeCustomerId": "cus_123456789",
    "paidAt": "2026-08-25T10:30:00Z"
  }
}
```

`sourceCustomerId` may be omitted while its use is still undecided (see §14). Optional fields may be omitted; all **Yes** fields must be present.

### Example (curl)

```bash
curl --request POST "https://app.myface.de/api/import/myface-session" \
  --header "Authorization: Bearer <server-only-myface-import-secret>" \
  --header "Idempotency-Key: cs_123456789" \
  --header "Content-Type: application/json" \
  --data-raw '{
  "sourceSystem": "myface.de",
  "sourceCustomerId": "mf_cust_123456789",
  "sourceSessionId": "cs_123456789",
  "order": {
    "orderNumber": "MF-2026-000123",
    "productId": "myface_report",
    "currency": "EUR",
    "amountCents": 4990
  },
  "customer": {
    "email": "customer@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "locale": "de"
  },
  "payment": {
    "provider": "myface_landing",
    "status": "paid",
    "checkoutSessionId": "cs_123456789",
    "paymentIntentId": "pi_123456789",
    "stripeCustomerId": "cus_123456789",
    "paidAt": "2026-08-25T10:30:00Z"
  }
}'
```

Optional availability check: `GET https://app.myface.de/api/health`

---

## 6. Import Response — New Customer

**Status:** `201 Created`

```json
{
  "success": true,
  "status": "created",
  "user": {
    "id": "60c72b2f-9b1d-4e8d-9256-8cf2001abcde",
    "email": "customer@example.com",
    "created": true
  },
  "order": {
    "orderNumber": "MF-2026-000123",
    "status": "paid"
  },
  "passwordSetup": {
    "required": true,
    "redirectToken": "short-lived-random-token",
    "expiresAt": "2026-08-25T10:45:00Z",
    "redirectUrl": "https://app.myface.de/auth/setup?token=short-lived-random-token"
  }
}
```

- Redirect the browser to `passwordSetup.redirectUrl` **only** after this successful response.
- The raw `redirectToken` is returned only so the landing backend can build/redirect the customer.
- MyFace stores **only a hash** of the token (never the raw token at rest).

---

## 7. Import Response — Existing Customer

### Already has a usable password

**Status:** `200 OK`

```json
{
  "success": true,
  "status": "already_registered",
  "user": {
    "id": "60c72b2f-9b1d-4e8d-9256-8cf2001abcde",
    "email": "customer@example.com",
    "created": false
  },
  "order": {
    "orderNumber": "MF-2026-000123",
    "status": "paid"
  },
  "passwordSetup": {
    "required": false
  },
  "loginUrl": "https://app.myface.de/auth"
}
```

Send the customer to `loginUrl`. Do **not** send them to `/dashboard` unless they are already logged into the app in that browser (there is no shared SSO cookie between sites in this version).

### Exists but password setup never finished

Same shape as §6: `passwordSetup.required: true` plus a newly issued setup URL. Existing passwords are **never** overwritten by a payment import.

A second purchase for the same email attaches another paid order to the same user.

### Idempotent retry behavior (detail)

- First accepted request creates one import/payment record, one user/order association, and at most one active setup token.
- Repeating the same request with the same idempotency key returns the same user and order association.
- If the original setup token is still valid and unused, the target may return the same setup URL.
- If the original token has expired or has already been consumed, the target issues a replacement setup token while keeping the import itself idempotent.
- Same key plus a changed customer/order/payment payload returns `409 Conflict` and does not modify the account.
- Email already registered: attach the order to that user; `created: false`; never overwrite password.

---

## 8. Password Setup Redirect Page

This is the page the landing site redirects to after a successful import when setup is required.

### Browser route

| Item | Value |
| --- | --- |
| Method | `GET` |
| URL | `https://app.myface.de/auth/setup?token=<redirect-token>` |
| Auth | Public (token in query string) |

Example:

```text
https://app.myface.de/auth/setup?token=short-lived-random-token
```

### What the page does

| Behaviour | Detail |
| --- | --- |
| Purpose | Dedicated password-creation page for newly imported paid customers |
| Separate from | Ordinary `/auth` sign-in and from email-based forgot-password |
| Form | Password (and confirm) only — **no email field** on this page |
| Email | Customer does **not** need a welcome / set-password email |
| After success | App stores the normal MyFace session and navigates to `/dashboard` |
| After dashboard | Customer starts analysis in-app (questionnaire, seven photos, preparing, admin review) |

### Token rules

| Rule | Detail |
| --- | --- |
| Lifetime | Short-lived; expiry returned as `passwordSetup.expiresAt` |
| One-time use | Consumed atomically on successful password set |
| Retry of import | If token still valid and unused, same setup URL may be returned; if expired or already used, a replacement token is issued while the import stays idempotent |
| Invalid / expired / reused | Cannot set a password; customer sees a generic error and should use landing retry or contact support / normal forgot-password later if applicable |
| Storage on MyFace | Hash only; raw token only in the redirect URL response |

### Security notes for the redirect URL

A URL containing a token can appear in browser history, proxy logs, or `Referer` data. The setup page on MyFace will:

- Consume / validate the token on load and after submit
- Replace the URL (strip the token from the address bar) after the page loads
- Use `Referrer-Policy: no-referrer` on this page
- Avoid third-party scripts on this page

Landing side: prefer a server-driven redirect (302/303) to `redirectUrl` rather than putting the token into client-side logs or analytics.

### When **not** to redirect here

- Import returned timeout, `5xx`, or malformed body → stay on landing confirmation / retry
- `passwordSetup.required = false` → use `loginUrl` (`https://app.myface.de/auth`) instead
- Never invent a setup URL or reuse an old token from a previous order without a fresh import response

---

## 9. Complete Password Setup API

Called by the **browser** on the setup page (not by the landing backend).

| Item | Value |
| --- | --- |
| Method | `POST` |
| Endpoint | `/api/auth/set-password` |
| Full URL | `https://app.myface.de/api/auth/set-password` |
| Auth | Public (setup token in JSON body) |
| Content-Type | `application/json` |

### Request

```json
{
  "token": "short-lived-random-token",
  "newPassword": "at-least-eight-characters"
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `token` | Yes | Same opaque token from `passwordSetup.redirectToken` / query string |
| `newPassword` | Yes | Minimum 8 characters |

### Success response

```json
{
  "ok": true,
  "token": "<normal-myface-access-token>",
  "user": {
    "id": "60c72b2f-9b1d-4e8d-9256-8cf2001abcde",
    "email": "customer@example.com",
    "role": "user"
  },
  "redirectTo": "/dashboard"
}
```

| Field | Meaning |
| --- | --- |
| `token` | Normal MyFace app JWT / session token (not the one-time setup token) |
| `redirectTo` | In-app path after setup (`/dashboard`) |

The frontend stores the session and navigates to the dashboard. The one-time setup token is marked used and cannot be reused. From there the customer uses the existing analysis flow (questionnaire, seven photos, preparing, admin review).

### Setup / set-password errors

| Status | Meaning |
| --- | --- |
| `400` | Validation error, or invalid / expired / already-used setup token (generic message) |
| `429` | Rate limited |

---

## 10. Recommended Landing Behaviour (Checklist)

1. Verify the Stripe webhook and commit the paid order + customer locally.
2. Call `POST /api/import/myface-session` with the same `Idempotency-Key` on every retry.
3. Only a validated `2xx` with `success: true` permits leaving the confirmation page:
   - `passwordSetup.required === true` → redirect to `passwordSetup.redirectUrl`
   - else → `loginUrl` (`https://app.myface.de/auth`)
4. Timeout, `5xx`, or malformed success → keep customer on confirmation / retry; mark transfer `failed`.
5. Later retry must not create another MyFace user or duplicate order association (same key + body).
6. Site-wide **Login** on `myface.de` → `https://app.myface.de/auth` (not `/dashboard`) until SSO exists.
7. Public Sign up on the app stays available for testing until cutover; then it is removed so accounts are created only after a successful payment import.

Existing customers should use a normal link to `https://app.myface.de/auth`. Sending every existing customer directly to `/dashboard` is only safe if the two sites share a deliberate SSO session; the current app does not have that cross-site browser-session contract.

---

## 11. Error Handling (Import API)

| Status | Meaning |
| --- | --- |
| `200` | Success — existing user reconciled |
| `201` | Success — new user created |
| `400` | Validation error (missing/invalid fields, e.g. empty `stripeCustomerId`, `status` not `paid`, Idempotency-Key ≠ `checkoutSessionId`) |
| `401` | Missing or invalid import bearer secret |
| `409` | Same `Idempotency-Key` with a different request body |
| `429` | Rate limited |
| `5xx` | Temporary server error — retry with the same key and body |

A successful payment on Stripe and a failed app import are **different** states. Keep the landing transfer retryable; do not redirect to a missing or incomplete MyFace account.

---

## 12. Product Rules (Locked)

| Topic | Rule |
| --- | --- |
| Where payment lives | Checkout stays on `myface.de`. App does not run Stripe Checkout. |
| What import creates | User account (placeholder password until setup) + payment/order metadata only |
| Login identity | Email creates or matches the MyFace user |
| Person vs payment ids | `cs_…` = one paid Checkout (and our Idempotency-Key); `pi_…` = PaymentIntent metadata; `cus_…` = required Stripe customer; landing `sourceCustomerId` = optional/undecided person id |
| Idempotency-Key | Stripe Checkout Session id only — not email, `cus_…`, `evt_…`, or person id |
| Analysis | Entirely inside `app.myface.de` after login |
| Report visibility | Unchanged: full report after **admin approval** (preparing / waiting UI until then). This API does not start analysis or change readiness policy. |
| Email for setup | **No** welcome / set-password email; browser redirect to setup URL |
| Payment storage | MyFace `payments` with `provider = myface_landing` |
| Existing password | Never overwritten by import |
| Public Sign up on app | Remains for testing until cutover; then removed |

---

## 13. Acceptance Criteria

- A verified paid checkout creates exactly one MyFace account on the first request for a new email.
- Retrying the same paid checkout with the same idempotency key does not create another account or order.
- Reusing the key with changed data is rejected (`409`).
- No browser request contains the server-only import secret.
- A new customer reaches the password form directly through the one-time setup URL (no email required).
- Setting the password logs the customer into the normal MyFace session and opens `/dashboard`.
- A used, expired, or malformed setup token cannot set a password.
- An existing customer's password is never overwritten by a payment import.
- MyFace outage leaves the landing order recorded and retryable without redirecting to a missing account.
- The imported payment is available for audit without reintroducing in-app Stripe checkout.
- Report visibility remains admin-approved.

---

## 14. Open Questions for Landing Team

Please confirm:

1. **`sourceCustomerId`** — Do you store a stable customer / user id in your own database?  
   - If **yes**: send it on every import (helps link repeat purchases without relying only on email).  
   - If **no**: omit the field; we match on email + required `stripeCustomerId` for now.  
   **Status: undecided**

2. **`payment.stripeCustomerId`** — Can you always create/reuse a Stripe Customer (`cus_…`) before Checkout and send that id? (Required on our side.)

3. **Checkout Sessions** — Confirm you use Stripe Checkout and can send the Session id (`cs_…`) as both `Idempotency-Key` and `payment.checkoutSessionId` after `checkout.session.completed` with `payment_status = paid`.

4. **Login link** — Is it acceptable for “Login” on `myface.de` to open `https://app.myface.de/auth` until shared SSO exists?

5. **Secret exchange** — Preferred channel to share the server-only import bearer secret for both Replit (or production) deployments?

---

## 15. Typical Use Cases

- After a successful Stripe payment, create the MyFace account and hand the customer off to `/auth/setup`
- Retry a failed import without duplicating the user or order
- Attach a second purchase to an existing MyFace email without resetting their password
- Keep the customer on the landing site when `app.myface.de` is unavailable
- Operational support: reconcile by `orderNumber`, `checkoutSessionId`, or `stripeCustomerId`

---

## 16. Out of Scope (This Version)

- Uploading the 7 pose images or questionnaire from the landing site
- Starting the analysis pipeline from this API
- Changing admin review or report unlock rules
- Cross-site auto-login into `/dashboard` without password setup / normal login
- In-app Stripe or PayPal checkout on `app.myface.de`
- Welcome / set-password email as the primary handoff (redirect replaces it)
