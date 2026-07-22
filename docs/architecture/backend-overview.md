# Backend Overview

Python FastAPI service for MyFace. It runs computer vision on uploaded photos, stores results in PostgreSQL, then adds AI narrative and optional SegFormer parsing via a **background worker**.

**Run:** `uvicorn backend.main:app --reload --port 8000`

---

## How a request flows (summary)

```
Photos + questionnaire
  → POST /api/assessments (validate + persist + enqueue)
  → pipeline worker: analyze_face → NL enrichment → face parsing → projected_after → ai_visuals
  → Report UI / browser PDF / Beauty Assistant
  → Admin approve → PDF download gate opens
```

**Invariant:** Numbers always come from CV (MediaPipe + OpenCV). The LLM only explains them — it does not invent scores.

---

## Full facial analysis pipeline

End-to-end path from questionnaire + photos to report, protocol PDF, and Beauty Assistant. **`POST /api/assessments` returns quickly**; CV, NL, and SegFormer parsing run in `pipeline_worker.py` (Postgres `pipeline` JSONB, `FOR UPDATE SKIP LOCKED`, per-stage retries). See ADR-025.

### Stage 0 — Entry & access

| Item | Detail |
|------|--------|
| **FE flow** | `AnalysisFlow.jsx`: Welcome → Questionnaire → Confirm → Upload → Scanning (fast submit) → **AnalysisPreparing** (poll) |
| **Kickoff** | `Scanning.jsx` → `utils/analyzeFace.js` → **`POST /api/assessments`** (~seconds). `AnalysisPreparing.jsx` polls `GET /api/assessments/{id}` every 5s. |
| **API** | `utils/apiClient.js` |
| **Access** | Paid user (or admin); backend checks completed payment (402 if unpaid) |
| **Inputs** | Questionnaire `answers`, 7 pose images, client `scanId` (UUID) |

**Required poses** (`config.PHOTO_POSES`): `front`, `leftProfile`, `rightProfile`, `left45`, `right45`, `smile`, `topHead`.

If the backend API is disabled, the FE can run a browser-local MediaPipe path (`utils/mediapipeAnalysis.js`) with **no Mongo persistence**.

### Stage 1 — Create assessment (`POST /api/assessments`)

**Handler:** `routers/assessments.py` → `post_assessment`

1. Auth + payment gate  
2. Require `scanId` (idempotency key with `userId`)  
3. Decode images (`image_utils`)  
4. Validate poses (`photo_validation.validate_required_poses`)  
5. Create Postgres row with `pipeline.status = queued`, `status = draft`  
6. Save pose JPGs to disk (`photo_storage.save_all_poses`)  
7. Return `{ assessmentId, processing: true, pipeline }` — **no CV/NL in request**

### Stage 1b — Background worker (`pipeline_worker.py`)

1. Claim queued row (`claim_next_queued_assessment`, `FOR UPDATE SKIP LOCKED`)  
2. **cv** — `pipeline_stages.run_cv_stage` → `analyze_face.run_face_analysis` in thread  
3. **narratives** — `enrich_assessment_nl_content`  
4. **parsing** — SegFormer crops + metrics → `feature_parsing` + `parsing/*.jpg` (torch/torchvision/transformers are core deps installed from `requirements.txt`; the stage disables gracefully via `face_parsing_enabled()` only if they are somehow absent or `FACE_PARSING_ENABLED=false`). Front pose: white mask-isolated feature crops (incl. neck); chin/cheeks/jaw rectangular. **lips** via stored front MediaPipe landmarks on `front.jpg`; **smile** via MediaPipe on `smile.jpg`; **earsLeft/earsRight** via SegFormer on left/right profiles.  
5. **projected_after** — **generative** AFTER image via `projected_after_ai.generate_projected_after_bytes` → `image_client` (fixed best-groomed makeover prompt, ADR-034) → `projected_after` + `projected/full.jpg` or `full.png` (skipped when `PROJECTED_AFTER_ENABLED=false`); provider unavailable/fail → status **`pending`** (retryable). On success, MediaPipe/OpenCV on that image → `projected_analysis` (BEFORE `analysis` untouched). (ADR-029, ADR-034)  
6. **ai_visuals** — `pipeline_stages.run_ai_visuals_stage` → `generate_visual_variants` (13 cards: 5 hair + 5 outfit + 3 aging) from the **front (BEFORE)** portrait; soft-skips when front bytes are missing.  
7. `pipeline.status = ready`, workflow `status = pending_review` (or dev auto-approve)

### Stage 2 — Computer vision (`analyze_face.py`)

