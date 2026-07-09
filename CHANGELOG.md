# Changelog

All notable changes to this project will be documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]
### Added
- Unified backend text AI layer (`backend/text_ai_service.py`) for narrative, protocol, protocol narrative, and Beauty Assistant; shared non-surgical safety rules.
- Payment gating (`backend/ai_access.py`) on all AI endpoints (`402` when unpaid); Beauty Assistant hourly rate limit (20 messages/user/hour).
- `POST /api/assessments/{id}/ai-protocol` — server-side protocol generation persisted as `protocolData` + `protocolNarrative`.
- Beauty Assistant session summary compression (refresh after first exchange, then every 6 user messages) stored on `conversations.sessionSummary`.
- MongoDB `assistant_rate_limits` collection for hourly assistant quotas.
### Changed
- Beauty Assistant context now includes `aiNarrative`, `protocolData`, and `protocolNarrative`; uses Groq/OpenAI via shared `llm_client`.
- Protocol AI generation routed through `backend/protocol_service.py` with local JSON storage (`protocol_storage.py`); frontend uses `GET /protocol` + `ensureAssessmentProtocol()`.
- `utils/protocolGenerator.js` removed (no client-side protocol generation).
- `Report.jsx` legacy markdown report tabs and `utils/openai.js` removed; Qoves `cvReport` view is the sole report surface.
### Removed
- `POST /api/generate-report`, `backend/openai_client.py`, `backend/beauty_assistant.py`, `utils/openai.js`, and `utils/protocolGenerator.js`.
### Added
- Qoves-faithful multi-view CV pipeline (v2): per-pose MediaPipe landmarking (`backend/multi_view.py`), ruler calibration step (`RulerCalibration.jsx`, `mouthWidthMm`/`philtrumLengthMm`), profile cephalometrics (`profile_cephalometrics.py`), quarter oblique analysis (`quarter_analysis.py`), smile dentofacial (`smile_analysis.py`), top-head hair analysis (`hair_analysis.py`).
- Photo persistence: `backend/photo_storage.py` saves all poses to `public/uploads/assessments/{id}/`; assessment `photos` map with URLs; `cvReport.photos` binding.
- Pre-prod checklist (`docs/pre-prod-checklist.md`) and photo storage architecture doc (`docs/architecture/photo-storage.md`).
- Unit tests: `backend/tests/test_calibration.py`, `test_photo_storage.py`, `test_profile_cephalometrics.py`.
### Changed
- Ears report section now shows **left and right profile** photos (not front face); `cvReport.ears` stores `imageSrcLeft` / `imageSrcRight` from persisted pose URLs.
### Added
- Dev-only questionnaire skip button (`NEXT_PUBLIC_DEV_SHORTCUTS=true`): fills sample answers and jumps to photo upload. Remove `DevShortcuts.jsx` + `devSampleAnswers.js` before prod.
### Changed
- `PhotoUpload.jsx` uses canonical `PHOTO_POSES` keys (7 poses: front, profiles, 45°, smile, topHead).
- `analyze_face.py` orchestrates multi-view analysis and enriches `cvReport` with profile, quarter, calibration, and meta fields.
- `POST /api/assessments` persists photos to disk and updates analysis with public URLs.
- MediaPipe `refine_landmarks=True` for improved lip/eye landmarks.
### Removed
- AWS Rekognition from backend: deleted `aws_rekognition.py`, `api_routes.py` (`/api/analyze-face`, `/api/test-aws`), `protocol_check.py`, and AWS report builder; removed `boto3` dependency. Analysis uses MediaPipe/OpenCV only (`local` / `openai` providers).
### Added
- Qoves-style frontend PDF overhaul: full-bleed cover, two-column disclaimer/privacy and closing pages, dumbbell feature comparison chart (replacing radar), per-feature two-column layouts with summary bars, empty AFTER image placeholders, and `generateProtocolNarrative()` for dense LLM copy with named actives/procedures.
- Shared `PRIVACY_PARAGRAPHS` and `LIMITATIONS_PARAGRAPH` in `utils/qovesProtocolModel.js`; PDF-quality crops via `cropFeatureBeforeForPdf()` and `cropProfileBefore()` in `utils/aestheticProjection.js`.
### Changed
- Protocol cover page (PDF + viewer): reverted to simple dark background without client photo; retains client name, date, and Aesthetic Protocol title.
- `buildFeaturePages()` accepts optional `protocolNarrative`; Eyes page has four subsections (Eyebrows, Eyelashes, Eyes, Under eye); Hair includes Hair Loss/Norwood staging.
- `Report.jsx` generates and passes `protocolNarrative` to PDF export and protocol viewer.
### Fixed
- Protocol feature images: prefer tight `cvReport` / `eyeAnalysis` crops over expanded live crops; cap bbox expansion (2.2×) so nose/lips don't become full-face; PROFILE slot only shown when a real profile photo exists.
- QOVES-style report web UI: gray collapsible sidebar TOC (`ReportNavSidebar`), document canvas shell (`ReportDocumentLayout`), Introduction/Disclaimer pages, flat per-section routing in `CvReportView`, shared `FeatureAnalysisPage` layout for feature panels, and HTML paginated Protocol viewer (`ProtocolDocumentViewer`) with `ProtocolSideRail` on the protocol section.
### Changed
- Report view: removed top Harmony/Symmetry metric strip and hardcoded `TreatmentProtocolCard`; defaults to Introduction; pending-review clients see intro/disclaimer only until **Approved**.
- Prototypicality CV engine (`prototypicalityEngine.js` / `backend/prototypicality.py`): demographic norms from questionnaire, per-feature deviations, feature-specific explanations, and precomputed wireframe paths on `cvReport.averageness` (no workflow changes — optional `answers` passthrough only).
- Protocol viewer scrolls vertically through the full document instead of horizontal page-by-page navigation.
### Changed
- Prototypicality engine: synthetic ideal wireframe (no user-landmark morph), full 0–100 score range, unified brow/eye-center thirds line, honest proportion-target copy; see `docs/architecture/prototypicality.md`.
### Changed
- Dashboard and report views now hide harmony/summary scores until an assessment is **Approved**; pending reports show an awaiting-review message instead.
- Assessment API responses now return display-cased workflow statuses (`Pending Review`, `Approved`) while still accepting lowercase/snake_case on input.
- Completed AuraScan → MyFace rebrand across the codebase: user-facing copy, `AGENTS.md`, architecture docs, `.env.example`, MongoDB/database examples, premium product id (`myface_report`), and browser `localStorage` keys (`myface_*`).
- Replaced the separate `QualityBadge` popup box (photo validation failed / passed) with **inline per-item status icons** in the REQUIRED list. Each guideline now shows: `○` idle (no photo), spinning (analyzing), `✓` green (pass), `‼` amber (warn), `✕` red (fail) — keyed to the active pose's validation checks via `GUIDELINE_CHECK_MAP`. Text color also updates (red/amber/neutral) to reinforce the status. Removed `QualityBadge` from both the desktop right panel and mobile upload zone.
- Made `PhotoUpload.jsx` both steps (confirmation & upload) fully responsive for small screens: layout switches from `h-screen` two-column to `min-h-screen` single-column on mobile, allowing natural scroll.
- On mobile, the confirmation checklist is now rendered **inline** in the left column (below the subtitle) using `lg:hidden`, so users can interact with it without the hidden right panel.
- On mobile, a compact upload zone with tap-to-upload, image preview, remove/change controls, and quality badge is injected inline between the poses grid and guidelines list using `lg:hidden`.
- Unified left panel width to `lg:w-[380px]` on both the confirmation checklist step and the upload images step in `PhotoUpload.jsx`.
- Shrunk the "Use all demo photos" button to a small inline text link (dev-only utility, not meant for production).
- Guidelines list on the upload step now shows all items without scrolling on `lg` screens (`lg:max-h-none lg:overflow-visible`); smaller screens retain the capped scrollable area.
- Extended `canAnalyze` gate in `PhotoUpload.jsx` to block continuation if **any uploaded optional pose** (right profile, left profile, top of head) also has a failed or warned validation result — not just the front photo.
- Changed `warn` overall results to be treated as a hard blocker: users must fix flagged issues on all uploaded photos before proceeding.
- Removed the "SECURE CONNECTION / © MYFACE EST. 2026" footer bar from the right panel of the photo upload step.
- Improved the Continue button hint message to show context-specific reasons (no front photo / front failed / other poses failed).
- Fixed `PhotoUpload.jsx` upload and instructions steps to use `h-screen overflow-hidden` so neither step requires page scrolling. Left panel now uses `flex-col` with a pinned footer (Continue button) and a scrollable middle section (`flex-1 min-h-0 overflow-y-auto`) for poses and guidelines.
- Redesigned `details`-type questions (medical conditions, medications, allergies, active infections) from a broken free-text input to a proper **Yes / No button pair**. Selecting "No" immediately enables Next. Selecting "Yes" reveals a textarea for specifics; Next is enabled only after at least 3 characters are entered. This eliminates all text-parsing validation ambiguity.
### Added
- Configured all questionnaire steps to require active page-level validation; marked `additionalNotes` as optional while strictly preventing next navigation on all other fields until an input is completed.
- Standardized details-type questions (such as medical conditions, medications, allergies, infections) to require page-level validation; removed default "No" values, added a `"yes/no"` placeholder, and disabled next navigation until a valid answer is typed.
- Configured questionnaire back navigation route states to initialize the index pointer to the last question (Question 23) when returning from photo upload views.
- Harmonized the photo upload flow colors by replacing standard `teal-400` classes in `PhotoUpload.jsx` with the exact brand green hex code (#5e9f8b).
- Redesigned the photo upload flow in `PhotoUpload.jsx` with a requirements confirmation page (left column instructions, right column guidelines checkboxes checklist container) and upload dashboard screen.
- Set the file upload area inside the dark visual panel as a responsive glassmorphic dropzone supporting JPEG, PNG, and WEBP formats.
- Standardized the user dashboard header in `DashboardPage.jsx` with the `MyFace` serif brand logo and aligned quick action controllers (Refresh, Start New Analysis).
- Replicated the premium document-viewer layout for the client report with a three-column grid containing page previews on the left, executive dashboard in the center, and a sticky treatment protocol list on the right.
- Created a high-density facial landmark SVG mapping overlay rendering all 478 points of the MediaPipe Face Mesh on the Potential profile face scan.
- Translated all client report dashboard titles, metadata keys, chronological age timelines, and treatment protocol guidelines to English.
- Replaced the invalid dark:bg-slate-850 button style class on the dashboard with a valid high-contrast outline scheme.
- Fixed the dashboard page background class to use the theme surface token, resolving dark mode grey fallbacks.
- Created `theme.md` outlining the strict styling constraints, brand green hex values (#5e9f8b / #548f7d), and border-radius rules.
- Overrode Tailwind's default configuration colors in `tailwind.config.js` to map the `brand` and `accent` categories to the new brand green shade, aligning all components (progress bars, status badges, scales) automatically.
- Updated `.btn-primary` and `.btn-ghost` components in `app/globals.css` to use pill-shaped `rounded-[50px]` and custom tracking.
- Styled photo guidelines next action button inside `PhotoUpload.jsx` and report download/retry buttons in `Report.jsx` to match this theme.
- Renamed the welcome component to `QuestionnaireWelcome.jsx` for easy understanding and updated all routing hooks in `App.jsx`.
- Forced the questionnaire right-hand split-screen panel to utilize a static dark `bg-[#0d1e1f]` background in both light and dark modes, ensuring white text remains fully readable.
- Integrated the questionnaire animations directly into the global stylesheet `app/globals.css` to guarantee Next.js bundles them correctly across client views.
- Redesigned the user dashboard (`components/DashboardPage.jsx`) to adopt the visual aesthetics and content structure of `myface.club`, including a light mint-green/teal layout, scientific progress bars for symmetry and proportion, and a step-by-step onboarding guide.
- Renamed the start questionnaire welcome page from `Landing.jsx` to `Welcome.jsx` and updated imports/references in `App.jsx` to match.
- Adjusted the "Get Started" and "Next" button design to align the separator `|` closer to the right arrow.
- Removed the "AuraScan" text brand from the right-side logo panel on both welcome and questionnaire screens.
- Revamped the onboarding questionnaire UI to support a one-question-at-a-time layout.
- Added a fluid, animated mesh gradient background to the desktop view side panel.
- Refactored the welcome page (`components/Landing.jsx`) to share the same responsive split-screen theme.
- Cleared all default initial answers to prompt the user to input fresh responses.
- Consolidated the question set to precisely follow the 23-question QOVES reference flow, conditionalizing beard queries on masculine aesthetics.
- Updated the onboarding questionnaire wizard to include all 23 questions from the QOVES reference site.
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
