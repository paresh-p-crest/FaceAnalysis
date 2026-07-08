# Changelog

All notable changes to this project will be documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]
### Added
- Created the landing page screen design specification at [landing-page.md](file:///c:/Users/JayRabari/Documents/FacialAnalysis/docs/design/screens/landing-page.md).
- Replaced the bare-bones onboarding welcome screen with a premium, minimal, conversion-focused landing page at [Landing.jsx](file:///c:/Users/JayRabari/Documents/FacialAnalysis/components/Landing.jsx), featuring full dark mode compatibility, mobile responsiveness optimizations (e.g. scrollable tabs), and an integrated theme toggle.
- Refined the landing page layout structure to feature exactly 5 anchors (Hero, How It Works, Sample Report, Trust/Security, FAQ/CTA), replacing card repetition and visual noise with an editorial diagnostic design, a unified face asset, and clear privacy trust signals.
- Fixed the questionnaire back-button navigation issue in [App.jsx](file:///c:/Users/JayRabari/Documents/FacialAnalysis/components/App.jsx) to correctly return users to their originating screen (e.g., Dashboard) instead of always falling back to the landing page, and integrated initial page state management so that hitting back from the photo upload screen returns the user to the last page of the questionnaire (Page index 6) instead of resetting the questionnaire to Page 0.
- Updated the onboarding wizard in [Questionnaire.jsx](file:///c:/Users/JayRabari/Documents/FacialAnalysis/components/Questionnaire.jsx) to implement the 12 refined diagnostic and preference questions, splitting them across 7 lighter pages (step-mapped to the progress stepper) to ensure each screen fits within a single viewport height without scrolling, and optimizing card layout constraints to be responsive on mobile devices.
- Refactored [PhotoUpload.jsx](file:///c:/Users/JayRabari/Documents/FacialAnalysis/components/PhotoUpload.jsx) to make the page completely fit a single viewport, including:
  * Adding an interactive Image Lightbox modal (triggered on thumbnail tap, equipped with a close button) to view the full uploaded picture.
  * Adding a dedicated Validation Results popup modal to display detailed check reports (with passed, warning, and failed states) without expanding the container height.
  * Removing the redundant "Upload Status" card, utilizing the top swipeable pose tabs to show upload progress and manage active pose navigation.
  * Vertically centering the compact "Photo Guidelines" card on the right-side grid column.
  * Correcting dark/light mode background styles on preview overlay buttons.
  * Removing the redundant "Next Photo" button to optimize vertical whitespace.
- Realigned project roadmap, requirements, and backlog to follow the newly agreed 3-milestone contract (Milestone 1: Core Onboarding & OpenAI Vision Analysis; Milestone 2: Gated Report, PDF & Stripe; Milestone 3: AI Visuals, Assistant & Admin Panel).
- Proposed visual radar charts for the client report summary dashboard.
- Proposed SVG overlays mapping calculated Face Mesh angles.

## [1.1.0] - 2026-07-08
### Added
- Standardized documentation layout pointing to `AGENTS.md` rules.
- Added Architectural Decision Records (ADRs) to track key system design choices.
- Created `docs/architecture/` subdirectory containing domain model schemas, live API endpoint contracts, and hard coding constraints.
- Integrated a Standard Operating Procedures (`docs/sop.md`) handbook for deployment on Replit and integration of Stripe/PayPal sandbox portals.

### Changed
- Reorganized `docs/` folder structure, consolidating legacy setup files (`MONGODB_SETUP.md`, `REPLIT_SETUP.md`, `SERVICE_SETUP.md`, `HANDOVER_CHECKLIST.md`, `SPRINT_LOG.md`) into systematic modular files.
- Replaced `.cursorrules` and `CLAUDE.md` with lightweight pointers to `AGENTS.md`.

---

## [1.0.0] - 2026-07-07
### Added
- Implemented user and admin roles registration (`/api/auth/register`, `/api/auth/login`).
- Added database persistence using MongoDB Atlas cluster via async Motor driver.
- Created Stripe Checkout and PayPal Orders v2 transaction flows.
- Built an admin review workspace allowing administrators to write notes, modify client narratives, and publish results.
- Added dynamic ReportLab server-side PDF compiler gated on report status rules.
- Created client-side questionnaire branching flows.
- Integrated event tracking logic for Google Tag Manager and Meta Pixel events.
- Added grounding context-aware Beauty Assistant chatbot utilizing OpenAI.
- Added prompt fallbacks for AI hairstyles, outfit styles, and aging simulation images.

### Changed
- Configured environment-gated CORS policies to secure the FastAPI server under public origins.
- Set up `replit-start.sh` and configuration scripts for standard execution.

---

## [0.2.0] - 2026-07-02
### Changed
- Migrated frontend framework from Vite + React to Next.js 15 App Router directory context.
- Configured dynamic PostCSS settings to correct module build errors.
- Shifted application mode configuration variables from `.env` keys into LocalStorage-based Settings UI options.

---

## [0.1.0] - 2026-06-22
### Added
- Initial commit of AuraScan facial analysis proof of concept.
- Added local browser-based MediaPipe landmark calculations and canvas image pixel skin testing.
