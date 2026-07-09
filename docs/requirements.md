<!-- Migrated from legacy product research and handover docs -->
# Product Requirements & Milestone Scopes

This document captures the functional and non-functional requirements of the MyFace AI Facial Analysis MVP, structured by the three agreed project milestones.

---

## Milestone 1: Core MVP Setup, Onboarding & Facial Analysis Flow
**Goal:** Allow users to complete onboarding, upload a valid image, and generate a structured AI facial analysis report draft.

### 1. Onboarding Questionnaire (23 Questions & Branching Logic)
- **Scale:** The wizard must support 23 specific questions to gather client details.
- **Branching Logic:** Questionnaire paths must adjust based on answers:
  - If gender is selected as `"male"`, the skincare and lifestyle questions automatically adjust to focus on male-specific grooming routines (e.g. shaving habits, facial hair care) and default presets.
  - Goals select boundaries: Users can select up to 3 target goals (e.g., Facial Harmony, Skin Health, Anti-aging) which dynamically prioritizes corresponding sections of the final report.
- **Data Categories:**
  - **Goals (Q1-Q3):** Define primary, secondary, and tertiary focus areas.
  - **Skin Concerns & Severity (Q4-Q8):** Identify acne, pigmentation, wrinkles, dark circles, redness, or scars, along with severity scale (Mild, Moderate, Severe).
  - **Demographics & Profile (Q9-Q12):** Age, gender, ethnicity.
  - **Lifestyle Habits (Q13-Q18):** Smoking habits, sleep duration/consistency, water intake, daily sun exposure, stress metrics, and environmental exposure.
  - **Skin Care Routine (Q19-Q23):** Skin type (oily, dry, combination, normal, sensitive) and routine depth (cleansers, moisturizers, active ingredients, sunscreen).

### 2. Photo Upload & Validation Checklist
- **Multi-Angle Support:** Standard interface supporting front photograph upload and optional secondary photos (profile, hair, styling poses).
- **Validation Checklist (Qoves-Style):** Before processing, verify image properties using client-side checks and AWS Rekognition details:
  - Neutral expression (no smile).
  - Adequate lighting (no extreme shadows).
  - Head pose alignment (warning if pitch, roll, or yaw exceeds 10°).
  - Image quality (warning if blurriness exceeds threshold).
  - No accessories (warning if glasses are detected).

### 3. OpenAI Vision Facial Analysis
- **Vision Model:** Integrate GPT-4o Vision to inspect the uploaded face image directly.
- **Contextual Analysis:** Send both the image and the complete questionnaire context (formatted answers summary) to the OpenAI API.
- **11 Facial Feature Categories:** The analysis must generate structured metrics and narrative grades for:
  1. **Hair:** Hairstyle harmony, texture, density, hairline shape.
  2. **Brows:** Eyebrow shape, positioning, symmetry, density.
  3. **Eyes:** Canthal tilt, eyelid exposure, under-eye circles, symmetry.
  4. **Nose:** Width, bridge projection, symmetry, nose-to-face ratio.
  5. **Cheeks:** Cheekbone projection, volume, symmetry.
  6. **Jaw:** Jawline angle, width, definition, symmetry.
  7. **Lips:** Fullness (upper vs lower), philtrum ratio, mouth width.
  8. **Chin:** Chin type (flat, cleft, round), projection, length.
  9. **Skin:** Textural quality, clarity, redness, pore visibility.
  10. **Neck:** Neck definition, posture alignment, neck-jaw angle.
  11. **Ears:** Ear proportion, symmetry, ear-to-eye alignment.

---

## Milestone 2: Report, PDF, Payment & User Dashboard
**Goal:** Allow users to pay via Stripe, unlock the facial analysis report, access it from the dashboard, and download the branded PDF.

### 1. Structured Report Layout
- **Visual Sidebar:** Clean dashboard interface showing overall symmetry scores, thirds proportions, face shape, and interactive panels for each of the 11 categories.
- **Payment Gating:** Initial scans generate a locked report. Detailed metrics, narratives, and protocols are hidden behind a payment firewall.

### 2. Branded PDF Report
- **Server-side Compilation:** Use Python `reportlab` to compile a multi-page PDF report.
- **Contents:** Includes cover page, disclaimer, calculated scores, before/after projection overlays, detailed feature breakdowns, and the personalized 30-day protocol.
- **Branding:** Branded with MyFace logo, layout, and colors.

### 3. Stripe Payment Integration
- **Stripe Checkout:** Redirect clients to secure checkout portals to purchase report access.
- **Webhooks:** Secure backend endpoint listening to Stripe callbacks (`checkout.session.completed`) to update report status to `paid` and unlock the dashboard viewing state.

### 4. User Dashboard
- **Report Access:** Dashboard view listing all history items.
- **PDF Downloads:** Provide secure, gated download links for unlocked reports.
- **Email Notifications:** SMTP-driven email delivery. Send confirmation on upload and email notification with a PDF copy when a report transitions to published.

---

## Milestone 3: Advanced AI Features, Admin Panel & Final Integrations
**Goal:** Deliver advanced AI visual variants, Beauty Assistant chatbot, admin review workspace, PayPal, tracking scripts, and final Replit deployment.

### 1. AI Visual Features (Image Generation)
- **AI Hairstyles:** Generate 5 distinct hairstyle variations suited to the user's face shape.
- **AI Outfit/Style:** Generate 5 distinct clothing/outfitting styles matching the user's profile.
- **AI Aging Simulations:** Generate 3 progressive aging preview images: Current status, +10 Years, and +20 Years.
- **Technology:** Use OpenAI DALL-E models or equivalent generation endpoints with prompt fallback modes.

### 2. AI Beauty Assistant Chat
- **Grounding:** Chatbot grounded on the specific user's `cvReport` values and questionnaire answers.
- **Boundaries:** Conversational guide explaining report findings, skin health, and routine recommendations without diagnosing medical conditions or proposing surgery/injectables.

### 3. Admin Review Panel
- **Workflow Control:** Administrator panel to review, edit AI-generated narratives, add custom notes, and update report status (`draft` → `pending_review` → `approved` → `published`).

### 4. PayPal Integration
- **Payment Alternative:** Integrate PayPal REST SDK (Orders v2) as an alternate gating pathway.

### 5. Tracking Scripts
- **Google Tag Manager & Meta Pixel:** Initialize GTM and Meta Pixel containers dynamically based on environment values to track purchase conversions and onboarding actions.

### 6. QA & Replit Deployment
- **Handoff:** End-to-end testing, smoke checks, config cleanups, and final deployment setup on Replit.
