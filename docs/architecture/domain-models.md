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

### Generated text (latest-only)
| Surface | Column / table |
|---------|----------------|
| Executive narrative | `ai_narrative` |
| Protocol overview + closing | `protocol_narrative` (+ disk `protocol.json`) |
| Per-feature narratives | `feature_narratives` |
| AI visuals | `ai_visuals` |
| Async pipeline state | `pipeline` (`status`, `stage`, `attempts`, timestamps) |
| SegFormer parsing (interactive only) | `feature_parsing` (`crops`, `metrics`, `scaleNote`); `parsing/*.jpg` — front white-mask (incl. neck) / rect chin·cheeks·jaw; lips from front DB landmarks; smile from smile mesh; earsLeft/earsRight from profiles |
| Projected AFTER (protocol/PDF) | `projected_after` (`status`, `full.publicUrl` → `projected/full.jpg` or `full.png`) |
| Projected AFTER CV (immutable sibling of BEFORE) | `projected_analysis` (`status`, `cvReport`, `landmarks`, `metrics`, `eyeAnalysis`, `source: projected_full`) — never writes into `analysis` |
| Beauty Assistant | `conversations` + `conversation_messages` |

---

## 3. Table: `payments`
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

---

## 5. Table: `app_settings`
Singleton: `key TEXT PRIMARY KEY CHECK (key = 'app')`. Pricing/product fields + optional `updated_by` FK → users SET NULL.

---

## 6. Table: `assistant_rate_limits`
Unique `(user_id, hour_bucket)`; `count`; `created_at`. Hour bucket UTC `YYYY-MM-DDTHH`.

---

## Ops
- Env: `DATABASE_URL` (or `POSTGRES_URL`)
- Startup: `connect_db()` → `Base.metadata.create_all`
- Migrations: Alembic under `backend/alembic/` (revision `20260713_0001`)
- Health: `GET /api/health` → `{ "database": "connected" | "error" | "not_configured" }`
