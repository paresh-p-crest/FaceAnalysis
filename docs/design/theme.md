# MyFace — Design System & Theme Reference

> **MANDATORY:** Every new component or UI change must conform to this document.  
> Do not use arbitrary hex codes, arbitrary pixel values, or ad-hoc Tailwind utilities for color, spacing, or typography when a token or component class already exists.

---

## 1. Brand Identity

| Property | Value |
|---|---|
| Product name | **MyFace** |
| Logo treatment | Wordmark: Inter bold (`font-sans`), tracking-tight. Same stack as app UI. |
| Brand voice | Scientific, clean, premium; Qoves-style third person (“the subject”) in PDF/protocol/narrative copy; second-person (you/your) in Beauty Assistant chat; no pipeline/tech jargon in client-facing text |
| Dark panel background | `#0d1e1f` → `#091516` → `#04090a` (gradient) |

---

## 2. Color Tokens
### 2.1 Brand Green (Primary Accent)

> **Rule:** Never use arbitrary teal/green hex codes in components. Always use one of these two values or the corresponding Tailwind token.

| Role | Hex | Tailwind class |
|---|---|---|
| Primary / interactive | `#5e9f8b` | `bg-brand` · `text-brand` · `border-brand` |
| Hover / dark state | `#548f7d` | `bg-brand-dark` · `text-brand-dark` |
| Light tint | `#73bfa9` | `text-brand-light` |
| Subtle tint | `#a8d9cb` | `text-brand-lighter` |
| Surface tint (light) | `#dbeee8` | `bg-brand-100` |
| Surface tint (dark) | `rgba(15,118,110,0.12)` | `bg-brand-50` (resolves via CSS var in dark mode) |
| Glow shadow | `rgba(94,159,139,0.15)` | `shadow-glow` |
| Brand shadow | `rgba(94,159,139,0.25)` | `shadow-brand` |

### 2.2 Surface Tokens (light / dark)

Defined as CSS custom properties in `app/globals.css` and mapped through `tailwind.config.js`.

| Token | Light | Dark | Tailwind class |
|---|---|---|---|
| Page background | `#F7F8FC` | `#0F1117` | `bg-surface` |
| Warm background | `#FAFBFD` | `#161922` | `bg-surface-warm` |
| Card background | `#FFFFFF` | `#1A1D27` | `bg-surface-card` |
| Raised surface | `#F0F2F7` | `#22263A` | `bg-surface-raised` |
| Border | `#E5E7EB` | `#2E3348` | `border-surface-border` |

### 2.3 Ink Tokens (text)

| Token | Light | Dark | Tailwind class |
|---|---|---|---|
| Primary text | `#111827` | `#F3F4F6` | `text-ink` |
| Secondary text | `#374151` | `#D1D5DB` | `text-ink-secondary` |
| Muted text | `#6B7280` | `#9CA3AF` | `text-ink-muted` |
| Faint / disabled | `#D1D5DB` | `#4B5563` | `text-ink-faint` |

### 2.4 Semantic / Status Colors

Use Tailwind's standard palette for status states only — do not use these for branding.

| State | Color class |
|---|---|
| Success / pass | `text-emerald-500` · `bg-emerald-500/10` · `border-emerald-500/20` |
| Warning | `text-amber-500` · `bg-amber-500/10` |
| Error / fail | `text-red-500` · `bg-red-500/10` · `border-red-500/20` |
| Info / neutral | `text-slate-400` · `text-slate-500` |

---

## 3. Typography

### 3.1 Font Families

| Role | Family | Tailwind class |
|---|---|---|
| App UI (body, headings, display) | `Inter, Helvetica` | `font-sans` · `font-serif` · `font-display` (all resolve to the same stack) |
| Protocol PDF / HTML preview | `Helvetica` | `.qoves-pdf-*` / jsPDF built-in Helvetica |

