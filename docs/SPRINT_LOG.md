# AuraScan — Sprint & Task Log

**Client:** Jay Michaels  
**Project:** AI Facial Analysis (Crest Infosystems proposal, July 2026)  
**Stack:** Next.js 15 · Python FastAPI · MongoDB · MediaPipe · OpenCV · OpenAI  
**Priority:** Complete milestones accurately; ship incrementally with tests each sprint.

**Architecture confirmed:** Next.js (Vercel) + Python API (separate host) + MongoDB Atlas  
**Rules:** See `.cursorrules` — MediaPipe math is source of truth; OpenAI enhances only.

---

## How to use this log

| Column | Meaning |
|--------|---------|
| **Status** | `done` · `in_progress` · `planned` · `blocked` |
| **Sprint** | Sprint number from plan below |
| **Milestone** | Proposal milestone (M1–M9) |

Update this file at the end of each work session or when a task is completed.

---

## Pre-sprint / MVP foundation (completed)

Work done before formal sprint plan (Vite POC → production-ready base).

| Date | Task | Status | Notes |
|------|------|--------|-------|
| — | Initial AuraScan POC (Vite + React) | done | Onboarding, questionnaire, photo upload, local CV |
| — | MediaPipe 478-landmark pipeline + cvReport | done | Symmetry, proportions, feature sections |
| — | Settings UI (Free CV / AWS / OpenAI providers) | done | Keys in localStorage |
| — | Report PDF export (jspdf) | done | Multi-page report with feature before/after |
| — | Anthropometrics + aesthetic projection engine | done | Measurement-based AFTER images |
| — | Averageness / Dimorphism / Proportions report UI | done | Qoves-inspired layout (in progress: dynamic wireframe) |
| — | Python FastAPI backend port | done | `backend/` mirrors JS analysis pipeline |
| Jul 2026 | Migrate Vite → **Next.js 15** App Router | done | Commit `ac8a93f` |
| Jul 2026 | Move `src/` → `app/`, `components/`, `utils/` | done | Client-only dynamic App |
| Jul 2026 | PostCSS ESM fix (`postcss.config.cjs`) | done | Fixes `module is not defined` build error |
| Jul 2026 | Vercel deploy config (`vercel.json` → Next.js) | done | Commit `73ded07`; dashboard: clear `dist` output dir |
| Jul 2026 | `.cursorrules` + sprint architecture plan | done | MongoDB, sprint breakdown approved |
| Jul 2026 | Git push to `main` for Vercel | done | `github.com/paresh-p-crest/FaceAnalysis` |

---

## Sprint roadmap (proposal alignment)

| Sprint | Focus | Milestone | Status |
|--------|--------|-----------|--------|
| **1** | MongoDB + API foundation, persist assessments | M1 | done |
| **2** | Auth + roles (user / admin) | M1 | done |
| **3** | Replit/local environment readiness, runbook, config cleanup | M2 | done |
| **4** | Report workflow UI polish (Draft to Published) | M1, M7 | done |
| **5** | Onboarding + multi-upload polish + DB history | M1 | done |
| **6** | OpenAI report enhancement (narrative only) | M3 | done |
| **7** | PDF export for approved/published reports | M3 | done |
| **8** | Stripe + PayPal + payments collection | M4 | done |
| **9** | Email, Meta Pixel, Google Tag Manager | M4 | done |
| **10** | AI visuals (hair, outfit, aging) | M5 | done |
| **11** | Beauty Assistant (ChatGPT, grounded on cvReport) | M6 | done |
| **12** | Admin panel (review, edit, publish) | M7 | done |
| **13** | Client dashboard (history, profile, payments) | M8 | done |
| **14** | E2E testing, optimization, final Replit deployment, handover | M2, M9 | done |

---

## Sprint 1 — MongoDB + API foundation (DONE — code ready)

**Goal:** Persist analysis data; reliable Next.js ↔ Python API.

### Tasks

