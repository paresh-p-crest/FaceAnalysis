# Domain Models & Database Schemas

Persistence is **PostgreSQL** via SQLAlchemy 2.0 async (`backend/database.py`, `backend/models.py`). CRUD goes through `backend/repositories/`. Exception: `assistant_rate_limits` is read/incremented from `backend/ai_access.py`.

API responses keep **camelCase** field names (`userId`, `createdAt`, …) and string `id` (UUID). Columns in the database are **snake_case**.

### Cascade deletes
| Trigger | Also deleted |
|---------|----------------|
| User delete | assessments, conversations (+ messages), payments, assistant_rate_limits (FK `ON DELETE CASCADE`) |
| Assessment soft delete | Sets `deleted_at`; conversations/media kept. Soft-deleted do **not** count toward package limit. |
| Assessment hard wipe (`DELETE /api/assessments` admin) | conversations (+ messages) for those assessments |

Photos, parsing crops, projected AFTER, and `protocol.json` live in media storage under keys `assessments/{id}/...` (local filesystem or Replit Object Storage; `backend/media_storage.py`), served at `/api/media/{key}`. See [ADR-030](decisions.md).

---

## 1. Table: `users`
| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | API `id` |
| `email` | `VARCHAR(320)` UNIQUE | lowercased |
| `first_name` / `last_name` | `VARCHAR` | |
| `password_hash` | `TEXT` | never returned by `serialize_user` |
| `role` | enum `user_role` | `user` \| `admin` |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | |

Indexes: unique `email`, `role`.

---

## 2. Table: `assessments`
| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `user_id` | `UUID` FK → users CASCADE | nullable |
| `status` | enum `assessment_status` | `draft` \| `pending_review` \| `approved` \| `published` |
| `scan_id` | `VARCHAR` | client dedupe key |
| `provider` | `VARCHAR` | default `local` |
| `admin_notes` | `TEXT` | |
| `reviewed_at` | `TIMESTAMPTZ` | |
| `reviewed_by` | `JSONB` | |
| `answers`, `photos`, `photos_keys`, `analysis` | `JSONB` | |
| `ai_narrative`, `protocol_narrative`, `feature_narratives`, `protocol_storage`, `ai_visuals` | `JSONB` nullable | |
| `pipeline`, `feature_parsing`, `projected_after`, `projected_analysis` | `JSONB` nullable | async job progress + SegFormer crops + full-face AFTER URL + AFTER CV report |
| `review_log` | `JSONB` array | |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | |
| `deleted_at` | `TIMESTAMPTZ` nullable | Soft delete; `NULL` = active. Soft-deleted rows stay in DB but are excluded from the per-user submitted analysis limit. |

**Partial unique:** `(user_id, scan_id) WHERE scan_id IS NOT NULL AND deleted_at IS NULL` (soft-deleted rows do not block scan_id reuse).

**Soft delete:** `DELETE /api/assessments/{id}` sets `deleted_at` (does not remove the row, conversations, or media). Active lists / GET by id exclude soft-deleted rows. `count_submitted_assessments_for_user` filters `deleted_at IS NULL` by default (`submittedCount` / package limit); `include_deleted=True` powers `lifetimeSubmittedCount` for legacy analysis-access unlock.

**Soft-delete access hardening:** Repository mutators and `requeue_failed_pipeline` no-op (`None`) when the row is soft-deleted. In-flight pipeline aborts when refresh returns `None` (no continue-on-stale). `GET /api/media/assessments/{id}/…` returns **404** if the assessment is soft-deleted (bytes kept). Payment access fallback that inspects assessments considers **active** rows only. After delete, the next item in `GET /my/assessments` is the previous active report; the client clears stale `cloudAssessment` and rebinds report/chat/AI visuals to that previous ready report (or empty).

**Draft lifecycle (ADR-031):** the web app creates a row with `status="draft"` and `pipeline=null` up front (`POST /assessments/draft`), then populates `photos`/`photos_keys` progressively as each pose is uploaded (`PUT …/photos/{poseId}`). `pipeline` stays `null` until `POST …/submit`, which sets it to `queued` and hands off to the worker. Un-submitted drafts (`status="draft"` AND `pipeline IS NULL`) are excluded from the per-user history list (`list_assessments_for_user`) but remain visible to admins. Pose images are stored at original quality (bytes unchanged; keyed `{poseId}.jpg` regardless of source format).

### Analysis JSON (`analysis`)
Same nested shape as before: `cvReport`, `landmarks`, `imagePreview`, `protocolWarnings`, etc. (see prior MediaPipe/`cvReport` documentation). Stored as JSONB — not normalized into metric tables.

