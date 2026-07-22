# Architectural Decision Records (ADR)

This file documents the major design and architecture decisions made for the MyFace platform.

## ADR-001: Tech Stack Selection
Date: 2026-07-01  
Status: accepted  

### Context
The MyFace platform requires a fast, interactive frontend onboarding process, a payment gate, and a highly complex facial landmark detection and computer vision analysis pipeline. The final MVP must be compatible with Replit hosting for client convenience.

### Decision
We chose a separated, decoupled micro-architecture:
- **Frontend:** Next.js 15 (React) styling via TailwindCSS. Gated pages are handled inside React components with localStorage fallback.
- **Backend:** Python FastAPI backend. This allows us to import and execute `mediapipe` (for 478 landmark Face Mesh) and `opencv-python-headless` (for image cropping, pixel skin sampling, and geometry analysis) natively.
- **Database:** MongoDB Atlas utilizing the async `motor` driver. A document-oriented store is perfect for storing highly nested, unstructured MediaPipe JSON coordinates and the dynamic `cvReport` schemas without requiring complex SQL tables.
- **Integrations:** Direct API integration with Stripe Checkout and PayPal Orders v2 for gated reporting.

### Consequences
- Frontend and backend can be hosted and scaled independently (e.g., Vercel for frontend, separate VPS or Replit for backend).
- Python compute costs are decoupled from the static UI page loads.
- Complex geometric facial coordinates fit naturally as nested JSON subdocuments in MongoDB assessments.
- Local and Replit environments must both support Python and Node.js dependencies.

---

## ADR-002: Separated AI Narrative and CV Measurement Data
Date: 2026-07-03  
Status: accepted  

### Context
Using LLMs like OpenAI GPT to generate facial metrics introduces risk of hallucination (e.g., claiming a symmetry score of 98% when OpenCV measures 82%). However, users prefer written narrative explanations over raw numbers.

### Decision
We decoupled numerical measurements from narrative generation:
- The backend CV engine calculates all landmark coords and metrics first, writing them to `analysis.cvReport` in MongoDB.
- OpenAI GPT is only invoked after the report is stored, parsing the *existing* measurements and questionnaire answers to write narrative summaries.
- The output of the LLM is stored in a separate collection field `aiNarrative`, keeping the `cvReport` field completely deterministic and immutable.

### Consequences
- No risk of AI hallucinating numerical metrics or facial scores.
- Clear audit path: if the AI server fails or is missing an API key, the platform falls back gracefully to template-based report summaries without breaking the underlying CV report metrics.

---

## ADR-003: Multi-View CV Pipeline and Local Photo Storage
Date: 2026-07-09  
Status: accepted  

### Context
Qoves-style analysis requires multiple photo angles (front, profiles, quarter views, smile, top of head), physical ruler scaling for mm cephalometrics, and persisted photos for report sections (e.g. naso-aural ratio on side profile). MyFace previously ran MediaPipe only on the front photo and stored pose key names without image files.

### Decision
- Run MediaPipe independently per uploaded pose via `multi_view.py`.
- Add ruler calibration fields to questionnaire answers for px→mm scaling (`calibration.py`).
- Implement profile, quarter, smile, and hair analysis modules; merge into `cvReport` in `analyze_face.py`.
- Persist photos via `LocalPublicPhotoStorage` under `public/uploads/assessments/{assessmentId}/` with MongoDB `photos` map.
- Gate production migration with `docs/pre-prod-checklist.md` (S3/R2, signed URLs, GDPR deletion).

### Consequences
- Profile cephalometrics use MediaPipe landmarks on profile photos (best-effort; not Qoves 529-point proprietary model).
- Dev photos are publicly served under `/uploads/` — must not ship to production without storage migration.
- `photosKeys` retained for backward compatibility; `photos` map is source of truth for URLs.

---

## ADR-004: Unified Backend Text AI Service
Date: 2026-07-09  
Status: accepted  

### Context
Text AI was split across `openai_client.py`, `beauty_assistant.py`, and client-side `protocolGenerator.js` / `openai.js` with inconsistent safety rules, no payment gating, and duplicated prompts.

### Decision
- Consolidate all text LLM usage in `backend/text_ai_service.py` (narrative, protocol, assistant).
- Gate AI endpoints behind completed payment (`backend/ai_access.py`); admins bypass.
- Persist `protocolNarrative` / `featureNarratives` on assessments; compress assistant history via `sessionSummary` on conversations.
- Remove legacy markdown report generation (`/api/generate-report`, `utils/openai.js`).

### Consequences
- Single place to update non-surgical safety instructions and Groq/OpenAI provider config.
- Beauty Assistant cost scales with session summary refresh (every 6 user messages) instead of full report context each turn.
- Unpaid users see template protocol fallback locally; paid users get server-generated protocol. See ADR-011 for later unification of NL feature access with dashboard auth.

---

## ADR-005: PDF-First Clinical Protocol Bundle with Structured Outputs
Date: 2026-07-09  
Status: accepted  

### Context
The Qoves protocol PDF (16 pages) is the primary client deliverable. Monolithic `generate_protocol_narrative` produced weak grounding, and frontend `buildFeaturePages` fallbacks contained invasive procedure language. Beauty Assistant needed on-demand report section access without dumping full context each turn.

### Decision
- Generate **10 per-feature** narratives via OpenAI strict `json_schema` + Pydantic + `clinical_guardrails.py`.
- Store `featureNarratives` on assessment and in `protocol.json`; expose via `GET /protocol`.
- Stitch `protocolNarrative.features` compat shim for `QovesProtocolReport` / jsPDF.
- Beauty Assistant uses ReAct loop with `assistant_tools.py` (CV + protocol fetch tools).
- Client jsPDF remains canonical PDF renderer when front photo exists; server `GET /pdf` is summary fallback.

### Consequences
- Protocol generation cost scales with 10+ small LLM calls but failures are isolated per feature.
- Admin review can validate stored JSON before publish.
- Assistant factual answers require tool calls to measured sections.

---

## ADR-006: URL-Synced SPA Routing (Minimal Migration)
Date: 2026-07-10  
Status: superseded by ADR-007  

### Context
The frontend was a single-page app mounted at `/` with all navigation driven by React `stage` state. URLs never changed, so browser back/forward, bookmarking, and shareable report links did not work.

### Decision (initial)
Keep the existing `App.jsx` monolith and sync `stage` with the browser URL via a catch-all route.

### Consequences
Superseded — see ADR-007 for the proper App Router split.

---

## ADR-007: Next.js App Router with Analysis Route Group
Date: 2026-07-10  
Status: accepted  

### Context
ADR-006 used a catch-all route hosting the entire SPA. Users needed real nested routes, especially grouping the onboarding flow under `/analysis` with full-bleed layouts (no site navbar) matching the questionnaire design. Photo confirmation and upload should not be top-level routes.

### Decision
- Lift shared state into `AppProvider` (React Context).
- Create proper Next.js pages:
  - `app/analysis/*` — welcome, questionnaire, confirm, upload, scanning (no navbar, `AnalysisShell`).
  - `app/(main)/*` — dashboard, history, billing, admin, report, payment-success (`AppShell` with navbar).
- `utils/routes.js` defines canonical paths; legacy `STAGES` map to routes for localStorage restore.
- Root `/` redirects by role; `export const dynamic = 'force-dynamic'` on root layout to avoid SSR localStorage errors.

### Consequences
- Each URL is a real Next.js route; browser back/forward works natively.
- Analysis pages are full viewport height without navbar offset.
- Page components remain thin wrappers over existing UI components.
- Report deep links at `/report/[assessmentId]` hydrate via `fetchAssessment` in `AppProvider`.