> **Rule:** Only load **Inter** from Google Fonts. Allowed families: **Inter** and **Helvetica** only. `font-serif` / `font-display` aliases must map to `Inter, Helvetica`.
>
> **Everywhere rule:** App UI = `Inter, Helvetica`. Protocol PDF / A4 HTML preview = `Helvetica`. No Arial, system-ui, Sora, Instrument Serif, or any other face.

### 3.2 Heading Scale

| Level | Typical size | Usage |
|---|---|---|
| `h1` | `text-3xl` – `text-5xl` | Page title (one per view) |
| `h2` | `text-2xl` – `text-3xl` | Section headers |
| `h3` | `text-lg` – `text-xl` | Card / panel headers |
| Body | `text-sm` – `text-base` | Paragraph, description text |
| Caption | `text-xs` – `text-[11px]` | Labels, metadata |
| Micro | `text-[9px]` – `text-[10px]` | Badges, tracking labels (uppercase + `tracking-widest`) |

### 3.3 Letter Spacing

| Context | Class |
|---|---|
| Headings (all) | `tracking-tight` (`-0.02em` applied globally) |
| Buttons | `tracking-[-0.03px]` |
| Badge / label CAPS | `tracking-widest` or `tracking-wider` |

---

## 4. Border Radius

> **Rule:** Do not use arbitrary `rounded-*` values. Use only the following.

| Shape | Class | Usage |
|---|---|---|
| Pill buttons | `rounded-[50px]` | All primary and ghost buttons |
| Cards / panels | `rounded-2xl` (`1rem`) | Standard card containers |
| Large containers | `rounded-3xl` (`1.5rem`) | Glassmorphic panels, dropzones |
| Extra large | `rounded-4xl` (`2rem`) | Modal overlays |
| Small elements | `rounded-xl` (`0.75rem`) | Input fields, chips, option rows |
| Inline / tag | `rounded-full` | Avatar, status dot, chip pill |

---

## 5. Shadows

Defined in `tailwind.config.js`. Use these — do not write custom `box-shadow` values.

| Token | Usage |
|---|---|
| `shadow-soft` | Default resting state for cards and buttons |
| `shadow-card` | Standard card elevation |
| `shadow-card-hover` | Hovered card state |
| `shadow-elevated` | Modals, drawers, popovers |
| `shadow-modal` | Full modal overlays |
| `shadow-glow` | Selected/active brand element glow |
| `shadow-brand` | Brand-colored button shadow |

---

## 6. Spacing & Layout

### 6.1 Split-Screen Layout (two-column pages)

Used on: Questionnaire, PhotoUpload confirmation, PhotoUpload upload.

| Element | Value |
|---|---|
| Left panel width | `lg:w-[380px]` (fixed, `shrink-0`) |
| Left panel background | `bg-white dark:bg-surface-card` |
| Left panel border | `lg:border-r border-surface-border` |
| Right panel background | `bg-gradient-to-br from-[#0d1e1f] via-[#091516] to-[#04090a]` |
| Right panel MyFace logo | `font-sans font-bold text-white text-3xl tracking-tight`, `absolute top-10 left-10` |
| Full height (desktop) | `lg:h-screen lg:overflow-hidden` |
| Mobile | `min-h-screen flex-col` (single column, natural scroll) |

### 6.2 Standard Padding

| Context | Padding |
|---|---|
| Left panel (standard) | `px-8 py-10` |
| Left panel (compact, with scrollable body) | `px-7 pt-7 pb-4` (header) · `px-7 py-5` (footer) |
| Right panel | `p-12` |

### 6.3 Site Navbar (full-width app chrome)

Used on all stages except **landing (questionnaire welcome)**, **questionnaire**, and **scanning**. Questionnaire welcome and wizard keep inline navigation only.