#### `cvReport.ears` (FaceMesh + optional ear landmarker)

FaceMesh junction proxies still populate the existing panel fields (`earSize`, `earSizeClass`, `earSymmetry`, `sizeDifference`, `protrusion`, `earProtrusion`, `earPosition`, scores/explanations). When profile photos are present, `_enrich_cv_report` loads `models/ear_landmarker.pth` (or `EAR_LANDMARKER_PATH`) — auto-downloading from `EAR_LANDMARKER_URL` when missing unless `EAR_LANDMARKER_AUTO_DOWNLOAD=false` — and **merges** an additive landmarker payload without overwriting those keys (ADR-054):

| Key | Meaning |
|-----|---------|
| `earLandmarkSource` | `"ear_landmarker"` when the module ran |
| `sides.left` / `sides.right` | Per-profile result keyed by anatomical side (`leftProfile` / `rightProfile`) |

Each side object:

| Field | Notes |
|-------|--------|
| `poseId` | `leftProfile` \| `rightProfile` |
| `status` | `ready` \| `skipped` \| `failed` |
| `reason` | e.g. `pose_missing`, `edge_collapse`, `decode_error`, `inference_error` |
| `imageSize` | `[W, H]` full profile pixels |
| `landmarks` | 20× `{id, x, y}` with **0–1 normalized** coords in full-image space |
| `regions` | `helix: 2–12`, `lobe: 13–18`, `tragus: [19,0,1]` |
| `measurements` | `verticalHeightNorm/Px`, `horizontalWidthNorm/Px`, `slantHeightNorm/Px`, `softBottomFrac`, `helixTop`, `lobeBottom`, `softBottom`, `lobeLeft`, `xMinNorm`/`xMaxNorm`, `verticalBracketXNorm` (norm = px / height for vertical+slant, / width for horizontal) |
| `confidences` | Per-point heatmap peak values |
| `edgeCollapseFrac` | Fraction of points near input border; `> 0.25` → `failed` (no landmarks merged) |
| `repairedIndices` | Contour indices snapped by neighbor-midpoint repair |
| `mirrored` | `true` if right-profile retry used a horizontal flip |

When landmarker enrichment succeeds, `proportions.ratios.nasoAural` is updated with `dataSource: "ear_landmarker"`, `photoSource` matching the ready side (`rightProfile`/`leftProfile`), `earHeightNorm` / `noseHeightNorm`, explicit `noseTop`/`noseBottom` (0–1, nasion→subnasale from the **same** 90° profile cephalometrics — never a 45° primary), and sidecar `guideGlabella` / `guideNoseBottom` (0–1) from `extract_glabella_subnasale`: **FaceMesh midline first** (idx 9 / 2, same as `scripts/profile_landmarks.py`), silhouette face-det crop only if mesh fails. Overlay `style: "qoves"` with `nasoLayout: "earPlusNoseGuides-v6"` when guides resolve (else `earOnly-v5`). Overlay contains a single `earVertical` bracket (helix→soft lobe behind the pinna) plus optional `guides[]` — two white dashed horizontals at guide glabella y and subnasale y (`{y, x1, x2, dashed: true}`). No nose vertical line. Ratio bar "Nose" height uses the guide span when present (`noseHeightSource: guide_glabella_subnasale`).

No DB migration — JSONB only. EarReportPanel overlay UI is a follow-up; SegFormer ear crops stay for hero imagery.

### Generated text (latest-only)
| Surface | Column / table | Locale |
|---------|----------------|--------|
| Executive narrative | `ai_narrative` (`content`, `contentOrigin`; `contentDe`, `contentDeOrigin`) | EN + DE |
| Protocol overview + closing | `protocol_narrative` (`summary`, `summaryOrigin`, `closing`, `closingOrigin`, `de.*`) | EN + DE |
| Per-feature narratives | `feature_narratives` (`origin`; nested `de.{summary, subsections}`) | EN + DE |
| AI visuals | `ai_visuals` | — |
| Async pipeline state | `pipeline` (`status`, `stage`, `attempts`, timestamps) |
| SegFormer parsing (interactive only) | `feature_parsing` (`crops`, `metrics`, `scaleNote`); `parsing/*.jpg` — front white-mask (incl. neck) / rect chin·cheeks·jaw; lips from front DB landmarks; smile from smile mesh; **earsLeft/earsRight** primary = landmarker contour cutout when ready (`sourceMethod: ear_landmarker_contour`), else SegFormer copy; **earsLeftSegformer/earsRightSegformer** always when SegFormer succeeds (`sourceMethod: segformer_ears`); aggregate `crops.ears` also has `leftSegformerPublicUrl` / `rightSegformerPublicUrl` |
| Projected AFTER (protocol/PDF) | `projected_after` (`status`, `full.publicUrl` → `projected/full.jpg` or `full.png`) |
| Projected AFTER CV (immutable sibling of BEFORE) | `projected_analysis` (`status`, `cvReport`, `landmarks`, `metrics`, `eyeAnalysis`, `source: projected_full`) — never writes into `analysis` |
| Beauty Assistant | `conversations` + `conversation_messages` |