| # | Task | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 1.1 | MongoDB Atlas cluster + connection string | done | | Atlas URI configured in `backend/.env` |
| 1.2 | Add `motor` / PyMongo + repository layer in FastAPI | done | | `backend/database.py`, `repositories/` |
| 1.3 | Collections: `users`, `assessments`, `analysis_results` | done | | Sprint 1 uses `assessments` only |
| 1.4 | `POST /api/assessments` — run analysis + save to DB | done | | `backend/routers/assessments.py` |
| 1.5 | `GET /api/assessments/:id` — retrieve full JSON | done | | |
| 1.6 | `NEXT_PUBLIC_API_URL` in Next.js + update API client | done | | `utils/apiClient.js` |
| 1.7 | `.env.example` for frontend + backend | done | | |
| 1.8 | Test: upload photo to cvReport in MongoDB | done | | API test saved assessment `6a4baf65290ccb544590ca2c` |

### Sprint 1 exit criteria

- [x] Health endpoint reports DB connected (when `MONGODB_URI` set)
- [x] One assessment saved and retrieved via API (Atlas test, `6a4baf65290ccb544590ca2c`)
- [x] Existing local MediaPipe analysis unchanged when API URL not set
- [x] MongoDB setup guide (`docs/MONGODB_SETUP.md`)

---

## Sprint 2 - Auth + roles (DONE)

**Goal:** Add secure user/admin identity foundation for report ownership and future admin review.

### Tasks

| # | Task | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 2.1 | Add password hashing + signed session tokens | done | | PBKDF2 + HMAC bearer token |
| 2.2 | Add `users` repository + MongoDB indexes | done | | Unique `users.email`, role index |
| 2.3 | Add auth API: register, login, me | done | | `backend/routers/auth.py` |
| 2.4 | Add role dependency: user/admin | done | | `get_current_user`, `require_admin` |
| 2.5 | Frontend auth client + session storage | done | | `utils/authClient.js` |
| 2.6 | Sign in / sign up UI entry point | done | | `components/AuthModal.jsx`, top nav user state |
| 2.7 | Tests: auth flow + role protection | done | | Register/login/me/admin guard verified |
| 2.8 | Bootstrap local admin account | done | | `ADMIN_EMAIL` / `ADMIN_PASSWORD` in backend env |
| 2.9 | Admin-only assessment list + status API | done | | Draft / pending_review / approved / published |

### Sprint 2 exit criteria

- [x] User can register and log in with email/password
- [x] Password is hashed; plaintext is never stored
- [x] Authenticated API can return current user
- [x] Role guard can distinguish `user` and `admin`
- [x] Frontend shows signed-in state and allows logout
- [x] Admin can list assessments and update report status via API

---

## Sprint 3 - Replit/local environment readiness (DONE)

**Goal:** Prepare the codebase and runbook for Replit while continuing feature development locally first.

### Tasks

| # | Task | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 3.1 | Add Replit setup/run guide | done | | `docs/REPLIT_SETUP.md` |
| 3.2 | Add/verify Replit config files only if needed | done | | `.replit`, `scripts/replit-start.sh` |
| 3.3 | Replace hardcoded CORS wildcard with env-based origins | done | | `CORS_ORIGINS`, `CORS_ORIGIN_REGEX` |
| 3.4 | Document env secrets for local and Replit | done | | `.env.example`, `docs/REPLIT_SETUP.md` |
| 3.5 | Local smoke/build test | done | | Backend health/admin/CORS, backend compile, frontend build |

### Sprint 3 exit criteria

- [x] Developer can run local frontend/backend from documented commands
- [x] Replit setup steps are documented clearly enough for handoff
- [x] Backend supports configured frontend origins
- [x] No final production deployment is required until Sprint 14

---

## Sprint 4 - Report workflow UI polish (DONE)

**Goal:** Make report status visible and actionable in the app while preserving the existing CV analysis/report flow.

### Tasks

