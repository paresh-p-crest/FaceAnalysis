# Architectural Rules & Constraints

This document lists the hard, "always true" constraints that must be observed during the development and maintenance of the MyFace platform.

## Core CV & AI Separation (Critical)
1. **MediaPipe is the Source of Truth:** Google MediaPipe Face Mesh (478 landmarks) + OpenCV produce all facial measurements, scores, coordinates, and ratios.
2. **OpenAI Boundaries:** OpenAI model calls (e.g. GPT-4o-mini) MUST NOT replace, override, estimate, or invent numerical facial metrics. OpenAI is used *only* for:
   - Narrative summaries and report text explanations.
   - Smart templates, protocol recommendations, and advice.
   - Interactive Beauty Assistant chat responses.
   - Generative visual preview prompts (hairstyles, outfits, aging).
3. **Data Dependency:** You must calculate and store the deterministic `cvReport` and landmarks in the database *before* performing any OpenAI narrative enrichment. All AI narrative text must reference the stored metrics and never hallucinate raw measurements.
4. **Immutability of Measurements:** Keep raw landmark and metric data (`analysis.cvReport`) immutable during AI or administrative reviews. Reviewers/admins can only edit narrative, recommendations, and status flags.

## Layout & Stack Responsibilities
1. **Frontend (Next.js 15 App Router):** Handles user interface rendering, user dashboard, routing, local browser settings, cookie-based sessions, client-side questionnaire flows, and basic billing states. No CV math logic or credentialed LLM calls run client-side — all text AI goes through `backend/text_ai_service.py`.
2. **Backend (Python FastAPI):** Handles heavy compute tasks, image parsing, MediaPipe landmark evaluation, `cvReport` building, ReportLab PDF compilation, payment gateway webhooks, email triggers, and credentialed OpenAI vision/generation requests.
3. **Database (PostgreSQL):** Primary transactional store for users, assessments (JSONB nested analysis), payment receipts, and chat logs.

## Security & Secrets
1. **No Committed Keys:** Never commit API keys, webhook secrets, passwords, or `.env` files.
2. **Environment Variables:** All secrets (Stripe, PayPal, SMTP, OpenAI, `DATABASE_URL`) must live exclusively in environment variables loaded dynamically via `python-dotenv` (backend) or Next.js environment mechanisms.

## Report Workflow Gates
1. **Access Restrictions:** Assessment PDFs can only be generated and downloaded when the report status is `approved` or `published`.
2. **Review Pipeline:** Assessments begin as `draft`, transition to `pending_review` via client submission, and are then set to `approved` and/or `published` by administrators.
3. **Audit Trail:** Admin reviews must append audit metadata (reviewer email, timestamp, status transition, edit indicators) to the document's review log.

## Environment & Deployment Lifecycle
1. **Local-First Development:** Developers should always write, run, and test code locally using local configurations and virtual environments.
2. **Deployment Ready:** Replit deployment compatibility remains supported as a deployment target, but live deployments should be run only at key release checkpoints.

## Media Storage (Hard Rules)
1. **One interface only.** All media reads/writes (poses, parsing crops, projected AFTER, protocol JSON) MUST go through `backend/media_storage.py` `get_media_storage()`. Never read/write assessment media via raw filesystem paths or a Next `public/` dir. Keys are `assessments/{id}/...`.
2. **Serve via `/api/media`.** Media is served only by `GET /api/media/{key}` and stored `publicUrl` values MUST be `/api/media/...` (same-origin, so client-side canvas pixel reads stay CORS-clean). Do not reintroduce `/uploads/...` static serving.
3. **One backend per environment, no runtime fallback.** `MEDIA_STORAGE_BACKEND` selects `local` or `replit`; a misconfigured `replit` backend MUST raise, not silently fall back to disk. Local dev uses the filesystem backend (`var/media`, gitignored); Replit uses Object Storage.
4. **Per-pose photo writes MUST be atomic.** Pose uploads happen in parallel (ADR-031 progressive flow), so writing the `photos` JSONB map MUST merge a single pose under a row lock (`upsert_assessment_photo` / `remove_assessment_photo`, `SELECT ... FOR UPDATE`). Never replace the whole `photos` map from a request-start snapshot — that read-modify-write loses concurrent uploads (poses vanish, Submit reports them missing).

## UI & Styling Constraints (Hard Rules)

All frontend component work is governed by the design system in [`docs/design/theme.md`](../design/theme.md). The following are non-negotiable:

1. **Brand color is `#5e9f8b` only.** Tailwind classes: `bg-brand`, `text-brand`, `border-brand`. Hover state: `#548f7d` (`bg-brand-dark`). No other teal/green shade may be used for branding.
2. **Use design tokens — never hardcode surface or text hex values.** Surface colors use `bg-surface`, `bg-surface-card`, `bg-surface-warm`, `bg-surface-raised`. Text colors use `text-ink`, `text-ink-secondary`, `text-ink-muted`, `text-ink-faint`.
3. **Dark mode is mandatory.** Every component using a color must include a `dark:` variant. A component that only works in light mode is incomplete.
4. **Fonts are Inter and Helvetica only** (`Inter, Helvetica` for app UI; `Helvetica` for protocol PDF). No other fonts may be imported or applied.
5. **All buttons are pill-shaped** (`rounded-[50px]`) and must use `.btn-primary` or `.btn-ghost` from `globals.css` where possible.
6. **Border-radius must match the approved set** — `rounded-xl`, `rounded-2xl`, `rounded-3xl`, `rounded-[50px]`, `rounded-full`. No arbitrary pixel values.
7. **Animation keyframes belong in `tailwind.config.js`** and are referenced via `animate-*` classes. Inline `@keyframes` blocks are forbidden in component files.
8. **Split-screen pages use `lg:w-[380px]`** for the left panel. Do not invent new widths for the left panel without updating this rule.

