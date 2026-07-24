# Changelog

All notable changes to this project will be documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]
### Added
- **Outfit white-tee comparison baseline** — When outfit AI visuals are generated, a strict white-tee edit is stored as `aiVisuals.outfitBaseline` and used as the outfit slider BEFORE (UI only). Outfit AFTER edits still use the original front photo.
- **AI visuals media URL storage** — New generations persist preview bytes under `assessments/{id}/ai-visuals/…` (local filesystem or Replit Object Storage) and store `/api/media/…` URLs in `imageSrc`. Legacy inline `data:image/…` values remain readable until regen.
- **Assessment soft delete** — `assessments.deleted_at`; `DELETE /api/assessments/{id}` soft-deletes. Soft-deleted rows are excluded from the 2-analysis package limit (`submittedCount`); lists/GET hide them. `GET /my/assessments` returns `submittedCount` for eligibility.
- **Soft-delete access hardening** — Mutators refuse soft-deleted rows; pipeline aborts mid-run; `GET /api/media/assessments/{id}/…` 404s when soft-deleted; payment assessment-fallback is active-only. After deleting the open report, FE clears stale binding and rebinds to the previous ready report (or empty) for report modal / chat / AI visuals.
- **Admin per-style AI visual regen** — `POST …/ai-visuals` accepts optional `styleId`; admin report overlay **Edit AI Visuals** (same pattern as Edit After Image) can regenerate the full gallery or any single hair/outfit/aging card without wiping siblings. Category-subset regen also merges into existing `aiVisuals`.
- **German locale (`de.json`)** — Full key-for-key du-form translation of `en.json` (no Sie-form, no en/em dashes); loanword/compound policy in `docs/industry-practices.md` §8.
### Changed
- **Admin PDF download bypass** — Admins can now download the PDF report regardless of approval status. Users still require `status === 'approved'` before the download button is enabled. Implemented by adding an `isAdmin` parameter to `canDownloadReportPdf` in `reportWorkflow.js` (returns `true` immediately for admins) and passing `isAdmin` from `Report.jsx` and `CustomerOverviewDashboard.jsx`.
- **Nose & Jaw PDF profile image source** — `nose` and `jaw` recommendation pages now use `rightProfile` (strict side profile) as the primary profile inset photo instead of `right45` (3/4 oblique). Fallback order: `rightProfile → leftProfile → right45 → left45`. All other profile-image pages (chin, etc.) retain the existing `right45`-first order. Implemented via `STRICT_PROFILE_FEATURE_IDS` in `protocolFeatureImages.js` with `featureId` passed through `resolveAllFeatureImages`.
- **Relaxed Profile Photo Validation (FE & BE Alignment)** — Relaxed validation strictness for `leftProfile` and `rightProfile` photos during upload and backend processing. Expanded `leftProfile` range to `{ min: 0.45, max: 1.0 }` and `rightProfile` range to `{ min: 0.0, max: 0.55 }` (matching in `photoValidation.js` and `photo_validation.py`) to accept 3/4 oblique to full profile views. Softened frontal-only checks (expression, hair, centering, glasses) for non-front poses in `photoValidation.js`. Added a low-confidence MediaPipe detector fallback (`min_detection_confidence=0.2`) in `backend/mediapipe_analysis.py` to ensure profile faces are detected reliably during backend pipeline execution.
- **PDF Chin Recommendation Overlay (Image 2 Style)** — Updated bottom profile frame on the Chin Recommendation PDF page to draw Ricketts' E-line (solid line from nose tip to chin), Zero Meridian (solid vertical line from Nasion down to chin level), and Subnasale Perpendicular (dotted vertical line from Subnasale down to chin level), matching Image 2 in `side_profile_lines.ipynb`. Reduced the bottom extension length of both vertical lines (`extraY = Math.max(6, (chin.y - subnasale.y) * 0.05)`) so they terminate cleanly right below the chin level. Implemented mild Canvas cover-crop zoom (`zoom = 0.85`) in `generateAnnotatedChinProfileImage` matching frame aspect ratio (`COL_W` x `CHIN_PROFILE_FRAME_H`) so the face profile is prominently displayed with comfortable padding, ensuring all guide lines (verticals and horizontals) remain 100% visible without edge clipping. Updated overlay line styling in `generateAnnotatedChinProfileImage` to match the clean white single-pass stroke aesthetic (`#FFFFFF`, ~2px width) used in Cheek Recommendations. Made `right45` (3/4 oblique profile) the primary preferred photo source in both frontend (`resolveProfileBeforeImage`) and backend (`build_profile_report`). Added dynamic client-side `analyzeWithMediaPipe` execution inside `generateAnnotatedChinProfileImage` in `chinProfileGuides.js` to extract real face landmarks (`4`, `2`, `168`, `0`, `152`) directly on the photo Canvas before rendering lines. Updated landmark validation bounds in `extractProfileLandmarks` to preserve real MediaPipe landmarks on 3/4 oblique views (`pn.x ~ 0.81`, `Sn.x ~ 0.73`, `Pog.x ~ 0.66`). Corrected MediaPipe Pronasale landmark index to 4 and added upper lip center (0). Backend cephalometrics and landmark resolution now include Nasion ($N$).
### Fixed
- **Soft-delete navigation** — Dashboard/report gates reload on `latestAssessmentEpoch`; deleting the open report rebinds or closes the modal (no stuck “ready” host); missing report opens clear state and return to dashboard; Chat/AI Visuals use first ready report; resume-draft at limit goes to `/analysis`; `lifetimeSubmittedCount` keeps legacy unlock after soft-delete.
- **Package limit ignores soft-deleted** — `count_submitted_assessments_for_user` / `submittedCount` exclude `deleted_at` rows so deleting a report frees an analysis slot.
- **Start questionnaire after soft-delete** — Limit-reached no longer redirects to `/report` (empty Start loop when soft-deleted rows still consume the package quota). Dashboard/report empty state shows the analysis-limit message instead of a Start CTA; `/analysis` limit UI only offers “View your report” when an active report exists.
- **Onboarding questionnaire refresh** — In-progress answers + step persist in `localStorage` (`myface_analysis_draft_{userId}`); refresh/`/analysis` re-entry resumes at the first incomplete question. Cleared on submit, start-new, logout, and server photo-draft resume.
- **Database branding scrub** — Removed leftover document-store wording from delete-report confirm, comments, SOP/overview/contracts/practices, and `protocol_service`; stack is PostgreSQL-only.
- **Admin review “Processing…” label** — Replaced “Pipeline running…” / “Pipeline läuft…” with “Processing…” / “Verarbeitung…” on review cards while analysis is in progress.
- **Forgot password tap target** — Control is text-sized only (`w-fit`); password label uses `htmlFor`/`id` so empty row space no longer opens the reset dialog.
- **Sign-out confirm copy** — Generic logout dialog text for all roles (`Nav.signOutConfirmTitle` / `signOutConfirmMessage` in `en.json` + `de.json`); no admin-tools mention.
- **PDF Treatment Protocol truncation** — Phase titles, durations, and item lines on PDF page 1 wrap fully with `splitTextToSize` (no max-line ellipsis); phase cards grow to fit all text. Summary still draws only if space remains below the cards.
- **Outfit style titles** — Occasion names use title case (e.g. Professional/Business); UI also title-cases legacy lowercase titles.
- **Treatment phases schema retries** — Liberalized `detail` (280), name/title/duration (100), items min 1, summary min 20; clamp soft overruns before Pydantic so clinical sentences no longer burn all structured retries.
- **Narrative metric key leakage** — `NO_TECH_JARGON_RULES` forbids pasting camelCase/PascalCase JSON metric names into client-facing prose; paraphrase into plain English.
- **PDF closing duplicate page number** — Closing page no longer draws a footer `Page N` alongside the standard header `PAGE / NN` (removed sole `addFooter` call).
### Changed
- **Admin Edit Generated Images** — AFTER and AI visual thumbnails open a full-size preview on click (Esc / backdrop to close).
- **Healthy aging AI visuals layout** — Vertical stack of image + age cards (Current, +3, +5, +10) with `visualAge` / `visualAge + n`; photo frame matches hairstyle compare. Static tag + blurb; educational footnote inside each +N card. Shared AI visual frames slightly shorter (`max-w-[22rem]`, mild aspect trim).
- **Hair Health narrative length** — BRIEF band `80–450` chars (~30–45 words) so the bottom hair-page column fits without mid-sentence clip; minimal-severity carve-outs keep Hair Health + Jaw Further Enhancement on their short bands while sibling subsections still use the 70–120 word grounding path.
- **Dimorphism display vs preference** — Report dimorphism scores/labels clamp to Moderate or the preferred side (`genderPreference` / `growBeard` fallback); measured metric phrases unchanged; opposite-side features get a room-for-improvement sentence (BE `cv_report.py` + FE `cvReport.js`).
- **Admin report image tools** — Navbar shows one **Edit Generated Images** control (projected AFTER + AI visuals in a single overlay). **Edit PDF narrative** removed; narrative edits stay in the protocol HTML preview. Pipeline status block in that overlay is temporarily commented out.
- **PDF baldness stage diagrams** — Feminine `genderPreference` loads `/ludwig-stages/stage-N.png`; otherwise `/norwood-stages/` (same numbering). CV field remains `norwoodStage`. Hair LLM hints use the matching Ludwig/Norwood keyword only.
- **AI visuals hair color lock** — Hair-style prompts no longer inject CV `hairColor`; color/texture locked from the reference image only (no dye escape hatch). Aging still uses CV color only to gate graying language.
- **Admin users tab** — Removed the `users` account-count subtitle under Registered users.
- **Admin report Past Assessments** — Sidebar Past Assessments nav/panel is hidden for admins (platform-wide list was noise while reviewing one report). Users unchanged.
- **`de.json` style pass** — `&`→`und` in headers; `Höchste Harmonie von 100`; `Dermatologisch freigegeben`; style chips localized (Ausstrahlung, Lässig, Business-leger, Klar).
- **Feature narrative concurrency** — All 11 feature LLM calls may run at once (`FEATURE_NARRATIVE_CONCURRENCY` default 11; was hard-capped at 2). Executive / overview / treatment phases / closing unchanged. Lower the env var if the provider rate-limits.
- **AI visuals hair/outfit layout** — Single before/after hero with recommendation side panel (static attribute grid + explanation; panel height matches the compare image) and round style thumbnails below the image (`max-w-sm`, same as prior cards).
- **AI visuals healthy aging** — Two centered panels (Now → selected age) with a right arrow between; circular +3/+5/+10 selectors under the right image.
- **Priority feature cards** — All overview/PDF priority findings use labeled key→value rows (e.g. `Blemishing`, `Texture`, `Shape`) instead of bare metric values as titles.
- **AI visuals comparison baseline** — Hair/outfit/aging sliders and aging grid use the original front portrait (labeled “Before” / “Now”) instead of the projected AFTER image.
- **AI visuals generation source** — Pipeline and `POST …/ai-visuals` edit the front (BEFORE) portrait; projected AFTER ready-checks are commented out / disabled (ADR-038 amendment 2026-07-22).
- **Phase 01 fallback items** — Include the source feature name with each metric (e.g. `Skin · Blemishing`).
- **Chat + AI Visuals assessment binding** — Both routes use only the chronologically latest submitted assessment when it is report-ready; no fallback to an older ready report (`fetchLatestSubmittedAssessment`).
- **Dimorphism chin/cheeks highlights** — Per-feature cards reuse Features Analysis region fills (`FeatureRegionHero`) at dimorphism card scale (`max-h-40`).
### Fixed
- **Questionnaire underline inputs** — Details follow-up fields use the same single-line underline input as “Please list” questions (dropped tall `min-h` textarea). Motivation/notes textareas no longer reserve a tall empty box either. Placeholders unchanged.
- **Replit Autoscale deploy health** — Restored today's explicit `GET /` probe short-circuit (`073cd44`): cheap `200 {"ok":true}` only for known probe UAs (`Go-http-client`, `kube-probe`, `curl`, …) or `Accept: application/json`. Browsers, Preview/Agent `Replit/*` UAs, and RSC still get real HTML (no empty/`*/*` guessing). Smoke: `node scripts/test-middleware-probes.js`.
- **Replit Agent Preview hydration (root cause)** — Overlay showed our Google Fonts `<link>` vs Replit’s injected `/__replco/static/devtools/injected.js` in `<head>`. Removed all manual `<head>` children from `LocaleLayout` (Inter already via `globals.css` `@import`). Keep `ClientAppShell` + no theme bootstrap script.
- **Replit hydration (confirmed)** — Error overlay: server rendered `localStorage` theme `<script>` while client had `__html: ""`. Removed that script from `app/[locale]/layout.jsx`. Theme only via `ThemeProvider` after mount. Re-applied `ClientAppShell` + React Refresh disable (`scripts/dev.mjs`) after Replit sync had restored the old layout.
- **Replit Agent chat Preview `/auth` crash** — Hydration broke when `usePathname()` disagreed between SSR and the Agent iframe (`key={pathname}` on the boot screen + path-based boot copy + shell branching). RouteLayout now mounts a pathname-agnostic boot screen until client mount; AppBootScreen defers path-based labels; artifact sets `NEXT_DISABLE_REACT_REFRESH=1`.
- **Replit Agent chat Preview (iframe)** — Open URL / top-level tab worked; chat-side artifact webview failed with Invalid hook call after Fast Refresh. Widened `allowedDevOrigins`, and disabled `ReactRefreshWebpackPlugin` when `REPL_ID` / `REPLIT_DEV_DOMAIN` / `NEXT_DISABLE_REACT_REFRESH` is set so the iframe full-reloads instead of corrupting React.
- **Replit Preview Invalid hook call (final)** — Removed all `GET /` JSON health short-circuits from middleware. Autoscale only needs HTTP 200 on `/` (HTML is fine); JSON liveness stays on `/healthz`. The previous probe heuristics still false-matched Preview and caused Invalid hook call + hydration failure. After deploy: restart web workflow + Republish so Preview is not stale.
- **Facial age card** — Large estimate on the left; thicker reference scale (5–65) on the right with a vertical needle at the CV age and the age label under the needle (HTML panel + PDF dashboard).
- **Replit Agent Preview Invalid hook call** — Middleware `GET /` health JSON was still matching Replit product UAs (`Replit/…`, `Replit-Agent/…`) with empty/star Accept, and a block comment containing `* / *` broke middleware compile (unterminated comment → 500s). Probe detection is now opt-in only (curl/kube-probe/Go-http-client/JSON Accept); Replit Preview/Agent always get real HTML. Smoke tests cover the regression.
- **Treatment protocol phases LLM** — `generate_treatment_phases_async` and `generate_protocol_overview_async` now retry up to `FEATURE_NARRATIVE_MAX_ATTEMPTS` with 429 backoff (same as feature narratives) and log `WARNING` on validation/empty/rate-limit failures instead of dropping phases silently.
- **Admin panel report actions while pipeline running** — Approve, Open, and Delete are hidden on overview/review cards until the analysis pipeline finishes (`isAssessmentProcessing`); a spinner + “Pipeline running…” label shows instead. Overview shows separate **processing** (sky) and **ready for review** (amber) banners with accurate counts.
- **Windows `npm run dev`** — Replaced Unix-only `predev` (`lsof`/`xargs`) with cross-platform `scripts/kill-port.mjs` (Windows `netstat`/`taskkill`, Linux/Replit `lsof`/`kill`).
- **Replit Preview Invalid hook call / hydration** — `GET /` health short-circuit was matching Next.js RSC flight requests and Preview `Accept: */*` navigations, returning `{"ok":true}` JSON instead of HTML/Flight. Middleware now only short-circuits **explicit** probes (JSON Accept, probe UA, or empty/`*/*` + non-browser UA) and always passes RSC/`text/html`/iframe traffic to the app.