**German narrative nesting (ADR-042):** no new columns. `ai_narrative.contentDe` mirrors `content`; `protocol_narrative.de` holds `{ summary, closing[], treatmentPhases?, origin }`; each `feature_narratives[id].de` holds `{ summary, subsections[], origin }`. Disk backup `assessments/{id}/protocol.json` stores the same nested shape. `origin` / `contentDeOrigin` values: `llm` | `template` | `stitch` | `admin`.

---

## 3. Table: `payments` (Archived / Read-Only, ADR-048)
*Note: Retained in database schema as an inert archive table. No new payment records are written.*
| Column | Type |
|---|---|
| `id` | `UUID` PK |
| `user_id` | `UUID` FK CASCADE |
| `assessment_id` | `UUID` FK SET NULL |
| `provider`, `provider_ref`, `checkout_url`, `plan_id`, `status` | text |
| `amount_cents` | `INT` |
| `currency` | `VARCHAR` |
| `raw` | `JSONB` |
| `created_at` / `updated_at` | `TIMESTAMPTZ` |

---

## 4. Tables: `conversations` + `conversation_messages`
**conversations:** unique `(assessment_id, user_id)`; `session_summary`, `summary_at_user_count`; FKs CASCADE.

**conversation_messages:** `conversation_id` FK CASCADE; `role` enum `user`\|`assistant`; `content`; `created_at`. API still returns embedded `messages[]` on the conversation document shape.

**Write pattern (persist-as-you-go):** the assistant router appends the user message on receipt and the assistant reply only after generation (two separate `append_messages` calls), so `created_at` ordering reflects real chronology — no schema change.

---

## 5. Table: `app_settings`
Singleton: `key TEXT PRIMARY KEY CHECK (key = 'app')`. Pricing/product fields + optional `updated_by` FK → users SET NULL.

---

## 6. Table: `assistant_rate_limits`
Unique `(user_id, hour_bucket)`; `count`; `created_at`. Hour bucket UTC `YYYY-MM-DDTHH`.

---

## 7. Table: `email_send_logs`
Transactional email audit log (written by `backend/email_service.py` on every send attempt).

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `recipient` | `VARCHAR(320)` | |
| `template` | `VARCHAR(64)` | `signup_confirmation` \| `password_reset` \| `report_ready` |
| `provider` | `VARCHAR(32)` | `resend` \| `smtp` |
| `provider_message_id` | `VARCHAR(255)` nullable | Resend message id |
| `status` | `VARCHAR(16)` | `sent` \| `failed` |
| `error_message` | `TEXT` nullable | |
| `user_id` | `UUID` FK → users SET NULL | optional audit link |
| `raw` | `JSONB` | provider response payload |
| `created_at` | `TIMESTAMPTZ` | |

---

## 8. Table: `password_reset_tokens`
Token-based password reset (SHA-256 hash of raw token; never store plaintext).

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `user_id` | `UUID` FK → users CASCADE | |
| `token_hash` | `TEXT` | indexed |
| `expires_at` | `TIMESTAMPTZ` | default TTL 60 min |
| `used_at` | `TIMESTAMPTZ` nullable | set on successful reset |
| `created_at` | `TIMESTAMPTZ` | |

---

## 9. Table: `auth_rate_limits`
Hourly buckets for auth abuse prevention (e.g. forgot-password).

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `scope` | `VARCHAR(64)` | e.g. `forgot_password_email`, `forgot_password_ip` |
| `key` | `VARCHAR(320)` | normalized email or client IP |
| `hour_bucket` | `VARCHAR(16)` | UTC `YYYY-MM-DDTHH` |
| `count` | `INT` | |
| `created_at` | `TIMESTAMPTZ` | |

Unique `(scope, key, hour_bucket)`.

---

## Ops
- Env: `DATABASE_URL` (or `POSTGRES_URL`)
- Startup: `connect_db()` → `Base.metadata.create_all`
- Migrations: Alembic under `backend/alembic/` (revision `20260713_0001`)
- Health: `GET|HEAD /api/health` → `{ "database": "connected" | "error" | "not_configured" }` (HEAD for uptime monitors)
