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
Fast upload + enqueue: validates 7 poses, persists photos, creates assessment with `pipeline.status = queued`. **Does not** run CV/NL inline.
- **Auth:** Private (paid user or admin)
- **Required photos:** All 7 poses (`front`, profiles, 45°, `smile`, `topHead`). **400** if missing.
- **Idempotency:** `(userId, scanId)` returns existing row (processing or complete).
- **Response (200 OK):**
  ```json
  {
    "assessmentId": "uuid",
    "scanId": "client-uuid",
    "status": "Processing",
    "processing": true,
    "pipeline": {
      "status": "queued",
      "stage": "queued",
      "stageLabel": "queued"
    },
    "featureParsing": { "status": "pending" },
    "photos": { "front": { "publicUrl": "/api/media/assessments/{id}/front.jpg" } },
    "createdAt": "2026-07-14T12:00:00Z"
  }
  ```
- **Worker:** Background loop runs `cv` → `narratives` → `parsing` (SegFormer). On success: `pipeline.status = ready`, workflow `status = pending_review` (or `approved` if `DEV_AUTO_APPROVE_REPORTS`).

### `POST /api/assessments/{assessment_id}/retry-pipeline`
Re-enqueue a **failed** pipeline (owner or admin). Returns the full serialized assessment (pipeline reset to `queued`). No-op returning current state if already `queued`/`running`; **400** if `ready` or not in a failed state.

### Progressive draft-upload-finalize flow (ADR-026)
This is the single assessment-creation path used by the web app in **all** environments. Photos are uploaded to the active `MediaStorage` backend (local filesystem in dev, Replit Object Storage in prod) immediately after client-side validation, then `submit` enqueues the pipeline. Original image bytes are stored **as-is** (no server or client re-encode).

#### `POST /api/assessments/draft`
Creates (or returns) an idempotent draft assessment used to collect per-pose uploads before submit.
- **Auth:** Private (paid user or admin)
- **Request Body:** `{ "scanId": "client-uuid" }`
- **Idempotency:** `(userId, scanId)` reuses the existing draft.
- **Behavior:** Creates `status = "draft"`, `pipeline = null`, `featureParsing`/`projectedAfter` pending, `photos = {}`.
- **Response (200 OK):**
  ```json
  { "assessmentId": "uuid", "scanId": "client-uuid" }
  ```

#### `PUT /api/assessments/{assessment_id}/photos/{pose_id}`
Uploads a single pose image (original bytes) to the bucket and merges it into the draft's `photos` map.
- **Auth:** Private (paid user or admin) + ownership
- **Content-Type:** `multipart/form-data` with a `file` field (the raw `File`; no base64, no re-encode)
- **`pose_id`:** one of the allowed poses (`front`, `left`, `right`, `left45`, `right45`, `smile`, `topHead`). **400** for unknown pose.
- **Rejects (409)** if the assessment is already submitted (`pipeline` not null).
- **Behavior:** Reads raw bytes + sniffs content-type from magic bytes, `save_pose(...)` stores the image (always keyed `{pose_id}.jpg` for pipeline compatibility while preserving original bytes/format), updates `photos` JSONB + `photos_keys`.
- **Response (200 OK):** The stored photo dict, e.g. `{ "pose": "front", "publicUrl": "/api/media/assessments/{id}/front.jpg", ... }`

#### `DELETE /api/assessments/{assessment_id}/photos/{pose_id}`
Removes an uploaded pose object from storage and its `photos` entry.
- **Auth:** Private (paid user or admin) + ownership
- **Rejects (409)** if the assessment is already submitted.
- **Response (200 OK):** `{ "ok": true }`

#### `POST /api/assessments/{assessment_id}/submit`
Finalizes a draft and enqueues the async pipeline (no image re-upload).
- **Auth:** Private (paid user or admin) + ownership
- **Request Body:** `{ "answers": { ... }, "provider": "openai" }`
- **Behavior:** Verifies all required poses are present in stored `photos` (**400** if missing), persists `answers`/`provider`, sets `pipeline = queued`. The background worker takes over.
- **Response (200 OK):**
  ```json
  { "assessmentId": "uuid", "processing": true, "pipeline": { "status": "queued", "stage": "queued" } }
  ```

### `POST /api/assessments` (legacy note)
Older docs described synchronous CV+NL in one request — superseded by ADR-025. The compressed base64 create path is no longer used by the web app (superseded by the draft-upload-finalize flow, ADR-026).

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
- **Response Shape (200 OK):** `{ "items": [...] }` where each item includes `id`, `userId`, `status`, `provider`, `scanId`, `createdAt`, `pipeline` (live stage/status for the admin tracker), and pruned `analysis` score fields only (no photos, narratives, protocol blobs, or cvReport image data). Use `GET /api/assessments/{id}` for full detail.
- **Note:** Un-submitted drafts (`status = "draft"` with `pipeline = null`) are excluded from the user history list, but appear here for admins.

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
Saves admin review comments, PDF protocol text edits, and/or publishes reports.
- **Auth:** Private (Admin)
- **Request Body:**
  ```json
  {
    "status": "Approved",
    "adminNotes": "Admin notes...",
    "protocolNarrative": { "summary": "...", "closing": ["..."], "features": {} },
    "featureNarratives": { "hair": { "summary": "...", "subsections": [] } }
  }
  ```
  Optional legacy `aiNarrative` is still accepted. Protocol text is persisted via protocol storage + DB when `protocolNarrative` / `featureNarratives` are sent.