| Element | Value |
|---|---|
| Shell | `.site-navbar` — `fixed top-0 inset-x-0 w-full`, **opaque** `bg-white` + hairline `border-landing-divider` (no backdrop-blur — avoids jagged seam) |
| Top inset | `--site-navbar-top`: `0` (flush to viewport) |
| Height | `--site-navbar-height`: `3.5rem` mobile · `3.75rem` from `sm` up |
| Content gap | `--site-navbar-gap`: `0.75rem` mobile · `1rem` from `sm` up (top only) |
| Page offset | `.site-navbar-offset` — `padding-top: var(--site-navbar-offset)` |
| Report modal | Explicit spacers: navbar-height clear + mint `--site-navbar-gap` strip |
| Standalone tools | `/chat` and `/ai-visuals` use `StandalonePageShell` — mint surface, `report-shell-inner` gutters, white `qoves-report-layout` card |
| Inner row | `.site-navbar-inner` — full width; `.site-navbar-cluster` left-aligns logo + links |
| Customer links | Report · AI Visuals · Chat Assistant (left of bar); History/Billing removed from navbar (use dashboard KPIs) |
| Active link | Brand liquid-glass pill (`site-navbar-link-active`) — low-opacity teal frost (~4–10% brand), heavy blur, brand-dark label |
| Controls | `.site-navbar-pill` account + language; `.site-navbar-btn` brand fill |
| Mobile | Hamburger opens `.site-navbar-mobile-panel`; Escape to close |
| Report actions | PDF + admin review actions in navbar whenever the report modal is open (any route, e.g. admin review); Share on overview header |

**Visibility:** `AppShell` shows the navbar on `/report`, `/ai-visuals`, `/chat`, `/dashboard`, `/history`, `/billing`, admin tabs, and `/payment-success`. Questionnaire and `/analysis/*` stay chromeless.

**Page width:** Page surface is mint (`--color-surface: #eef6f3`). Dashboard/admin **hero is full-bleed** (`.dashboard-hero-band--bleed`) flush under the navbar. Lower sections use full width with `px-4 sm:px-6 lg:px-8` gutters. Cards/panels use glass (`bg-white/55–70` + backdrop blur).

**Customer home:** Default authenticated route is `/report` (`CustomerHome`). Ready submitted assessment → open report modal; submitted pending → `AnalysisPreparing` `variant="home"`; in-progress draft (photos only) → **Continue upload**; empty → questionnaire CTA; unpaid → Stripe Checkout; Stripe return → `PaymentSuccessPage` with **Start Face Analysis**. Photo-only drafts are excluded from `GET /my/assessments`.

**Standalone tools:** `/ai-visuals` and `/chat` use `StandalonePageShell` — mint surface + `report-shell-inner` gutters (`px-4 sm:px-6 lg:px-8`), then white `qoves-report-layout` card (same as report). Chat uses a floating pill composer inside the card. Generate/Regenerate on AI Visuals is **admin-only**.

**Report chrome:** Report has no secondary header bar (`REPORT` / `#ref` / close). PDF lives in the site navbar while the report modal is open; admin review actions (Edit PDF narrative, Edit After Image, Approve) share that navbar row and only render for admins on unapproved assessments. Share is on the overview header only (protocol meta · centered MyFace · Share). Mint gap under navbar via ReportModal spacers.

---

## 7. Pre-Built Component Classes

Defined in `app/globals.css` `@layer components`. **Always use these before writing new utility combinations.**

| Class | Description |
|---|---|
| `.btn-primary` | Brand green pill button — hover scale, shadow, disabled state |
| `.btn-ghost` | Outline pill button, light/dark aware |
| `.site-navbar-premium` | Legacy alias — full-width bar chrome is on `.site-navbar` |
| `.glass` | Card: white bg + border + shadow (light/dark) |
| `.dashboard-icon-well` | Landing-style mint circle icon well (customer KPI headers) |
| `.dashboard-icon-well-stat` | Landing-style white square icon well (stat bar icons) |
| `.dashboard-card-glass` | Glassmorphic dashboard card with 8px blur |
| `.dashboard-card` | Solid premium dashboard card (no blur) |
| `.dashboard-panel` | Solid dashboard section wrapper |
| `.dashboard-hero-band` | Mint/gradient hero band wrapper for dashboard header |
| `.dashboard-status-chip` | Check-bubble status chip (ready/pending) |
| `.dashboard-metric-bar` | 5px track metric bar (landing) |
| `.dashboard-empty-state` | Dashed-border neutral empty state card |
| `.option-card` | Selectable option row — bordered, hover to brand tint |
| `.option-card-selected` | Active option: brand border + ring + glow |
| `.chip-option` | Rounded chip/tag selector |
| `.chip-option-selected` | Active chip state |
| `.severity-card` | Assessment severity selector card |
| `.input-field` | Text input with brand focus ring |
| `.metric-pill` | Horizontal key-value metric row |
| `.tab-active` | Active tab underline in brand color |
| `.markdown-report` | Styled markdown prose for report content |
| `.onboarding-step-active` | Active step indicator dot |
| `.onboarding-step-done` | Completed step indicator dot |

