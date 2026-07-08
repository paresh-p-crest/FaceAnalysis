# Industry Practices & Guidelines

This document outlines the coding standards, design practices, and operational boundaries followed in this repository.

---

## 1. Code Style Conventions

### Python (FastAPI / Backend)
- **Styling Guide:** Follow PEP-8 style guide.
- **Naming Conventions:**
  - Variables & Functions: `snake_case` (e.g. `get_current_user`, `assessment_id`)
  - Classes: `PascalCase` (e.g. `RunAnalysisRequest`, `BaseModel`)
  - Constants: `UPPER_CASE` (e.g. `SETTINGS_ID`, `DEFAULT_PREMIUM_AMOUNT_CENTS`)
- **Modules & Imports:** Group imports in three sections: standard library, third-party libraries, local app modules. Use absolute imports or explicit relative imports starting with `.`.
- **Async/Await:** All database operations (Motor), network requests (Httpx), and database triggers should be async. Heavy CPU-bound compute tasks (e.g. OpenCV, MediaPipe mesh processing) should be run in a background thread pool using `asyncio.to_thread`.

### JavaScript / React (Next.js / Frontend)
- **Styling Guide:** Standard ES6/React formatting.
- **Naming Conventions:**
  - Variables & Helper Functions: `camelCase` (e.g. `apiClient`, `authToken`)
  - Components: `PascalCase` (e.g. `AuthModal`, `ReportLayout`)
  - Styles: Tailwind CSS utility classes. Match branding colors (brand teal as primary accent).
- **Client Directives:** Use `'use client'` at the top of the file only for components utilizing state, context, or browser APIs (like `localStorage`).

---

## 2. File and Function Size Limits
To prevent bloated, unmaintainable source files:
- **Max Lines per File:** Proposed limit of **400-500 lines** maximum. If a file exceeds this range, it must be refactored into smaller sub-modules or utility components.
- **Max Lines per Function:** Proposed limit of **50-100 lines** maximum. Extract logical sub-steps into clean, separate functions.

---

## 3. Git Workflow Guidelines

### Branch Naming
Follow clean, descriptive branch naming conventions:
- Feature Branch: `feature/sprint-<N>-<short-description>`
- Bugfix Branch: `bugfix/<issue-description>`
- Release Branch: `release/v<version-number>`

### Commit Message Format
Commit messages should follow standard prefixes:
- `feat: <description>` (new feature additions)
- `fix: <description>` (bugfixes)
- `docs: <description>` (documentation updates)
- `refactor: <description>` (non-functional code cleanups)
- `test: <description>` (adding or modifying tests)

### Pull Request Checklist
```markdown
- [ ] Code complies with file limit (400-500 lines) and function limit (50-100 lines).
- [ ] Unit tests/smoke tests run and pass locally.
- [ ] No API keys, passwords, or configuration secrets are hardcoded or checked into git.
- [ ] Associated documentation has been updated per the Maintenance policy in AGENTS.md.
```

---

## 4. Security Baseline
- **Secrets Management:** Secrets must reside strictly inside `.env` configurations. Never check in `.env`, `venv/`, or `.next/` directories. Use `.env.example` to document placeholders.
- **Role Protections:** Protect admin routes using role-based FastAPI dependencies (`require_admin`) and ensure JWT signed session tokens are properly validated server-side.
- **Database Safety:** Avoid raw MongoDB injections; utilize the motor repository layer to build structured query filters.