- **400:** When assessment status is **Approved**, requests that include `protocolNarrative` or `featureNarratives` are rejected (`Cannot edit protocol narrative on approved reports.`).
- **Response Shape (200 OK):** Complete updated assessment document.

### `POST /api/assessments/{assessment_id}/ai-narrative`
Returns stored executive narrative, or generates once if missing. Prefer pipeline enrichment on `POST /api/assessments`.
- **Auth:** Owner User or Admin
- **Query:** `force=true` — admin-only regenerate (legacy executive narrative)
- **Response Shape (200 OK):** Updated assessment with `aiNarrative`.

### `GET /api/media/{object_key}`
Streams a stored media object (pose photo, parsing crop, projected AFTER, protocol JSON) from the active media backend (local filesystem or Replit Object Storage; `backend/media_storage.py`). Same URLs in dev and prod. See [ADR-030](decisions.md).
- **Auth:** None (open, matching prior public `/uploads`; owner-only signed tokens deferred)
- **Path:** `object_key` must be under `assessments/` (e.g. `assessments/{id}/front.jpg`). Rejects `..`.
- **Response (200 OK):** Raw bytes with a content-type by extension (`image/jpeg`, `image/png`, `application/json`, …) and `Cache-Control: public, max-age=3600`.
- **404:** Object not found / key outside `assessments/`.

### `GET /api/assessments/{assessment_id}/protocol`
Loads persisted protocol from media storage (`assessments/{id}/protocol.json`) with database fallback.
- **Auth:** Owner User or Admin
- **Response Shape (200 OK):**
  ```json
  {
    "protocolNarrative": { "summary": "...", "features": {}, "closing": [] },
    "featureNarratives": { "hair": { "measuredFacts": [], "subsections": [] } },
    "protocolStorage": { "publicUrl": "/api/media/assessments/{id}/protocol.json" },
    "source": "storage"
  }
  ```
- **404:** Protocol not yet generated.

### `POST /api/assessments/{assessment_id}/ai-protocol`
Generates protocol via `narrative_orchestrator` (per-feature structured LLM calls + overview + closing), writes JSON to protocol storage, and syncs `featureNarratives` / `protocolNarrative` to the database.
- **Auth:** Owner User or Admin (paid AI access)
- **Query:** `force=true` — **admin-only** full regenerate (overwrites existing PDF narrative text)
- **400:** Rejected when assessment status is **Approved**.
- **Response Shape (200 OK):** Updated assessment document (idempotent for non-admin / `force=false` if already stored).

### `POST /api/assessments/{assessment_id}/ai-protocol/section`
Admin-only regenerate of one PDF section.
- **Auth:** Private (Admin) + paid AI access
- **400:** Rejected when assessment status is **Approved**.
- **Request Body:**
  ```json
  { "sectionId": "overview" | "closing" | "hair" | "eyes" | "…" }
  ```
- **Response Shape (200 OK):** Updated assessment with merged section text.

### `POST /api/assessments/{assessment_id}/projected-after`
Admin-only on-demand projected AFTER image. Always runs (ignores `PROJECTED_AFTER_ENABLED`), writes `projected/full.jpg` or `full.png`, updates `projected_after` JSONB, then runs MediaPipe/OpenCV CV on that image into `projected_analysis` (does **not** mutate BEFORE `analysis`).
- **Auth:** Private (Admin)
- **Response Shape (200 OK):** Updated assessment with `projectedAfter.status === "ready"` and `projectedAnalysis` (`status` `ready` \| `failed`, plus `cvReport` / `landmarks` / `metrics` / `eyeAnalysis` when ready).
- **400:** Missing front photo / landmarks / generation failure.

Assessment `GET` payloads include `projectedAnalysis` alongside `projectedAfter` when present. Protocol UI and PDF feature AFTER images use `projectedAnalysis.landmarks` + the same `getFeatureBox` crop keys as BEFORE for eyes/jaw/chin/ears/neck/hair. When AFTER aspect or pixel size differs from front BEFORE, AFTER is cover-fitted onto the BEFORE canvas (AFTER-only; landmarks remapped) before cropping; `FEATURE_MIN_PX` is scaled by short-side ratio. Other features prefer `projectedAnalysis.cvReport` / `eyeAnalysis` stored crops when `status === "ready"`. Fallback: client MediaPipe on AFTER, then BEFORE landmarks, then stored crops. Skin PDF half-split does not use this path.

### `POST /api/assessments/{assessment_id}/ai-visuals`
Triggers hairstyle, outfit, and healthy-aging visual variants via OpenAI Images Edits (`OPENAI_IMAGE_MODEL`, default `gpt-image-1`).
- **Auth:** Owner User or Admin (paid AI access)
- **Source image:** Prefers the stored front pose object (`assessments/{id}/front.jpg` via the media backend), then `assessment.photos.front`, then `cvReport` image refs (data URL or `/api/media/...` path; legacy `/uploads/...` still accepted). Never base64-decodes public URLs.
- **Request Body:**
  ```json
  {
    "variants": ["hair", "outfit", "aging"]
  }
  ```
- **Response Shape (200 OK):** Updated assessment with `aiVisuals` (`source`, `model`, `sourceKind`, `variants[]` with `prompt`, `imageSrc`, `status`, `error`). Failed edits return `status: "blocked"` per variant instead of crashing the request. Prompt text is natural-language with a shared identity opening and per-variant scope-fence (ADR-035); schema unchanged.

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
- **Response Shape (200 OK):** Updated conversation with appended `messages` (`max_tokens` from `LLM_MAX_OUTPUT_TOKENS`, default **8000**).
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