## Report Narrative / Text Generation (Hard Rules)

Governs all report/protocol prose generated in `backend/narrative_orchestrator.py` and its helpers (ADR-032, ADR-033, ADR-021, ADR-017).

1. **No raw numeric deviation values in generation prompts.** Deviation magnitudes, ratios, degrees, and CV floats MUST be converted to qualitative buckets/labels **before** prompt assembly. Never inject a raw float (e.g. `{mag:.2f}`) into hints, and always scrub numeric leaves from any CV cue dump (`_drop_numeric_leaves`). Narrative prose stays qualitative (see also the numeric ban in report prose, ADR-021).
2. **Severity gates recommendation content.** Content is conditional on the feature's severity bucket (`minimal | mild | moderate | notable`). At `minimal` severity every feature **except Skin** uses the **content-anchored null path** (ADR-033): describe the specific measured geometry (attribute → why it sits in range → "no non-surgical changes recommended"), not a length-only "2-3 sentences" cap and not a forced protocol. Skin retains a baseline routine.
3. **Null-path sections must be grounded.** A null-path narrative MUST reference at least one concrete CV cue term for that feature; `null_path_grounded` regenerates ungrounded boilerplate (independent `NULL_PATH_GROUNDING_MAX_RETRIES` budget) and keeps the last LLM copy over the generic template if the budget is spent. Generic phrases ("balanced", "harmonious", "no deviations") may not appear unpaired to a specific measured attribute. Features with no usable measured cues (`has_usable_measured_cues` is false) are exempt (never force-rejected).
4. **Foundational care is Skin-confined.** SPF/hydration/sleep guidance belongs only to the Skin section; other feature sections MUST NOT restate it unless it is that feature's specific measured concern.
5. **Directional consistency.** A measured classification/direction is stated once and kept consistent within a section (e.g. a "wide" dimension is never also called narrow or told to narrow).
6. **Sclera is a visual observation only.** Sclera coloring is described as a single neutral visual/lighting observation — never attributed to oxidative stress, vitamin deficiency, or any medical cause — and is not repeated outside the eyes section.
7. **Non-invasive vocabulary is enforced, not assumed.** Invasive/energy-based treatments (surgery, injectables, fillers, Botox, laser, IPL, HIFU, Thermage, Endolift, microneedling, chemical peels, radiofrequency, Ultherapy, energy-based devices, prescriptions) are banned in report prose. Enforcement is both prompt-level (`STRICT_NON_SURGICAL_RULES`) and post-generation (`BANNED_TERM_PATTERN` → hard reject → retry → per-section template fallback; the report never fails).

## Projected AFTER Image (Hard Rules)

Governs the generative full-face AFTER edit in `backend/projected_after_ai.py` (ADR-034).

1. **Fixed prompt only.** The image-edit provider receives `PROJECTED_AFTER_PROMPT` — one constant string. No CV weakness ranking, no per-feature guidance injection, no Client/Context appendix.
2. **Identity lock.** Prompt must preserve same face shape, nose, lips, eyes, jawline, ears, and proportions; result is best-groomed same person, not a different face.
3. **Pores required.** Prompt must instruct visible pores and natural texture — no airbrushed or plastic skin finish.
4. **Manual preview scripts only.** `scripts/preview_*` helpers (e.g. `preview_projected_after_prompt.py`) are for human developers only. AI agents, pipeline workers, smoke tests, and CI MUST NOT execute them during implementation or verification.

## AI Visuals Image Edits (Hard Rules)

Governs on-demand hair / outfit / aging previews in `backend/visual_generation.py` (ADR-035).

1. **Natural prose, no label lists.** Prompts use a shared natural-language opening (`SHARED_VISUAL_OPENING`) and variant paragraphs — no trailing `Client:` / `Context:` semicolon appendices.
2. **Scope-fence first.** Each variant states “change only X — leave Y exactly as is” (or aging’s multi-axis healthy-aging preview with bone-structure lock) before creative instruction. One variant per `generate_image_edit` call; no mega-prompt combining hair/outfit/aging.
3. **Inline CV phrases with grammatical fallbacks.** Weave face shape / hairline / skin color (`skin.skinTone`) / hair color+texture via `_cv_anchors` phrase slots. Do not use `skin.tone` (evenness) in outfit prompts. Missing or sentinel values (`unknown`, etc.) use neutral phrases (`their face shape`); never emit the literal word `unknown`.
4. **Curated multi-variant banks.** Hair uses a curated 5-style bank keyed to the CV face-shape class (`Oval`, `Round`, `Square`, `Heart`, `Oblong`) plus a `neutral` bank for missing/unknown values (no silent Oval fallback). Outfit uses 5 curated occasion/register entries. Aging uses parametric tiers (`+3`, `+5`, `+10` years). One variant per `generate_image_edit` call remains mandatory.
5. **Full gallery (13 cards).** Each `generate_visual_variants` call emits all bank entries for requested types (5 hair + 5 outfit + 3 aging when all three types are requested).
6. **Projected AFTER only.** Image edits MUST use the stored projected AFTER full image (`assessments/{id}/projected/full.jpg|png`). No front pose, `photos.front`, or CV `imageSrc` fallbacks on the pipeline or admin generate path.

