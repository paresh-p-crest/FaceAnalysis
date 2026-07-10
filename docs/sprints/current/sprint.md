<!-- Migrated from docs/SPRINT_LOG.md -->
# Milestone 1: Core MVP Setup, Onboarding & Facial Analysis Flow

**Dates:** July 2026  
**Goal:** Implement/complete the 23-question onboarding questionnaire with branching logic, Qoves-style photo guidelines upload checklist, and integrate OpenAI Vision-based facial analysis across 11 category metrics.

## In-Flight Tasks
- [x] Fix symmetry landmark overlay mapping (object-fit content box) + smaller curated dots (status: completed)
- [x] Fix proportion page overlays (ear/nose/mouth/eye) mapping + Qoves landmark indices (status: completed)
- [x] Fix naso-oral mouth cheilions + label; fix naso-aural profile ear side/span (status: completed)
- [x] Remove dashboard Account KPI; navbar username menu with Sign out / Sign in (status: completed)
- [x] Qoves-style frontend PDF overhaul: jsPDF + `QovesProtocolReport` layout, dumbbell chart, protocol narrative, empty AFTER placeholders (status: completed)
  - [x] Redesigned cover page (Page 1) with a centered title, metadata fields grid, top and bottom border accent lines, and brand footers (status: completed)
  - [x] Redesigned pages 2, 3, and 4: even vertical distribution, separator gridlines, and MYFACE text header branding (status: completed)
  - [x] Redesigned pages 5 and 6: added custom vector radar chart, Norwood stage diagram panel, and summary card layout (status: completed)
  - [x] Redesigned pages 7, 8, and 9: implemented custom sub-grids, vertical profile stacks, geometric overlays, and summary cards (status: completed)
  - [x] Redesigned pages 10, 11, and 12: implemented profile stacks, lip crops, double geometric overlays, and summary panels/bars (status: completed)
  - [x] Redesigned pages 13, 14, and 15: implemented split images, vertical image stacks, antihelix/height overlays, and summary panels (status: completed)
- [x] PDF-first clinical protocol pipeline: structured per-feature narratives, guardrails, orchestrator (status: completed)
- [x] Beauty Assistant ReAct agent with report section tools (status: completed)
- [x] Prototypicality CV engine: demographic norms, deviations, wireframe precompute on `cvReport.averageness` (JS + Python); QOVES shape-analysis UI (status: completed)
- [x] Landing-style full-width `SiteNavbar` + dashboard theme alignment (status: completed)
- [x] Four-route app shell with `/analysis` gated flow and history report modal (status: completed)
- [x] Implement/complete onboarding questionnaire with 23 questions and branching logic in `components/Questionnaire.jsx` (status: completed)
- [x] Add photo upload checklist matching Qoves guidelines screen in `components/PhotoUpload.jsx` (status: completed — 7 canonical poses)
- [x] Qoves multi-view CV pipeline v2: photo storage, ruler calibration, profile/quarter/smile/hair analysis (status: completed)
- [x] Wire questionnaire responses context into analysis workflow payload (status: completed)
- [x] Report/PDF parity sprint: all 7 poses required, eyes 4-way split, LLM closing synthesis, 3-tier recs, hair PDF live data, nose profile merge (status: completed)
- [x] CV metrics Tier A–D: jaw shape/cupid's bow, profile angles, skin texture module, hair Norwood estimate, neck approximate labeling (status: completed)
- [x] Unify NL/AI feature access with dashboard tier; keep admin report approval (ADR-011) (status: completed)
- [x] One-shot NL enrichment in upload pipeline; report open load-only (ADR-012); PDF in report header bar (status: completed)
- [x] Second-person AI voice + no MediaPipe/OpenCV jargon in client-facing coaching copy (ADR-013) (status: completed — superseded for PDF/narrative by ADR-017)
- [x] Qoves-style third-person PDF/protocol/narrative voice with “the subject” as grammatical subject; Beauty Assistant stays second person (ADR-017) (status: completed)
- [x] Beauty Assistant chatbot UX: optimistic user bubble, typing loader, input editable while send locked (status: completed)
- [x] OpenAI Vision pose mapping for feature narratives when LLM_PROVIDER=openai (ADR-014) (status: completed)
- [x] MediaPipe Pose neck integration (ADR-016 — supersedes ADR-010 deferral)
- [x] Hair mask always in pipeline (ADR-015) — OpenCV HSV segmentation; removed `HAIR_SEGMENTATION_ENABLED`
- [x] Wire profile silhouette as 90° landmark source for Tier C angles (ADR-015)
- [x] Surface Tier C nose profile fields in UI/PDF (`CvReportView`, `qovesProtocolModel`)
- [x] Fix naso-aural ear span (helix→lobe on profile) + chin/jaw right-profile images
- [ ] Run backend compile gates and smoke tests for Milestone 1 (status: planned)
- [ ] Verify frontend build states for questionnaire and uploads (status: planned)
- [ ] Optional BiSeNet upgrade for hair mask (future — not env-gated)

## Blockers & Decisions
- **OpenAI API Quota:** Confirm OpenAI billing/credits are enabled to test the OpenAI Vision model calls (GPT-4o) locally or on Replit.
- **Branching Questions List:** Finalize the exact wording of all 23 questions for branching routes (e.g. shaving/beards for male users).

## Retro / Notes
- The project roadmap has been aligned directly with the new client milestones contract. Milestone 1 focus is the ingestion (onboarding/upload) and analysis (OpenAI Vision 11-category) pipeline.