---

## 8. Animation & Motion

Keyframes are defined in `tailwind.config.js`. Use `animate-*` classes — do not write inline `@keyframes`.

| Class | Usage |
|---|---|
| `animate-fade-up` | Wrap each page/view root element |
| `animate-fade-in` | Contextual element reveal |
| `animate-slide-up` | Modal or drawer entry |
| `animate-scale-in` | Tooltip, popover entry |
| `animate-shimmer` | Skeleton loading states |
| `animate-laser-sweep` | Face scan animation |
| `animate-pulse-glow` | Glow ring pulse |
| `animate-scan-line` | Report scan overlay |

---

## 9. Dark Mode Rules

Dark mode is class-based (`darkMode: 'class'`). The `dark` class is toggled on `<html>`.

> **Rule:** Every component must include `dark:` variants for all surface and text colors.

```jsx
// ✅ Correct
<div className="bg-white dark:bg-surface-card text-ink dark:text-ink">

// ❌ Wrong — missing dark mode
<div className="bg-white text-gray-900">
```

---

## 10. Strict Dos and Don'ts

### ✅ Do
- Use `bg-brand` / `text-brand` / `border-brand` for all primary interactions
- Use `#5e9f8b` directly only in inline SVG, CSS gradients, or Tailwind JIT arbitrary values when a token isn't sufficient — never as a replacement for tokens in JSX `className`
- Use `font-sans` for the **MyFace** logo wordmark
- Apply `animate-fade-up` to every new page/view root element
- Use `rounded-[50px]` for all action buttons
- Use `.btn-primary` / `.btn-ghost` for buttons instead of writing new button styles
- Provide both `bg-*` and `dark:bg-*` for every surface color used

### ❌ Don't
- Use arbitrary teal/green hex codes (`#0d9488`, `#14b8a6`, `teal-400`, `green-500`, etc.)
- Define new `@keyframes` inline — add to `tailwind.config.js` then use `animate-*`
- Use `min-h-screen` with `overflow-hidden` on the same element — use `h-screen` instead
- Hardcode light-only backgrounds (`bg-white`, `text-gray-900`) without `dark:` pair
- Use `font-mono` for brand or UI text
- Use any border-radius outside the approved set in Section 4
- Add new Google Fonts — only `Inter` is permitted. Stack is exactly `Inter, Helvetica`. Protocol PDF is Helvetica only.

---

## 11. Source of Truth Files

| What | File |
|---|---|
| CSS variables (light/dark tokens) | `artifacts/myface/app/globals.css` `:root` + `.dark` blocks |
| Tailwind tokens (colors, shadows, animations, fonts) | `artifacts/myface/tailwind.config.js` |
| Pre-built component classes | `artifacts/myface/app/globals.css` `@layer components` |
| This design system document | `docs/design/theme.md` ← **you are here** |

---

## 12. Report Document Layout (QOVES-style)

The in-app report uses a document-style shell separate from the onboarding/dashboard chrome.

