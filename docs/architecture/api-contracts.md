# API Contracts (Implemented Endpoints)

The Python FastAPI backend exposes these endpoints. All REST responses are in JSON unless specified otherwise. Private endpoints require authentication via a Bearer token in the `Authorization` header (`Authorization: Bearer <token>`).

---

## Authentication Domain

### `POST /api/auth/register`
Creates a new client account.
- **Auth:** None
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "strong-password-here"
  }
  ```
- **Response Shape (200 OK):**
  ```json
  {
    "token": "eyJhbGciOi...",
    "user": {
      "id": "60c72b2f9b1d8e2568cf2001",
      "email": "user@example.com",
      "role": "user"
    }
  }
  ```

### `POST /api/auth/login`
Authenticates a user and returns a token session.
- **Auth:** None
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "strong-password-here"
  }
  ```
- **Response Shape (200 OK):**
  ```json
  {
    "token": "eyJhbGciOi...",
    "user": {
      "id": "60c72b2f9b1d8e2568cf2001",
      "email": "user@example.com",
      "role": "user"
    }
  }
  ```

### `GET /api/auth/me`
Retrieves current user info from token context.
- **Auth:** Private (User)
- **Response Shape (200 OK):**
  ```json
  {
    "id": "60c72b2f9b1d8e2568cf2001",
    "email": "user@example.com",
    "role": "user"
  }
  ```

### `GET /api/auth/admin-check`
Validates that the token holder has admin privilege.
- **Auth:** Private (Admin)
- **Response Shape (200 OK):**
  ```json
  {
    "admin": true
  }
  ```

### `GET /api/auth/users`
Lists all registered users.
- **Auth:** Private (Admin)
- **Response Shape (200 OK):**
  ```json
  [
    {
      "id": "60c72b2f9b1d8e2568cf2001",
      "email": "user@example.com",
      "role": "user",
      "createdAt": "2026-07-01T12:00:00Z"
    }
  ]
  ```

### `DELETE /api/auth/users/{user_id}`
Deletes a user account.
- **Auth:** Private (Admin)
- **Response Shape (200 OK):**
  ```json
  {
    "ok": true,
    "message": "User deleted successfully"
  }
  ```

---

## Assessments & Face Analysis Domain

### `POST /api/assessments`
Main analysis entrypoint: parses image landmarks and saves the results in MongoDB.
- **Auth:** Private (paid user or admin)
- **Required photos:** All 7 poses must be present in `photos` (base64 map): `front`, `leftProfile`, `rightProfile`, `left45`, `right45`, `smile`, `topHead`. Returns **400** with `Missing required photo poses: ...` if any are absent.
- **Request Body:**
  ```json
  {
    "imageBase64": "data:image/jpeg;base64,...",
    "answers": {
      "gender": "male",
      "age": 28
    },
    "photos": {},
    "photos": {
      "front": { "poseId": "front", "publicUrl": "/uploads/assessments/abc/front.jpg", "byteSize": 245000 }
    },
    "provider": "local",
    "scanId": "unique-uuid-here"
  }
  ```
- **`provider`:** Must be `"local"` for full MediaPipe + OpenCV analysis (`cvReport` + `eyeAnalysis`). Legacy `"openai"` values are accepted but normalized to `"local"`. `"aws"` is rejected by the backend.
- **Response Shape (200 OK):**
  ```json
  {
    "assessmentId": "60c72b2f9b1d8e2568cf2002",
    "status": "Pending Review",
    "createdAt": "2026-07-08T12:00:00Z",
    "photos": {
      "front": { "poseId": "front", "publicUrl": "/uploads/assessments/abc/front.jpg" }
    },
    "aiNarrative": { "source": "openai", "model": "...", "content": { "summary": "..." } },
    "protocolData": { "summary": "...", "recommendations": [] },
    "protocolNarrative": { "summary": "...", "features": {}, "closing": [] },
    "featureNarratives": {},
    "protocolStorage": { "publicUrl": "/uploads/assessments/{id}/protocol.json" },
    "analysis": {
      "cvReport": {
        "photos": { "front": "/uploads/assessments/abc/front.jpg" },
        "meta": { "pipelineVersion": "2.0.0", "posesAnalyzed": ["front"], "posesStored": ["front"] }
      }
    }
  }
  ```
- **Pipeline:** After CV analysis + photo storage, the same request runs one-shot NL enrichment (`aiNarrative` + protocol/feature narratives). When `LLM_PROVIDER=openai`, feature narratives also receive mapped pose photos (OpenAI Vision enrichment; see `FEATURE_VISION_POSES`). Report open only loads stored content; it does not regenerate.

