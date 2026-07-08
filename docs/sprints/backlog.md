<!-- Migrated from docs/SPRINT_LOG.md and docs/AURASCAN_RESEARCH.md -->
# Milestone Backlog (Milestones 2 & 3)

This document tracks planned task details for the subsequent milestones in the project contract.

---

## Milestone 2: Report, PDF, Payment & User Dashboard
**Goal:** Deliver payment gateway gating, a client dashboard, branded PDFs, and SMTP notification flows.

### Scope & Tasks
- [ ] **Finalize Report UI Layout:** Refine report card rendering, overlays, and charts in `components/Report.jsx`.
- [ ] **Build Branded PDF compiler:** Polish server-side ReportLab PDF formatting (cover page, disclaimer, custom tables) in `backend/report_pdf.py`.
- [ ] **Stripe Checkout Integration:** Connect Stripe APIs in `backend/routers/payments.py` to support redirects to the secure checkout page.
- [ ] **Locking Gate Workflow:** Restrict detailed analysis blocks, narratives, assistant modules, and PDF downloads until database report status flips to paid.
- [ ] **Implement User Dashboard:** Build the user profile page showing historical logs, report categories, status badges, and transaction summaries in `components/DashboardPage.jsx`.
- [ ] **Email Integration:** Build SMTP support to email confirmation codes on upload and copies of reports when published in `backend/email_service.py`.

---

## Milestone 3: Advanced AI Features, Admin Panel & Final Integrations
**Goal:** Deliver advanced AI visual variants, AI grounded chat assistant, admin review workspace, PayPal payments, tracking scripts, and final Replit deployment.

### Scope & Tasks
- [ ] **AI Hairstyle Generation:** Prompt engineering and DALL-E image generation interface to display 5 hairstyle recommendations in `backend/visual_generation.py`.
- [ ] **AI Outfit Styling:** Image generation pipelines displaying 5 custom clothing suggestions in `backend/visual_generation.py`.
- [ ] **AI Age Projection:** Generate 3 progressive age progression images (Now, +10 Years, +20 Years) in `backend/visual_generation.py`.
- [ ] **Grounded chat assistant:** Connect conversation threads grounded on assessment measurements inside `backend/routers/assistant.py`.
- [ ] **Admin Review Panel:** Connect status modifications (`draft` → `pending_review` → `approved` → `published`) and AI narrative edits in `components/AdminReviewPanel.jsx`.
- [ ] **PayPal Integration:** Implement PayPal REST APIs (Order Creation & Capture) inside `backend/routers/payments.py`.
- [ ] **Tracking Scripts:** Inject Google Tag Manager and Meta Pixel tracking libraries in `components/AnalyticsScripts.jsx`.
- [ ] **Replit Deployment Handoff:** QA checks, smoke test suite execution, port optimizations, and Replit handover guide finalization.