| # | Task | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 4.1 | Sanity-check questionnaire/upload/analysis/report flow | done | | No CV math changes; integration flow reviewed |
| 4.2 | Show report status on report screen | done | | Draft / pending review / approved / published badge |
| 4.3 | Gate PDF download until approved or published | done | | Backend-saved reports only; local/offline fallback unchanged |
| 4.4 | Add cloud report list in History | done | | User sees own reports; admin sees review queue |
| 4.5 | Add user submit-for-review action | done | | User can move own draft to pending_review |
| 4.6 | Add admin status controls in UI | done | | Admin can set draft/pending_review/approved/published |
| 4.7 | Verify workflow and builds | done | | Backend transition test, compileall, npm build |

### Sprint 4 exit criteria

- [x] Report page displays current status
- [x] PDF download is blocked until approved/published for backend-saved reports
- [x] User can submit a draft report for review
- [x] Admin can list reports and update statuses from the app UI
- [x] Existing questionnaire/upload/analysis/report flow remains intact

---

## Sprint 5 - Onboarding + multi-upload polish + DB history (DONE)

**Goal:** Tighten the existing onboarding/upload/history flow and make MongoDB-backed report history usable from the UI.

### Tasks

| # | Task | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 5.1 | Sanity-check questionnaire/upload/analysis/report integration | done | | Existing flow reviewed; no CV math changes |
| 5.2 | Reduce empty optional photo payloads | done | | Backend submissions now omit empty photo slots |
| 5.3 | Add user cloud history view | done | | Signed-in users can list their MongoDB assessments |
| 5.4 | Add admin cloud history/review view support | done | | Admin review queue remains available in History |
| 5.5 | Allow cloud history item to open full report | done | | Uses stored `analysis.cvReport` and generated crop image |
| 5.6 | Verify DB history round trip | done | | User assessment saved/listed with `cvReport` and image data |

### Sprint 5 exit criteria

- [x] Existing questionnaire/upload/analysis flow remains intact
- [x] Optional empty photo slots are not sent to backend
- [x] Signed-in user can see MongoDB-backed report history
- [x] Admin can still see review queue
- [x] Cloud history report can open in the report screen
- [x] Backend compile, frontend build, and DB history smoke test pass

---

## Sprint 6 - OpenAI report enhancement (DONE)

**Goal:** Add OpenAI narrative enrichment while keeping MediaPipe/OpenCV as the only source of measurements.

### Tasks

| # | Task | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 6.1 | Add backend OpenAI narrative generator | done | | `generate_cv_narrative` returns structured JSON only |
| 6.2 | Ground prompts on stored `cvReport` and `metrics` | done | | Prompt forbids invented/changed measurements |
| 6.3 | Add secured assessment narrative endpoint | done | | `POST /api/assessments/:id/ai-narrative` |
| 6.4 | Persist AI narrative separately from raw analysis | done | | Saves `aiNarrative`; does not mutate `analysis.cvReport` |
| 6.5 | Display narrative in structured report summary | done | | OpenAI Narrative card in Executive Summary |
| 6.6 | Verify compile/build and no-key behavior | done | | Backend compile, frontend build, graceful missing-key response |

### Sprint 6 exit criteria

- [x] OpenAI text is stored separately from deterministic CV measurements
- [x] OpenAI prompt references stored `cvReport`/metrics only
- [x] UI labels narrative as CV-grounded OpenAI text
- [x] Existing report/history/admin workflows remain intact at build level
- [x] Backend compile and frontend production build pass
- [ ] Live OpenAI response blocked by OpenAI `insufficient_quota` after key was added locally

---

## Sprint 7 - PDF export for approved/published reports (DONE)

**Goal:** Provide secure PDF download for approved/published MongoDB reports while keeping local/offline PDF export available.

### Tasks

