<!-- Migrated from docs/SPRINT_LOG.md and legacy product research -->
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
- [x] **AI Hairstyle Generation:** Curated 5-style hair bank per CV face shape (Oval/Round/Square/Heart/Oblong) in `backend/visual_generation.py`.
- [x] **AI Outfit Styling:** 5 curated outfit/register occasions in `backend/visual_generation.py`.
- [x] **AI Age Projection:** 3 aging tiers (+3, +5, +10 years) in `backend/visual_generation.py`.
- [ ] **Grounded chat assistant:** Connect conversation threads grounded on assessment measurements inside `backend/routers/assistant.py`.
- [ ] **Admin Review Panel:** Connect status modifications (`draft` → `pending_review` → `approved` → `published`) and AI narrative edits in `components/AdminReviewPanel.jsx`.
- [ ] **PayPal Integration:** Implement PayPal REST APIs (Order Creation & Capture) inside `backend/routers/payments.py`.
- [ ] **Tracking Scripts:** Inject Google Tag Manager and Meta Pixel tracking libraries in `components/AnalyticsScripts.jsx`.
- [ ] **Replit Deployment Handoff:** QA checks, smoke test suite execution, port optimizations, and Replit handover guide finalization.