**Entry:** `run_face_analysis` → local CV path (`cvEngine: "local-cv"`, `pipelineVersion: "2.0.0"`). AWS provider is rejected.

#### 2a. Multi-view landmarking

| Module | Role |
|--------|------|
| `multi_view.py` | FaceMesh on each pose |
| `mediapipe_analysis.py` | 478 landmarks `{x,y,z}` |

Front face failure fails the whole analysis. Other poses soft-fail (empty landmarks).

#### 2b. Front metrics & structured report

| Module | Role |
|--------|------|
| `opencv_metrics.py` | Image quality + geometry from landmarks |
| `eye_analysis.py` | Eye tilt, lids, sclera, under-eye, etc. |
| `cv_report.py` → `build_cv_report` | Full feature report + crops |
| `pose_analysis.py` | Neck / posture from MediaPipe Pose |
| `prototypicality.py` | Averageness vs fixed ideal ratios |
| `skin_texture.py` | Roughness, redness, oiliness |

**`cvReport` feature sections include:** face shape, symmetry, proportions, nose, eyes, eyebrows, lips, jaw/chin, cheeks, smile, neck, ears, hair, skin, dimorphism, averageness, overall.

#### 2c. Multi-view enrichment (`_enrich_cv_report`)

| Module | Role |
|--------|------|
| `quarter_analysis.py` | 45° oblique views |
| `smile_analysis.py` | Dentofacial smile metrics |
| `hair_analysis.py` / `hair_segmentation.py` | Density + temple-geometry Norwood 1–3 (density for 4+) |
| `profile_cephalometrics.py` + `profile_silhouette.py` | Side-profile angles/ratios (normalized units; no physical mm scale) |

**Analysis blob stored:** `{ success, cvEngine, landmarks, metrics, eyeAnalysis, cvReport, error }`.

### Stage 3 — Persistence

**MongoDB `assessments`** (`assessment_repository.py`):

| Field | Content |
|-------|---------|
| `status` | `draft` → `pending_review` → `approved` / `published` |
| `userId`, `scanId` | Ownership + idempotency |
| `answers` | Questionnaire responses |
| `analysis` | Immutable CV payload (`cvReport`, landmarks, metrics, …) |
| `aiNarrative` | Executive summary envelope |
| `protocolNarrative` | Overview + closing (+ feature shim) |
| `featureNarratives` | Per-feature protocol pages |
| `protocolStorage` | Disk file metadata |
| `photos` / `photosKeys` | Pose storage metadata |
| Review fields | `adminNotes`, `reviewedBy`, `reviewedAt`, `reviewLog` |

**Media storage** via the `MediaStorage` interface (`backend/media_storage.py`, keys under `assessments/{id}/`) — local filesystem (`var/media`, dev) or Replit Object Storage (prod), selected by `MEDIA_STORAGE_BACKEND`:

- `{poseId}.jpg` — pose photos  
- `parsing/{featureId}.jpg` — SegFormer feature crops  
- `projected/full.{jpg|png}` — projected AFTER image  
- `protocol.json` — `{ version, storedAt, protocolNarrative, featureNarratives }`  

Served by the backend at `GET /api/media/{key}`; public URLs look like `/api/media/assessments/{id}/front.jpg` (identical in dev and prod). See ADR-030.

### Stage 4 — AI narrative & protocol (LLM)

Triggered by `enrich_assessment_nl_content` on create (not on report open). Idempotent if a complete bundle already exists.

#### 4a. Executive narrative

- `protocol_service.ensure_ai_narrative` → `text_ai_service.generate_cv_narrative`  
- Schema: `narrative_schemas.ExecutiveNarrative`  
- Output: `{ summary, strengths[], focusAreas[], recommendations[], disclaimer }`  
- Optional Vision attachment of the front pose when `LLM_PROVIDER=openai`

#### 4b. Protocol feature pages

- `narrative_orchestrator.generate_all_protocol_text`  
- Features (`PROTOCOL_FEATURE_IDS`): hair, eyes, nose, cheeks, jaw, lips, chin, skin, neck, ears  
- Parallel generation (`FEATURE_NARRATIVE_CONCURRENCY`, default 11) with `feature_context`, `recommendation_rules`, and optional Vision poses  
- Overview + closing synthesis; closing falls back to `stitch_closing_paragraphs` if the LLM fails  
- Persist via `persist_protocol_bundle` → Mongo + `protocol.json`

**Protocol load precedence:** complete Mongo → disk file → partial Mongo.

### Stage 5 — Clinical guardrails

**File:** `clinical_guardrails.py` (after each feature LLM response)