---

## ADR-008: All Photo Poses Required for Analysis
Date: 2026-07-10  
Status: accepted  

### Context
Multi-view CV metrics (profile cephalometrics, quarter oblique, smile dynamics, top-of-head hair) were optional, causing placeholder fallbacks and misleading PDF copy when poses were missing.

### Decision
- Require all 7 canonical poses (`front`, `leftProfile`, `rightProfile`, `left45`, `right45`, `smile`, `topHead`) before analysis starts.
- Enforce on frontend (`PhotoUpload.canAnalyze`) and backend (`photo_validation.validate_required_poses` on `POST /api/assessments`).

### Consequences
- Higher upload friction but eliminates stub metrics and enables full Qoves-style report parity.
- Demo photo injector fills all 7 poses for dev testing.

---

## ADR-009: LLM-Synthesized Protocol Closing
Date: 2026-07-10  
Status: accepted  

### Context
Closing page used deterministic stitch of 4 feature summaries — generic and not assessment-specific.

### Decision
- Add `generate_closing_synthesis_async()` after all 10 feature narratives complete.
- Input: all subsection bodies, action cards, CV summary, client goals.
- Fallback: existing `stitch_closing_paragraphs()` on LLM failure.

### Consequences
- One additional LLM call per protocol generation; better closing cohesion at modest cost.

---

## ADR-010: Neck Metrics Deferred to MediaPipe Pose
Date: 2026-07-10  
Status: superseded by ADR-016  

### Context
FaceMesh landmarks do not extend below the jaw; neck width/length used jaw proxies that overclaim precision.

### Decision
- Mark `cvReport.neck.dataSource` as `"approximate"` with explicit limitation text.
- Defer MediaPipe Pose Landmarker integration to a follow-on milestone.

### Consequences
- Report copy and LLM guardrails must not claim clinical neck measurements until Pose is integrated.

---

## ADR-016: MediaPipe Pose for Neck Metrics
Date: 2026-07-10  
Status: accepted  

### Context
ADR-010 deferred neck length/posture until a body model could see shoulders. MediaPipe Pose (`mp.solutions.pose`) is already available via `mediapipe==0.10.14` and can run alongside FaceMesh on the front photo.

### Decision
- Add `backend/pose_analysis.py` (Pose Landmarker, static image mode).
- `neck_metrics(landmarks, pose)` uses FaceMesh jaw + Pose shoulders when both shoulders are visible (`visibility ≥ 0.5`):
  - Neck length = chin → shoulder midline / face height
  - Head-forward posture = ear–shoulder horizontal offset vs vertical (`headPostureAngleDeg`)
  - Neck width remains jaw width / IPD (superior neck column); also store `shoulderWidthPct`
  - `dataSource: "measured"`; omit approximate limitation text
- If shoulders are not visible (tight crop / clothing), keep ADR-010 approximate fallback.
- Surface posture angle / data source in `CvReportView` and `feature_context` facts.

### Consequences
- Front photos that include shoulders produce measured neck length and posture.
- Tight face-only crops still fall back to approximate jaw proxies.
- Pose adds a second model pass on the front image (modest latency).

---

## ADR-011: Unified Dashboard Access Tier for NL Features
Date: 2026-07-10  
Status: accepted  

### Context
AI narrative, protocol generation, AI visuals, and Beauty Assistant were gated behind a second payment check (`require_paid_ai_access` / `canUsePaidAi`) even after a user could reach the dashboard and open assessments. That split tier confused product access and blocked NL features for eligible users.

### Decision
- Any authenticated user who can access an assessment (same tier as dashboard) may use all natural-language / AI report features.
- Remove payment checks from `backend/ai_access.require_paid_ai_access` (auth-only) and from `Report.jsx` feature unlocks.
- Keep existing admin approval workflow for client full-report / PDF unlock unchanged.
- Analysis entry may still use payment / prior-assessment access via `userHasAnalysisAccess` and `POST /api/assessments` payment checks.

### Consequences
- One product tier for report tools once the user is in the app; approval remains the client visibility gate.
- Assistant hourly rate limits still apply.

## ADR-012: One-Shot NL Enrichment in Assessment Pipeline
Date: 2026-07-10  
Status: accepted  

### Context
Opening a report called `POST /ai-narrative` (and often protocol generation) whenever local state lacked stored text. That re-ran expensive LLM work on every open and could overwrite or delay the report experience.

### Decision
- Run executive narrative + protocol/feature narratives once inside `POST /api/assessments` after CV + photo persistence (`enrich_assessment_nl_content`).
- Report open only **loads** stored `aiNarrative` / protocol via GET; it must not trigger generation.
- `POST /ai-narrative` is idempotent; `force=true` is admin-only (Admin Review regenerate).
- `POST /ai-protocol` remains available for incomplete/legacy assessments but is not called from the report viewer.

### Consequences
- Scanning/upload waits longer (NL included in pipeline).
- Reopening reports is cheap and stable.
- Assessments created before this change may lack NL until admin regenerate or a new upload.

## ADR-013: Second-Person Coaching Voice Without Tech Jargon
Date: 2026-07-10  
Status: superseded by ADR-017  

### Context
Protocol PDF and assistant copy mixed third-person clinic narration (“the client…”) with implementation details (MediaPipe, OpenCV, computer-vision). That broke the premium coaching tone and exposed behind-the-scenes tech.

### Decision
- All NL system prompts include shared `VOICE_RULES` (you/your) and `NO_TECH_JARGON_RULES` (no MediaPipe/OpenCV/CV/pipeline language).
- Guardrail templates, closing stitchers, frontend closing fallbacks, Beauty Assistant, and report UI subtitles use second-person aesthetic language only.
- Legal Disclaimer/Privacy pages may still use “client” in a legal sense.
- Cover titles may personalize with the reader’s name.

### Consequences
- New assessments and regenerations read as direct coaching.
- Older stored narratives keep prior wording until re-upload or admin force-regenerate.

## ADR-017: Qoves-Style Third-Person Report Voice (Subject as Subject)
Date: 2026-07-10  
Status: accepted  

### Context
ADR-013 moved PDF/protocol copy to second person (you/your). Qoves-style clinical protocol PDFs instead narrate in third person with the assessed person as the grammatical subject (“the subject…”, or a provided name). Chat coaching still benefits from second person.

### Decision
- **PDF / protocol / executive / feature narratives:** third person with **the subject** as the grammatical subject (prefer the subject’s name when provided). Shared `NARRATIVE_VOICE_RULES` + `NO_TECH_JARGON_RULES` on narrative/protocol system prompts only.
- **Hard-coded PDF/protocol fallbacks** (`qovesProtocolModel`, `reportPdf`, guardrail templates, closing stitchers, CV `explanation` strings) use the same third-person subject voice.
- **Beauty Assistant** keeps second person (`ASSISTANT_VOICE_RULES` / `assistant_agent`); image-generation prompts are unchanged.
- Do not use “the client” as the default referent in narrative copy (legal/privacy pages may still say client/reader).

### Consequences
- New assessments and regenerations read as clinic-style subject reports in the PDF/protocol.
- Older stored narratives keep prior wording until re-upload or admin force-regenerate.
- Assistant chat remains direct coaching (you/your).

## ADR-014: OpenAI Vision Enrichment for Narratives (Optional Layer)
Date: 2026-07-10  
Status: accepted  

### Context
Feature narratives were text-only (scores + facts). Users want GPT multimodal context from the correct pose photos without replacing MediaPipe/OpenCV measurements.

