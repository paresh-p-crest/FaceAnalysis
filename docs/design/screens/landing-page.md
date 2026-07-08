# Screen Design: Landing Page (AuraScan Refinement)

High-fidelity specification for the AuraScan landing page, focused on an editorial, diagnostic aesthetic.

---

## 1. Visual Strategy & Architecture
* **Layout Structure:** Exactly 5 cohesive sections to maximize narrative clarity and minimize card repetition:
  1. **Hero:** Focus on headline, "Start Your Journey" CTA, and 3 immediate trust chips.
  2. **How It Works:** Streamlined 3-step timeline.
  3. **Sample Report:** Unified interactive analysis (Symmetry, Proportions, Face Shape, Skin) combined with visual report diagnostics.
  4. **Trust & Security:** Data deletion policy, SSL/payment badges, and informational disclaimers.
  5. **FAQ & Final CTA:** Collapsible accordion and final entry path.
* **Styling Guidelines:**
  * **Typography:** `Sora` for headlines, `Inter` for body.
  * **Color:** 1 neutral background family (white/off-white in light mode, `#0F1117` in dark mode), 1 primary accent color (Brand Teal `#0F766E`), 1 clean card structure.
  * **Clutter Reduction:** Remove neon glows, duplicate shadow styles, and generic border-radius templates. Keep lines sharp and clean.
  * **Face Asset Unity:** Use exactly 1 face asset `/demo-photos/front.jpg` for the hero portrait, interactive overlay, and report mockup to establish a consistent user focus.

---

## 2. Structural Specifications

### A. Navigation Header
* **Style:** Sticky header with `bg-white dark:bg-surface-card` and standard `border-surface-border`.
* **Elements:** Wordmark `AuraScan`, anchor links (`#how-it-works`, `#sample-report`, `#trust-security`, `#faq`), Theme Switcher icon, and the "Analyze My Face" button.

### B. Hero Section
* **Layout:** 2-column split.
  * **Left:** Strong diagnostic headline, description, primary button labeled "Start Your Journey" (no secondary CTA to avoid confusion), and 3 trust chips immediately underneath:
    1. processed in-memory
    2. no photo retention
    3. ssl encryption
  * **Right:** Clean, sharp portrait frame using `/demo-photos/front.jpg` with subtle alignment markers.

### C. How It Works
* **Layout:** Minimalist 3-column steps (01. Upload, 02. Geometry Mapping, 03. Full Report).

### D. Sample Report (Integrated)
* **Layout:** 2 columns.
  * **Left:** The face portrait with SVG coordinate overlays and alignment lines that update dynamically based on the selected tab.
  * **Right:** Smooth tab interface (Symmetry, Proportions, Face Shape, Skin) showing real measurements and a circular progress metric representing the overall score dial.

### E. Trust & Security
* **Layout:** Centered panel highlighting our privacy baseline:
  * **In-Memory Processing:** Images are discarded immediately post-computation.
  * **No Photo Retention:** Zero server storage of user media.
  * **Payment Standards:** SSL-encrypted checkout powered by Stripe and PayPal.
  * **Non-Medical Disclaimer:** Stating that the analysis is calculated mathematically for self-improvement and aesthetic reference.

### F. FAQ & Closing CTA
* **Accordion:** Clean questions answering data storage, diagnostic context, and photo criteria.
* **Final CTA:** Clean card pitching the entry to the onboarding questionnaire.