| # | Task | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 7.1 | Add backend PDF endpoint for saved assessments | done | | `GET /api/assessments/:id/pdf` |
| 7.2 | Enforce owner/admin access on PDF downloads | done | | Reuses assessment access rules |
| 7.3 | Enforce approved/published PDF status gate server-side | done | | Draft/pending reports return 403 |
| 7.4 | Generate PDF from stored `cvReport`, metrics, answers, and AI narrative | done | | Does not recalculate or mutate CV data |
| 7.5 | Wire frontend download button to backend PDF for DB reports | done | | Local/offline reports keep existing jsPDF export |
| 7.6 | Fix and verify backend ReportLab PDF helper | done | | Valid `%PDF` bytes generated |

### Sprint 7 exit criteria

- [x] Approved/published DB-backed reports can download through a backend endpoint
- [x] Draft/pending DB-backed reports remain blocked server-side
- [x] Users cannot download another user's report PDF unless admin
- [x] PDF content is built from stored deterministic report data
- [x] Local/offline PDF prototype remains available for non-DB reports
- [x] Backend compile, frontend build, PDF generation smoke test pass

---

## Sprint 8 - Stripe + PayPal + payments collection (DONE)

**Goal:** Add payment collection foundation for premium reports with Stripe Checkout, PayPal Orders, and MongoDB payment records.

### Tasks

| # | Task | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 8.1 | Add `payments` MongoDB repository and indexes | done | | Tracks provider, amount, status, refs, raw provider data |
| 8.2 | Add payment config endpoint | done | | Frontend can detect missing Stripe/PayPal keys |
| 8.3 | Add Stripe Checkout session endpoint | done | | Uses direct Stripe API via `httpx` |
| 8.4 | Add Stripe webhook endpoint | done | | Optional signature check via `STRIPE_WEBHOOK_SECRET` |
| 8.5 | Add PayPal order create/capture endpoints | done | | Uses PayPal Orders v2 via `httpx` |
| 8.6 | Add frontend Billing page and nav entry | done | | Stripe/PayPal buttons, provider status, payment history |
| 8.7 | Add payment env placeholders | done | | `.env.example` includes Stripe/PayPal vars |

### Sprint 8 exit criteria

- [x] Signed-in users can reach Billing from the app
- [x] Backend exposes Stripe Checkout and PayPal Orders endpoints
- [x] Payment attempts can be stored in MongoDB
- [x] Frontend handles missing provider credentials without breaking
- [x] Backend compile, frontend build, and payment config smoke test pass
- [ ] Live Stripe checkout test pending `STRIPE_SECRET_KEY`
- [ ] Live PayPal sandbox order test pending `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET`

---

## Sprint 9 - Email, Meta Pixel, Google Tag Manager (DONE)

**Goal:** Add notification and marketing-tracking foundations that stay disabled until service env values are configured.

### Tasks

| # | Task | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 9.1 | Add short service setup guide | done | | `docs/SERVICE_SETUP.md` covers Stripe, PayPal, SMTP, Meta Pixel, GTM |
| 9.2 | Add SMTP email helper | done | | `backend/email_service.py`, no startup failure when missing SMTP |
| 9.3 | Add admin notification config/test-email endpoints | done | | `/api/notifications/config`, `/api/notifications/test-email` |
| 9.4 | Add Meta Pixel script loader | done | | Env-gated by `NEXT_PUBLIC_META_PIXEL_ID` |
| 9.5 | Add Google Tag Manager script loader | done | | Env-gated by `NEXT_PUBLIC_GTM_ID` |
| 9.6 | Add frontend analytics event helper | done | | Tracks assessment start/complete and checkout start |
| 9.7 | Add env placeholders | done | | `.env.example` includes SMTP, Meta Pixel, GTM vars |

### Sprint 9 exit criteria

- [x] Email config can be checked without SMTP credentials
- [x] Admin-only test email endpoint exists
- [x] Meta Pixel and GTM load only when env IDs are present
- [x] Key user/payment funnel events push to analytics helpers
- [x] Backend compile and frontend build pass
- [ ] Live SMTP send pending SMTP credentials
- [ ] Meta Pixel live verification pending `NEXT_PUBLIC_META_PIXEL_ID`
- [ ] GTM live preview pending `NEXT_PUBLIC_GTM_ID`

