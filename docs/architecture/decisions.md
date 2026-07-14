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