| Element | Token / class | Notes |
|---|---|---|
| Sidebar width | `~240px` · `.qoves-report-sidebar` | `bg-surface-raised`, collapsible text TOC |
| Document canvas | `.qoves-report-canvas` · `.qoves-report-page` | White document surface; no heavy outer card |
| Section headings | `ReportSectionHeading` | `font-display` title + muted `accent` span |
| Metric labels | `.qoves-report-mono-label` | Uppercase, `10px`, tracking-wide — **not** `font-mono` |
| Metric cards | `.qoves-report-metric-card` | 2×2 grids on assessment/feature pages |
| Protocol pages | `.qoves-protocol-pdf-frame` | Full-bleed native PDF iframe in report canvas; in-viewer toolbar removed (download stays in report header) |
| Protocol admin HTML spike | `.qoves-protocol-scroll--html` · `.qoves-report-a4-page` · `.qoves-pdf-*` | Admins see fixed 595×842 HTML sheets mirroring jsPDF feature layouts (header, stacked titles, column images, summary cards); non-admins keep PDF iframe |
| Protocol inline edit | `.qoves-editable` · `.qoves-protocol-edit-status` | `contentEditable` feature/closing text in the admin HTML preview; box-shadow affordance only (no layout shift); sticky status shows saving/error |
| Protocol admin edit | `.qoves-protocol-edit-dock` | Lightweight: section picker + AI generate + Save only; narrative text edited inline on HTML sheets. Narrow rail (~14rem). |
| Right rail | `.qoves-report-rail` | Protocol section only — patient profile + next steps |
| Brand accents | `bg-brand` / `text-brand` | Never QOVES blue; keep MyFace green |

### 12.1 Protocol PDF export (`utils/reportPdf.js`)

Client-side jsPDF uses the same tokens as the web report. **`buildMyFacePdf`** returns `{ blob, filename }` for in-app iframe preview; **`downloadMyFacePdf`** wraps it for file download. Preview and download share one generator. Admin HTML preview is only for edit UX evaluation, and its `.qoves-pdf-*` styles must mirror jsPDF’s built-in Helvetica typography plus the layout constants in `reportPdf.js` (`MARGIN=48`, `COL_GAP=20`, `SECTION_GAP=22`, `IMAGE_TEXT_GAP=22`, `SUMMARY_CARD_MIN_H=110`). Long narrative copy may still clip per-page in jsPDF layout (stored text remains complete in DB).

**Page 1 (protocol dashboard):** light-grey page background (`#F8F9FA`), compact soft-grey header bar (`#EEF0F3`, ~36pt) with PROTOCOL | client meta left and **MyFace** centered (no right-side action buttons), extra gap then larger KPI strip (brand-green type), more space before body; three-column body — **left** ~30% / **right** ~24%; summary panels use default light/white fills. Interactive overview uses full report canvas width (not A4 chrome).

| Token | Hex / RGB | Usage |
|---|---|---|
| Brand | `#5e9f8b` (94, 159, 139) | Projected potential dots, accent bar |
| Page-1 bg | `#F8F9FA` (248, 249, 250) | Protocol dashboard page canvas |
| Mint bg | `#E8F3F0` (232, 243, 240) | Legacy mint token (other surfaces) |
| Ink | `#111827` (17, 24, 39) | Body text |
| Muted | `#6B7280` | Page numbers, secondary labels |
| Surface warm | `#FAFBFD` | Image frame backgrounds |
| Summary bar | `#dbeee8` (brand-100) | Per-feature summary footer / card |

> **Rule:** AFTER/projected image slots use `projectedAfter.full.publicUrl` when `status === ready`; otherwise show “Projected image pending” (`skipped` / disabled until `PROJECTED_AFTER_ENABLED=true`).

> **Rule:** Protocol HTML parity pages must keep content sequential with PDF spacing: header first, split title, two-column content, image groups, then summary card/bar. Do not use responsive app typography (`font-display`, Inter-only `font-sans`) or ad-hoc gaps inside `.qoves-report-a4-inner--pdf`; use the scoped Helvetica stack and `--qoves-pdf-*` spacing variables.