---

## Sprint 10 - AI visuals: hair, outfit, aging (DONE)

**Goal:** Add a separate AI visual preview layer for hairstyle, outfit styling, and healthy-aging concepts without changing deterministic CV metrics.

### Tasks

| # | Task | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 10.1 | Add backend visual prompt/image generator | done | | `backend/visual_generation.py` |
| 10.2 | Add protected assessment visual endpoint | done | | `POST /api/assessments/:id/ai-visuals` |
| 10.3 | Persist visual variants separately from CV report | done | | Saves `aiVisuals`; does not mutate `analysis.cvReport` |
| 10.4 | Add frontend AI Visuals report tab | done | | Hair, outfit, healthy-aging cards |
| 10.5 | Add prompt-ready fallback when image credits are unavailable | done | | Local-safe; still gives reviewable prompts |
| 10.6 | Add image model env placeholder | done | | `OPENAI_IMAGE_MODEL=gpt-image-1` |

### Sprint 10 exit criteria

- [x] AI visuals are clearly separate from measured CV analysis
- [x] Hair, outfit, and healthy-aging variants are supported
- [x] Backend can save generated/prompt-ready visual variants to MongoDB
- [x] Frontend can display saved visual variants from cloud history
- [x] Backend compile, frontend build, and prompt-only smoke test pass
- [ ] Live OpenAI image generation pending OpenAI API quota/credits

---

## Sprint 11 - Beauty Assistant grounded on cvReport (DONE)

**Goal:** Add a report-grounded assistant that answers user questions from stored CV measurements and conversation history.

### Tasks

| # | Task | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 11.1 | Add conversation repository and indexes | done | | `conversations` collection, one thread per assessment/user |
| 11.2 | Add grounded assistant response service | done | | Uses stored `cvReport`, metrics, answers, recent chat |
| 11.3 | Add deterministic fallback response | done | | Works without OpenAI quota; does not invent metrics |
| 11.4 | Add protected assistant API endpoints | done | | `GET/POST /api/assessments/:id/assistant` |
| 11.5 | Add Beauty Assistant report tab | done | | Chat UI with starter prompts and source labels |
| 11.6 | Verify compile/build and fallback answer | done | | Backend compile, frontend build, template smoke test |

### Sprint 11 exit criteria

- [x] Assistant is available only for accessible backend-saved reports
- [x] Answers are grounded on stored `cvReport`/metrics
- [x] Conversation turns are stored in MongoDB
- [x] Assistant avoids new measurements, diagnosis, surgery/injectable recommendations
- [x] Backend compile, frontend build, and fallback smoke test pass
- [ ] Live OpenAI assistant response pending OpenAI API quota/credits

---

## Sprint 12 - Admin panel: review, edit, publish (DONE)

**Goal:** Give admins a real review workspace for client reports while keeping measured CV data immutable.

### Tasks

| # | Task | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 12.1 | Add admin-only review API | done | | `PATCH /api/assessments/:id/admin-review` |
| 12.2 | Store review metadata | done | | `adminNotes`, `reviewedBy`, `reviewedAt`, `reviewLog` |
| 12.3 | Allow narrative edits without changing raw CV report | done | | Updates `aiNarrative`; does not mutate `analysis.cvReport` |
| 12.4 | Add admin review UI | done | | Review panel inside cloud history/admin queue |
| 12.5 | Add approve/publish actions from review workspace | done | | Admin can save, approve, or publish |
| 12.6 | Verify compile/build | done | | Backend compile and frontend build |

### Sprint 12 exit criteria

- [x] Only admins can save review edits
- [x] Admin can update report status from the review workspace
- [x] Admin can edit client-facing narrative summary, strengths, focus areas, recommendations, and disclaimer
- [x] Review notes and reviewer metadata persist to MongoDB
- [x] Deterministic CV measurements remain unchanged
- [x] Backend compile and frontend build pass
- [ ] Live admin review save pending local browser/API testing with MongoDB running