1. Validate (banned procedural claims, **numeric CV measurement language** in prose, evidence tier, voice, etc.)  
2. Soft failure → **keep** LLM copy (no retry). Hard reject (banned terms / score language) or empty → up to **`FEATURE_NARRATIVE_MAX_ATTEMPTS` (default 3)** total LLM attempts  
3. **429 / rate limit** → up to **`FEATURE_NARRATIVE_RATE_LIMIT_RETRIES` (default 3)** extra calls with exponential backoff starting at **`FEATURE_NARRATIVE_RATE_LIMIT_BACKOFF_SEC` (default 30s)** → 30 / 60 / 120; still limited → template  
4. Still bad after attempts → deterministic template from measured facts  
5. Rewrite to third-person “the subject” voice; **`strip_score_language` last-pass** after accept  
6. ASCII sanitize for PDF-safe punctuation  

**No mid-sentence clipping:** normalize does not ellipsis-truncate bodies/summaries. Every feature subsection has an explicit body band — **short 1000** / **standard 1500** / **long 2000** chars — via `FEATURE_SUBSECTION_BODY_LIMITS` + JSON `prefixItems`; over-length fails validation and retries. Summary ≤500.

**Qualitative-only LLM context:** `feature_context` maps scores/decimals to bands/labels (no `N/100` in `measuredFacts`). Vision instructions forbid inventing or quoting numeric measurements. Product UI still shows real CV numbers.

Prompt-side rules also live in `text_ai_service` (`STRICT_NON_SURGICAL_RULES`, `NARRATIVE_VOICE_RULES`, `NO_SCORES_IN_REPORT_PROSE` / NUMERIC BAN, …).

### Stage 6 — Report UI, PDF, and optional add-ons

| Path | How |
|------|-----|
| **Interactive report** | `Report.jsx` + `CvReportView` / `QovesProtocolReport` / `ExecutiveSummary` — opens from one `GET /api/assessments/{id}` (admin/dashboard); Report reuses that payload for admin tools + NL hydrate (load only; no regenerate on open) |
| **Branded PDF (primary)** | Browser `utils/reportPdf.js` (jsPDF) using `cvReport` + protocol narratives + front photo. Chin PROFILE plates stay center-cover; convexity/E-line guides snap to the profile silhouette edge. Cheek ANALYSIS overlays use DB MediaPipe landmarks via `utils/cheekGuides.js` (notebook midface construction). Reference fixtures under `fixtures/`. |
| **Backend PDF (fallback)** | `GET /api/assessments/{id}/pdf` → ReportLab (`report_pdf.py`) from markdown — used when the UI has no front photo |
| **PDF gate** | `report_status.is_pdf_allowed_status` — only `approved` / `published` (or always if dev auto-approve) |
| **AI visuals** | On-demand `POST .../ai-visuals` (hair / outfit / aging) — **not** part of create |
| **Section formatters** | `report_sections.py` for admin, assistant tools, markdown fallbacks |

### Stage 7 — Beauty Assistant (report-grounded)

| Layer | Detail |
|-------|--------|
| API | `routers/assistant.py` |
| Access | Paid AI access + hourly rate limit (`ai_access`) |
| Agent | `assistant_agent.run_assistant_agent` (ReAct, max 3 tool rounds) |
| Tools | `assistant_tools.AssessmentTools` — read questionnaire, executive NL, CV sections, protocol features |
| Store | `conversations` collection |

Tools only **read** the stored assessment — they do not re-run CV or regenerate protocol.

### Stage 8 — Admin review workflow

| Status | Meaning |
|--------|---------|
| `pending_review` | Default after create |
| `approved` / `published` | Admin approved; PDF download allowed |
| `draft` | Schema-allowed; create path rarely uses it |

- Only admins can `PATCH` status / admin-review  
- Approved cannot move back to pending  
- Admin review edits **protocol / feature narratives** (PDF text) via `admin-review` + optional `ai-protocol?force=true` / `ai-protocol/section`  
- Admins can on-demand generate projected AFTER via `POST .../projected-after` (ignores env flag)  
- Manual helper (same generation path): `scripts/rerun_projected_after.py <assessment_id>`
- CV-only from existing AFTER (no image regen): `scripts/rerun_projected_analysis.py <assessment_id>` — uses DB `projectedAfter.full` URL/path → `projected_analysis`  
- Optional legacy `aiNarrative` edits still best-effort refresh protocol closing  
- **CV measurements stay immutable** during review

### Error & fallback cheat sheet