### Changed
- **Assessment limit (2 per package)** — Customers may submit at most two facial analyses. `/analysis` requires auth, payment, and eligibility; users at the limit see a subtle limit screen with a link to their report. Admins are redirected away from `/analysis`. Backend enforces the cap on draft, photo upload, submit, and legacy create endpoints (**403**).
- **Photo upload demo photos** — “Use demo photos” on the analysis upload step is shown only when `NEXT_PUBLIC_DEV_SHORTCUTS=true` (same gate as questionnaire dev shortcuts).
- **AI visuals variant counts** — Hairstyle, outfit, and healthy-aging gallery sizes are configurable via backend `AI_VISUALS_HAIR_COUNT`, `AI_VISUALS_OUTFIT_COUNT`, and `AI_VISUALS_AGING_COUNT` (defaults 5 / 5 / 3).
- **Protocol dashboard facial age** — Overview shows CV `visualAge` only (removed unused bio-age column/range from questionnaire). Shared `FacialAgePanel`: large age left, 5–65 scale with vertical needle (interactive + PDF).
- **Skin analysis (LAB + skin-mask)** — Backend replaces region-box brightness metrics with notebook-aligned Qoves fields (undertone, blemishing, evenness, texture, roughness/homogeneity RIN, oiliness skew, under-eye L*). `SkinReportPanel` shows those fields in the existing summary/carousel/table layout.

### Added
- **`scripts/rerun_skin_analysis.py`** — Recomputes LAB skin metrics from stored `front.jpg` + landmarks and patches only `analysis.cvReport.skin` on one assessment (in-place, with fingerprint verification). Supports `--dry-run` and `-o report.json`.
- **Forgot password** — Auth page “Forgot password?” opens a modal (email, new password, confirm); `POST /api/auth/reset-password` updates the account password.
- **Customer dashboard (`/dashboard`)** — Protocol overview (`ExecutiveSummary`) is a standalone customer home after login; same billing, draft, start, and preparing gates as before. Full report remains at `/report` (modal). Legacy `DashboardPage.jsx` kept unchanged.
- **Shared customer gates** — `CustomerAssessmentGate` reused by `/dashboard` and `/report`.
- **Settings page (`/settings`)** — Sidebar layout (Account Info / Password / Billing) matching report-style document chrome; billing, account edit, and password change in separate panels.
- **Report sidebar — Past Assessments** — Footer button opens an overlay list of past assessments on the current report; tapping a row loads that report in place (no `/history` navigation).
- **Pipeline AI visuals (13)** — Background worker runs `ai_visuals` after `projected_after`, generating all 13 style variants (5 hair + 5 outfit + 3 aging) from the front (BEFORE) portrait. Admin `POST …/ai-visuals` regenerates the full gallery when front bytes are available.
### Fixed
- **Dashboard PDF download** — Pose photos are converted to URL strings before PDF build (raw `{ publicUrl }` metadata no longer becomes `/[object Object]` and fails generation).
- **Dashboard overview name plate** — Shows first name, protocol ID, and “View full report” only (same plate size; assessed date / overall score / full name removed from overview).
- **Dashboard loader copy** — `/dashboard` shows “Loading your dashboard…” (not report); report route keeps report-specific copy.
- **Stuck bootstrap loader** — Removed deadlock when a stale Stripe session blocked `accessReady`; payment/access checks use 15s timeouts and an 18s watchdog so the UI never spins indefinitely.
- **Past assessments switch** — Selecting another report from the overlay always fetches the full assessment and remounts report state (list summaries no longer reuse stale content).
- **Past assessments nav** — Report sidebar footer button appears only when the user has more than one submitted assessment.
- **PDF page-1 row alignment** — Treatment Protocol column title baseline offset so it lines up with the name plate and before/potential image row tops (jsPDF text Y is baseline, not box top).
- **Name / protocol plate** — Grey client plate on dashboard overview shows full name, assessment date, overall score, and link to full report; **PDF page-1 plate** keeps the same box size and adds assessed date + overall score (with first name + protocol ID).
- **Report / PDF client name** — Overview header, protocol document, and client PDF use the assessment subject (`ownerUser` / assessment `userId`), not the logged-in viewer (admins no longer appear as the protocol name).
- **Preparing status page** — Unapproved / in-preparation home fits one viewport (no page scroll); title highlight “prepared” renders correctly.
- **Preparing shown before submit** — Photo-only drafts no longer appear in `/report` history; preparing timeline shows only after `POST …/submit`. In-progress uploads offer **Continue upload** via `GET /my/assessments/draft`.
- **Payment success layout** — Success card is vertically centered in the viewport (navbar-aware) and matches the paywall card style.
### Changed
- **Auth page** — Split layout matching questionnaire (fluid mesh brand panel left, form right); password visibility toggle; questionnaire-style primary CTA.
- **AI Visuals hair/outfit** — Each style uses a drag before/after slider (original front photo vs generated style).
- **AI Visuals aging** — Progression grid: current photo, then available +3 / +5 / +10 year previews in order; smaller portrait cards, no body copy under images, shared aspect ratio from the current photo.
- **Dashboard overview header** — Removed centered MyFace logo; added Download PDF next to Share.
- **Post-login home** — Customers land on `/dashboard` (overview); admins still on `/dashboard/admin-overview`. Stripe return and billing paywall redirect to `/dashboard`.
- **Interactive report** — Overview section removed from report sidebar (lives on `/dashboard` only); default report section is Introduction.
- **Customer navbar** — Dashboard tab removed (home overview stays at `/dashboard` via logo redirect); Report nav no longer highlights on `/dashboard`.
- **Dashboard overview scroll** — Standalone overview shell scrolls vertically; tighter top gap under the navbar.
- **Name / protocol plate (dashboard)** — Larger type; bottom link to full report (`/report`) on standalone overview only. — New/unpaid users pay from the `/report` paywall (opens Stripe Checkout directly). Copy: “Pay securely to start analysis of your face and receive your report.” After Stripe success, `/report` shows **Start Face Analysis** (not the paywall); payment is confirmed and access unlocked. Customer `BillingPage` is deprecated; `/billing` redirects to `/report`. Cancel and unpaid chat/AI Visuals return to `/report`.
- **Admin report tools in navbar** — Edit PDF narrative, Edit After Image, and Approve move from the report card into the site navbar (next to PDF); visible only for admins on unapproved assessments. Also shown when the report modal is open over admin routes (not only `/report`).
- **Ears & Skin report panels** — Rewritten to match the same UI layout used by Eyes, Nose, Jaw, Cheeks, and other feature panels (`ReportSectionHeading` → `FeatureHeroFrame` → `FeatureSummaryGrid` with `DetailCarousel` → `AllMetricsTable`). Narrative/explanation prose block removed from both sections.