---

## Sprint 13 - Client dashboard: history, profile, payments (DONE)

**Goal:** Give signed-in clients one workspace for account status, recent reports, review progress, and payments.

### Tasks

| # | Task | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 13.1 | Add dashboard app stage and top-nav entry | done | | User-only dashboard button in `TopNav` |
| 13.2 | Add profile/account summary | done | | Email and role from authenticated session |
| 13.3 | Add report summary cards | done | | Total cloud reports, latest score, review pipeline counts |
| 13.4 | Add recent report list | done | | Opens MongoDB-backed reports from dashboard |
| 13.5 | Add payment summary | done | | Recent payments and completed payment count |
| 13.6 | Add dashboard quick actions | done | | New analysis, refresh, history, billing |
| 13.7 | Verify compile/build | done | | Backend compile and frontend build |

### Sprint 13 exit criteria

- [x] Signed-in user can open a dashboard from the top navigation
- [x] Dashboard loads user's own reports from MongoDB
- [x] Dashboard loads user's own payment records
- [x] Dashboard links into report view, history, billing, and new analysis
- [x] Dashboard handles missing backend or signed-out state cleanly
- [x] Backend compile and frontend build pass
- [ ] Live dashboard browser walkthrough pending user local test

---

## Sprint 14 - E2E testing, optimization, Replit deployment, handover (DONE)

**Goal:** Package the finished sprint work for repeatable QA, Replit deployment, and client/dev handover.

### Tasks

| # | Task | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 14.1 | Add repeatable smoke test script | done | | `scripts/smoke_test.py` checks health, auth, history, payments, admin guard |
| 14.2 | Fix Replit/local port env clarity | done | | `.env.example` now uses `PORT=3000`, `BACKEND_PORT=8000` |
| 14.3 | Finalize Replit deployment runbook | done | | `docs/REPLIT_SETUP.md` updated for final deployment |
| 14.4 | Add handover checklist | done | | `docs/HANDOVER_CHECKLIST.md` |
| 14.5 | Run backend compile gate | done | | `.\venv\Scripts\python.exe -m compileall backend` |
| 14.6 | Run frontend production build | done | | `npm run build` |
| 14.7 | Run live local smoke test | done | | Health/auth/history/payments/admin guard passed |

### Sprint 14 exit criteria

- [x] Repeatable backend smoke test exists
- [x] Local compile/build checks pass
- [x] Backend health reports MongoDB connected in local smoke test
- [x] Admin login and protected route guard pass in smoke test
- [x] Replit deployment guide is final-useful
- [x] Handover checklist documents run, QA, deployment, and caveats
- [ ] Actual Replit deploy must be performed in user's Replit account
- [ ] Live OpenAI, Stripe, PayPal, SMTP, Meta Pixel, and GTM checks still require service credentials/credits

---

## Session log (append-only)