### `POST /api/run-analysis`
Runs quick mathematical analysis without saving to MongoDB database.
- **Auth:** None
- **Request Body:** Same as `POST /api/assessments` (minus `scanId`).
- **Response Shape (200 OK):** Raw CV analysis results dict.

### `GET /api/assessments/{assessment_id}`
Retrieves a detailed assessment object by ID.
- **Auth:** Owner User or Admin (anonymous reports are open)
- **Response Shape (200 OK):** Full assessment document JSON.

### `GET /api/assessments`
Lists recent assessments for the admin panel (summary projection only).
- **Auth:** Private (Admin)
- **Query:** `limit` (max 100)
- **Response Shape (200 OK):** `{ "items": [...] }` where each item includes `id`, `userId`, `status`, `provider`, `scanId`, `createdAt`, and pruned `analysis` score fields only (no photos, narratives, protocol blobs, or cvReport image data). Use `GET /api/assessments/{id}` for full detail.

### `GET /api/my/assessments`
Lists assessment history belonging to current user context (summary projection only).
- **Auth:** Private (User)
- **Query:** `limit` (max 100)
- **Response Shape (200 OK):**
  ```json
  {
    "items": [
      {
        "id": "60c72b2f9b1d8e2568cf2002",
        "createdAt": "2026-07-08T12:00:00Z",
        "status": "Approved",
        "provider": "local",
        "analysis": {
          "cvReport": { "overall": { "score": 81 } },
          "metrics": { "harmonyScore": 81 }
        }
      }
    ]
  }
  ```

### `DELETE /api/assessments/{assessment_id}`
Deletes specific assessment.
- **Auth:** Owner User or Admin
- **Response Shape (200 OK):**
  ```json
  {
    "ok": true
  }
  ```

### `PATCH /api/assessments/{assessment_id}/status`
Updates assessment status (e.g. submitting for review).
- **Auth:** Owner User or Admin
- **Request Body:**
  ```json
  {
    "status": "Pending Review"
  }
  ```
- **Response Shape (200 OK):** Updated assessment summary. `status` is returned as a display label (`Pending Review`, `Approved`).

### `PATCH /api/assessments/{assessment_id}/admin-review`
Saves admin review comments, alters client narrative text, and/or publishes reports.
- **Auth:** Private (Admin)
- **Request Body:**
  ```json
  {
    "status": "Approved",
    "adminNotes": "Admin notes...",
    "aiNarrative": {
      "content": "Updated client narrative here..."
    }
  }
  ```
- **Response Shape (200 OK):** Complete updated assessment document.

### `POST /api/assessments/{assessment_id}/ai-narrative`
Returns stored executive narrative, or generates once if missing. Prefer pipeline enrichment on `POST /api/assessments`.
- **Auth:** Owner User or Admin
- **Query:** `force=true` — admin-only regenerate (used by Admin Review panel)
- **Response Shape (200 OK):** Updated assessment with `aiNarrative`.

### `GET /api/assessments/{assessment_id}/protocol`
Loads persisted protocol from storage (`public/uploads/assessments/{id}/protocol.json` locally) with MongoDB fallback.
- **Auth:** Owner User or Admin
- **Response Shape (200 OK):**
  ```json
  {
    "protocolData": { "summary": "...", "recommendations": [] },
    "protocolNarrative": { "summary": "...", "features": {}, "closing": [] },
    "featureNarratives": { "hair": { "measuredFacts": [], "subsections": [] } },
    "protocolStorage": { "publicUrl": "/uploads/assessments/{id}/protocol.json" },
    "source": "storage"
  }
  ```
- **404:** Protocol not yet generated.

### `POST /api/assessments/{assessment_id}/ai-protocol`
Generates protocol via `narrative_orchestrator` (10 per-feature structured LLM calls + guardrails), writes JSON to protocol storage, and syncs `protocolData`, `featureNarratives`, and `protocolNarrative` to MongoDB.
- **Auth:** Owner User or Admin
- **Response Shape (200 OK):** Updated assessment document (idempotent if already stored).

### `POST /api/assessments/{assessment_id}/ai-visuals`
Triggers hairstyle, outfit, and healthy-aging visual variants via OpenAI Images Edits (`OPENAI_IMAGE_MODEL`, default `gpt-image-1`).
- **Auth:** Owner User or Admin (paid AI access)
- **Source image:** Prefers stored front pose file (`public/uploads/assessments/{id}/front.jpg`), then `assessment.photos.front`, then `cvReport` image refs (data URL or `/uploads/...` path). Never base64-decodes public URLs.
- **Request Body:**
  ```json
  {
    "variants": ["hair", "outfit", "aging"]
  }
  ```