> **Rule:** Never pin protocol HTML blocks to the sheet bottom with `mt-auto`/`flex-1` — on a fixed-height clipped A4 page that causes images to overlap preceding text. Lay every block out top-down with `margin-top: var(--qoves-pdf-section-gap)` (first block after the title uses ~4px) and let overflow clip at the sheet boundary, matching jsPDF's sequential draw order.

> **Rule:** Inline protocol edits (`contentEditable`) are admin-only (unapproved reports), update the shared local draft on blur (not on keystroke), and persist only when **Save edits** is clicked (`PATCH …/admin-review`). Editable fields: overview summary, feature subsection bodies, feature summaries, closing paragraphs. The right dock must stay lightweight — section nav + generate + save only; do not duplicate narrative textareas in the sidebar. Write only the edited subsection/summary/closing entry — do not emit empty sibling subsections, or `mergeSubsections` will blank CV-derived defaults. The edit dock section picker follows scroll via `[data-protocol-section]`.

> **Rule:** Report nav uses flat section IDs (`overview`, `intro`, `dimorphism`, `eyebrows`, `protocol`, etc.). Overview, Introduction, and Disclaimer are always visible; assessment and feature scores are gated until the assessment is **Approved**.

---

## 13. Dashboard Components (premium app chrome)

> **MANDATORY:** Dashboard styling must be built from the exact literals below. Implementers copy values into component primitives/classes; they do not invent.

### 13.0 Client app typography (locked decision)
- Customer app chrome uses **`Inter, Helvetica` only**.
- Report/onboarding `font-display` / `font-serif` aliases resolve to the same `Inter, Helvetica` stack.
- Protocol PDF / A4 HTML preview stays **Helvetica only**.
- Do not rely on global `h1..h6` font-family for customer pages; use `font-sans` on customer page roots if needed.

### 13.1 Icon-well pattern (three landing variants)
Landing has different “icon wells” depending on context. Use the correct one:

#### A. `.dashboard-icon-well` — mint circle (KPI headers, page titles, pipeline icons)
| Property | Literal value |
|---|---|
| Shape | `h-10 w-10 rounded-full` (`44px`) |
| Background | `#eef6f3` |
| Icon size | `h-5 w-5` (`20px`) |
| Icon color | `#5e9f8b` |

#### B. `.dashboard-icon-well-stat` — white square (stats bar icons only)
| Property | Literal value |
|---|---|
| Shape | `h-11 w-11 rounded-xl` (`44px`) |
| Border | `1px solid #e8eeec` |
| Background | `#ffffff` |
| Icon size | `h-5 w-5` (`20px`) |
| Icon color | `#3c3c3c` |

#### C. Rows/lists never use icon wells
Use photo thumbnails or solid tint blocks on list rows.

### 13.2 Glass card — `.dashboard-card-glass`
Landing’s hero glass card uses:
| Property | Literal value |
|---|---|
| Radius | `rounded-2xl` (`16px`) |
| Border | `border: 1px solid rgba(255,255,255,0.6)` (`#ffffff99`) |
| Background | `bg-white/70` |
| Shadow | `0px 4px 24px rgba(118,118,118,0.12), inset 0 1px 0 rgba(255,255,255,0.60), inset 1px 0 0 rgba(255,255,255,0.50)` |
| Blur | `backdrop-blur-[8px]` and `-webkit-backdrop-filter: blur(8px)` |
| Padding | `p-6` |

### 13.3 Hero band — `.dashboard-hero-band`
No blur on the wrapper (perf). Use only mint gradient.
| Property | Literal value |
|---|---|
| Wrapper background | `#eef6f3` OR `linear-gradient(180deg, #eef6f3 0%, #f0f7f7 60%, transparent 100%)` |
| Padding | `pt-4 pb-8 px-4 sm:px-6` |

### 13.4 Solid card — `.dashboard-card`
| Property | Literal value |
|---|---|
| Radius | `rounded-2xl` |
| Background | `#ffffff` |
| Border | `border: 1px solid #e8eeec` |
| Shadow | `shadow-[0px_2px_16px_#4343431a]` |
| Padding | `p-5` default; `p-6` panels |

