# Domain Models & Database Schemas

Persistence is **PostgreSQL** via SQLAlchemy 2.0 async (`backend/database.py`, `backend/models.py`). CRUD goes through `backend/repositories/`. Exception: `assistant_rate_limits` is read/incremented from `backend/ai_access.py`.

API responses keep **camelCase** field names (`userId`, `createdAt`, …) and string `id` (UUID). Columns in the database are **snake_case**.

### Cascade deletes
| Trigger | Also deleted |
|---------|----------------|
| User delete | assessments, conversations (+ messages), payments, assistant_rate_limits (FK `ON DELETE CASCADE`) |
| Assessment delete | conversations (+ messages) for that assessment |

Photos and `protocol.json` under `public/uploads/assessments/{id}/` remain filesystem mirrors.

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
| `pipeline`, `feature_parsing` | `JSONB` nullable | async job progress + SegFormer crops/metrics |
| `review_log` | `JSONB` array | |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | |

**Partial unique:** `(user_id, scan_id) WHERE scan_id IS NOT NULL`.

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
| SegFormer parsing (interactive only) | `feature_parsing` (`crops`, `metrics`, `scaleNote`) |
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