### Decision
- Keep CV provider local for all measurements.
- When `LLM_PROVIDER=openai` and `OPENAI_VISION_NARRATIVE` is not disabled, attach compressed pose images to feature narrative (and executive narrative front photo) calls via a dynamic `FEATURE_VISION_POSES` map.
- Hair is the special case: `front` + `topHead`. Other features use report-aligned poses only.
- Groq / non-OpenAI text providers remain text-only.

### Consequences
- Better visual grounding for OpenAI narrative/protocol copy at higher token cost.
- Mapping lives in `backend/config.py` / `backend/vision_context.py` for future expansion (crops, more poses).

---

## ADR-015: Always-On Hair Mask + Silhouette Profile Landmarks
Date: 2026-07-10  
Status: accepted  

### Context
Hair segmentation was gated behind `HAIR_SEGMENTATION_ENABLED` and returned `None`, so deploys never changed hair output. Profile Tier C formulas ran on FaceMesh landmarks at 90°, which are unreliable past ~60–70° yaw. New nose fields were computed but not shown in the UI/PDF.

### Decision
- Remove the `HAIR_SEGMENTATION_ENABLED` kill-switch. OpenCV HSV hair-mask segmentation always runs in `analyze_hair_photo` / `hair_segmentation.py` as part of the analysis pipeline (BiSeNet remains a future upgrade path, not an env gate).
- Prefer silhouette anatomical points from `profile_silhouette.extract_profile_silhouette_points` for soft-tissue profile angles; merge with FaceMesh ears when available (`landmarkSource`: `silhouette` | `facemesh` | `silhouette+facemesh`).
- Surface Tier C fields (`nasofrontalAngleDeg`, `nasolabialAngleDeg`, `dorsalHump*`, etc.) in `cvReport.nose` explanation, `CvReportView`, `qovesProtocolModel`, and `feature_context` measured facts.

### Consequences
- Hair and profile numbers can change without setting env vars.
- Silhouette estimates are coarse; label `landmarkSource` so narratives do not overclaim clinical cephalometrics.
- Existing assessments keep prior stored `cvReport` until re-analyzed.

---

## ADR-018: Latest-Only Generated Report Text (No protocolData)
Date: 2026-07-12  
Status: accepted  

### Context
Protocol action cards (`protocolData`) were generated and dual-written but unused in the Qoves UI/PDF. Closing text could be synthesized on the client from `aiNarrative` without persistence. File `protocol.json` could shadow richer Mongo fields. Generated report text needed a clear latest-only source of truth across executive narrative, protocol/feature copy, AI visual prompts, and Beauty Assistant chat.

### Decision
- Remove `protocolData` from generation, Mongo writes, `protocol.json`, APIs, FE props, and the Beauty Assistant `get_protocol_cards` tool.
- Treat Mongo `aiNarrative`, `protocolNarrative`, `featureNarratives`, and `aiVisuals` as latest-only SOT; `conversations` holds assistant messages linked by `assessmentId`.
- `protocol.json` mirrors `{ protocolNarrative, featureNarratives }` only; Mongo wins when complete.
- Always persist `protocolNarrative.closing` (LLM or measured fallback); FE must not invent closing. Admin `aiNarrative` edits refresh stored closing.
- Completeness helper: `backend/report_content.report_content_status`.

### Consequences
- One fewer LLM call per protocol enrich; smaller protocol payload.
- Legacy assessments may still have `protocolData` until the next protocol persist (`$unset`).
- UI/PDF closing matches stored server text.

---

## ADR-019: Remove Ruler Calibration (No px→mm Scale)
Date: 2026-07-12  
Status: accepted  

### Context
ADR-003 added questionnaire ruler fields (`mouthWidthMm`, `philtrumLengthMm`) and `calibration.py` for physical mm cephalometrics. The FE ruler UI was later removed, so calibration always returned `mmPerUnit: null`. Absolute-mm fields were unused; angles and ratios already drive the product.

### Decision
- Delete `backend/calibration.py` and `backend/tests/test_calibration.py`.
- Stop writing `cvReport.calibration` and stop accepting `mm_per_unit` in profile cephalometrics.
- Profile distances use normalized landmark units only (`chinProjectionNorm`, relative E-line values). No physical mm scale in the pipeline.

### Consequences
- No true millimetre chin/E-line measurements until a new scale source is introduced.
- Older assessments may still contain a stored `calibration` block; new analyses will not.
- Supersedes the ruler-calibration bullet of ADR-003 (multi-view photo storage and other ADR-003 decisions remain).

---

## ADR-020: OpenRouter as Optional Text LLM Provider
Date: 2026-07-13  
Status: accepted  

### Context
Narrative enrichment hits Groq TPM/RPM limits under parallel feature calls. OpenRouter offers an OpenAI-compatible gateway to many models (including `:free` variants) behind one API key, without changing prompt/orchestrator code.

