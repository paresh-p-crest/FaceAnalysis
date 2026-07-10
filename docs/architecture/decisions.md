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
- Persist `protocolData` / `protocolNarrative` on assessments; compress assistant history via `sessionSummary` on conversations.
- Remove legacy markdown report generation (`/api/generate-report`, `utils/openai.js`).

### Consequences
- Single place to update non-surgical safety instructions and Groq/OpenAI provider config.
- Beauty Assistant cost scales with session summary refresh (every 6 user messages) instead of full report context each turn.
- Unpaid users see template protocol fallback locally; paid users get server-generated protocol.

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
Status: accepted  

### Context
FaceMesh landmarks do not extend below the jaw; neck width/length used jaw proxies that overclaim precision.

### Decision
- Mark `cvReport.neck.dataSource` as `"approximate"` with explicit limitation text.
- Defer MediaPipe Pose Landmarker integration to a follow-on milestone.

### Consequences
- Report copy and LLM guardrails must not claim clinical neck measurements until Pose is integrated.