### Added
- **Treatment protocol phases** — Narrative pipeline runs a dedicated structured LLM call (`generate_treatment_phases_async`) producing `protocolNarrative.treatmentPhases` (phase01–03 + summary). Overview dashboard, HTML protocol cover, and PDF render phases via `resolveTreatmentPhases`; when LLM phase01 is absent, only **Phase 01** is shown from priority mini-cards (no static phases 02–03). **Analysis time** KPI uses `updatedAt − createdAt` shown in **days** (not seconds). Overview **left column** stacks name/protocol plate + analysis hero (copy left, annotated portrait right, score/evaluated/time below) + priority feature cards; callout dots use MediaPipe landmarks mapped through the same cover-crop as the photo. Overview + PDF page-1 header date uses assessment **`updatedAt`**.
### Fixed
- **PDF page-1 analysis hero** — Preview card text no longer clips under the portrait; layout mirrors interactive overview (reserved copy column, wrapped title/body, feature title+detail, metrics band with `/ 100` and evaluated i18n).
- **PDF treatment phases** — Phase cards size to content instead of splitting the full column height (a lone Phase 01 no longer stretches to the page bottom with huge item gaps); summary sits under the cards.
- **Overview hero → priority gap** — Extra space between analysis preview card and “Priority features to improve” (interactive + PDF).
- **PDF page-1 chrome** — Light-grey page (`#F8F9FA`), softer grey header bar (`#EEF0F3`, shorter height) with PROTOCOL | meta left and **MyFace** centered (no right buttons); more space under header and after KPIs; larger KPI boxes with brand-green **numbers** only (labels/units use normal muted/ink); left ~30% / right ~24%; name/protocol plate full left-column width with compact height.
- **Facial vs biological age** — Title uses “Age Range”; bio shows questionnaire band; no “years younger/older” badge; bar is range ±5 with facial-age marker (amber + Outlier when outside the input band).
- **Report sidebar default** — Nav groups start contracted except Introduction (was Features expanded by default).
- **Admin report close** — Text-only ✕ “Close report” sits in the mint gap between the navbar and the report card (not inside the white report chrome).
- **Guest auth redirect** — Unauthenticated visits to `/report`, `/ai-visuals`, `/chat`, `/history`, `/billing`, and `/dashboard/*` replace to `/auth` (pages no longer stall on the boot screen). `dashboardPathForUser(null)` now returns `/auth` instead of `/report`.
- **Admin panel navbar gap** — Explicit navbar-height + mint gap spacers above the hero (bleed hero/gradients were covering `padding-top` so `--site-navbar-gap` alone had no visible effect).
- **Navbar–content gap** — `--site-navbar-gap` increased to `1.25rem` / `1.5rem` (sm+).
- **Navbar logo–nav gap** — More space between MyFace wordmark and the first nav item (Report / admin links).
- **Overview + PDF KPI colors** — Metric numbers (and evaluated `+`) use brand green; labels and unit text stay muted/ink.
- **PDF feature summaries** — Per-feature summary cards/bars use mint `bg-brand-100` (`#dbeee8`) with ink text (was dark slate `#374151` with white text).
- **Navbar–report gap** — Report modal uses two explicit spacers (navbar height + mint `--site-navbar-gap`). AI Visuals + Chat use the same offset and fill flush to the viewport bottom.
- **Report sidebar** — Scrollbar hidden on inner `.qoves-report-nav-scroll` (unlayered CSS overrides global scrollbar styles).
- **Chat layout** — Composer pinned to bottom of white body (`flex: 1` height chain); dock keeps ~1.25rem bottom gap + floating pill.
- **Dimorphism feature crops** — Per-feature image wells use white background so SegFormer crop white edges blend in (was mint `surface-warm`).
- **Brand wordmark** — `/brand/myface-wordmark.png` now has a transparent background (was opaque white).
- **Dashboard crash** — Recent assessments list referenced undefined `item` when resolving overall score (`ReferenceError: item is not defined`).
- **Error / 404 “Go home”** — When already on the home route, the button now hard-reloads instead of no-op client navigation.
### Changed
- **AI Visuals layout** — Category content flush left next to sidebar (override report page `max-w-4xl` centering); tighter canvas padding on tool pages. — Mint background + `report-shell-inner` side gutters and white `qoves-report-layout` card match the report shell; canvas padding aligned (`p-5 sm:p-7 lg:p-9`).
- **AI visuals source image** — `POST …/ai-visuals` image edits prefer the stored projected AFTER full portrait; falls back to front pose when AFTER is unavailable.
- **Page loaders** — Chat Assistant and AI Visuals show their own loading copy (not “Loading your report…”); `AppBootScreen` picks a label from the current route. — Report / AI Visuals / Chat (and admin tabs) use a low-opacity brand-teal glass pill (heavy blur, ~4–10% tint) on the active link.
- **AI Visuals cards** — Portrait square preview restored; category pages use a slightly narrower card (`max-w-md` / 448px) so content fits without scroll. Tighter copy block and compact section header kept.
- **Removed report secondary header** — No more `REPORT` / `#ref` / PDF / close bar above the report document. Admin tools float top-right when needed.
- **Report PDF + Share in navbar** — On `/report` with the report open, the PDF pill renders in the site navbar (brand fill, matches Share). **Share** stays on the overview header only (centered logo + meta row). `Report.jsx` registers toolbar state via `AppProvider`.
- **AI Visuals + Chat fully separate** — Components moved out of `report/` (`AiVisualsSection.jsx`, `ChatAssistant.jsx`). Pages `/ai-visuals` and `/chat` have their own shells (no report header bar, no report modal sections).
- **AI Visuals + Chat routes** — `/ai-visuals` and `/chat` are standalone pages (no longer report modal sections). Navbar links navigate by URL. AI Visuals uses report-style sidebar with hair / outfit / aging only; Chat Assistant fills the viewport below the navbar. Latest ready assessment powers both.
- **Report home route** — Customer default is `/report` (`CustomerHome`: latest ready report / questionnaire / preparing). Legacy `/dashboard` redirects customers to `/report`. Admin tabs stay under `/dashboard/admin-*`. Site navbar gap under bar (`--site-navbar-gap`) spaces the report shell. Priority feature cards no longer show photos (text + findings only; PDF/HTML match). Report left sidebar is report sections only — AI Visuals / Chat Assistant stay in the top navbar.
- **Customer home** — `/dashboard` no longer mounts `DashboardPage` (component kept, import commented). `CustomerHome` loads cloud assessments: ready → open latest report; pending → modified `AnalysisPreparing` with remaining days `max(0, 28 − days since created)`; none → questionnaire CTA; unpaid → billing CTA. Post-submit preparing CTA says “Go home”.
- **Customer navbar** — Removed Analysis History + Billing links (those stay reachable from dashboard KPIs). Added left-aligned **Report · AI Visuals · Chat Assistant** that open the latest ready cloud report at that section. Logo stays left with nav cluster; language/account stay right.
- **Navbar edge** — Opaque solid white bar (no frosted blur) so the seam under the navbar stays crisp; hero bleed no longer uses backdrop-blur on the top edge.
- **Analysis History** — Shows cloud assessments only as report history (removed localStorage “saved results” grid). Rows use `#ref` + shared overall score helper.
- **Site navbar + glass chrome** — Full-width bar; page surface is mint (`#eef6f3`). Dashboard/admin hero is **full-bleed** flush under the navbar; cards/panels use glass blur. Remaining content keeps `px-4 sm:px-6 lg:px-8` gutters.
- **Admin panel UI** — Aligned with customer dashboard: hero band, dashboard-card KPIs, dashboard-panel sections, restructured report rows (client → badges → `#ref` meta → actions), shared `resolveOverallHarmonyScore` for scores. Admin tabs (Overview, Users, Review, Payments) moved into the site navbar; Analysis History hidden for admins.
- **Typography** — App-wide stack is exactly `Inter, Helvetica` (`font-sans` / `font-serif` / `font-display`). Protocol PDF / A4 preview is Helvetica only. No Arial, Sora, Instrument Serif, or other faces.
- **Brand logo** — Exact wordmark image (`/brand/myface-wordmark.png`) via `BrandLogo` across navbar, onboarding, report chrome; cropped tight and enlarged in navbar (`lg` / 40px).
- **Dashboard hero badge** — Replaced “Session synced” with “Welcome back · {name}”.
- **Navbar account + language pills** — Matching white rounded-full controls; account shows brand-teal initials avatar (first+last) + username + chevron; language uses Languages icon + locale + chevron.
- **Dashboard recent list** — Row title is unique backend ref (`scanId` or assessment id), with a right-arrow open affordance beside ready reports.
- **Interactive report shell** — Matches navbar/dashboard chrome: `max-w-[1180px]` column, pill header actions, `#ref` title, white sidebar with mint active nav, compact PDF/close pills. Full-viewport opaque overlay (`inset-0` + navbar offset padding) so dashboard content does not bleed through above the report. AI Visual preview cards use uniform grid/footer sizing; images open in a lightbox on click. Protocol overview **Overall score** now uses `cvReport.overall.score` first (same as dashboard), not legacy `metrics.harmonyScore`.
- **App navbar** — Center nav links use `text-[13px]` (was `text-base`); pill container width matches app content (`max-w-[1180px]` + same horizontal padding). History/Billing columns use the same max width. Floating top inset (`--site-navbar-top`) so the pill isn’t flush with the viewport edge.
- **Dashboard KPI tiles** — Reports / Latest Score / Payments are real buttons: history, open latest ready report (else history), and billing. Removed hero Refresh button (data still loads on mount). Scientific panel keeps a single overall score ring (no duplicate in Harmony card) and no secondary Start new analysis CTA. Score KPI is **Best score** (highest approved harmony) and opens that assessment from history. Harmony “Jawline & proportions” reads `cvReport.jaw` / `jawChin` (was looking at missing `structure` → false “Queued”).
- **404 / error pages** — Centered Lovable-style layout: large status code, title, short description, brand “Go home” button. Locale `not-found` + `error` pages updated; root `app/not-found.jsx` added as fallback. Merged duplicate `Errors` i18n namespaces so page copy and API error codes coexist.
- **Customer dashboard (Lovable parity)** — Rebuilt `DashboardPage` to match the Lovable clinical dashboard: mint grain hero, glass KPI trio, scientific-analysis panel with score ring, recent-assessment list rows, harmony metric tracks, review pipeline tiles, and payments card. Added `surface-grain`, `micro-label`, metric track/fill, and status-chip `data-state` primitives.
### Added
- **`scripts/test_ai_visuals_e2e.py`** — end-to-end AI visuals test (HTTP or `--direct` DB path): generate variants, persist `aiVisuals` JSONB, reload assessment, optionally save PNGs. — Mint clinical dashboard replaces the dark PDF cover and becomes the default report section (`overview`): KPI strip, face-map panel, VORHER/POTENZIAL comparison, age scale, radar + overview, Merkmalsbewertung table, and three-phase treatment protocol. Shared data via `buildProtocolDashboardData()`; EN-first i18n with DE parity (`Report.executiveSummary`, `Pdf.dash*`).
- **Multi-variant AI visuals galleries** — curated style banks for hair (per CV face shape), outfit occasions, and aging tiers; each `styleId` + named prompt preserved (ADR-035/038).
### Changed
- **AI visuals generation capped to 1 per type** — each `POST …/ai-visuals` call generates at most **3** image edits (1 hair + 1 outfit + 1 aging): first style in the face-shape bank, first outfit occasion, and **+5 years** aging tier. Style banks remain for future multi-variant expansion.
- **Aging prompts cover skin, hair, and soft tissue** — tier-specific magnitude text spans all three axes with identity locks (bone structure, eye shape, proportions); temple graying language is omitted for light/gray hair colors.
- **Protocol dashboard priority cards** — Feature heading and score share one row (score right-aligned); metrics render as key–value pairs (key left, value right); no truncated joined summary when findings are present. Mini-cards show CV metrics only (no “The subject…” explanation filler).
- **Protocol dashboard interactive header** — MyFace brand sits in the center grid column instead of absolute centering, so it no longer overlaps PDF/Share actions.
- **Protocol dashboard data + layout** — Removed static placeholder copy; empty fields show `—` only where needed. Left column: horizontal name plate (name + protocol ID, no landmarks/photo), Skin/Hair/Eyes mini-cards with larger single crop previews and real findings only. Evaluated points `468+`. Header: PROTOCOL | meta left, MyFace centered. Interactive overview uses full report canvas width (not A4 mint-card chrome); PDF/HTML cover keep the framed dashboard.
### Fixed
- **Protocol dashboard PDF layout** — Page 1 dashboard uses proportional columns, 4:5 face-map hero, clipped overview text, and CV-driven feature findings; removed hardcoded 98% accuracy and placeholder ages. — outfit now uses `skin.skinTone` (color) instead of `skin.tone` (evenness label); hair weaves `hairColor` / `textureType` into the anchor line and drops the redundant generic keep-color sentence (ADR-035 data fix).
- **Locale switcher** — Re-enabled `localeDetection` for `localePrefix: 'never'` so the `NEXT_LOCALE` cookie is honored; `LocaleSwitcher` calls `router.refresh()` after switching so server messages reload.
- **Stripe success screen stuck on reload** — Removed bootstrap re-redirect from stale `myface_payment_session_id` in `localStorage`; success UI only shows on actual Stripe return query params. Billing CTA on success page now dismisses `paymentReturn`; confirmed payments clear the stored session.
- **Page transition flash** — Added `[locale]/loading.tsx` opaque fallback; removed `animate-fade-up` from route-level page shells (dashboard, history, billing, admin).
- **Replit Preview artifact error** — Theme provider always SSR/`useState`-inits as `light` and hydrates from `localStorage` after mount (no overwrite flash). Added `data-scroll-behavior="smooth"` on `<html>`. Middleware treats `sec-fetch-dest: iframe` (and `Accept: text/html`) as navigation so Preview gets HTML while Autoscale probes still get `200 {"ok":true}`.
### Changed
- **Admin panel** — Removed production/testing environment toggle (QA bulk reset) and API Settings modal/button from navbar and admin header. Removed admin pricing/settings tab + endpoints + i18n/docs.
### Fixed
- **Replit `:8000` ECONNREFUSED for ~2 min after deploy** — Logs showed Next proxying while Python was still importing routers (`Started server process` only after ~2 min), then lifespan blocked on DB before bind. `backend.main` now imports almost nothing at module load; routers + `connect_db` + pipeline worker mount in deferred boot after uvicorn yields (port open immediately). `/api/*` waits up to 120s for boot; `/api/health` returns `starting` meanwhile.
- **Replit Autoscale `GET /` healthcheck** — Middleware returns `200 {"ok":true}` for non-navigational probes; browsers (`document`) and Preview iframe (`iframe` / `text/html`) always get HTML. `previewPath` is `/`.
- **Replit deploy: backend dead for minutes after publish** — Auth/API failed with `ECONNREFUSED :8000` because uvicorn does not accept TCP until lifespan yields, and `connect_db`/`create_all` blocked that. Lifespan now yields immediately and boots DB/pipeline in a background task; `/api/*` (except health) waits up to 60s for boot. Also: lazy CV imports, parallel Next/backend start, `PYTHONUNBUFFERED`, `MPLCONFIGDIR`, auth client retries on cold start, next-intl `localeDetection`/`alternateLinks` off for `/` probes.
### Added
- **`/auth` route** — Dedicated login/register page (`AuthForm`) replaces modal-only auth; chromeless `AuthShell` with locale switcher.
- **Error and not-found pages** — `[locale]/error.jsx` and `not-found.jsx` with a Home link to the role dashboard.
- **Unpaid dashboard billing lock** — Hero billing CTA on dashboard; product actions muted until `userHasAnalysisAccess`; navbar emphasizes Billing and disables History for unpaid users.
### Changed
- **Auth-first landing** — `/` and unknown paths route unauthenticated users to `/auth`; authenticated users land on `dashboardPathForUser` only (no default `/analysis`).
- **Post-login routing** — All successful logins go to the role dashboard; unpaid users stay on `/dashboard` (billing is mandatory via dashboard CTA, not auto-redirect to `/billing`).
- **Logout** — Clears stage/admin tab and routes to `/auth` instead of `/analysis` + modal.
- **Role/session reload** — Clears stale stage/admin tab and re-routes to the correct dashboard when stored role differs from `/api/auth/me` or session is cleared.
### Removed
- **`AuthModal`** — Auth UI lives only on `/auth`.
### Fixed
- **Protocol admin HTML overlap** — feature pages now flow top-down sequentially with fixed `SECTION_GAP` spacing instead of pinning summaries with `mt-auto`/`flex-1`, so images no longer overlap preceding text; content clips at the A4 boundary like jsPDF. Text edits no longer trigger a full protocol image reload.
- **Protocol admin HTML A4 scale** — HTML protocol sheets no longer grow with content; locked to jsPDF A4 (595×842) and fit-to-width scaled in the admin preview pane.
- **Replit Autoscale healthcheck 500** — Deploy probe now hits lightweight `GET /healthz` (`previewPath` in `artifact.toml`) instead of SSR `/`; middleware bypasses next-intl for that path; `start-prod.sh` starts Next immediately (no 2s sleep before bind). App API health remains `GET /api/health`.
- **Protocol PDF viewer** — Protocol tab now previews the same client-side jsPDF A4 blob as download (`buildMyFacePdf` + iframe), replacing the HTML A4 mock that mis-scaled pages.
### Added
- **Protocol inline text editing (admin HTML)** — Admins click overview summary, feature subsection bodies/summaries, and closing paragraphs directly in the HTML protocol preview (`contentEditable`); edits update a shared local draft and persist only when **Save edits** is clicked. The right dock is lightweight (section picker + AI generate + Save) — no duplicated textareas. Scrolling syncs the dock section to the visible page.
- **Protocol inline admin edit** — Admins hand-edit overview/feature/closing narrative text in the Protocol viewer (`ProtocolNarrativeEditDock`); PDF preview rebuilds only after Save or LLM section regen. Header Edit PDF narrative / AdminReviewPanel kept as secondary path.
- **Approved report narrative lock (server)** — `PATCH …/admin-review` and protocol regen endpoints reject narrative edits when report status is approved.
### Changed
- **Protocol admin HTML↔PDF layout** — admin HTML protocol feature pages now mirror jsPDF layouts (MYFACE header, stacked titles, column image placement, right-column summary cards) with Helvetica typography and spacing constants from `reportPdf.js` on 595×842 sheets.
- **Protocol admin HTML preview spike** — admins on unapproved reports see the full `QovesProtocolReport` HTML document (all pages) in the Protocol tab instead of the PDF iframe, for evaluating in-place edit UX; non-admins still get the PDF iframe. HTML sheets are locked to jsPDF A4 (595×842) and fit-to-width scaled like the PDF iframe.
- **Protocol PDF viewer chrome** — removed in-viewer Protocol title, zoom, fullscreen, and Download PDF controls; iframe now fills the report canvas (`qoves-report-page--protocol`).
- **Single Python deps path** — install from root `requirements.txt` only (`python -m pip install -r requirements.txt`). Updated README, AGENTS.md, replit.md, `.env.example`, `scripts/rerun_parsing.py`, and `media_storage` install hint away from removed `backend/requirements.txt` / `pyproject.toml` / `uv sync` paths. Clarified face-parsing torch deps are a required install (runtime still gates via `face_parsing_enabled()`).
### Fixed
- **Stuck MyFace boot spinner on home** — `RouteContent` no longer blocks unauthenticated users behind `AppBootScreen`; home redirects to `/analysis` or dashboard once `authReady`. Bootstrap strips `/en`/`/de` from raw `window.location.pathname` before route checks.
### Added
- **Locale switcher dropdown** — `LocaleSwitcher` in site navbar (desktop/mobile) and analysis flow; switches locale via next-intl router while keeping the current page path.
- **next-intl en/de locale routing** — `artifacts/myface` App Router now serves `/en/...` and `/de/...` via middleware locale detection, `app/[locale]/` segment, and `NextIntlClientProvider`. Message catalogs live in `messages/en.json` (source for translation) and `messages/de.json` (German placeholders). Run `pnpm --filter @workspace/myface run i18n:extract` to audit flat `t()` keys into `messages/en.extracted.json`.
### Changed
- **Onboarding flow i18n** — Questionnaire welcome, questionnaire wizard, photo upload/protocol, analysis preparing screen, onboarding layout, and shared `onboarding.js` / `photoValidation.js` utils now use `next-intl` with keys under `Onboarding`, `Questionnaire`, `Photo`, and `Analysis` in `messages/en.json` and `messages/de.json` (German file uses English placeholders for new keys). MyFace brand name stays untranslated.
### Added
- **Report UI i18n namespace** — Converted report navigation (`labelKey` in `reportNavConfig.js`, translated in `ReportNavSidebar`), intro/disclaimer/executive summary, proportions/dimorphism/averageness, shell chrome (`Report.jsx`), protocol side rail, locked gate, and static paragraphs in `qovesProtocolModel.js` to next-intl `Report` namespace in `artifacts/myface/messages/en.json` and `de.json`.
- **Admin/Errors/Pdf/CvReport/Shared i18n namespaces** — Converted admin panel, review panel, pipeline status, shared score widgets, `apiClient` error codes, CV report label keys, and PDF chrome strings to next-intl (`messages/en.json`, `messages/de.json`).
### Changed
- **Report feature panel i18n** — Chin, Smile, Neck, Brow, Eye, Skin, Nose, Lips, Hair, and Cheek report panels in `artifacts/myface` now use `useTranslations('Report')` for static UI chrome; added minimal `nose`/`lips`/`hair`/`cheek` keys to `messages/en.json` and `messages/de.json`.
- **Chin & cheek filled highlights on interactive report heroes** — Cheeks and Chin tabs keep the existing hero image and overlay notebook-style fills via `featureRegionOverlays.js` / `FeatureRegionHero`. Chin fill is geometric (top below the labiomental fold, bottom extended past menton 152) so goatee / soft-tissue chin tip is covered — MediaPipe 152 alone sits too high on bearded faces.
### Fixed
- **Local Postgres startup — SSL rejected** — `connect_db` no longer forces `ssl=True` for `localhost` / `127.0.0.1` / `::1` DATABASE_URL hosts (local Postgres typically has no TLS). Still uses SSL for remote managed URLs unless `sslmode=disable` or Replit `PG*` vars.
- **Naso-aural overlay disabled** — Ear (naso-aural) tab shows the profile photo with ratio stats only; measurement brackets deferred until profile mapping is reliable.
- **Orbital proportion bar eye length** — frontal ratio tabs now render a live face-crop plate paired with crop-space overlays (fixes short spans from image-% guides on a cropped photo). Outer ticks also get a small soft-tissue pad beyond mesh canthi.
- **Orbital proportion overlay placement** — measurement bar sits on the lower forehead (above the brows), not through the canthi; tick x still marks ex–en–en–ex. Crop/zoom unchanged.
- **Orbital proportion overlay** — replaced canthus dots + full-height vertical guides with one continuous eye-line bar and downward ticks at all four canthi (ex–en–en–ex). Crop/zoom unchanged.
- **Naso-oral proportion overlay** — same span-bar treatment as orbito-nasal: nose-base (al–al) and mouth-corner (ch–ch) horizontal bars with downward end ticks; no full-height vertical guides or corner dots. Crop/zoom unchanged.
- **Orbito-nasal proportion overlay** — replaced corner dots + full-height vertical guides with two horizontal measurement bars (inner canthi + alae) and downward end ticks, matching the Qoves span style. Crop/zoom unchanged.
- **Eyes / Eyebrows hero flash** — panels no longer briefly show the stored eyes-only (or brows) crop before the live zoomed periorbital crop finishes; hero waits for `cropFeatureBefore(…, 'periorbital')` with no sync fallback.
### Changed
- **Core shell i18n** — Site navbar, auth modal, dashboard, history, billing, payment success, settings, confirm dialog, and boot screen now use `next-intl` with `Nav`, `Auth`, `Dashboard`, `History`, `Billing`, `Settings`, and `Common` message namespaces in `messages/en.json` and `messages/de.json`.
- **Proportion span-bar overlays brighter** — orbito-nasal / naso-oral / orbital measurement bars render at full white (`rgba(255,255,255,1)`) with a slightly heavier stroke for readability.
- **Features Analysis UI alignment** — Cheeks, Jaw, Chin, Hair, Smile, and Neck panels now share the same Lips/Nose shell (`FeatureSummaryUi`: mono-label cards, ink range meter, detail carousel, brand metric columns, white hero frame). Image sources and metric data wiring unchanged.
- **Neck Features Analysis UI refresh** — new `NeckReportPanel`: same layout as Smile/Hair (header, 2×2 classifications, wide numeric carousel, All Neck Metrics table). Hero image source unchanged (`resolveFeatureHero('neck')` → `imageSrc`). Metrics from `featureParsing.metrics.neck` (neck width mm, neck/jaw width ratio) + `cvReport.neck` width class; Definition / Length / Aging stay N/A from geometry.
- **Smile Features Analysis UI refresh** — new `SmileReportPanel`: same layout as Hair/Chin (header, 2×2 classifications, wide numeric carousel, All Smile Metrics table). Hero image source unchanged (`resolveFeatureHero('smile')` → `imageSrc`). Metrics from `featureParsing.metrics.smile` (upper/lower arc curvature, smile width mm) + `cvReport.smile` width/curvature labels; Teeth Exposure / Teeth Color stay N/A from geometry.
- **Hair Features Analysis UI refresh** — new `HairReportPanel`: same layout as Chin/Jaw (header, 2×2 classifications, wide numeric carousel, All Hair Metrics table). Hero image source unchanged (`resolveFeatureHero('hair')` → `imageSrc`). Metrics from `featureParsing.metrics.hair` (forehead width/height, L/R temple inclination) + `cvReport.hair` qualitative labels (density, hairline, forehead exposure).
- **Chin Features Analysis UI refresh** — new `ChinReportPanel`: same layout as Jaw/Cheeks (header, 2×2 classifications, wide numeric carousel, All Chin Metrics table). Hero image source and highlights unchanged (`resolveFeatureHero('chin')` / `FeatureRegionHero` via `heroSlot`). Metrics from `featureParsing.metrics.chin` (width, vertical height, midline deviation) + CV qualitative labels.
- **Jaw Features Analysis UI refresh** — new `JawReportPanel`: same layout as Lips/Cheeks (header, 2×2 classifications, wide numeric carousel, All Jaw Metrics table). Hero image source unchanged (`resolveFeatureHero('jaw')` → front jaw crop / `imageSrc`). Metrics from `featureParsing.metrics.jaw` (frontal rise, bi-gonial width, L/R inclination) + CV qualitative labels.
- **Cheeks Features Analysis UI refresh** — `CheekReportPanel` matches Eyebrows/Eyes/Nose/Lips layout (header, 2×2 classifications, wide numeric carousel, All Cheek Metrics table). Hero image source and highlights unchanged (`resolveFeatureHero('cheeks')` / `FeatureRegionHero` via `heroSlot`). Metrics from `featureParsing.metrics.cheeks`; Cheekbone Height stays N/A.
- **Lips Features Analysis UI refresh** — new `LipsReportPanel`: same layout as Eyebrows/Eyes/Nose (header, 2×2 classifications, wide numeric carousel, All Lip Metrics table). Hero image source unchanged (`resolveFeatureHero('lips')` → `imageSrc`). Metrics from `featureParsing.metrics.lips` + derived qualitative labels; Lip Health stays unavailable from geometry.
- **Nose Features Analysis UI refresh** — new `NoseReportPanel`: same layout as Eyebrows/Eyes (header, 2×2 classifications, wide numeric carousel, All Metrics table). Hero image source unchanged (`resolveFeatureHero('nose')` → `imageSrc`). Metrics from `featureParsing.metrics.nose` + derived qualitative labels.
- **Eyes Features Analysis UI refresh** — `EyeReportPanel` matches the Eyebrows layout: emotion-style header, same zoomed periorbital hero (`cropFeatureBefore(…, 'periorbital', 1.2)`), 2×2 classifications (tilt / exposure / sclera / under-eye), wide numeric carousel (curvature / EAR / spacing from `featureParsing.metrics.eyes`), and **All Eye Metrics** table. Narrative prose deferred like brows.
- **Eyebrows Features Analysis UI refresh** — `BrowReportPanel`: emotion header, zoomed **periorbital** hero (live `cropFeatureBefore(…, 'periorbital', 1.2)` eyes+brows; fallback eyes hero then brows crop), 2×2 classification cards (Position / Tilt / Virility / Shape), wide numeric detail carousel (peak / elevation / apex from `featureParsing`), and **All Eyebrow Metrics** table. Dense legacy charts deferred.
- **`cropFeatureBefore` optional `zoomIn`** — values `> 1` shrink the crop box toward center (tighter framing); default `1` keeps prior behavior.
- **AI visuals prompts aligned to natural-language scope-fence style (ADR-035)** — `backend/visual_generation.py` hair / outfit / aging variants share `SHARED_VISUAL_OPENING`, put a scope-fence sentence first per variant, weave CV anchors as ready-to-insert phrases (`_cv_anchors`: face shape, hairline, skin tone) with grammatical fallbacks when CV is missing, and drop the trailing `Client:` / `Context:` appendix. Three independent single-call edits unchanged.
- **Best-groomed projected-AFTER prompt — fixed constant, no CV weighting (ADR-034)** — `backend/projected_after_ai.py` now sends one fixed makeover template (`PROJECTED_AFTER_PROMPT`) to `image_client`: visible skin/eye improvement, flattering hair/facial-hair styling, identity/proportion lock, pores preserved. Removed `projection_strengths`, `_FEATURE_GUIDANCE`, `_focus_features`, and `visual_generation` profile/context imports. New manual-only dev helper `scripts/preview_projected_after_prompt.py` prints the prompt (optional assessment UUID for `front.jpg` path hint; agents must not invoke it).
- **Content-anchored null-path narratives — grounded "no changes" sections, per-feature few-shot, keep-best-LLM fallback (ADR-033)** — the minimal-severity (non-Skin) null path was length-anchored ("2-3 sentences, no changes recommended"), so the model padded with generic phrases ("balanced/harmonious") instead of the actual measured geometry. Now `get_severity_content_directive` (`backend/recommendation_rules.py`) emits a 3-part content structure (name the specific measured attributes → why they sit in range → conclude no non-surgical change), and `_build_feature_messages` injects a **per-feature few-shot exemplar** (`NULL_PATH_FEATURE_GUIDE`, one per non-Skin feature incl. `smile`, feature-specific vocabulary) into the user message with a longer content band. A new `null_path_grounded` guard (`backend/clinical_guardrails.py`) rejects null-path copy that cites zero concrete cue terms (`null_path_grounding_terms` = curated distinctive anatomical nouns ∪ auto-derived `measuredFacts` key tokens minus a stopword list tuned against a real key dump; features with no usable measured cues via `has_usable_measured_cues` are exempt). `generate_feature_narrative_async` is now a `while` loop with an **independent grounding-retry budget** (`NULL_PATH_GROUNDING_MAX_RETRIES`, default 2, separate from `FEATURE_NARRATIVE_MAX_ATTEMPTS`) so schema failures can't starve grounding retries; ungrounded sections regenerate with a corrective hint and, if the budget is spent, keep the **last LLM copy** (logged) rather than dropping to the generic template.
- **Qoves-style narrative text generation — severity-gated, no numeric leaks, enforced non-invasive vocabulary (ADR-032)** — reworked the per-feature report prompt pipeline (`backend/narrative_orchestrator.py` + supporting modules). Severity now gates recommendation length: `feature_severity_bucket` + `get_severity_content_directive` (`backend/recommendation_rules.py`) map each feature's deviation magnitude to minimal/mild/moderate/notable and emit bucket-specific directives, and a **null-recommendation path** makes every non-Skin feature output a short "no changes recommended" (2-3 sentences) at negligible severity instead of forced SPF/hydration/sleep filler. **Skin-confined foundational care:** SPF/hydration/sleep advice is instructed to live only in the Skin section for every non-Skin feature regardless of bucket (deterministic dedupe under parallel generation). **Directional consistency (Fix 2):** `FEATURE_NARRATIVE_SYSTEM` + a jaw/cheeks hint require stating a classification once (e.g. "wide" never also "narrow"/"narrowing"), with a soft co-occurrence backstop (`CONTRADICTION_PAIRS`) logged in `clinical_guardrails.py`. **Sclera guardrail (Fix 5):** the eyes prompt + `CLOSING_SYNTHESIS_SYSTEM` forbid attributing sclera color to any medical cause (one neutral visual sentence, not repeated elsewhere), with a soft validation for sclera+cause language. **Non-invasive vocabulary enforced (Fix 7):** enumerated ban list added to `STRICT_NON_SURGICAL_RULES`; `BANNED_TERM_PATTERN` extended with tightly scoped `chemical|laser|micro* peel(s)`, `radiofrequency`, `ultherapy`, `energy-based` (bare "peel" deliberately excluded to avoid verb false-positives); `_RETRY_USER_HINT` now names the banned terms so a hard-reject retry is corrective before the deterministic per-section template fallback.
### Fixed
- **Face parsing failing on every fresh venv — `feature_parsing.status = failed`, `lastError: "Face parsing disabled or PyTorch/transformers not installed"`** — `torch`/`torchvision`/`transformers` were optional (a since-removed `requirements-face-parsing.txt`) and never listed in `pyproject.toml`, so `uv sync` never installed them and `face_parsing_enabled()` returned `False`, short-circuiting `run_parsing_stage` (attempts stay 0). They are now core dependencies in `pyproject.toml`, pinned to **CPU** wheels via a `[[tool.uv.index]] pytorch-cpu` (`https://download.pytorch.org/whl/cpu`) + `[tool.uv.sources]` override scoped to Windows/Linux (macOS falls through to PyPI's native build). A plain `uv sync` now installs them (`torch 2.13+cpu`, `torchvision 0.28+cpu`, `transformers 5.x`) and SegFormer parsing works out of the box. Docs updated (`docs/sop.md`, `docs/architecture/backend-overview.md`).
- **Concurrent pose uploads silently dropped — "Missing required photo poses" on submit despite all 7 showing Uploaded (ADR-031 flow)** — the progressive upload UI fires per-pose `PUT /assessments/{id}/photos/{poseId}` requests in parallel (`PhotoUpload.jsx` bulk/demo path `Promise.all`), but the handler did a read-modify-write of the whole `photos` JSONB map from a request-start snapshot, so concurrent uploads clobbered each other (lost update) and only a subset persisted — each PUT still returned 200, so the UI marked every pose Uploaded while the DB held only the last writers, and Submit's `validate_required_poses` then failed. Writes are now atomic per pose: new `upsert_assessment_photo` / `remove_assessment_photo` repository helpers lock the row (`SELECT ... FOR UPDATE`) and merge/drop a single pose key; `put_assessment_photo` / `delete_assessment_photo` use them instead of replacing the whole map.
- **Raw numeric deviation leaked into report prose (cheek/ear etc.)** — two prompt-assembly sources removed at the root: `get_tier_hints` no longer injects the raw magnitude float (`({mag:.2f})` is now `(qualitative)`), and `feature_context_as_prompt_text` scrubs raw int/float leaves from the `CV cues JSON` block (`_drop_numeric_leaves`) so only qualitative cues reach the model (the qualitative form already ships via `measuredFacts`/`deviationFacts`). `FEATURE_NARRATIVE_SYSTEM` also instructs the model to use only the provided severity label, never raw decimals.
### Added
- **Progressive per-pose bucket upload + draft/finalize flow (ADR-031)** — a single assessment-creation path in every environment. New endpoints `POST /api/assessments/draft` (idempotent by `user+scanId`), `PUT /api/assessments/{id}/photos/{poseId}` (multipart, original bytes), `DELETE /api/assessments/{id}/photos/{poseId}`, and `POST /api/assessments/{id}/submit` (verifies required poses, enqueues the pipeline). Each pose is uploaded to the active `MediaStorage` backend immediately after client-side validation; Submit only finalizes. Repo helpers `set_assessment_photos` + `finalize_assessment_for_processing`. apiClient gains `createAssessmentDraft`, `uploadAssessmentPhoto`, `deleteAssessmentPhoto`, `submitAssessment`; `AppProvider` gains `draftAssessmentId`/`ensureDraft`/`submitAnalysis`.
- **Admin live pipeline tracker** — new `components/admin/PipelineStatusPanel.jsx` (per-stage `cv → parsing → narratives → projected_after` progress + percent) rendered in `AdminReviewPanel`, plus a compact `pipeline.status`/current-stage badge in the `AdminPanelPage` review list. Admin "Retry pipeline" button wired to `retryAssessmentPipeline` → `POST /api/assessments/{id}/retry-pipeline` (shown when the pipeline is `failed`). `pipeline` added to the admin list summary projection.
### Changed
- **Full image quality preserved end-to-end** — original pose bytes are uploaded via multipart and stored **as-is** (no client 1600px downscale, no JPEG q0.88 re-encode). `utils/imagePayload.js` `prepareImageForBackend`/`preparePhotosForBackend` are now pass-throughs (normalize to a data URL only). Client MediaPipe validation still runs on a throwaway 640px canvas copy, so it never touches the stored image. `photo_storage.save_pose` sniffs the true content-type from magic bytes and preserves original bytes while keying `{poseId}.jpg` for pipeline compatibility; `routers/media.py` sniffs and sets the correct `Content-Type` when serving.
- **Static timeline Preparing page** — `AnalysisPreparing.jsx` rebuilt as a static per-stage timeline (day estimates + "N DAYS LEFT" badge) with a non-functional "Need it sooner?" express-delivery placeholder; all live polling/stage-status removed. Submit drops the user straight here ("We'll email you when it's ready — you may close this tab safely").
- **Live pipeline status hidden from users** — Dashboard/History show a neutral "In preparation" vs "Ready" badge (`userReportReady`/`userStatusLabel` in `reportWorkflow.js`); Open/View buttons are gated on the report being viewable. Live pipeline detail now lives only on the admin side.
- **Un-submitted drafts hidden from users** — `list_assessments_for_user` excludes `status="draft"` rows with `pipeline=null` so abandoned drafts don't clutter the user dashboard (admins still see them).
### Removed
- **Dead client-side CV + AWS-fallback paths** — deleted `utils/analyzeFace.js`, `components/Scanning.jsx`, `components/App.jsx`, the "Use Free Local Analysis Instead" retry button + `handleRetryLocal`/`onRetryLocal` wiring, `goToScanning`/`startScanning`, `runFaceAnalysis`/`runFaceAnalysisViaBackend`, and the dead `formatProcessingBadge` helper. The web app no longer uses the legacy compressed base64 `POST /api/assessments` create path.
- **AWS Rekognition subsystem (frontend)** — removed the now-orphaned client-side AWS provider entirely: deleted `utils/awsRekognition.js` (incl. `testAwsConnection`/`analyzeFaceWithAWS`), `utils/buildAwsReport.js`, `utils/appMode.js`, and `utils/settings.js` (provider selection + AWS credential storage). `components/Settings.jsx` is now an info-only "API Settings" panel describing the managed pipeline (no provider tabs, no AWS keys, no connection test). Dropped the dead `detectProtocolViolations`/`protocolWarningsToMarkdown` (Rekognition `faceDetails`) helpers from `utils/protocolCheck.js` (kept `PROTOCOL_ITEMS`/`PHOTO_POSES`) and the `cvEngine === 'aws'` label branch in `Report.jsx`. Analysis is backend-only; there was no `/api/test-aws` route.
### Changed
- **Unified media storage (local filesystem ⇄ Replit Object Storage)** — all assessment media (poses, SegFormer parsing crops, projected AFTER, protocol JSON) now flows through one interface, `backend/media_storage.py` `get_media_storage()`, with two interchangeable backends selected by `MEDIA_STORAGE_BACKEND` (`local` | `replit`; unset = auto-detect `replit` inside a Replit env, else `local`; **no runtime fallback**). Objects are addressed by keys like `assessments/{id}/front.jpg` and served to the browser by a new open route `GET /api/media/{key}` (`backend/routers/media.py`) that streams bytes from the active backend — so image URLs (`/api/media/assessments/{id}/...`) resolve identically in dev and prod and no longer depend on Next static serving. `photo_storage.py`/`protocol_storage.py` and all readers (`visual_generation.py`, `vision_context.py`, `pipeline_stages.py`, plus `scripts/rerun_projected_analysis.py`, `scripts/test_hair_norwood_assessment.py`) now store/read via the interface. Adds the `replit-object-storage` dependency, gated with a `python_version < "3.13"` marker (its wheels stop at 3.12; Replit runs 3.11) so it installs on Replit but is skipped on 3.13, where only the local backend runs; the local backend writes under `var/media/` (gitignored). `MediaStorage.public_url`/relativePath are now `/api/media/...` and `assessments/...`. (ADR-030)
- **Generative projected AFTER face** — the projected AFTER image is now produced by a **generative image edit** (`backend/projected_after_ai.py` → `image_client`) instead of the deterministic OpenCV retouch. The prompt is identity- and measurement-preserving (same person / bone structure / proportions / pose / lighting; no reshaping, no clinical imagery) and emphasizes the weakest features via `projection_strengths`. If the provider is unavailable or the edit fails, `projected_after.status` is set to **`pending`** (retryable) instead of `failed`, and AFTER CV (`projected_analysis`) is skipped. The legacy OpenCV `backend/projected_after.py` (`project_full_face_after`) is **removed**; its still-used helpers (`projected_after_enabled`, `projection_strengths`) moved into `projected_after_ai.py`. (ADR-029)
- **Provider-agnostic image client** — new `backend/image_client.py` replaces `openai_images.py`/inlined OpenAI calls. One `generate_image_edit(prompt, image_bytes)` entry point abstracts **OpenAI** (`/v1/images/edits`, multipart) and **OpenRouter** (`/v1/chat/completions` with `modalities:["image","text"]`, source image in the user message, edited image in `choices[0].message.images[0]`). Provider resolves `IMAGE_PROVIDER → LLM_PROVIDER → key presence` (mirrors `resolve_llm_provider`); models via `OPENAI_IMAGE_MODEL` (default `gpt-image-1`) / `OPENROUTER_IMAGE_MODEL` (default `google/gemini-2.5-flash-image`). `visual_generation.py` (AI visuals) now routes through the same client, so a single provider setting drives both features. Never raises for expected failures (missing key, timeout, non-2xx). (ADR-029)
### Fixed
- **App randomly stuck on the loading screen (needed a full refresh)** — the auth bootstrap in `AppProvider` used `fetchCurrentUser().then(setUser).finally(setAuthReady(true))` with **no `.catch`**. When `/api/auth/me` rejected (backend reloading under `uv run --reload`, cold start, or a proxy blip), the `.then` was skipped so `setUser` never ran, while `.finally` still flipped `authReady=true` → `RouteContent` rendered `AppBootScreen` forever (`authReady` true but `user` null) until a manual refresh. Added a `.catch` that falls back to the optimistic stored session, and hardened `fetchCurrentUser` (`utils/authClient.js`): a 12s `AbortController` timeout so a hung backend can't spin forever, and `clearSession()` now only fires on real auth failures (401/403), not transient 5xx/network errors.
- **Uploads no longer 404 in dev or prod** — superseded by the unified media storage above (see Changed / ADR-030). The interim fix that wrote uploads into `artifacts/myface/public/uploads` is removed; media is now streamed from the active backend via `/api/media/{key}`, which works the same under `next dev`, a Replit static/app deploy, and locally on Windows.
- **Cross-platform workspace tooling (Replit + Windows)** — the pnpm-only `preinstall` guard is now a Node script (`scripts/enforce-pnpm.cjs`) instead of `sh -c '...'` (which failed in Windows PowerShell/cmd); the `@workspace/myface` `dev`/`start` scripts drop the bash `${PORT:-3000}`/`$PORT` and rely on Next.js honoring the `PORT` env (Replit sets it; local defaults to 3000). Added a root `pnpm dev` convenience script.
- **Skin Recommendations side-by-side pair framing** — the skin *side-by-side* pair now uses a tight cheek-only skin patch (`getFeatureBox('skin')`): image-left cheek framed strictly **below the lower eyelid and above the upper lip**, inset from the ear/jaw silhouette and stopped before the nasal ala — no eye, no lips, no nose. `FEATURE_MIN_PX.skin` lowered to 180 so the tight box is not re-inflated by `expandBoxToMinSize`. Side-by-side BEFORE = `imageSlots.pairBefore` (live tight crop) and AFTER = feature-cropped tight AFTER (`AFTER_LIVE_FIRST_FEATURES`). The PDF **half-split panel is unchanged** — it keeps the wide `imageSlots.before` cheek crop (stored `cvReport.cheeks`) with the full AFTER warped on via `alignAfterToBefore`.
- **`scripts/test_hair_norwood_assessment.py`** — hair/Norwood geometry test; by default inserts a **new** assessment clone with only `analysis.cvReport.hair` updated (source row untouched; `--dry-run` to skip write).
- **`scripts/calibrate_norwood_temples.py`** — labeled-folder harness for temple-recession threshold calibration.
- **Norwood stage 1 vs 2 misclassification** — staging for Hamilton–Norwood 1–3 is now **temple-geometry** driven (`templeRecession` / mid-frontal hairline), not scalp `densityPct`. Density only escalates stage 4+. Also: hair-mask highlight arm (glossy lit hair), density ROI starts below the detected hairline (not fixed forehead %), `templeMetrics` on hair result, calibration harness `scripts/calibrate_norwood_temples.py`. Thresholds 0.03/0.07/0.13 are pre-calibration placeholders (not a clinical diagnosis).
### Added
- **Projected AFTER CV (`projected_analysis`)** — after a successful `projected/full` write, runs MediaPipe/OpenCV on that image into assessments JSONB `projected_analysis` (`cvReport`, landmarks, metrics, eyeAnalysis). BEFORE `analysis` is never mutated (ADR-027). Admin `POST …/projected-after` regenerates both image + AFTER analysis.
- **`scripts/rerun_projected_analysis.py`** — run AFTER CV (`projected_analysis`) from the assessment’s `projectedAfter.full` URL/path (disk scan only as fallback); asserts BEFORE `analysis` unchanged. Manual invoke only.
### Fixed
- **Protocol/PDF feature AFTER framing** — eyes/jaw/chin/ears (and neck/hair) live-crop with `projectedAnalysis.landmarks` + same `getFeatureBox` as BEFORE. When AFTER aspect/size ≠ BEFORE front, face-centered cover-fit onto BEFORE canvas (AFTER-only; clinical B&A same-format practice) then remap landmarks. `FEATURE_MIN_PX` scaled by short-side ratio. Stored `cvReport` crops fallback for live-first features; other features prefer stored crops. Skin half-split unchanged.
- **PDF skin half-split alignment** — for Skin Recommendations, the half-before / half-after panel warps projected AFTER onto the BEFORE canvas via MediaPipe similarity (`alignAfterToBefore`) before `composeSplit`. BEFORE is never modified.
- **Skin BEFORE/AFTER pair AFTER framing** — side-by-side AFTER uses a midface crop centered between nose tip and upper lip, slightly zoomed out (`zoomOut` 1.22); landmarks detected on the AFTER image. Half-split path unchanged.
- **Protocol overview AFTER squeeze** — PDF cover no longer stretch-falls-back when warm/crop misses (aspect-preserving contain). Overview BEFORE/AFTER face-aligns AFTER onto BEFORE; UI overview frames use `aspect-[3/4]` matching portrait captures.
### Changed
- **Report open: single assessment GET** — admin/dashboard no longer stack redundant `GET /api/assessments/{id}` calls; `viewCloudAssessment` skips a second fetch when already given a full payload, and `Report` reuses that doc for admin tools + NL hydrate (no extra GETs on open).
### Added
- **Admin projected AFTER** — `POST /api/assessments/{id}/projected-after` (admin) always generates/overwrites `projected/full.jpg|png`, ignoring `PROJECTED_AFTER_ENABLED`.
- **`scripts/rerun_projected_after.py`** — re-run full-face projected AFTER for one assessment (mirrors admin path; default ignores env flag). Manual invoke only.
- **Admin protocol section regen** — `POST /api/assessments/{id}/ai-protocol/section` regenerates overview, closing, or one feature; `ai-protocol?force=true` regenerates the whole PDF narrative (admin).
- **Projected AFTER pipeline stage** — last worker step after parsing generates one full-face measurement-guided image (`projected/full.jpg` or `full.png` from magic bytes); same `publicUrl` on all protocol/PDF AFTER slots; `PROJECTED_AFTER_ENABLED=false` by default (ADR-026). Distinct from AI Visuals.
- **Async full assessment pipeline** — `POST /api/assessments` validates photos, persists uploads, and enqueues CV → narratives → SegFormer parsing via Postgres-tracked `pipeline` JSONB + in-process worker (`PIPELINE_WORKER_ENABLED`, `FOR UPDATE SKIP LOCKED`).
- **AnalysisPreparing UI** — Qoves-style “your analysis is being prepared” screen with live stage list; users can close the tab and track progress from Dashboard/History.
- **Feature parsing enrichment** — `featureParsing` JSONB + `parsing/{featureId}.jpg` crops; assumed-scale mm metrics (`scale: assumed_ipd_63.5`) for interactive Features Analysis panels only (ADR-024).
- **Pipeline retry endpoint** — `POST /api/assessments/{id}/retry-pipeline` for failed jobs.
- **`scripts/rerun_parsing.py`** — re-run SegFormer parsing only for an existing assessment (no full pipeline replay).
### Changed
- **Admin review panel** — removed executive summary / strengths / focus / recommendations / disclaimer editors; admins generate whole or per-section PDF protocol text, edit subsection bodies via section dropdown, and generate projected AFTER; save persists `protocolNarrative` + `featureNarratives`.
- **Hybrid SegFormer parsing crops** — front-pose mask-isolated heroes use **white** background (eyes, nose, eyebrows, hair, **neck**; ears skipped on front); **skin** = face composite minus hair; **chin / cheeks / jaw** stay rectangular. **lips** from DB front MediaPipe landmarks on `front.jpg`; **smile** from MediaPipe on `smile.jpg`; **earsLeft / earsRight** from SegFormer on profile poses.
- **Ears panel** — single left-profile hero (`max-h-48`) matching other feature boxes; dual L/R grid removed.
- **Dimorphism per-feature cards** — show the same `featureParsing` crops (eyebrows/eyes/nose/…) as Features Analysis; scores/explanations unchanged.
- **Upload flow** — Scanning step is a fast submit only; report opens after pipeline `ready` (not inline in POST).
- **Per-subsection narrative body caps (all features)** — explicit short/standard/long bands (1000 / 1500 / 2000 chars) for every feature title; Ear Structure / Neck Skin / Eyebrows / Under eye = long; Further Enhancement = standard.
### Fixed
- **PDF projected AFTER** — protocol overview and feature pages were hardcoding AFTER as `null` (“Projected image pending”); they now use `projectedAfter.full.publicUrl`. Report also re-fetches `projectedAfter` when narratives are already cached.
- **Admin review scroll** — embedded review panel uses a max-height + internal scroll with sticky Save/Approve so actions stay reachable inside the report modal.
- **Admin review tools** — PDF narrative and After image are separate admin-only header toggles that open independent overlays; not shown to clients; report body stays uncluttered.
- **Protocol BEFORE/AFTER framing** — preview `ImageFrame` uses absolute `object-cover` so portrait AFTER fills the frame (no side letterboxing); hair PDF frames also use `cover: true`.
- **Landmark-matched AFTER crops** — protocol UI + PDF crop `projectedAfter.full` with the same `getFeatureBox` keys as BEFORE (`resolveFeatureAfterImage`); overview stays full-face; skin uses cheek/skin box (not full portrait).
- **Face parsing optional deps** — `requirements-face-parsing.txt` now includes `torchvision` (required by `SegformerImageProcessor`); documented `uv pip install --python backend/.venv/Scripts/python.exe` for local venv setup.
- **AnalysisFlow build** — removed duplicate `openDashboard` destructure from `useApp()` that broke Next.js compile.
- **Proportions overview guides** — lines were crop-% drawn on the full front photo (spread above the head / into the neck). Guides are now full-image % (hairline/brow/subnasale/chin); UI recomputes from landmarks at display time and prefers the front photo so existing assessments fix without a re-scan.
### Changed
- **Report prose: no hard clip + numeric ban** — removed mid-sentence `_clip` ellipsis; raised feature narrative caps (`body` 1500, `summary` 500); LLM `measuredFacts` use qualitative score bands (no `N/100`); expanded NUMERIC BAN prompts + `SCORE_PROSE_PATTERN`; score language hard-rejects then retries (strip only after accept).
- **PDF summary / labeled heading spacing** — more gap under titles in `drawSummaryCard` and `drawLabeledBody` (e.g. Ear Summary).
- **Feature narrative retries** — hard reject / empty: up to **3** total LLM attempts (`FEATURE_NARRATIVE_MAX_ATTEMPTS`); **429**: **3** extra calls with exponential backoff from **30s** (`FEATURE_NARRATIVE_RATE_LIMIT_RETRIES` / `FEATURE_NARRATIVE_RATE_LIMIT_BACKOFF_SEC`).
- **Eyes interactive panel** — omits the Eyebrows narrative subsection; brows stay on the dedicated Eyebrows Features Analysis tab.
- **LLM max output tokens** — default `LLM_MAX_OUTPUT_TOKENS` raised from **4000** to **8000** (narratives, protocol, assistant; still overridable via env).
### Fixed
- **Facial thirds mismatch** — metrics used brow→mouth→chin while the overlay (reference) uses brow→subnasale→chin, producing inflated middle thirds (e.g. 0.60) and high proportionality scores unrelated to thirds; both now share hairline/10 → brow → subnasale/2 → chin, and score from thirds balance.
### Changed
- **Facial Assessments copy from measurements** — Face Shape `midfaceWidth` classified vs brow/jaw; dimorphism/symmetry/proportions/prototypicality explanations cite live scores, ratios, and regional drivers (no false skin claim); thirds fall back to landmarks when metrics missing.
### Removed
- **Scanning cycling headline** — dropped rotating `SCAN_MESSAGES` copy; scan UI shows the current progress stage only.
### Changed
- **PostgreSQL greenfield (ADR-023)** — SQLAlchemy async + asyncpg; UUID PKs; JSONB for nested assessment payloads; `conversation_messages` normalized; env `DATABASE_URL`; gate `is_db_configured`; health field `database`.
### Fixed
- **Domain models doc ↔ database alignment** — documented `users.firstName`/`lastName`, `app_settings.createdAt`, `reviewLog` element shape, partial `user_scan_unique` index, cascade deletes, and `ai_access` owning `assistant_rate_limits`; startup now creates the unique `(userId, hourBucket)` index on that table.
### Added
- **Symmetry regional balance UI** — interactive Symmetry panel shows Eyes/Brows/Mouth/Jaw L–R balance bars from scoring pairs (`cvReport.symmetry.regions`).
- **Smile LLM narrative** — `FEATURE_NARRATIVE_IDS` includes `smile` (subsections Smile Shape / Teeth & Gingiva); generated into `featureNarratives.smile` and shown on the interactive Smile panel. Protocol PDF page map stays 10 features (ADR-022).
### Changed
- **Face Shape layout** — Shape + Midface/Forehead/Lower-third/Facial-length + Explanation sit in the right column beside the photo; Length/Midface and W/H Ratio wrap below.
- **Prototypicality mesh topology** — thick closed polygonal brows; nose is bridge-to-tip then tip↔alae triangle; face outline is temple→chin→temple U (near outer-eye height via 162/389), no forehead oval.
- **Prototypicality shape mesh stroke** — sage `#6B9080`, thinner (~0.75) round-cap lines on a white panel with a faint grid.
- **Proportions overview UI (Qoves layout)** — left face photo with hair/brow/nose/chin dotted guides; right stack of Proportionality score card (High/Good/Fair badge), Facial Thirds C→B→A bar, and Explanation. Backend `proportionLines` now crop-relative to match `imageSrc`.
- **Prototypicality shape mesh** — Shape Analysis panel draws a single front x/y MediaPipe feature mesh (lips/eyes/brows/oval/nose) in brand stroke; no photo, no side profile, no You vs Average overlay.
- **Symmetry overlay (notebook set)** — 18 bilateral hollow rings (brow/eye/alae/mouth/cheek/jaw/chin pairs) plus double-arrow midline from landmarks 10→152; removed midline nose-chain and lid/peak dots from the overlay. Rings match notebook style: thin pure-white hollow circles (stroke ~1.1px), no fill/outline halo; aspect-compensated ellipses so markers stay round under stretched SVG mapping.
- **Symmetry score curve (liberal)** — mapping softened to `92 − avgDev×7.5` (clamp 55–97); label bands unchanged (85/74/64).
- **Face Shape assessment (notebook port)** — `face_shape_from_landmarks` uses the 8-point polygon (10/103/234/132/152/361/454/332) with forehead expansion and Oval/Square/Heart/Round/Oblong classification; UI shows notebook metrics plus W/H ratio (jaw%/cheek% removed as static); white octagon+ellipse+dashed crosshairs via `FaceShapeOverlay` on the front photo (also baked into `faceShape.imageSrc`).
- **Face Shape metrics** — dropped static `jawWidth` / `cheekWidth` % cards from interactive Face Shape (and from `faceShape` payload).
- **Interactive feature panels — one prose block** — brows/skin/cheeks/eyes/`FeatureReportPanel`/nose/lips no longer repeat the same CV `explanation` in details + section fallbacks + Full Analysis Summary; single `FeatureProseBlock` per panel.
- **Interactive Features Analysis ← `featureNarratives`** — protocol LLM `summary`/`subsections` wired into that slot (eyebrows from eyes “Eyebrows” subsection); CV explanation or “Narrative pending” when missing.
- **Facial Assessments copy (no LLM)** — dimorphism / prototypicality / proportions / symmetry / face shape use second-person Qoves-style metric templates; proportions UI shows facial-thirds overview + per-ratio explanations (ADR-022).
- **Scanning progress UI** — stages mirror one-shot NL enrichment (`Writing feature recommendations` / `Building protocol narrative`); CV stages advance ~1.4s, NL stages ~10s; final stage completes only when `POST /api/assessments` returns; helper copy notes the wait can take a few minutes.
- **Unified LLM max output tokens** — all backend completions use `LLM_MAX_OUTPUT_TOKENS` (default **4000**, overridable via env) instead of mixed per-call caps; reduces truncated-JSON fallbacks that burned free-tier retries.
- **Slim feature LLM schema + hard no-scores in report prose (ADR-021)** — feature narratives ask the model only for `summary` + subsection `{title,body}`; `measuredFacts`/`limitations`/etc. are hydrated server-side. Executive, protocol overview/closing, and feature prompts forbid numeric scores (`X/100`); scores are stripped before persist.
### Added
- **Feature narrative shape normalize + enrichment scoreboard** — coerce common free-model JSON mistakes (`feature`→`featureId`, string→list fields, title-keyed subsections, body length clip) before schema validate; log `LLM accepted` / `TEMPLATE` per feature and a end-of-run `llm/total` scoreboard.
- **OpenRouter LLM provider** — set `LLM_PROVIDER=openrouter` with `OPENROUTER_API_KEY` (+ optional `OPENROUTER_MODEL`, default `meta-llama/llama-3.3-70b-instruct:free`). OpenAI-compatible client via `https://openrouter.ai/api/v1` (ADR-020). Free `:free` models remain rate-limited.
### Fixed
- **Feature LLM discarded for soft guardrail fails** — schema-valid feature narratives are kept (with a warning) when only soft checks fail (ungrounded scores / evidence tiers); templates only on banned procedural terms or unparseable JSON. Stops PDF from showing guardrail templates after successful Groq generations.
### Removed
- **`protocolData` action cards** — dropped from LLM generation, database/`protocol.json` storage, APIs, FE props, and Beauty Assistant `get_protocol_cards`. Protocol completeness uses `protocolNarrative` + `featureNarratives` only (ADR-018).
- **Ruler calibration** — deleted `calibration.py` / `test_calibration.py`; no `cvReport.calibration`, `mmPerUnit`, or questionnaire `mouthWidthMm`/`philtrumLengthMm` path (ADR-019). Profile cephalometrics keep angles/ratios in normalized units only.
### Added
- **Cheek PDF ANALYSIS guides from MediaPipe** — Cheek Recommendations ANALYSIS overlay uses DB `analysis.landmarks` with the midface construction from `test.ipynb` (ear-to-ear @ 1.08×, eyes 130/263, nostrils 102/331, mouth 61/291); see `utils/cheekGuides.js`.
- **PDF chin profile guides from CV** — Top: facial thirds. Bottom: pitched profile (~7° CW for rightProfile) with Pn + lip-plane verticals and chin ticks only (no dashed E-line). Landmarks resolved on the pitched bitmap via `resolveChinProjectionOverlay`.
- **`report_content.py`** — latest-only completeness helper (`aiNarrative`, `featureNarratives`, `protocolNarrative`, `aiVisuals`) and envelope shapes for generated report text.
- **Full facial analysis pipeline** — staged end-to-end doc in `docs/architecture/backend-overview.md` (FE entry → CV → persistence → LLM/guardrails → report/PDF → assistant → admin review).
### Changed
- **PDF/web protocol cover** — client name from questionnaire or logged-in user (`firstName`/`lastName`); cover shows PREPARED FOR + EDITION only (no date).
- **Cheek ANALYSIS crop** — midface box (eyes/ears/nostrils/mouth) so notebook-style guides fit the plate.
- **PDF Understanding page** — wider gap after numbers (48→78); section headings 10→11pt; body 8→9pt; page title 26→28.
- **PDF Neck Summary overflow** — `drawSummaryCard` no longer forces `minH` when space is tight (was drawing past the page); neck BEFORE/AFTER **280→240** to leave room for the summary.
- **PDF column summaries** — `drawSummaryCard` sticks to `PAGE_BOTTOM`; standard `SUMMARY_CARD_MIN_H = 110`; eyes EYES crop bottom-aligns with Eye Region Summary.
- **PDF image→text gaps** — `SECTION_GAP` and `IMAGE_TEXT_GAP` set to **22** (was 14 / 10); applied to frame returns, before/after pairs, cheek ANALYSIS trailing space, and client protocol portraits.
- **PDF lips BEFORE/AFTER** — pair height **175→200**.
- **PDF hair BEFORE/AFTER** — stacked frames **100→120**.
- **PDF lips LIPS preview** — square frame at full `COL_W`×`COL_W` (was `COL_W`×120).
- **PDF client protocol page** — BEFORE/AFTER portraits **240→360** tall; text/radar positions shift down to fit.
- **PDF chin profiles** — two guide frames use full `COL_W` × `CHIN_PROFILE_FRAME_H` (200), same style as nose/jaw but shorter than `PROFILE_FRAME_H` (300) so B/A + summary stay on one page.
- **PDF feature frame sizes** — hair BEFORE/AFTER 80→100; eyes BEFORE/AFTER pair 100→130; nose/jaw PROFILE shared `COL_W`×300 (`PROFILE_FRAME_H`); cheeks ANALYSIS/BEFORE/AFTER unified at COL_W×180; jaw BEFORE/AFTER 140→150; lips BEFORE/AFTER 150→175; chin guide profiles 100→120; skin half-col BEFORE/AFTER 90→150; neck stacked BEFORE/AFTER 230→280; ear stacked BEFORE/AFTER 200→220.
- **PDF eyes EYES frame** — landmark eyelid-ring contour clip (same approach as lips); no center-zoom that flattened the tops.
- **PDF lips LIPS frame** — uses outer-lip (`MOUTH`) contour mask on the protocol panel (`lipPreviewMask: 'contour'`); web protocol UI keeps the oval preview.
- **Protocol persistence SOT** — database wins when narrative fields are complete; `protocol.json` mirrors narrative/features only; closing always persisted server-side; admin `aiNarrative` edit refreshes closing; FE closing reads stored text only.
- **Protocol web viewer A4 sheets** — in-app protocol pages use `.qoves-report-a4-page` (210×297 aspect) on a desk canvas so the UI reads like stacked A4 pages, matching the PDF export proportions.
- **Backend overview doc** — `docs/architecture/backend-overview.md` maps every backend module (routers, CV pipeline, AI, PDF, repos) in plain language with the upload → analyze → store → narrative flow; clarifies FE jsPDF owns the branded protocol PDF vs backend ReportLab fallback.
### Changed
- **Report voice (ADR-017)** — PDF/protocol hard-coded copy and narrative/protocol LLM prompts use Qoves-style third person with **the subject** as grammatical subject (name when provided). Beauty Assistant and image prompts remain second person / unchanged. Supersedes ADR-013 for report narratives. Stored second-person feature/closing narratives are rewritten to subject voice at PDF/protocol render time.
### Fixed
- **Cheek PDF left-eye slant in sclera** — left eye vertex nudged toward ear; ANALYSIS overlay now cover-maps like chin and uses the same crop box as the photo so nudges actually land outside the eye.
- **Chin PDF top-plate horizontals on nose tip** — rays now start at/ below subnasale (clamped under Pronasale) on the facial plane; vertical still reaches the tip.
- **Chin PDF top-plate eye/cheek ray** — horizontal Y locked to Pn→Pog fractions only (ignore overlay Sn/G); drop anything at/above the tip; vertical no longer extends to brow.
- **Chin PDF top-plate unequal ticks** — horizontals use a fixed length from the vertical (no silhouette→vertical span), so all four match; tick length ~8% norm to match Image-2.
- **Chin PDF bottom verticals** — shifted further left (~2.8% norm); lip-plane (left) just shy of eyes, Pn (right) just shy of forehead.
- **Chin PDF over-pitch / floating guides** — replaced unstable Frankfort auto-level (~18° tilts) with a fixed ~7° chin-down pitch; tightened Pn/Pog/lip so the outer vertical and E-line stay on the soft-tissue profile instead of gray padding.
- **Chin PDF top plate invisible** — chin-show builder no longer drops out on soft validation; silhouette snap keeps a visible gap profile→vertical; draw path no longer skips segments via clip.
- **Chin PDF top PROFILE plate** — replaced cheek facial-thirds grid with Image-2 chin-show: one nose-tip vertical plus four horizontals from soft-tissue profile (Sn / stomion / labiomental / Pog) to that vertical.
- **Chin PDF projection overlays** — horizontals removed; both verticals nudged slightly left (~1.2% norm) toward the face.
- **Chin PDF guides shifted left of nose tip** — after clockwise pitch, silhouette X sat slightly posterior; Pn / lip / Pog get a small anterior nudge so verticals sit on the nose tip and lip plane (not through the eye/mouth corner).
- **Chin PDF guide fine-tune** — Pn/Pog inset onto soft tissue (not the bright halo); chin tip band raised off the throat; verticals end at chin-tick height.
- **Chin PDF pitch direction + simplify overlays** — right-profile pitch is clockwise (+7°) to match the reference forward tilt; bottom plate draws only verticals + chin horizontals (dashed E-line removed).
- **Chin PDF pitch + Ricketts lock** — re-enabled chin-down pitch; projection guides resolve Pn/Pog/Sn on the pitched photo (not collapsed overlay); chin ticks span Pog→lip plane and Pog→Pn vertical in full.
- **Chin PDF guides misaligned into padding** — template band used the frame’s right edge (empty gray); band is now face-content ∩ cover, then landmark X values snap onto the soft-tissue silhouette so Pn / Pog / verticals sit on the profile.
- **Closing PDF text corruption** — sanitize LLM Unicode (soft hyphens, en/em dashes, curly quotes, control chars) to Helvetica-safe ASCII before `splitTextToSize`/`text`; stops `` glyphs, blown word spacing, and left/right column overlap on Closing Recommendations.
- **Feature PDF templates instead of LLM copy** — `validated != raw` was always true after subject-voice rewrite, so every feature forced a retry; 429/failed retries then replaced good narratives with guardrail templates. Retries now run only when the first pass fails validation, and concurrency is capped at 2.
- **Chin PDF stacked analysis images** — right-column guide frames use the real right-profile photo (not frontal); frontal mouth/chin crop remains on the BEFORE pair only. Chin layout now resolves `profileImage` like nose/jaw.
- **PDF feature-page overlaps** — Hair/Eyes/Nose/Jaw/Chin/Cheeks/Lips/Skin/Neck/Ears drawers now use cursor-based (`leftY`/`rightY`) layout; summary cards grow with content and clamp above the footer.
- **PDF image frame overflow** — cover frames are canvas center-cropped to the exact box size before `addImage` (no jsPDF clip); keeps aspect ratio, prevents overflow, and does not blank later images.
- **Neck feature crop** — framing is now lower-face + neck (nostrils through jaw to collar), not a thin under-chin strip; protocol PDF prefers live crop over legacy stored crops.
- **Skin PDF split panel** — dashed center line is a true before|after split; right side shows projected after when available, otherwise "Pending" (does not mirror the before photo).
- **Chin BEFORE image** — frontal mouth/chin crop again (not right profile); profile kept on `imageSrcProfile` for overlays.
- **Ear BEFORE image** — front-facing ear/face crop (not right profile); PDF measurement guide lines removed for now.
- **Jaw BEFORE image** — front-facing mouth/jaw crop (not right profile); profile kept on `imageSrcProfile` for side overlays.
- **Hair BEFORE image** — frontal hairline/forehead/brows crop (not top-of-head scalp photo); top-head kept on `imageSrcTopHead` for density analysis.
### Changed
- **Nose PDF before/after** — image frame height increased from 80pt to 120pt on the Nose Recommendations page only.
- **Jaw PDF before/after** — image frame height increased from 90pt to 140pt on the Jaw Recommendations page only.
- **Norwood hair-loss PDF strip** — replaced line-drawn icons with head-focused Norwood stage illustrations (`public/norwood-stages/stage-1.png`…`stage-7.png`; Stage 3 vertex omitted; labels cropped out).
- **Understanding Your Results PDF** — bold lead sentences on page 4 bumped from 9pt to 10pt (slightly more prominent vs body copy).
### Removed
- **Scanning CV engine badge** — removed the "MediaPipe + OpenCV" pill from the analysis scanning screen (client-facing; ADR-013).
### Fixed
- **Naso-aural ear < nose false reading** — FaceMesh "ear" indices only mark the face–ear junction and under-read pinna height on 90° profiles. Ear span now uses rear-side helix→lobe detection from the profile photo; nasion/subnasale refined via silhouette indents. Overlay guides track the corrected points.
- **Chin / jaw recommendation images** — bind and display the right-profile photo (not front chin crop) in `photo_storage`, `CvReportView`, and protocol feature image resolution.
### Added
- **MediaPipe Pose neck metrics (ADR-016)** — `pose_analysis.py` runs alongside FaceMesh; jaw→shoulder neck length + head-forward posture angle when shoulders are visible; approximate fallback otherwise.
### Fixed
- **Hair segmentation kill-switch** — removed `HAIR_SEGMENTATION_ENABLED`; OpenCV HSV hair-mask always runs in the analysis pipeline (ADR-015).
- **Profile Tier C garbage-in** — `profile_silhouette` now wired as preferred 90° landmark source; FaceMesh alone no longer feeds nasofrontal/nasolabial/dorsal-hump when a silhouette is extractable.
- **Tier C render gap** — `nasofrontalAngleDeg`, `nasolabialAngleDeg`, `dorsalHump*` now shown in `CvReportView`, PDF protocol model, and nose explanation text (were computed but never displayed).
### Changed
- **`hair_analysis.analyze_hair_photo`** — prefers hair-mask density/hairline; falls back to dark-pixel heuristics only if mask fails.
- **`profile_cephalometrics`** — accepts profile photo bytes; `landmarkSource` is `silhouette` | `facemesh` | `silhouette+facemesh`.
### Added
- ADR-015 (always-on hair mask + silhouette profile landmarks).
- Tests: `test_hair_segmentation.py`, `test_profile_silhouette.py`.
### Fixed
- **LLM usage logs not visible** — usage boxes now `print` to stderr (uvicorn was hiding app `INFO`); `configure_backend_logging()` wires `backend.*` loggers.
- **Beauty Assistant markdown** — assistant bubbles render Markdown (bold, headings, lists, links) via `react-markdown` + `.assistant-markdown` styles.
- **AI visuals 500 (`Incorrect padding`)** — source portrait now loads from stored front photo / local `/uploads/...` path instead of base64-decoding public URLs; edits fail soft per variant.
### Added
- **LLM usage logging** — each chat completion logs provider, model, input/output/total tokens, and duration via `backend.llm_client` (pretty boxed INFO/WARNING lines).
- **Production AI visual prompts** — identity-preserving hair / outfit / aging edit prompts; image request logging; `sourceKind` on `aiVisuals`.
### Fixed
- **Beauty Assistant chat UX** — user message appears immediately; assistant typing loader in the thread; input stays editable while send is blocked until the reply returns.
- **Beauty Assistant panel** — responsive height (shorter on mobile, taller on desktop) with pinned composer; removed subtitle under the title.
- **`qovesProtocolModel.js` syntax** — restored missing `(` in `if (strengths.length)` that broke the Next.js build.
- **Beauty Assistant LLM failure** — no longer returns a fake score-dump template as a chat reply; `POST .../assistant` returns **503** with `ASSISTANT_UNAVAILABLE` when the model/API fails.
- **Symmetry / landmark overlays** — map MediaPipe 0–100% points onto the real `object-fit` image content box (fixes square SVG `meet` vs 4:5 letterboxing drift); smaller dots; curated landmark set; midline from facial landmarks.
- **Proportion overlays (ear/nose/mouth/eye)** — same content-box mapping; dots at true landmark coords (not averaged guide lines); orbito-nasal uses inner canthi (en–en) vs alae; orbital canthi L→R; live recompute from landmarks when available; 4px markers.
- **Naso-oral mouth width** — cheilions from outer-lip extremes (not inset 61/291); label is mouth vs nose (not vs 1.6 ideal).
- **Naso-aural ear guides** — use correct profile-side MediaPipe points; lateral ear span; short tick horizontals + endpoint dots.
- **Questionnaire welcome** — replaced Q-mark SVG with MyFace serif wordmark on the right panel.
- **Favicon** — page icon now uses `public/favicon.png` (replaced legacy `favicon.svg`).
### Changed
- **Navbar account control** — username / Sign in use `rounded-lg` (aligned with nav links), not pill shape.
- **Dashboard Payments KPI** — descriptor reads “Completed payments” (not “records”).
- **Dashboard** — removed Account KPI card; identity lives in the navbar only.
- **Navbar** — shows username (tap for Sign out); shows Sign in when logged out.
- **AI coaching voice** — narrative, protocol, closing, Beauty Assistant, and report UI use second-person (you/your) and omit MediaPipe/OpenCV/computer-vision jargon (ADR-013).
- **OpenAI Vision narrative enrichment** — when `LLM_PROVIDER=openai`, feature narratives attach only the mapped pose photos (hair: front+topHead; others per `FEATURE_VISION_POSES`); CV scoring stays local. Disable with `OPENAI_VISION_NARRATIVE=0`.
### Added
- **All 7 photo poses required** before analysis (`utils/constants.js`, `backend/photo_validation.py`, `POST /api/assessments` returns 400 when poses missing).
- **Structured `cvReport.eyes`** — four metric slices (eyebrows, eyelashes, ocular, underEye) via `assemble_eyes_region()` in `backend/eye_analysis.py`.
- **LLM closing synthesis** — `generate_closing_synthesis_async()` in `narrative_orchestrator.py` with `ClosingSynthesis` schema; deterministic stitch fallback.
- **Severity-gated 3-tier recommendations** — `evidenceTier` prompts, `deviationFacts`, tier ceiling validation in `clinical_guardrails.py`; tier labels in PDF and web viewer.
- **Profile cephalometrics extensions** — nasofrontal angle, dorsal hump deviation, profile gonial angle in `profile_cephalometrics.py`.
- **Skin texture module** — `backend/skin_texture.py` (Laplacian roughness, R−G redness, oiliness proxy) wired into `skin_quality_metrics()`.
- **Tier A landmark metrics** — jaw U/V/square classifier, cupid's bow definition, formalized frontal gonial angle proxy.
- **Optional hair segmentation hook** — `backend/hair_segmentation.py` gated by `HAIR_SEGMENTATION_ENABLED`.
- **Profile silhouette fallback** — `backend/profile_silhouette.py` for edge-based profile points (Phase 2 model integration).
- `backend/tests/test_photo_validation.py`.
### Fixed
- **`POST /api/assessments` 400** — front photo sent via `imageBase64` is now counted toward required-pose validation (was rejecting valid uploads).
- **Report modal** — shows an error instead of infinite "Building structured report…" when analysis returns without `cvReport`.
- **Demo photo analysis** — demo images (~40MB each) are compressed before upload; fixes oversized payloads on `POST /api/assessments`.
- **Open Report from dashboard/history** — fetches full assessment via `GET /api/assessments/{id}`; summary rows no longer misclassified as failed analysis.
- **Interactive report sidebar** — accordion nav (Introduction / Facial Assessments / Features Analysis / Protocol + Tools) restored; section-based navigation replaces immersive stacked scroll.
- **Report nav CSS build** — replaced invalid `@apply dark:hover:bg-surface-card/50` (and `/60`) with `hover:bg-surface-warm` so Next.js compiles `globals.css`.
- **Report header** — PDF (and Approve) sit in the same top bar as the title and close control.
- **AI narrative / protocol on open** — report open only loads stored NL content; generation runs once in `POST /api/assessments` pipeline.
- **`POST /api/assessments` 500** — `to_json_safe` now converts NumPy scalars (`np.bool_`, ints, floats, arrays) so database insert no longer fails with `cannot encode object: np.True_`.
- **Top-of-head hair analysis** — fixed grayscale-as-BGR crash in `analyze_hair_photo`; failed enrich no longer overwrites measured hair metrics.
- **Protocol narratives / summaries** — guardrails no longer reject the phrase `non-surgical`; templates and closing stitch produce measured, feature-specific copy instead of `Non-surgical guidance for X based on stored measurements`.
- **Report PDF feature crops** — per-feature landmark crops for eyes (brows / periorbital / dual-eye preview), lips (oval masked preview), and cheeks (landmark-based measurement overlays); generic guardrail narrative no longer replaces distinct subsection copy.
- **Hair PDF page** — `drawHairFeaturePage()` reads live `section.subsections` / `summary` and Norwood stage from `cvReport.hair`.
- **Nose PDF page** — no longer tags front crop as `PROFILE`; profile panel only when real side profile exists.
- **Nose CV enrichment** — profile measurements merged into `cvReport.nose` in `analyze_face._enrich_cv_report()`.
- **Neck metrics** — `dataSource: approximate` with user-facing limitation (no MediaPipe jargon).
- **Eyes web viewer** — 2×2 quadrant layout via `eyesQuadrant` layout hint.
- **Hair Norwood copy** — labeled as estimated, not clinical diagnosis.
- `AnalysisFlow` — single `/analysis` page with gated step state (welcome → questionnaire → confirm → upload → scanning).
### Changed
- Admin panel tabs use real routes (`/dashboard/admin-overview`, `/dashboard/admin-users`, `/dashboard/admin-review`, `/dashboard/admin-payments`, `/dashboard/admin-settings`) instead of `dashboard#admin-*` hash URLs.
- Assessment list APIs (`GET /api/assessments`, `GET /api/my/assessments`) return summary rows only (scores + metadata); full report loads on `GET /api/assessments/{id}` when opening a report.
- Admin workspace data is cached in `AppProvider` with tab-specific loading (no refetch when switching admin tabs; Refresh forces reload).
- Session is validated with `/api/auth/me` before `authReady`; route content does not render until complete.
- Inline theme bootstrap script in root layout prevents dark/light flash on refresh.
- Admin panel renders on `/dashboard` for admin users; Stripe success shows on `/billing`.
- Legacy URLs (`/report/*`, `/analysis/*`, `/admin`, `/payment-success`) redirect to the correct top-level route.
- `components/providers/AppProvider.jsx` — shared app state and navigation context.
- `components/AppShell.jsx` and `components/analysis/AnalysisShell.jsx` — layout shells with/without site navbar.
- Flattened App Router pages (`app/dashboard`, `app/history`, `app/billing`) — removed `(main)` route group to fix RSC bundler errors on `/history`.
- History and Billing pages: removed Back buttons; responsive stacked headers and full-width action buttons on mobile.
- Mobile `SiteNavbar`: full-width expandable panel below the header bar (replaces right-side drawer).
### Fixed
- Boot screen no longer shows navbar links (e.g. Analysis History) before session validation completes.
- Dashboard flash on refresh: auth gate blocks route content until session validation completes (no sign-in card swap).
- `/history` 500 from React Client Manifest / `SegmentViewNode` bundler errors after route-group flattening and client-only history load.
- `HistoryPage` loads local history in `useEffect` (avoids `localStorage` during SSR).
- `utils/settings.js` guards `localStorage` access during SSR (fixes 500 on report routes when `Settings` mounts).
- Report deep links show a loading state while assessment hydrates; no longer treats missing `analysis` as a CV failure.
### Changed
- Compact site navbar: reduced bar height (`2.5rem`/`2.75rem`), smaller nav links and auth/theme controls; hidden on analysis flow pages.
- Navbar-to-content spacing: `--site-navbar-gap` added to page offset on all navbar pages; fixed `py-8` overriding offset on dashboard, report, history, billing, admin, and payment success.
- Report view: immersive full-width layout without global navbar or report sidebar; floating PDF download only (admin Approve when pending).
- Questionnaire welcome: **Back to Dashboard** control (top-left) for signed-in users.
- Full-width responsive `SiteNavbar` replaces floating icon `TopNav`; preserves all app nav actions (Dashboard, History, Billing, Sign in/out, theme, etc.) with mobile drawer; hidden on questionnaire and scanning stages.
- Dashboard aligned to design tokens (`bg-brand`, `text-ink`, `bg-surface-card`) and landing-style gradient background; duplicate MyFace header removed.
### Added
- PDF-first clinical protocol pipeline: per-feature `featureNarratives` with OpenAI strict JSON Schema (`backend/narrative_schemas.py`, `chat_structured_completion` in `llm_client.py`).
- `backend/narrative_orchestrator.py` — 10 parallel structured LLM calls + clinical guardrails + protocol bundle stitching.
- `backend/feature_context.py`, `backend/clinical_guardrails.py`, `backend/recommendation_rules.py`, `backend/protocol_page_schema.py`, `backend/report_sections.py`.
- Beauty Assistant ReAct agent (`backend/assistant_agent.py`) with report fetch tools (`backend/assistant_tools.py`); max 3 tool rounds, `max_tokens=1000`.
- Unit tests: `test_narrative_schemas.py`, `test_clinical_guardrails.py`, `test_feature_context.py`.
### Changed
- Reorganized `.env.example` (single root file, removed unused `BACKEND_PORT` / duplicate `PORT`, outdated Settings UI key note).
- `docs/sop.md` — env setup uses one root `.env` instead of `backend/.env` + `.env.local`.
- Removed legacy OpenAI CV provider stub (`run_mediapipe_path` / partial analysis without `cvReport`); all assessments use full local CV. Settings OpenAI tab removed; `provider=openai` normalized to `local`.
- `POST /api/assessments/{id}/ai-protocol` now uses orchestrator (replaces monolithic `generate_protocol_narrative` for new bundles).
- Protocol JSON bundle stores `featureNarratives`; `GET /protocol` returns full PDF-ready bundle.
- `utils/qovesProtocolModel.js` fallback copy sanitized (no injectables/lasers/procedures in defaults).
- `ProtocolSideRail` label: Non-Surgical Protocol.
- Executive narrative and protocol action cards use structured JSON Schema output.
- Backend fallback PDF markdown notes Qoves client PDF as canonical when photo available.
### Added
- Unified backend text AI layer (`backend/text_ai_service.py`) for narrative, protocol, protocol narrative, and Beauty Assistant; shared non-surgical safety rules.
- Payment gating (`backend/ai_access.py`) on all AI endpoints (`402` when unpaid); Beauty Assistant hourly rate limit (20 messages/user/hour).
- `POST /api/assessments/{id}/ai-protocol` — server-side protocol generation persisted as `protocolData` + `protocolNarrative`.
- Beauty Assistant session summary compression (refresh after first exchange, then every 6 user messages) stored on `conversations.sessionSummary`.
- `assistant_rate_limits` table for hourly assistant quotas.
### Changed
- Redesigned downloaded PDF report pages 2, 3, and 4 to align with Qoves layout line-by-line, including vertical/horizontal dividers, even text distribution, and MyFace top-left text branding.
- Redesigned PDF cover page (Page 1) with a centered title, metadata fields grid, top and bottom border accent lines, and brand footers.
- Redesigned Page 5 (Client Protocol overview) with portrait BEFORE/AFTER images, description texts, and a mathematically-generated vector radar chart.
- Redesigned Page 6 (Hair Recommendations) with stacked BEFORE/AFTER hair crops, a programmatic 7-stage Norwood hairline diagram panel, a double-column text layout for hair loss details, and a dark-slate summary card.
- Redesigned Page 7 (Eyes), Page 8 (Nose), and Page 9 (Cheeks) to match visual screenshots, incorporating custom 4-section grids, vertical profile stacks, geometric analysis overlays, and full-width summary panels.
- Redesigned Page 10 (Jaw), Page 11 (Lips), and Page 12 (Chin) to match visual screenshots, incorporating profile stacks, lip crops, double geometric overlays, and summary panels/bars.
- Redesigned Page 13 (Skin), Page 14 (Neck), and Page 15 (Ears) to match visual screenshots, incorporating split images, vertical image stacks, antihelix/height overlays, and summary panels.
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
- Dev-only auto-approve (`NEXT_PUBLIC_DEV_AUTO_APPROVE` + `DEV_AUTO_APPROVE_REPORTS`): skips admin review in dev. Delete `devConfig.js`, `backend/dev_config.py`, and unset env vars before prod.
### Fixed
- Facial assessment overlays: symmetry dots and proportion guides now use full-image coordinates with `object-contain` + SVG `meet` alignment (fixes misplaced landmarks on front photos).
- Orbital proportion tab aligned to Qoves (inter-eye spacing vs eye width); backend now generates ratio overlays and explanations.
- Prototypicality score: fixed inverted middle-third calculation that collapsed scores to ~9; explanations match Qoves tone.
- Dimorphism overview: richer Qoves-style narrative and per-feature explanations.
- Pipeline calibration vs Qoves: symmetry score recalibrated (8 mirror pairs incl. ears; typical faces ~72–82, not inflated 90+); naso-aural ratio measured from profile photo (nasion→subnasale vs visible ear span); front-view naso-aural marked `front_estimate` until profile enrichment.
- Prototypicality score recalibrated for MediaPipe landmarks: jaw width (172↔397), nose/cheek ratio (127↔356), updated cohort norms, softer penalty curve — typical faces now land ~70–80 (Qoves band) instead of collapsing to ~23.
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
- Completed AuraScan → MyFace rebrand across the codebase: user-facing copy, `AGENTS.md`, architecture docs, `.env.example`, database examples, premium product id (`myface_report`), and browser `localStorage` keys (`myface_*`).
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
- Reorganized `docs/` folder structure, consolidating legacy setup files (`REPLIT_SETUP.md`, `SERVICE_SETUP.md`, `HANDOVER_CHECKLIST.md`, `SPRINT_LOG.md`) into systematic modular files.
- Replaced `.cursorrules` and `CLAUDE.md` with lightweight pointers to `AGENTS.md`.

---

## [1.0.0] - 2026-07-07
### Added
- Implemented user and admin roles registration (`/api/auth/register`, `/api/auth/login`).
- Added database persistence using PostgreSQL via SQLAlchemy async.
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