### Decision
- Extend `llm_client.resolve_llm_provider` / `get_chat_llm` to support `LLM_PROVIDER=openrouter` with `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (default `meta-llama/llama-3.3-70b-instruct:free`), and optional `OPENROUTER_HTTP_REFERER` / `OPENROUTER_APP_TITLE` attribution headers.
- Auto-select OpenRouter when `LLM_PROVIDER` is unset and only `OPENROUTER_API_KEY` is present (Groq still wins if both keys exist).
- Structured completions use `json_object` (same path as Groq), not OpenAI strict `json_schema`.
- Vision narrative enrichment remains OpenAI-only (ADR-014); OpenRouter text path is text-only unless a future ADR adds multimodal routing.
- AI image generation continues to require `OPENAI_API_KEY` regardless of text provider.

### Consequences
- Operators can switch text LLMs via env without code changes.
- Free OpenRouter models are still rate-limited (~20 RPM / 50–1000 RPD); they do not remove quota pressure for one-shot multi-feature enrichment.
- Failed free-tier requests still consume daily quota — retries must stay conservative.

---

## ADR-021: Slim Feature Narrative Schema + No Scores in Report Prose
Date: 2026-07-13  
Status: accepted  

### Context
Feature LLM JSON required `measuredFacts`, `limitations`, `description`, `recommendations`, and `evidenceTier`. Free/OpenRouter models often fail that shape even when HTTP 200 succeeds, so PDFs fell back to templates. Protocol PDF/UI only render feature `summary` and subsection bodies. Separately, numeric scores in narrative prose are redundant with CV UI and cause invented/`X/100` leakage.

### Decision
- LLM feature schema asks only for `featureId`, `summary`, and `subsections[{title, body}]`.
- Server hydrates `measuredFacts`, `limitations`, default `evidenceTier`, and empty `description`/`recommendations` after the LLM response.
- Hard constraint for executive narrative, feature narratives, and protocol overview/closing: no numeric scores in report prose (`X/100`, `score N`, etc.). Prompts use qualitative CV summaries; `strip_score_language` runs before persist.
- CV numeric scores remain available to the product UI and Beauty Assistant; they must not appear in PDF/protocol narrative copy.

### Consequences
- Higher accept rate on weak free models; PDF copy stays qualitative.
- Stored feature blobs may still include CV `measuredFacts` (including score strings) for tooling — those arrays are not rendered as PDF prose.
- Older assessments with score-heavy narrative text are unchanged until re-enriched.

---

## ADR-022: Interactive Panel Text Sources (Dedupe + Split)
Date: 2026-07-13  
Status: accepted  

### Context
Interactive Features Analysis panels repeated the same CV `explanation` in multiple UI slots. Protocol LLM `featureNarratives` already existed for the PDF/protocol document but were unused in interactive panels. Facial Assessments (dimorphism, prototypicality, proportions, symmetry, face shape) are metric-driven and should not depend on LLM availability.

### Decision
- Exactly **one** prose block per interactive feature panel (`FeatureProseBlock`).
- Features Analysis prose prefers `featureNarratives` (eyebrows ← eyes subsection `"Eyebrows"`); else single CV explanation; else “Narrative pending”.
- Facial Assessments keep **metric-driven second-person templates** in CV generators — no LLM.
- **Smile** is included in `FEATURE_NARRATIVE_IDS` (LLM `featureNarratives.smile`) for interactive Features Analysis and assistant tools; it is **not** a protocol PDF page (`PROTOCOL_FEATURE_IDS` / 16-page map unchanged).

### Consequences
- Interactive report and protocol PDF can share the same feature narrative store without tripling CV copy in the UI.
- Assessment sections remain available even when NL enrichment is incomplete.
- Re-enrichment (or first enrichment after this change) generates an 11th narrative key `smile` without expanding the PDF page count.

---

## ADR-023: PostgreSQL + JSONB (supersedes ADR-001 database engine)
Date: 2026-07-13  
Status: accepted  
Supersedes: ADR-001 database choice (MongoDB Atlas / Motor)

### Context
MongoDB fit nested `cvReport` / landmarks well, but the team preferred SQL tooling, real foreign keys, and a greenfield schema without preserving Atlas ObjectId strings. Nested MediaPipe payloads must remain document-shaped.

### Decision
- **PostgreSQL** via SQLAlchemy 2.0 async + asyncpg + Alembic.
- **UUID** primary keys (`gen_random_uuid` / `uuid4`); API still exposes string `id`.
- **JSONB** columns for nested assessment payloads (`analysis`, narratives, photos metadata, review_log, payment `raw`).
- Normalize Beauty Assistant messages into `conversation_messages` (not JSONB arrays).
- Env: `DATABASE_URL` (replaces `MONGODB_URI`). Gate: `is_db_configured()`.
- No Atlas data import — empty DB / schema create on startup (`create_all`) + Alembic revision `20260713_0001`.

### Consequences
- Nested CV documents stay flexible without metric-table explosion.
- Cascading deletes and partial unique `(user_id, scan_id)` are native SQL.
- Operators need a Postgres instance; Motor/pymongo are removed from dependencies.

---

## ADR-024: Assumed-Scale mm for Interactive Parsing Metrics
Date: 2026-07-14  
Status: accepted  

### Context
The SegFormer + MediaPipe notebook exports mm distances using assumed IPD = 63.5 mm to align with Qoves-style reference bands. ADR-019 forbids clinical px→mm rulers in the core CV pipeline, but interactive Features Analysis needs comparable numeric cards.

### Decision
- Face-parsing metrics may emit **mm** values with metadata `scale: "assumed_ipd_63.5"` and `scaleNote` on `featureParsing`.
- Metrics live in **`featureParsing` JSONB only** — not in immutable `analysis.cvReport` scores.
- Interactive Features Analysis panels may show parsing crops/metrics; **protocol PDF and Facial Assessments sections do not consume parsing output**.

### Consequences
- UI must label estimated mm as non-clinical (tooltips).
- Future R&D may add calibration or score-band mapping without rewriting CV measurements.

---

## ADR-025: Async Postgres-Tracked Assessment Pipeline
Date: 2026-07-14  
Status: accepted  

### Context
`POST /api/assessments` blocked for minutes running CV + NL + (planned) parsing inline. Users need a Qoves-style preparation screen and the ability to close the tab while work continues.

### Decision
- Fast **POST** validates poses, persists JPGs, creates assessment with `pipeline.status = queued`, returns `assessmentId` + `processing: true`.
- In-process **worker loop** on FastAPI startup claims rows (`FOR UPDATE SKIP LOCKED`) and runs stages: `cv` → `narratives` → `parsing` → `projected_after` with per-stage retries.
- `pipeline` and `featureParsing` JSONB on `assessments`; workflow `status` flips to `pending_review` (or dev auto-approve) when `pipeline.status = ready`.
- Frontend **AnalysisPreparing** polls `GET /api/assessments/{id}`; Dashboard shows Processing/Failed badges.

### Consequences
- Report is not immediately available after upload; Dashboard is the recovery path.
- Worker is single-process (no Redis/Celery v1); multi-worker deploys should run one worker instance or add a dedicated job runner later.
- Email on ready is deferred until SMTP product hooks land.

---

## ADR-026: Backend Full-Face Projected AFTER (v1)
Date: 2026-07-14  
Status: accepted  

### Context
Protocol and PDF BEFORE/AFTER pairs showed empty AFTER placeholders. A measurement-guided “potential” portrait is required for report parity. This is **not** OpenAI AI Visuals (`ai_visuals`).

### Decision
- Add pipeline stage **`projected_after`** after `parsing`; worker runs `project_full_face_after` (OpenCV + landmark masks) and saves **`projected/full.jpg`** or **`full.png`** (extension from image magic bytes).
- Store metadata in **`projected_after` JSONB** (`status`, `full.publicUrl`). Disk still holds **one** full asset only.
- Gate with **`PROJECTED_AFTER_ENABLED`** (default `false`); when disabled, stage sets `status: skipped` and pipeline still completes.
- Frontend reads `projectedAfter` from assessment payload; **feature pages crop the full AFTER client-side** with the same `getFeatureBox` / landmark keys as BEFORE (`resolveFeatureAfterImage`). Overview stays full-face. Requires AFTER geometry registered to front (pipeline-generated); misaligned manual uploads will crop wrongly until regen.

### Consequences
- Enabling requires env flag + pipeline re-run for existing assessments.
- Python projection is a simplified port of `aestheticProjection.js` full-face path; pixel parity with JS is not guaranteed in v1.
- AI Visuals remain a separate on-demand feature and must not populate protocol AFTER slots.
- Per-feature AFTER files on disk remain deferred; read-time crops are enough for framing parity.
- **Gemini / unregistered AFTER:** feature AFTER framing mirrors BEFORE: live `getFeatureBox` on `projectedAnalysis.landmarks` for eyes (periorbital), jaw, chin, ears, neck, hair. When AFTER AR/size ≠ front, **face-centered cover-fit** onto BEFORE canvas (AFTER-only; PRS GO / ASPS same-format B&A practice) then remap landmarks; `FEATURE_MIN_PX` scaled by short-side ratio. `projectedAnalysis.cvReport` for other features / fallback. Similarity warp (`alignAfterToBefore`) remains overview + skin half-split only.
- **AFTER measurements:** after a successful `projected/full` write, the pipeline/admin path runs local CV on that image into **`projected_analysis`** JSONB (`cvReport`, landmarks, metrics). BEFORE `analysis` remains immutable.

---

## ADR-027: Projected AFTER CV in `projected_analysis`
Date: 2026-07-14  
Status: accepted  

### Context
Protocol AFTER images need measurable facial metrics for future before/after comparisons. BEFORE `analysis.cvReport` must stay immutable per architecture rules.

### Decision
- Add assessments column **`projected_analysis` JSONB** parallel to `analysis`.
- After `projected_after` becomes `ready`, run `run_face_analysis` on `projected/full.jpg|png` (front-only, no multi-view pose enrichments) via `run_projected_analysis_now`.
- Soft-fail CV into `projected_analysis.status=failed` without marking `projected_after` failed.
- When AFTER is skipped/failed, set `projected_analysis.status=skipped`.

### Consequences
- Clients read `projectedAnalysis` from assessment GET; no separate endpoint in v1.
- Protocol/PDF **feature AFTER** mirrors BEFORE live-first features via `projectedAnalysis.landmarks` + `getFeatureBox` (see `AFTER_LIVE_FIRST_FEATURES`); cover-fit AFTER onto BEFORE canvas when AR/size differs; `FEATURE_MIN_PX` scaled by short side; stored `cvReport` / `eyeAnalysis` for other features and as fallback. Skin half-split continues to use face-align.
- SegFormer / AFTER narratives remain out of scope until a later ADR.

---

## ADR-028: Temple-Geometry Norwood Staging (1–3)
Date: 2026-07-14  
Status: accepted  

### Context
Hamilton–Norwood stages 1–3 are defined by **hairline/temple shape**, not scalp coverage %. Density-first `_norwood_stage` misclassified stage 1 vs 2 when lighting or forehead ROI diluted `densityPct`.

### Decision
- Primary staging for 1–3 uses `_temple_recession_metrics` + `_norwood_stage_geometric` in `hair_segmentation.py` / `hair_analysis.py`.
- Density / crown escalate only once stage ≥ 3 (stage 4+).
- Keep density heuristic `_norwood_stage` only when segmentation/temple metrics are missing.
- Expose `templeMetrics` + `norwoodStagingMethod` on hair result; calibrate depth cutoffs via `scripts/calibrate_norwood_temples.py` before asserting production 1/2/3 boundaries.
- Type A variants and ethnicity-adjusted norms deferred.

### Consequences
- Existing stored `cvReport.hair.norwoodStage` values may change on re-analysis.
- Pre-calibration thresholds are directional; keep “(not a clinical diagnosis)” client language and avoid leaking metric key names into prose.

---

## ADR-029: Generative projected AFTER + provider-agnostic image client
Date: 2026-07-15  
Status: accepted  

### Context
The projected AFTER face was a deterministic OpenCV retouch (`project_full_face_after`), which produced flat, unconvincing results. The existing "AI Visuals" feature already generated realistic edits through OpenAI Images Edits. We want the AFTER face generated the same way, and — since the project already routes text LLM traffic through OpenRouter — images should be provider-agnostic (OpenAI **or** OpenRouter) driven by one setting.

### Decision
- New **`backend/image_client.py`** (replaces `openai_images.py`): one `generate_image_edit(prompt, image_bytes)` entry point abstracting two provider surfaces:
  - **OpenAI** — `POST /v1/images/edits` (multipart, `b64_json` in `data[0]`).
  - **OpenRouter** — `POST /v1/chat/completions` with `modalities:["image","text"]`, the source image as an `image_url` part in the user message; edited image returned as a data URL in `choices[0].message.images[0].image_url.url`.
- Provider resolution mirrors `resolve_llm_provider`: **`IMAGE_PROVIDER` → `LLM_PROVIDER` → key presence** (groq is not image-capable, so it falls through to key detection). Models via `OPENAI_IMAGE_MODEL` (default `gpt-image-1`) and `OPENROUTER_IMAGE_MODEL` (default `google/gemini-2.5-flash-image`).
- `visual_generation.py` (AI visuals) and **`backend/projected_after_ai.py`** (generative AFTER) both call the shared client. The AFTER prompt is identity/measurement-preserving (same person, bone structure, proportions, pose, lighting; no reshaping; no clinical/surgical imagery) and emphasizes the weakest features derived from `projection_strengths`.
- The pipeline (`generate_projected_after_now`) replaces the OpenCV call with the generative path. On provider unavailable/failure/crash, `projected_after.status` = **`pending`** (retryable, not `failed`); AFTER CV is skipped until a later retry succeeds. Landmarks are no longer required to start generation (downstream `projected_analysis` runs its own MediaPipe).
- The client never raises for expected failures (missing key, timeout, non-2xx); callers branch on the returned `error`.

### Consequences
- One env switch (`IMAGE_PROVIDER`/`LLM_PROVIDER` + matching key/model) selects the provider for **both** AI visuals and the AFTER face.
- The legacy OpenCV `backend/projected_after.py` (`project_full_face_after`) is **removed**; its still-needed pure helpers (`projected_after_enabled`, `projection_strengths`) moved into `projected_after_ai.py`.
- `pending` AFTER rows are expected during outages and are picked up by existing retry paths (admin regen, `rerun_projected_after.py`, pipeline worker) — consumers must treat `pending` as non-terminal.
- OpenRouter image models vary in edit fidelity; the default (`google/gemini-2.5-flash-image`) is chosen for identity-preserving image-to-image, and is overridable per deployment.

---

## ADR-030: Unified media storage interface (local filesystem ⇄ Replit Object Storage)
Date: 2026-07-15  
Status: accepted  

### Context
After the Replit migration the frontend is built and served from `artifacts/myface`. Backend-written media (poses, SegFormer parsing crops, projected AFTER images, protocol JSON) had been written into that Next `public/` dir so `next dev` could serve it at `/uploads/...`. That only works under the dev server: a Replit static/app deploy freezes files at build time, so any runtime-written upload would 404 in production. We need media that persists and serves in production, works for local Windows dev, and does not fork the codebase into two storage paths.

### Decision
- One interface, `backend/media_storage.py` `MediaStorage` (`put_bytes` / `get_bytes` / `delete` / `delete_prefix` / `exists`), accessed everywhere via `get_media_storage()`. Two implementations:
  - `LocalMediaStorage` — filesystem under `MEDIA_LOCAL_ROOT` (default `<repo>/var/media`), for local dev + tests.
  - `ReplitObjectMediaStorage` — Replit Object Storage via `replit-object-storage` (`Client()` auto-resolves `.replit` `[objectStorage] defaultBucketID`; optional `REPLIT_DEFAULT_BUCKET_ID`). Client + package import are lazy so the backend runs locally without the SDK.
- Backend chosen once by `MEDIA_STORAGE_BACKEND` (`local` | `replit`). Unset = auto-detect: `replit` when a Replit environment is detected (`REPL_ID`/`REPLIT_DEPLOYMENT`/`REPLIT_DB_URL`/`REPLIT_DEFAULT_BUCKET_ID`), else `local`. There is **no runtime fallback** — if `replit` is selected and the bucket errors, it raises (single source of truth per environment).
- Objects use forward-slash keys `assessments/{id}/{pose}.jpg`, `.../parsing/{feature}.jpg`, `.../projected/full.{png|jpg}`, `.../protocol.json`. `StoredPhoto.relativePath` = the key; `publicUrl` = `/api/media/{key}`.
- Serving: new open route `GET /api/media/{object_key}` (`backend/routers/media.py`) validates the key is under `assessments/`, streams bytes from the active backend with a content-type by extension. `/api/*` is already routed to the backend by Next (dev rewrite) and the Replit app router (prod), so the same URLs work everywhere and keep media same-origin (client-side canvas pixel reads in `cvReport.js` stay CORS-clean).

### Consequences
- Local Windows dev works with the filesystem backend; Replit uses Object Storage. Switching is one env var, and the frontend/DB never change (`/api/media/...` URLs are identical).
- The Replit Object Storage SDK only runs inside Replit and caps at Python `<3.13` (Replit is 3.11); local dev at 3.12 installs it fine but does not need it for the `local` backend.
- Access is open, matching the prior public `/uploads` behavior. Owner-only access (short-lived signed media tokens on `/api/media`) is a deferred follow-up; the route is the hook for it.
- Legacy on-disk assessments will not display after cutover to `replit` unless their bytes are uploaded into the bucket (optional one-time migration). `media_key_from_ref` still accepts legacy `/uploads/...` refs so reads resolve if the object exists.
- Supersedes the interim `artifacts/myface/public/uploads` writing (removed `backend/config.py` `PUBLIC_DIR`/`UPLOADS_ROOT`).

---

## ADR-031: Progressive per-pose bucket upload with draft/finalize; user timeline vs admin live status
Date: 2026-07-15  
Status: accepted  

### Context
The prior flow validated poses client-side, then on Submit compressed each pose (downscale to 1600px, JPEG q0.88), base64-encoded them, and POSTed all seven in one `POST /api/assessments` request that created the assessment and enqueued the pipeline. This lost image quality (unacceptable for a facial-analysis product), coupled upload to submit (a slow, single fat request), and forked the frontend into divergent paths (dead client-side CV branches, an AWS-fallback "Use Free Local Analysis Instead" retry). It also surfaced live pipeline stage status directly to end-users on the Dashboard/History/Preparing surfaces, exposing internal processing/failure detail and implying a self-serve, instant result that the admin-reviewed model does not provide.

### Decision
- **One creation path in every environment**, built on the ADR-030 `MediaStorage` interface (the only environmental difference is `MEDIA_STORAGE_BACKEND`): `POST /assessments/draft` (idempotent by `user+scanId`) → `PUT /assessments/{id}/photos/{poseId}` per validated pose → `POST /assessments/{id}/submit` (verifies required poses, sets answers/provider, enqueues `pipeline=queued`). The worker (ADR-025) is unchanged.
- **Full quality preserved end-to-end.** Poses upload as the original `File` bytes via `multipart/form-data`; nothing downscales or re-encodes on any path (`imagePayload.js` helpers become pass-throughs; the demo loader keeps originals too). Client MediaPipe validation runs on a throwaway 640px canvas copy and never touches the stored image. `save_pose` sniffs the real content-type from magic bytes, stores bytes unchanged, and keys `{poseId}.jpg` for pipeline compatibility; `GET /api/media/...` sniffs and returns the correct `Content-Type`.
- **Uploads are proxied through the backend, not direct-to-bucket.** Replit App Storage is GCS-backed but its SDK has no presigned-URL support and its workload-identity credentials cannot sign GCS URLs (`Cannot sign data without client_email`). Proxying via `/api/media/...` keeps per-upload auth and one identical code path in dev and prod; original-quality payloads (a few MB/pose) are fine over the proxy.
- **Users get a static timeline, admins get live status.** The user Preparing page is a static per-stage timeline (day estimates + "N DAYS LEFT") plus a non-functional express-delivery placeholder — no polling. Dashboard/History show a neutral "In preparation" vs "Ready" (report open still gated on `approved`/`published`). The live `cv → parsing → narratives → projected_after` tracker + a "Retry pipeline" action move to the admin views (`PipelineStatusPanel`, list badge); `pipeline` is added to the admin summary projection.
- **Cleanup.** Un-submitted drafts (`status="draft"`, `pipeline=null`) are excluded from the user history list (admins still see them). Dead client-side CV/AWS-fallback code is removed (`analyzeFace.js`, `Scanning.jsx`, `App.jsx`, the local-analysis retry button, `runFaceAnalysis*`, `formatProcessingBadge`); the compressed base64 `POST /api/assessments` create path is no longer used by the web app.

### Consequences
- Uploads happen progressively during selection, so Submit is instant (it only finalizes/enqueues); perceived latency drops and quality is bit-exact.
- Abandoned drafts can leave orphaned bytes in the bucket; a TTL sweep is a deferred follow-up (not built here).
- Server-side re-validation of photos remains out of scope (validation stays client-side).
- End-users no longer see processing/failure internals; recovering a genuinely failed pipeline is an admin/owner concern via `POST /assessments/{id}/retry-pipeline`.

---

## ADR-032: Qoves-style severity-gated narrative generation (null path, numeric scrub, enforced non-invasive vocabulary)
Date: 2026-07-15  
Status: accepted  

### Context
Per-feature report narratives read unlike the Qoves reference: every section was padded with the same SPF/hydration/sleep triad regardless of severity, raw deviation numbers (e.g. `0.04`) leaked into prose, sections contradicted themselves (jaw described as both "wide" and "narrower"), the sclera observation drifted into clinical-cause claims, and there was no enforced, enumerated ban on invasive/energy-based treatment vocabulary. The generation approach itself was sound — the defects were pipeline-level (prompt assembly + guardrails), not model-level.

### Decision
- **Severity gates content, computed before prompt assembly.** `feature_severity_bucket` + `get_severity_content_directive` (`backend/recommendation_rules.py`) map each feature's deviation magnitude (`_feature_deviation_magnitude` → `magnitude_label`) to `minimal | mild | moderate | notable` and return a bucket-specific recommendation directive injected into the user message by `_build_feature_messages`.
- **Null-recommendation path.** At `minimal` severity, every feature **except Skin** is instructed to output a short "no changes recommended" (2-3 sentences) and the length target is overridden away from the ~120-160 word band. Skin always retains a baseline routine (it is the canonical home of foundational care). Per-title `minLength` stays at 80 chars; 2-3 explanatory sentences clear it comfortably, so no schema/validator change was needed.
- **No raw numbers in prompts (root-cause).** `get_tier_hints` no longer embeds the magnitude float; `feature_context_as_prompt_text` scrubs raw int/float leaves from the `CV cues JSON` block via `_drop_numeric_leaves` (booleans/strings/nested kept). The qualitative form of every numeric already ships via `measuredFacts`/`deviationFacts`. The system prompt also forbids emitting raw decimals and restricts output to the supplied severity label.
- **Deterministic dedupe by confinement.** Because features generate in parallel (no runtime cross-check is possible), foundational SPF/hydration/sleep advice is confined to the Skin section: every non-Skin feature (all buckets) gets a directive not to restate it unless it is that feature's specific measured concern.
- **Directional consistency + backstop.** The system prompt and a jaw/cheeks hint require stating a classification once and staying consistent; a soft, logged `CONTRADICTION_PAIRS` check in `clinical_guardrails.py` surfaces `wide`/`narrow`, `full-prominent`/`flat-recessed`, `elevated`/`low` co-occurrences without churning good reports.
- **Sclera guardrail.** The eyes prompt and `CLOSING_SYNTHESIS_SYSTEM` require describing sclera color only as a single neutral visual/lighting observation, never a medical cause, and never repeated elsewhere; a soft validation flags sclera+cause language.
- **Enforced non-invasive vocabulary.** `STRICT_NON_SURGICAL_RULES` enumerates the ban list (Botox, fillers, injectables, laser, IPL, HIFU, Thermage, Endolift, microneedling, chemical peels, radiofrequency, Ultherapy, energy-based devices). `BANNED_TERM_PATTERN` is extended with tightly scoped `(?:chemical|laser|micro\w*)\s+peels?`, `radiofrequency`, `ultherapy`, `energy-based`. **Bare `peel(s)` is intentionally not banned** to avoid false-positives on the verb ("skin may peel"). On a banned-term hit the existing hard-reject path applies: regenerate up to `FEATURE_NARRATIVE_MAX_ATTEMPTS` (with `_RETRY_USER_HINT` now naming the banned vocabulary), then fall back to the deterministic guardrail template for that section only — the report never fails.

### Consequences
- Strong features get terse "no changes recommended" copy; weak features get the full, targeted protocol — matching the Qoves length profile and removing boilerplate padding.
- Numeric leaks are structurally impossible in the assembled prompt (removed at source, not just instructed), and the ban list is enforced pre-generation (prompt) and post-generation (regex → retry → per-section template).
- The contradiction and sclera checks are intentionally soft (logged, LLM copy retained) to catch regressions without churning otherwise-good reports; escalate to hard only if they prove reliable.
- **Deferred (tracked, not dropped):** surfacing shape-based Hamilton–Norwood staging *reasoning* in the hair narrative text (the CV metric already uses shape-based staging under ADR-028) is out of scope here and logged as an open backlog item in the sprint.

---

## ADR-033: Content-anchored null-path narratives (few-shot + grounding gate)
Date: 2026-07-15  
Status: accepted (refines ADR-032 null path)  

### Context
ADR-032's null path was **length-anchored** ("no changes recommended, 2-3 sentences"). A length constraint alone lets the model satisfy the target with generic template phrases ("balanced", "harmonious") because nothing forces it to reference the actual measured cues. The Qoves reference null sections (Nose, Eyes, Ears) are substantive because they still describe the specific measured geometry — the "no change" is the *conclusion*, not the *substance*.

### Decision
- **Content-anchored directive.** The `minimal`/non-Skin branch of `get_severity_content_directive` now requires a 3-part structure: (1) name the specific measured attributes from the cues, (2) explain why those values sit within the expected/balanced range (grounded in the stated classification), (3) close with "no non-surgical changes recommended". "balanced/harmonious/no deviations" may not appear unless paired to the specific attribute they describe. The old "2-3 sentences / do not stretch" cap is replaced with a "4-6 sentences (~70-120 words), fully describe attributes, do not pad" band. `min_length=80` is comfortably cleared, so no schema change.
- **Per-feature few-shot exemplars.** `NULL_PATH_FEATURE_GUIDE` (`recommendation_rules.py`) holds a per-feature exemplar (nose/ears/lips/… each with feature-specific vocabulary) injected into the **user message** by `_build_feature_messages` on the null path — not the shared system prompt, which is common to all features/severities. Few-shot beats instruction-only for precise formatting, and per-feature examples avoid biasing every section toward nose vocabulary.
- **Grounding validation (per-feature scope).** `null_path_grounded` (`clinical_guardrails.py`) verifies a null-path narrative references at least one concrete cue term (`null_path_grounding_terms` = curated distinctive anatomical nouns ∪ tokens auto-derived from `measuredFacts` keys, minus a stopword list tuned against a real key dump). It is a no-op for Skin, non-minimal severity, or features with no usable measured cues (`has_usable_measured_cues` — e.g. smile with no smile photo and only the "limited metrics" fallback). Curated terms deliberately exclude generic dimension adjectives and common prose words (`wide/full/low/profile/contour/…`) that collide with ordinary language and the ADR-032 `CONTRADICTION_PAIRS`.
- **Independent grounding retry budget + keep-best-LLM fallback.** `generate_feature_narrative_async` is a `while` loop with two budgets: `FEATURE_NARRATIVE_MAX_ATTEMPTS` (schema/banned, existing) and new `NULL_PATH_GROUNDING_MAX_RETRIES` (default 2), so a schema failure cannot starve grounding retries; total LLM calls per feature are bounded by their sum. An ungrounded-but-schema-valid null section triggers a corrective `_null_path_grounding_hint` regeneration; if the grounding budget is spent, the **last LLM copy is kept** (logged warning) rather than dropping to the generic template — the whole point is to avoid the boilerplate the template would reintroduce. Banned-term/schema hard rejects still fall back to the template (unchanged), except a usable-but-ungrounded copy seen along the way is now preferred over the template.

### Consequences
- Null sections read as substantive measured descriptions ending in "no change", matching Qoves, instead of interchangeable filler.
- Grounding is enforced structurally (validator + regeneration), not just requested; cue-sparse features degrade gracefully via the `< 2 terms` skip.
- The stopword list and curated term sets are a first pass — tuned against a real `measuredFacts` key dump; extend if new noise tokens or collisions appear.
- `smile` is included as the 11th non-Skin null-path feature (12th narrative feature overall); its cues are photo-dependent, so the skip-guard covers the no-smile-photo case.

---

## ADR-034: Fixed best-groomed projected-AFTER image prompt
Date: 2026-07-16  
Status: accepted (supersedes bounded-clause / barbershop AFTER prompt designs)  

### Context
ADR-029 introduced generative projected AFTER via `projected_after_ai.py` → `image_client`, with weakness-ranked focus via `projection_strengths` and static per-feature `_FEATURE_GUIDANCE` strings. That assembly caused overshoot (e.g. jawline reshaping on wide-jaw assessments) and added ~90 lines of dead prompt code with no reliable benefit.

### Decision
- **Single constant prompt.** `PROJECTED_AFTER_PROMPT` is the only text sent to the image-edit provider. `build_projected_after_prompt` returns it unchanged; `answers`, `cv_report`, and `metrics` are ignored (signature kept for pipeline/admin call sites).
- **Product intent.** Visible skin/eye improvement, flattering hair and facial-hair styling (length/style may change; beard/stubble/clean-shaven at model discretion), with identity lock on face shape, nose, lips, eyes, jawline, ears, and proportions. Pores and natural texture must remain visible (no airbrushed/plastic skin).
- **Remove CV-driven image focus.** Delete `projection_strengths`, `_FEATURE_GUIDANCE`, `_focus_features`, and `visual_generation` profile/context imports from the AFTER path.
- **Manual preview only.** `scripts/preview_projected_after_prompt.py` prints the constant for human provider testing; AI agents, pipeline workers, smoke tests, and CI must not invoke it (`scripts/preview_*` manual-only rule in `rules.md`).

### Consequences
- Simpler module (~50 lines); same single-call architecture (`generate_image_edit`).
- More output variance on hair/facial-hair styling is accepted in exchange for better groomed results.
- `projection_strengths` is no longer part of the Python AFTER module (JS anthropometrics weighting in the frontend, if any, is unchanged).
- Narrative/report numeric-ban rules (ADR-021/032) do not apply to this image-edit prompt — it is generative visual instruction only.

---

## ADR-035: AI visuals natural-language prompts with scope-fence isolation
Date: 2026-07-16  
Status: accepted  

### Context
`visual_generation.py` built hair / outfit / aging edit prompts with a label-style shared block plus a trailing `Client:` / `Context:` semicolon appendix. That style drifted from the working projected-AFTER natural-language prompts (ADR-034) and offered weak per-variant isolation (no explicit “change only X — leave Y exactly as is” fence before creative instruction). Pixel-level masking was out of scope; prompt scoping is the single-call lever.

### Decision
- **Shared opening.** All three variants start with `SHARED_VISUAL_OPENING` (identity lock + no medical/surgical imagery) in natural prose.
- **Scope-fence first.** Each variant’s body opens with an explicit change-only / leave-unchanged sentence before creative instruction (aging uses “skin maturation only” plus the shared identity opening).
- **Inline CV phrases.** `_cv_anchors` returns ready-to-insert phrases (`face_shape_phrase`, `hairline_phrase`, `hair_detail_suffix`, `skin_tone_phrase` from `skin.skinTone`) woven into sentences; missing/unknown values use grammatical fallbacks (`their face shape`, etc.), never the literal word `unknown`. Do not use `skin.tone` (evenness) for outfit color. No `Client:` / `Context:` appendix; `answers` / `metrics` unused in prompt text.
- **Three separate calls.** Keep `generate_visual_variants` calling `build_visual_prompt` once per selected type — no mega-prompt.

### Consequences
- Prompt text shape in `aiVisuals.variants[].prompt` changes; API response schema unchanged.
- Isolation is prompt-level only (not pixel masks); bleed risk remains bounded by single-purpose calls + fence wording.

**Amendment (2026-07-20):** Aging scope-fence expanded from skin-only to skin + hair + soft tissue per tier (ADR-038); `hairColor` gates temple-graying language.

---

## ADR-036: Frontend i18n with next-intl (en/de path prefixes)
Date: 2026-07-16  
Status: accepted  

### Context
MyFace needs German UI support with SEO-friendly locale URLs, static generation compatibility, and a maintainable translation catalog. The App Router frontend lives in `artifacts/myface` with almost all user-facing copy in client components.

### Decision
- Use **next-intl** (not i18next runtime) with App Router `[locale]` segment and **always-prefixed** paths (`/en/dashboard`, `/de/analysis`).
- Locales: **`en`** (default) and **`de`**. Middleware (`createMiddleware`) handles detection; `localePrefix: 'always'`.
- Messages in nested JSON: `artifacts/myface/messages/en.json` (English source) and `messages/de.json` (German). Namespaces: `Nav`, `Auth`, `Dashboard`, `History`, `Billing`, `Settings`, `Common`, `Onboarding`, `Questionnaire`, `Photo`, `Analysis`, `Report`, `Admin`, `Errors`, `Pdf`, `CvReport`, `Shared`.
- Client components use `useTranslations('Namespace')`; server metadata uses `getTranslations` / message imports in `app/[locale]/layout.jsx`.
- In-app navigation via `i18n/navigation.js` (`Link`, `useRouter`, `usePathname`); `utils/routes.js` stays locale-free.
- Non-React utils return **translation keys** (`labelKey`, `messageKey`, `ERROR_KEYS`); callers call `t()`.
- **Out of scope for static catalogs:** brand name MyFace, assessment UUIDs, raw backend `detail` strings, GPT/protocol narrative bodies (locale belongs in generation prompts later).
- **i18next-parser** (devDependency) audits flat `t()` usage via `pnpm --filter @workspace/myface run i18n:extract` → `messages/en.extracted.json`; structured `en.json` remains the translation source file.

### Consequences
- All app URLs gain a locale prefix; bookmarks and external links must include `/en/` or `/de/`.
- `generateStaticParams` pre-renders both locales for SSG-compatible pages.
- German copy ships when `de.json` values are translated; until then English placeholders or `getMessageFallback` apply.
- PDF export accepts optional `pdfT` / message slice for locale-aware chrome; CV qualitative labels use `translateCvLabel`.
- API errors expose stable `code` values mapped to `Errors.*` keys in the UI.

---

## ADR-037: Protocol PDF iframe preview + narrative-source editing
Date: 2026-07-17  
Status: accepted  

### Context
The Protocol tab rendered an HTML approximation of A4 pages (`QovesProtocolReport`) that did not match the downloadable jsPDF output. Admins edited protocol LLM text only via a header overlay (`AdminReviewPanel`), not while reviewing the protocol document.

### Decision
- **Preview = download:** extract `buildMyFacePdf` from `downloadMyFacePdf` in `utils/reportPdf.js` (export surface only — no page layout changes). Protocol tab embeds the returned blob in an iframe.
- **Editable PDF experience = edit narrative source:** admins hand-edit `protocolNarrative` / `featureNarratives` in `ProtocolNarrativeEditDock` beside the preview. PDF rebuild runs **client-side only after successful Save** (or after LLM section/whole regen applies), not on keystroke.
- **Secondary path:** keep header **Edit PDF narrative** → `AdminReviewPanel` unchanged for now.
- **Concurrency:** last-save-wins; no optimistic locking.
- **Dirty UX:** `beforeunload` when unsaved; confirm before LLM regen if dirty.
- **Approved lock:** hide edit dock client-side; server rejects narrative PATCH and protocol regen when status is `approved`.
- **Layout clipping:** jsPDF may visually clip long copy on a single page (`maxLines` etc.); stored narrative remains complete — reflow is out of scope.

### Consequences
- `mergeNarrativesForPdf` merges `featureNarratives` into `protocolNarrative.features` before PDF generation (viewer + download).
- HTML `.qoves-report-a4-page` mock is unused in Protocol tab preview; may be removed later.
- Direct API calls cannot mutate protocol text on approved assessments.

---
## ADR-038: Multi-variant AI visuals galleries (5 hair + 5 outfit + 3 aging)
Date: 2026-07-20
Status: accepted

### Context
The existing AI visuals feature generated three previews (hair / outfit / aging) using a single “most flattering” edit instruction per category. That produced visible variety that could be too small because the prompt was not explicitly steering toward multiple named style directions.

### Decision
1. **Keep ADR-035 structure.** Maintain `SHARED_VISUAL_OPENING` + scope-fence-first bodies, and keep one `generate_image_edit` call per variant (no mega-prompt).
2. **Use static style banks.** Introduce `backend/visual_style_banks.py` with curated, named style descriptors:
   - Hair: 5 styles per CV face shape (`Oval`, `Round`, `Square`, `Heart`, `Oblong`) plus a `neutral` fallback bank for missing/unknown values (no silent Oval mapping).
   - Outfit: 5 fixed occasion/register entries.
   - Aging: 3 tiers using parametric magnitude text for `+3`, `+5`, and `+10` years.
3. **Extend the returned variant schema additively.** Each card includes `styleId` and a human-readable `title` in addition to the existing `type`, `prompt`, `imageSrc`, `status`, and `error`.
4. **Expand total generation calls.** When all categories are requested, generate up to **13** single-call image edits sequentially (hair 5 + outfit 5 + aging 3).

**Amendment (2026-07-20):** Generation is temporarily capped to **1 variant per type** (3 total) per request: first hair style in the face-shape bank, first outfit occasion, **+5 years** aging. Banks and prompt builders unchanged for future gallery expansion.

**Amendment (2026-07-20, aging axes):** Aging tiers now specify skin, hair, and soft-tissue magnitude per tier. Temple graying language branches on CV `hairColor` (dark vs light/gray); no new baldness patterns beyond the reference.

**Amendment (2026-07-21):** Lift the 1-per-type cap — `generate_visual_variants` emits the full **13** cards when all types are requested. Source image is **projected AFTER only** (no front/CV fallbacks). Pipeline worker runs a new **`ai_visuals`** stage after `projected_after` (soft-skips when AFTER is not ready). Admin `POST …/ai-visuals` requires AFTER `ready` and regenerates all 13.

### Consequences
- Users see grouped galleries with distinct prompt directions per card (hair styles differ by named style, not random sampling noise).
- Prompt text becomes more deterministic and reviewable via the “View prompt” affordance in the UI.
- The backend continues to avoid identity drift by preserving the “same person / same framing / no medical/surgical imagery” constraints.

---
## ADR-039: Dedicated LLM call for dashboard treatment protocol phases
Date: 2026-07-21
Status: accepted

### Context
The report overview dashboard shows three “Treatment Protocol” phase cards (Phase 01–03) beside priority-feature mini-cards. These were static placeholders (`—`) while overview prose came from a separate `generate_protocol_overview_async` call.

### Decision
1. Add a **second structured LLM call** in `generate_all_protocol_text`: `generate_treatment_phases_async`, validated by `TreatmentPhases` / `treatment_phases_json_schema()`.
2. Persist on `protocolNarrative.treatmentPhases` (`phase01`–`phase03` + `summary`), generated in parallel with overview after feature narratives exist (so items can reference priority regions).
3. Frontend resolves via `resolveTreatmentPhases`: use LLM data when `phase01` is populated; otherwise **CV-driven fallback** — Phase 01 only from priority mini-card findings + clinical summary i18n (no static phases 02–03).
4. Same non-surgical guardrails as all protocol text (`STRICT_NON_SURGICAL_RULES`).

### Consequences
- Existing assessments need protocol regen (`POST …/ai-protocol?force=true`) to populate `treatmentPhases`.
- PDF, HTML protocol cover, and live overview share one resolver; no duplicate phase logic in each renderer.
- Fallback copy is medical/third-person and references priority anatomical zones from CV, not casual “you look great” messaging.
