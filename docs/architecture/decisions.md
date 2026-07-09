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