- **Response Shape (200 OK):** Updated assessment with `aiVisuals` (`source`, `model`, `sourceKind`, `variants[]` with `prompt`, `imageSrc`, `status`, `error`). Failed edits return `status: "blocked"` per variant instead of crashing the request.

### `GET /api/assessments/{assessment_id}/pdf`
Retrieves generated PDF bytes directly.
- **Auth:** Owner User or Admin (Status must be `approved` or `published`).
- **Response:** PDF binary download stream (`application/pdf`).

### `POST /api/generate-pdf`
Builds PDF binary from input Markdown text and options.
- **Auth:** None
- **Request Body:**
  ```json
  {
    "reportMarkdown": "# Report Summary...",
    "reportData": {}
  }
  ```
- **Response Shape (200 OK):**
  ```json
  {
    "pdfBase64": "JVBERi...",
    "contentType": "application/pdf"
  }
  ```

---

## Beauty Assistant Chat Domain

### `GET /api/assessments/{assessment_id}/assistant`
Fetches historical messages exchanged in the assessment assistant session.
- **Auth:** Owner User or Admin
- **Response Shape (200 OK):** Conversation object with `messages`, optional `sessionSummary`.

### `POST /api/assessments/{assessment_id}/assistant`
Sends a message to the Beauty Assistant (ReAct agent with report tools; max 3 tool rounds per reply).
- **Auth:** Owner User or Admin
- **Rate limit:** 20 messages/user/hour (`429` when exceeded)
- **Request Body:**
  ```json
  {
    "message": "What should I focus on for skin quality?"
  }
  ```
- **Response Shape (200 OK):** Updated conversation with appended `messages` (`max_tokens` 1000).
- **503:** LLM/provider failure — `{ "detail": { "code": "ASSISTANT_UNAVAILABLE", "message": "Beauty Assistant is not working right now. Please try again later." } }`. No fake template reply is stored.

---

## Payments Domain

### `GET /api/payments/config`
Check which payment gateways are configured on the backend.
- **Auth:** None
- **Response Shape (200 OK):**
  ```json
  {
    "stripe": { "configured": true },
    "paypal": { "configured": false }
  }
  ```

### `GET /api/payments/my`
Retrieves billing transaction list for logged-in user.
- **Auth:** Private (User)
- **Response Shape (200 OK):** List of payment transaction records.

### `POST /api/payments/stripe/checkout`
Builds Stripe payment checkout portal.
- **Auth:** Private (User)
- **Request Body:**
  ```json
  {
    "assessmentId": "60c72b2f9b1d8e2568cf2002"
  }
  ```
- **Response Shape (200 OK):**
  ```json
  {
    "sessionId": "cs_test_...",
    "checkoutUrl": "https://checkout.stripe.com/..."
  }
  ```

### `POST /api/payments/stripe/webhook`
Listens to Stripe API callback hooks.
- **Auth:** None (secured via signing secret check)
- **Response Shape (200 OK):** `{"ok": true}`

### `POST /api/payments/paypal/orders`
Initiates PayPal transaction process.
- **Auth:** Private (User)
- **Request Body:**
  ```json
  {
    "assessmentId": "60c72b2f9b1d8e2568cf2002"
  }
  ```
- **Response Shape (200 OK):** Order creation record containing link details.

### `POST /api/payments/paypal/capture`
Captures PayPal transaction funds after confirmation.
- **Auth:** Private (User)
- **Request Body:**
  ```json
  {
    "orderId": "PAYPAL-ORDER-12345"
  }
  ```
- **Response Shape (200 OK):** Capture receipt details.

---

## Admin Domain Settings

### `GET /api/admin/pricing`
Retrieves default pricing and payment details.
- **Auth:** Private (Admin)
- **Response Shape (200 OK):** Settings documentation.

### `PATCH /api/admin/pricing`
Alters default pricing and currency.
- **Auth:** Private (Admin)
- **Request Body:**
  ```json
  {
    "amountCents": 100,
    "currency": "usd",
    "productName": "Advanced MyFace Assessment Report",
    "productDescription": "Complete visual scan breakdown"
  }
  ```
- **Response Shape (200 OK):** Updated product configurations.

---

## Notification Settings

### `GET /api/notifications/config`
Checks if SMTP notification variables are loaded.
- **Auth:** Private (Admin)
- **Response Shape (200 OK):**
  ```json
  {
    "configured": true
  }
  ```

### `POST /api/notifications/test-email`
Triggers test SMTP send.
- **Auth:** Private (Admin)
- **Request Body:**
  ```json
  {
    "email": "test@example.com"
  }
  ```
- **Response Shape (200 OK):** `{"ok": true}`
