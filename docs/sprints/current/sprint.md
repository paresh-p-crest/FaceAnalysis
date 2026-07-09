<!-- Migrated from docs/SPRINT_LOG.md -->
# Milestone 1: Core MVP Setup, Onboarding & Facial Analysis Flow

**Dates:** July 2026  
**Goal:** Implement/complete the 23-question onboarding questionnaire with branching logic, Qoves-style photo guidelines upload checklist, and integrate OpenAI Vision-based facial analysis across 11 category metrics.

## In-Flight Tasks
- [x] Qoves-style frontend PDF overhaul: jsPDF + `QovesProtocolReport` layout, dumbbell chart, protocol narrative, empty AFTER placeholders (status: completed)
- [x] QOVES-style report web UI: document layout, sidebar TOC, intro/disclaimer, flat section routing, feature pages, protocol viewer (status: completed)
- [x] Prototypicality CV engine: demographic norms, deviations, wireframe precompute on `cvReport.averageness` (JS + Python); QOVES shape-analysis UI (status: completed)
- [/] Set up and organize project codebase on Replit (status: in_progress)
- [x] Implement/complete onboarding questionnaire with 23 questions and branching logic in `components/Questionnaire.jsx` (status: completed)
- [x] Add photo upload checklist matching Qoves guidelines screen in `components/PhotoUpload.jsx` (status: completed — 7 canonical poses)
- [x] Qoves multi-view CV pipeline v2: photo storage, ruler calibration, profile/quarter/smile/hair analysis (status: completed)
- [x] Wire questionnaire responses context into analysis workflow payload (status: completed)
- [ ] Implement OpenAI Vision-based analysis in Python backend `backend/text_ai_service.py` (planned) and `backend/analyze_face.py` to analyze the photo directly (status: planned)
- [ ] Verify structured analysis outputs covering all 11 categories (Hair, Brows, Eyes, Nose, Cheeks, Jaw, Lips, Chin, Skin, Neck, Ears) (status: planned)
- [ ] Run backend compile gates and smoke tests for Milestone 1 (status: planned)
- [ ] Verify frontend build states for questionnaire and uploads (status: planned)

## Blockers & Decisions
- **OpenAI API Quota:** Confirm OpenAI billing/credits are enabled to test the OpenAI Vision model calls (GPT-4o) locally or on Replit.
- **Branching Questions List:** Finalize the exact wording of all 23 questions for branching routes (e.g. shaving/beards for male users).

## Retro / Notes
- The project roadmap has been aligned directly with the new client milestones contract. Milestone 1 focus is the ingestion (onboarding/upload) and analysis (OpenAI Vision 11-category) pipeline.
