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

## 5. Design & Theming

> **Before writing any new component or modifying UI**, read [`docs/design/theme.md`](../design/theme.md). It is the single source of truth for all visual decisions.

Key rules enforced:
- **Brand color:** Always use `#5e9f8b` (Tailwind: `bg-brand`, `text-brand`, `border-brand`) and `#548f7d` for hover states. Never use arbitrary teal/green shades (`teal-400`, `green-500`, `#0d9488`, etc.).
- **Tokens first:** Use `bg-surface`, `bg-surface-card`, `text-ink`, `text-ink-muted`, and `border-surface-border` for all surface and text colors. Never hardcode hex values for these.
- **Buttons:** Use `.btn-primary` and `.btn-ghost` component classes from `globals.css`. All buttons are pill-shaped (`rounded-[50px]`).
- **Typography:** Body = `font-sans` (Inter). Headings/logo = `font-serif` or `font-display` (Sora). No other fonts.
- **Dark mode mandatory:** Every component must include `dark:` variants for background and text colors.
- **Animations:** Use only `animate-*` tokens defined in `tailwind.config.js`. Add new ones there — never inline `@keyframes`.
- **Border-radius:** Follow the approved set only (`rounded-xl`, `rounded-2xl`, `rounded-3xl`, `rounded-[50px]`, `rounded-full`).

---

## 4. Security Baseline
- **Secrets Management:** Secrets must reside strictly inside `.env` configurations. Never check in `.env`, `venv/`, or `.next/` directories. Use `.env.example` to document placeholders.
- **Role Protections:** Protect admin routes using role-based FastAPI dependencies (`require_admin`) and ensure JWT signed session tokens are properly validated server-side.
- **Database Safety:** Avoid raw MongoDB injections; utilize the motor repository layer to build structured query filters.

---

## 6. Clinical BEFORE/AFTER comparison (protocol / PDF)

Aligned with aesthetic photography standards (PRS GO photographic documentation; ASPS framing guides; Aesthetics Journal B&A guidelines):

- **Same format always** — pair tiles must share aspect / canvas orientation. Divergent projected AFTER AR or resolution is normalized **AFTER-only** via face-centered cover-fit onto the front BEFORE canvas before feature crops (`coverFitAfterToBeforeCanvas`). BEFORE and disk `projected/full` are never rewritten for this.
- **Equal image section** — feature crops use the same `getFeatureBox` keys on both sides; absolute `FEATURE_MIN_PX` is scaled by AFTER/BEFORE short side so smaller gens do not over-expand.
- **Post-capture framing adjust is OK** — matching section need not be locked only at generation time; software fit to a reference frame is accepted industry practice.
- **No presentation bias** — do not give AFTER a more flattering zoom than BEFORE (avoid unscaled absolute minPx on a smaller AFTER canvas; avoid stored `eyesCrop` for protocol eyes pairs).
- **Similarity warp** (`alignAfterToBefore`) is reserved for overview full-face and the skin half-split registration, not routine feature tiles.
- **Skin side-by-side pair = cheek-only texture patch** — the Skin Recommendations *side-by-side* pair frames one cheek (image-left / subject's right) **below the lower eyelid and above the upper lip**, inset from the ear/jaw silhouette and stopped before the nasal ala: no eye, no lips, no nose — just cheek skin texture (tight `getFeatureBox('skin')` live crop, both sides; `FEATURE_MIN_PX.skin` kept low so the box is not re-inflated). The PDF **half-split panel is unchanged**: it keeps the wide cheek crop (`imageSlots.before` = stored `cvReport.cheeks`) with the full AFTER warped onto it via `alignAfterToBefore`.

### Hair / Norwood staging
- Stages **1–3** follow Hamilton–Norwood **hairline/temple shape** (bilateral temple triangles vs mid-frontal line), not scalp coverage %. `densityPct` may escalate only from stage 3→4+.
- Geometric depth fractions (currently 0.03 / 0.07 / 0.13) require calibration via `scripts/calibrate_norwood_temples.py` on labeled top-of-head photos before production trust on the 1/2/3 boundary.
- Client prose must not leak internal metric keys (`templeRecession`, `jawWidthClass`, …); report human-readable language only.
- Type A variants and ethnicity-adjusted hairline norms are out of scope for the current geometric path.

---

## 7. AI report narrative generation (Qoves-style)

Applies to per-feature narratives, closing synthesis, and protocol overview (`backend/narrative_orchestrator.py`, `recommendation_rules.py`, `feature_context.py`, `clinical_guardrails.py`; ADR-032, ADR-033). See the hard constraints in [`rules.md`](architecture/rules.md#report-narrative--text-generation-hard-rules).

- **Convert to qualitative before the prompt, don't rely on instructions.** Any numeric CV value that would otherwise reach the model must be bucketed/scrubbed at assembly time (`magnitude_label`, `_drop_numeric_leaves`). Prompt instructions are a backstop, not the primary control.
- **Gate content by severity; anchor the null path on content, not length.** Match Qoves: strong features conclude "no changes recommended" but still *describe the measured geometry* (attribute → why it's in range → conclusion); weak features get the full targeted protocol. A length-only cap ("2-3 sentences") invites generic filler ("balanced/harmonious") — instead require the model to cite concrete cues. Severity is computed once per feature (`feature_severity_bucket`).
- **Use per-feature few-shot for precise formatting.** Few-shot beats instruction-only for structured output; keep one exemplar *per feature* (`NULL_PATH_FEATURE_GUIDE`) so vocabulary stays feature-specific (nose=dorsum/alar, ears=helix/lobule) rather than biasing every section toward one feature's language. Inject it into the per-feature user message, not the shared system prompt.
- **Validate grounding, then regenerate; keep the best LLM copy over a template.** A null-path section that cites zero concrete cue terms (`null_path_grounded`) is regenerated on an *independent* retry budget so one failure type can't starve another; on exhaustion keep the last LLM copy rather than reintroducing the generic template you were trying to avoid. Exempt cue-sparse features (`has_usable_measured_cues` is false, e.g. smile with no smile photo) so they're never force-rejected. Curate grounding terms toward distinctive anatomical nouns; exclude generic dimension adjectives and common prose words that collide with ordinary language. Tune the stopword list against a real key dump before trusting it.
- **Deduplicate deterministically under parallel generation.** Feature sections generate concurrently, so cross-section runtime checks are not possible — instead confine shared advice (SPF/hydration/sleep) to a single owning section (Skin) and instruct the others not to repeat it.
- **Pair guardrail instructions with a soft, logged validator.** New prose constraints (directional consistency, sclera framing) get a low-cost co-occurrence/regex check in `validate_feature_narrative` that logs a soft warning and retains the LLM copy — surfaces regressions without churning good reports. Escalate to hard-reject only when a check is proven reliable.
- **Enforce vocabulary bans in code, both sides of generation.** Enumerate banned terms in the prompt AND in `BANNED_TERM_PATTERN`. Scope regexes tightly to avoid false-positives (e.g. `chemical peel`, never bare `peel`). Hard rejects must have a defined recovery: retry with a corrective hint, then a deterministic per-section template — never a failed report.
