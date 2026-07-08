# AuraScan — AI Facial Analysis

## Purpose
AuraScan is a documentation-first, AI-powered facial analysis platform that processes uploaded images via a MediaPipe-grounded CV math engine and enriches it with OpenAI GPT narrative reports. It allows gated access via Stripe/PayPal payments, custom admin review workflows, and a report-grounded Beauty Assistant.

## Repository Map
- [backend/](file:///c:/Users/JayRabari/Documents/FacialAnalysis/backend): Python FastAPI code for computer vision analysis, PDF generation, OpenAI interface, database repositories, and payments.
- [app/](file:///c:/Users/JayRabari/Documents/FacialAnalysis/app): Next.js 15 App Router views, routing endpoints, page layouts, and client logic.
- [components/](file:///c:/Users/JayRabari/Documents/FacialAnalysis/components): Shareable React components (Billing, User Dashboard, AuthModal, Report view).
- [utils/](file:///c:/Users/JayRabari/Documents/FacialAnalysis/utils): Front-end helper clients (e.g. [apiClient.js](file:///c:/Users/JayRabari/Documents/FacialAnalysis/utils/apiClient.js), [authClient.js](file:///c:/Users/JayRabari/Documents/FacialAnalysis/utils/authClient.js)).
- [docs/](file:///c:/Users/JayRabari/Documents/FacialAnalysis/docs): Systematic documentation, including architecture plans, contracts, decisions, constraints, SOP, and sprint logs.
- [scripts/](file:///c:/Users/JayRabari/Documents/FacialAnalysis/scripts): Startup scripts ([replit-start.sh](file:///c:/Users/JayRabari/Documents/FacialAnalysis/scripts/replit-start.sh)) and API smoke test suite ([smoke_test.py](file:///c:/Users/JayRabari/Documents/FacialAnalysis/scripts/smoke_test.py)).

For full database schemas and collection definitions, see [Domain Models](file:///c:/Users/JayRabari/Documents/FacialAnalysis/docs/architecture/domain-models.md).

## Operational Commands
### Frontend (NodeJS / npm)
- Run Dev: `npm run dev`
- Build App: `npm run build`
- Start App: `npm run start`
- Lint: `npm run lint`

### Backend (Python / pip / venv)
- Run Dev: `uvicorn backend.main:app --reload --port 8000`
- Compile Check: `python -m compileall backend`
- Run Smoke Tests: `python scripts/smoke_test.py`

## Quick Links
- [Industry Practices & Guidelines](file:///c:/Users/JayRabari/Documents/FacialAnalysis/docs/industry-practices.md)
- [Architecture Hard Constraints](file:///c:/Users/JayRabari/Documents/FacialAnalysis/docs/architecture/rules.md)
- [Architectural Decision Records (ADR)](file:///c:/Users/JayRabari/Documents/FacialAnalysis/docs/architecture/decisions.md)
- [Product Requirements](file:///c:/Users/JayRabari/Documents/FacialAnalysis/docs/requirements.md)
- [Active Sprint Backlog](file:///c:/Users/JayRabari/Documents/FacialAnalysis/docs/sprints/current/sprint.md)

## Maintenance (MUST)
After any change, update the md file(s) it touches. Do NOT finish a task without updating the relevant doc — a missing doc update means the task is incomplete.
- New/changed endpoint → docs/architecture/api-contracts.md or api-mocked.md
- New architectural choice → docs/architecture/decisions.md (new numbered ADR entry, dated, immutable once written)
- New hard constraint discovered → docs/architecture/rules.md
- Schema/table change → docs/architecture/domain-models.md
- Any change at all, however small → CHANGELOG.md (Added/Changed/Fixed/Removed, dated, Keep-a-Changelog format)
- Sprint task done/blocked/added → docs/sprints/current/sprint.md
- New/changed coding convention → docs/industry-practices.md