Harmony/attractiveness panel uses solid card + `#eef6f3` tint, not glass.

### 13.5 Named glass placements (hard locked)
On **DashboardPage**, glass is allowed **exactly** on:
1. Navbar pill shell
2. Hero title card (page title + subtitle + CTAs)
3. KPI: Reports
4. KPI: Latest Score
5. KPI: Payments

Everything else uses `.dashboard-card` (solid). **Never** apply blur per table row/list row.

### 13.6 Site navbar — `.site-navbar`
Full-width frosted glass bar:
| Property | Literal value |
|---|---|
| Position | `fixed top-0 inset-x-0` |
| Background | `rgba(255,255,255,0.72)` + `backdrop-filter: blur(22px) saturate(1.2)` |
| Border | `border-b border-white/50` |
| Height | `--site-navbar-height` (`3.5rem` / `3.75rem`) |
| Inner | `w-full` + `px-4 sm:px-6 lg:px-8` |
| Center links | `text-[13px]`; active = soft glass chip `bg-white/70` |
| Account / language | `.site-navbar-pill` frosted pills + initials avatar |

### 13.6b Dashboard hero bleed — `.dashboard-hero-band--bleed`
| Property | Literal value |
|---|---|
| Width | Edge-to-edge (`w-full`, no side margin) |
| Radius | `rounded-none` (flush under navbar) |
| Gap above | None — sits directly under `.site-navbar-offset` |
| Finish | Glass gradient + grain; KPI tiles use `.dashboard-card-glass` |

### 13.13 Interactive report shell
| Element | Spec |
|---|---|
| Column | Full width (`w-full` gutters) — matches site navbar |
| Header | `.report-shell-bar` white + hairline bottom border |
| Actions | `.report-shell-btn` white pills; PDF uses `.report-shell-btn-primary` |
| Sidebar nav | White panel; active item `bg-landing-mint text-brand` |
| Document card | `.qoves-report-layout` — white `rounded-2xl shadow-soft` |

### 13.14 Admin panel
| Element | Spec |
|---|---|
| Column | Full width + `px-4 sm:px-6 lg:px-8` |
| Navbar (admin) | Center links: Overview · Users · Review reports · Payments (no Analysis History); optional count badges on Users / Review |
| Hero | `.dashboard-hero-band.surface-grain` + shield icon well + serif title + Refresh |
| KPIs | `.dashboard-card` + `.micro-label` + tabular stat |
| Sections | `.dashboard-panel`; report rows: client block → status/pipeline badges → `#ref` meta → action pills |

### 13.7 Status chip — `.dashboard-status-chip`
| State | Literal value |
|---|---|
| Ready | `bg-emerald-50 text-emerald-700 border border-emerald-200` + check bubble well in `#5e9f8b` |
| Pending | `bg-amber-50 text-amber-700 border border-amber-200` |

### 13.8 Metric bar — `.dashboard-metric-bar`
Landing’s bars:
| Property | Literal value |
|---|---|
| Track | `h-[5px] w-full rounded-[3.5px] bg-[#00000014]` |
| Fill | `h-[5px] rounded-[3.5px] bg-[#509180]` |

### 13.9 Empty / pending values
Never show a bare em dash `—`. Use pending microcopy.

### 13.10 Client-facing labels
Never show internal storage/provider terms or raw operational labels.

### 13.11 Buttons
Use landing CTAs literals for consistent radii/hover behavior.

### 13.12 Error / 404 pages
Centered single-column stack on `bg-surface` (no cards, no chrome):
| Element | Spec |
|---|---|
| Code | Large tabular `404` / `500` (`text-6xl`–`text-7xl`, `font-bold`, `text-ink`) |
| Title | `text-xl`–`text-2xl` `font-semibold` |
| Body | `text-sm text-ink-muted` one line |
| CTA | Brand `rounded-xl bg-brand` “Go home” → dashboard if signed in, else `/auth` |
| Files | `app/[locale]/not-found.jsx`, `error.jsx`; root `app/not-found.jsx` fallback |