| Failure | Behavior |
|---------|----------|
| Missing poses / bad image | 400 |
| No payment | 402 |
| No face / CV exception | 422 |
| Duplicate `scanId` | Return existing assessment |
| NL enrichment fails | Logged; CV assessment still returned |
| Feature LLM invalid | Retry → clinical template |
| Closing LLM fails | Stitch from scores + feature summaries |
| PDF without approval | 403 |
| Assistant LLM down | 503 |

### Pipeline diagram

```text
[FE AnalysisFlow]
  answers + photos[7] + scanId
       │
       ▼
POST /api/assessments  (assessments.py)
       │
       ├─ validate_required_poses
       ├─ run_face_analysis
       │     multi_view → mediapipe (478 landmarks)
       │     opencv_metrics → eye_analysis → build_cv_report
       │     enrich: quarter, smile, hair, profile
       ├─ create_assessment (Mongo)
       ├─ save_all_poses (disk JPGs)
       ├─ update_assessment_analysis (URL rewrite)
       └─ enrich_assessment_nl_content
              ├─ generate_cv_narrative → aiNarrative
              └─ generate_all_protocol_text → clinical_guardrails
                    → protocol.json + featureNarratives + protocolNarrative
       │
       ▼
[Report.jsx]
       ├─ CvReportView / QovesProtocolReport
       ├─ downloadMyFacePdf (jsPDF)     [primary PDF]
       ├─ GET .../pdf (ReportLab)       [fallback]
       ├─ POST .../ai-visuals           [optional]
       └─ Beauty Assistant tools        [conversations]
```

---

## Folder map

| Folder | Role |
|--------|------|
| `backend/` | Core app, CV, AI, reports |
| `backend/routers/` | HTTP API endpoints |
| `backend/repositories/` | MongoDB read/write |
| `backend/tests/` | Unit tests |

---

## App entry & infrastructure

| File | What it does |
|------|----------------|
| `main.py` | Starts FastAPI, CORS, DB lifespan, mounts routers. Also has `/api/health` and quick `/api/run-analysis` (no DB save). |
| `config.py` | Shared constants (poses, models, thresholds, feature lists). |
| `database.py` | MongoDB connection via Motor (async). |
| `logging_config.py` | Makes backend logs visible under uvicorn. |
| `serialization.py` | Turns numpy/nested CV data into JSON/Mongo-safe values. |
| `dev_config.py` | Dev-only auto-approve reports — remove before production. |
| `requirements.txt` (root) | Python dependencies. |

---

## API routers (`routers/`)

| File | What it does |
|------|----------------|
| `assessments.py` | Create/list assessments, run analysis, AI narrative/protocol/visuals, admin review, PDF download. |
| `auth.py` | Register, login, current user, admin user management. |
| `assistant.py` | Beauty Assistant chat for a stored assessment. |
| `payments.py` | Stripe Checkout and PayPal create/capture. |
| `admin_settings.py` | Admin premium pricing settings. |
| `notifications.py` | Admin email config check and test send. |

---

## Auth, access, email

| File | What it does |
|------|----------------|
| `auth.py` | Password hashing, signed tokens, user/admin guards, bootstrap admin. |
| `ai_access.py` | Who can call AI endpoints + Beauty Assistant rate limits. |
| `email_service.py` | Sends transactional emails over SMTP. |

---

## Database (`repositories/`)

| File | What it stores |
|------|----------------|
| `assessment_repository.py` | Facial assessments (CV report, status, narrative, protocol). |
| `user_repository.py` | Users. |
| `payment_repository.py` | Payment attempts and captures. |
| `conversation_repository.py` | Beauty Assistant chat history. |
| `settings_repository.py` | App-wide settings (e.g. premium price). |

---

## Computer vision pipeline

This is the core of the product: photos in → structured `cvReport` out.

| File | What it does |
|------|----------------|
| `analyze_face.py` | **Main orchestrator** — runs the full local CV path and builds the final report. |
| `multi_view.py` | Runs landmarking on each pose (front, profiles, 45°, smile, top-head). |
| `mediapipe_analysis.py` | MediaPipe FaceMesh — 478 face landmarks. |
| `pose_analysis.py` | MediaPipe Pose — shoulders/ears for neck length and posture. |
| `opencv_metrics.py` | Geometry and image quality stats from landmarks. |
| `face_crop.py` | Landmark groups, bounding boxes, crop helpers. |
| `cv_report.py` | **Largest module** — all feature metrics + `build_cv_report()`. |
| `eye_analysis.py` | Eye metrics (tilt, lids, sclera, under-eye, etc.). |
| `build_eye_report.py` | Markdown eye report text from those metrics. |
| `hair_segmentation.py` | OpenCV HSV hair mask (crown coverage / hairline). |
| `hair_analysis.py` | Hair density + temple-geometry Norwood (1–3) / density (4+). |
| `smile_analysis.py` | Smile-photo dentofacial metrics. |
| `profile_silhouette.py` | Side-profile outline points when FaceMesh is weak at ~90°. |
| `profile_cephalometrics.py` | Lateral angles/ratios (nose, lips, ear height, etc.). |
| `quarter_analysis.py` | 45° oblique view analysis. |
| `skin_texture.py` | Roughness, redness, oiliness from pixels. |
| `prototypicality.py` | Proportion conformity vs fixed ideal ratios (“averageness”). |

