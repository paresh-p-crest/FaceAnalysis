# MyFace — Design System & Theme Reference

> **MANDATORY:** Every new component or UI change must conform to this document.  
> Do not use arbitrary hex codes, arbitrary pixel values, or ad-hoc Tailwind utilities for color, spacing, or typography when a token or component class already exists.

---

## 1. Brand Identity

| Property | Value |
|---|---|
| Product name | **MyFace** |
| Logo treatment | Serif (`font-serif`), bold, tracking-tight |
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
| Body / UI text | `Inter` | `font-sans` (default on `body`) |
| Headings / display | `Sora` | `font-display` or `font-serif` |

> **Rule:** Do not import or use any other Google Font. Both fonts are loaded in `globals.css`.

### 3.2 Heading Scale

All `h1`–`h6` elements automatically receive `font-family: Sora`, `letter-spacing: -0.02em`, and `color: var(--color-ink)` via the base layer in `globals.css`.

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
| Right panel MyFace logo | `font-serif font-bold text-white text-2xl tracking-tight`, `absolute top-10 left-10` |
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
| Shell | `.site-navbar` — `fixed top-0 inset-x-0 w-full`, `bg-surface-card`, `border-b border-surface-border`, `shadow-soft` |
| Height | `--site-navbar-height`: `2.5rem` mobile · `2.75rem` from `sm` up |
| Content gap | `--site-navbar-gap`: `1.5rem` mobile · `2rem` from `sm` up |
| Page offset | `.site-navbar-offset` — `padding-top: var(--site-navbar-offset)` where offset = height + gap |
| Inner row | `.site-navbar-inner` — `max-w-[1440px] mx-auto`, `h-full`, padding `px-3 sm:px-4 md:px-6` |
| Compact controls | `.site-navbar-btn`, `.site-navbar-icon-btn` — `text-xs`, `min-h-[32px]` |
| Mobile | Hamburger opens `.site-navbar-drawer`; overlay + Escape to close |

**Visibility:** `AppShell` shows the navbar only on `/dashboard`, `/history`, `/billing`, `/admin`, and `/payment-success`. The `/analysis/*` flow and `/report` are chromeless (full-bleed / immersive).

---

## 7. Pre-Built Component Classes

Defined in `app/globals.css` `@layer components`. **Always use these before writing new utility combinations.**

| Class | Description |
|---|---|
| `.btn-primary` | Brand green pill button — hover scale, shadow, disabled state |
| `.btn-ghost` | Outline pill button, light/dark aware |
| `.glass` | Card: white bg + border + shadow (light/dark) |
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
- Use `font-serif` for the **MyFace** logo wordmark
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
- Add new Google Fonts — only `Inter` and `Sora` are permitted

---

## 11. Source of Truth Files

| What | File |
|---|---|
| CSS variables (light/dark tokens) | `app/globals.css` `:root` + `.dark` blocks |
| Tailwind tokens (colors, shadows, animations, fonts) | `tailwind.config.js` |
| Pre-built component classes | `app/globals.css` `@layer components` |
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
| Protocol pages | `.qoves-report-a4-page` | Fixed A4 aspect (210×297); desk canvas `.qoves-protocol-viewer`; zoom via CSS `transform: scale()` |
| Right rail | `.qoves-report-rail` | Protocol section only — patient profile + next steps |
| Brand accents | `bg-brand` / `text-brand` | Never QOVES blue; keep MyFace green |

### 12.1 Protocol PDF export (`utils/reportPdf.js`)

Client-side jsPDF uses the same tokens as the web report:

| Token | Hex / RGB | Usage |
|---|---|---|
| Brand | `#5e9f8b` (94, 159, 139) | Projected potential dots, accent bar |
| Ink | `#111827` (17, 24, 39) | Body text, cover band |
| Muted | `#6B7280` | Page numbers, secondary labels |
| Surface warm | `#FAFBFD` | Image frame backgrounds |
| Summary bar | `#374151` gradient | Per-feature summary footer |

> **Rule:** AFTER/projected image slots use `projectedAfter.full.publicUrl` when `status === ready`; otherwise show “Projected image pending” (`skipped` / disabled until `PROJECTED_AFTER_ENABLED=true`).

> **Rule:** Report nav uses flat section IDs (`intro`, `dimorphism`, `eyebrows`, `protocol`, etc.). Introduction and Disclaimer are always visible; assessment and feature scores are gated until the assessment is **Approved**.