| Date | Who | Summary |
|------|-----|---------|
| Jul 2026 | Team | Architecture + 14-sprint plan approved. `.cursorrules` created. Priority: accuracy + fast delivery. |
| Jul 2026 | Team | Sprint 1 code: MongoDB layer, assessment API, frontend apiClient, MONGODB_SETUP.md |
| Jul 2026 | Team | Sprint 1 verified against MongoDB Atlas: health connected, assessment saved, `cvReport` retrieved. Sprint 2 started. |
| Jul 2026 | Team | Sprint 2 completed: auth endpoints, password hashing, bearer sessions, role guards, frontend sign-in UI. |
| Jul 2026 | Team | Proposal reviewed; added Sprint 2 admin bootstrap and backend report status workflow APIs for M1 alignment. |
| Jul 2026 | Team | Roadmap adjusted: Replit compatibility/runbook moved to Sprint 3; final deployment remains in Sprint 14 after core features. |
| Jul 2026 | Team | Sprint 3 completed: Replit runbook/config, env-based CORS, local smoke/build verification. |
| Jul 2026 | Team | Sprint 4 completed: report status badges, PDF gating, user submit-for-review, admin review queue/status controls. |
| Jul 2026 | Team | Sprint 5 completed: cloud DB history viewing, report opening from MongoDB history, optional photo payload cleanup. |
| Jul 2026 | Team | Sprint 6 completed: OpenAI narrative endpoint, MongoDB `aiNarrative` persistence, Executive Summary narrative card. |
| Jul 2026 | Team | OpenAI key loads from `backend/.env`; live request reaches OpenAI but returns `insufficient_quota`. |
| Jul 2026 | Team | Sprint 7 completed: secured approved/published backend PDF endpoint and frontend DB-report download path. |
| Jul 2026 | Team | Sprint 8 completed: payments repository, Stripe Checkout/webhook, PayPal Orders/capture, Billing UI. |
| Jul 2026 | Team | Sprint 9 completed: SMTP notification foundation, Meta Pixel/GTM env-gated loaders, analytics events, service setup guide. |
| Jul 2026 | Team | Sprint 10 completed: AI Visuals tab, prompt/image generator, MongoDB `aiVisuals` persistence. |
| Jul 2026 | Team | Sprint 11 completed: Beauty Assistant chat, conversation persistence, cvReport-grounded fallback responses. |
| Jul 2026 | Team | Sprint 12 completed: admin review workspace, narrative edit/publish flow, review audit metadata. |
| Jul 2026 | Team | Sprint 13 completed: client dashboard with profile, report history summary, review status, and payment summary. |
| Jul 2026 | Team | Sprint 14 completed: smoke test script, final Replit runbook, handover checklist, compile/build/local smoke verification. |

---

## Blockers & decisions

| Date | Item | Resolution |
|------|------|------------|
| Jul 2026 | Vercel looked for `dist` (old Vite) | `vercel.json` + dashboard: Framework = Next.js, Output Directory empty |
| Jul 2026 | Client requested Replit | Prepare Replit compatibility early (Sprint 3), but final deployment/handover stays near the end (Sprint 14). |
| Jul 2026 | DB choice | **MongoDB** for unstructured MediaPipe + cvReport JSON |
| Jul 2026 | OpenAI live test | Key is configured, but OpenAI API project/account returned `insufficient_quota`; enable billing/add credits before live AI narrative testing. |
| Jul 2026 | Payment live tests | Stripe/PayPal code is build-ready; live checkout/order tests require provider sandbox credentials in `backend/.env`. |
| Jul 2026 | Email/tracking live tests | SMTP, Meta Pixel, and GTM are build-ready; live verification requires service IDs/SMTP credentials. |
| Jul 2026 | OpenAI image live test | AI visuals are build-ready; live image generation requires OpenAI quota/credits. |
| Jul 2026 | Beauty Assistant live test | Assistant is build-ready with deterministic fallback; live OpenAI chat requires OpenAI quota/credits. |

---

## Quick status (for stakeholders)

**Last updated:** July 2026  

**Completed:** MVP facial analysis engine, Next.js frontend, Python backend scaffold, report UI, PDF prototype, Vercel frontend deploy, Sprint 1 MongoDB persistence, Sprint 2 auth + roles, Sprint 3 Replit/local readiness, Sprint 4 report workflow UI, Sprint 5 DB history, Sprint 6 OpenAI narrative enhancement, Sprint 7 approved/published PDF export, Sprint 8 payment foundation, Sprint 9 email/tracking foundation, Sprint 10 AI visuals foundation, Sprint 11 Beauty Assistant, Sprint 12 admin review workspace, Sprint 13 client dashboard, Sprint 14 QA/deployment/handover package.  

**In progress:** Feature sprints complete; ready for user browser QA and Replit account deployment.

**Next:** User browser QA, Replit import, production secrets, and live third-party service verification.