---

## AI narrative & assistant

| File | What it does |
|------|----------------|
| `llm_client.py` | Talks to OpenAI, Groq, or OpenRouter; chat/JSON completions + usage logs. |
| `text_ai_service.py` | Shared text-AI layer: narratives, protocol helpers, assistant voice rules. |
| `narrative_orchestrator.py` | Generates per-feature + closing narratives for the PDF protocol. |
| `narrative_schemas.py` | Expected JSON shapes for those narratives. |
| `feature_context.py` | Small CV slices per feature so the LLM stays grounded in measurements. |
| `vision_context.py` | Attaches the right pose photos when using OpenAI Vision. |
| `recommendation_rules.py` | Deterministic hints injected into LLM prompts. |
| `clinical_guardrails.py` | After the LLM: block bad clinical claims / enforce structure. |
| `answer_summary.py` | Turns questionnaire codes into readable labels. |
| `assistant_agent.py` | ReAct-style Beauty Assistant that calls report tools. |
| `assistant_tools.py` | Tools that read sections of the stored assessment. |
| `image_client.py` | Provider-agnostic image edit (OpenAI Images Edits / OpenRouter chat image modalities); provider via `IMAGE_PROVIDER`→`LLM_PROVIDER`→key. |
| `visual_generation.py` | AI image edits (hair / outfit / aging) via `image_client`: three independent single-call prompts with shared natural-language opening, scope-fence first, inline CV phrase anchors (ADR-035). |
| `projected_after_ai.py` | Generative projected AFTER face via `image_client` (fixed `PROJECTED_AFTER_PROMPT` best-groomed makeover); owns `projected_after_enabled` flag. |

---

## Reports, PDF, protocol

**Important:** The branded ~16-page Qoves protocol PDF users download is built **in the browser** (`utils/reportPdf.js` + jsPDF), not by `report_pdf.py`. The backend builds/stores the **protocol text bundle** (narratives + structured data); the FE turns that into the visual PDF when a front photo is present.

| File | What it does | Used on FE PDF download? |
|------|----------------|---------------------------|
| `protocol_service.py` | Builds AI protocol narratives and persists the bundle. | **Yes (indirect)** — FE needs `protocolNarrative` / `featureNarratives`. |
| `protocol_storage.py` | Saves that protocol JSON to disk (+ Mongo fields). | **Yes (indirect)** — load/save path for the bundle. |
| `protocol_page_schema.py` | Canonical section map for the protocol bundle. | Indirect — shapes what gets generated/stored. |
| `report_sections.py` | Formats sections for admin review, assistant tools, and markdown fallbacks. | Not for drawing PDF pages. |
| `report_status.py` | Status labels (draft / pending review / approved) and PDF-gate helpers. | Gates *whether* download is allowed. |
| `report_pdf.py` | ReportLab PDF from markdown. | **Fallback only** — `GET /api/assessments/{id}/pdf` when no front photo in the UI; not the branded protocol. |

---

## Photos & helpers

| File | What it does |
|------|----------------|
| `photo_storage.py` | Saves assessment photos under public uploads. |
| `photo_validation.py` | Checks required poses exist before analysis. |
| `image_utils.py` | Decodes base64 / data-URL images for APIs. |

---

## Tests (`tests/`)

Each `test_*.py` covers the matching module (hair, silhouette, guardrails, serialization, etc.). Run with the project’s pytest setup or `python -m compileall backend` for a quick syntax check.

---

## Mental model

The staged pipeline above is the canonical flow. Module layout:

```
main.py
  └── routers  →  auth / repositories / services
        └── analyze_face
              ├── multi_view → mediapipe (+ pose, smile, silhouette…)
              ├── opencv_metrics, eye_analysis, face_crop
              └── cv_report (+ hair, profile, skin, prototypicality…)
                    ↓ saved assessment
              narrative_orchestrator / protocol_service / llm_client
                    ↓
              report UI · jsPDF (primary) · report_pdf (fallback) · Beauty Assistant
```

For API shapes and domain fields, see [api-contracts.md](./api-contracts.md) and [domain-models.md](./domain-models.md).
