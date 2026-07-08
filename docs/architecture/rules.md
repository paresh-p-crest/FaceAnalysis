# Architectural Rules & Constraints

This document lists the hard, "always true" constraints that must be observed during the development and maintenance of the AuraScan platform.

## Core CV & AI Separation (Critical)
1. **MediaPipe is the Source of Truth:** Google MediaPipe Face Mesh (478 landmarks) + OpenCV produce all facial measurements, scores, coordinates, and ratios.
2. **OpenAI Boundaries:** OpenAI model calls (e.g. GPT-4o-mini) MUST NOT replace, override, estimate, or invent numerical facial metrics. OpenAI is used *only* for:
   - Narrative summaries and report text explanations.
   - Smart templates, protocol recommendations, and advice.
   - Interactive Beauty Assistant chat responses.
   - Generative visual preview prompts (hairstyles, outfits, aging).
3. **Data Dependency:** You must calculate and store the deterministic `cvReport` and landmarks in MongoDB *before* performing any OpenAI narrative enrichment. All AI narrative text must reference the stored metrics and never hallucinate raw measurements.
4. **Immutability of Measurements:** Keep raw landmark and metric data (`analysis.cvReport`) immutable during AI or administrative reviews. Reviewers/admins can only edit narrative, recommendations, and status flags.

## Layout & Stack Responsibilities
1. **Frontend (Next.js 15 App Router):** Handles user interface rendering, user dashboard, routing, local browser settings, cookie-based sessions, client-side questionnaire flows, and basic billing states. No CV math logic or OpenAI credentialed prompts should be duplicated or run client-side.
2. **Backend (Python FastAPI):** Handles heavy compute tasks, image parsing, MediaPipe landmark evaluation, `cvReport` building, ReportLab PDF compilation, payment gateway webhooks, email triggers, and credentialed OpenAI vision/generation requests.
3. **Database (MongoDB Atlas):** Primary transactional store for users, assessments, analysis logs, payment receipts, and chat logs.

## Security & Secrets
1. **No Committed Keys:** Never commit API keys, webhook secrets, passwords, or `.env` files.
2. **Environment Variables:** All secrets (Stripe, PayPal, SMTP, OpenAI, MongoDB credentials) must live exclusively in environment variables loaded dynamically via `python-dotenv` (backend) or Next.js environment mechanisms.

## Report Workflow Gates
1. **Access Restrictions:** Assessment PDFs can only be generated and downloaded when the report status is `approved` or `published`.
2. **Review Pipeline:** Assessments begin as `draft`, transition to `pending_review` via client submission, and are then set to `approved` and/or `published` by administrators.
3. **Audit Trail:** Admin reviews must append audit metadata (reviewer email, timestamp, status transition, edit indicators) to the document's review log.

## Environment & Deployment Lifecycle
1. **Local-First Development:** Developers should always write, run, and test code locally using local configurations and virtual environments.
2. **Deployment Ready:** Replit deployment compatibility remains supported as a deployment target, but live deployments should be run only at key release checkpoints.
