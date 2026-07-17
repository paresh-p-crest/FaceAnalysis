<!-- Merged and migrated from README.md and TECHNICAL_README.md -->
# MyFace — AI Facial Analysis

MyFace is an AI-powered facial analysis platform. Users upload a photograph, complete an onboarding questionnaire, and receive a comprehensive, structured report analyzing facial symmetry, proportions, shapes, and features.

---

## Technical Architecture Overview

MyFace runs a combined hybrid processing system:
1. **Google MediaPipe Face Mesh:** Maps **478 3D landmarks** on the client's face to calculate geometry metrics (symmetry, jaw angle, eye/lip/nose proportions).
2. **Canvas Pixel Analysis:** Samples pixel colors from 6 facial zones (forehead, nose, chin, cheeks, under-eyes) to evaluate brightness, redness, uniformity, and tone.
3. **OpenAI GPT Narrative (Optional):** Generates conversational, structured summaries and personal protocol plans grounded on the calculations.
4. **Stripe & PayPal Gateways:** Restricts detailed reports behind a checkout session wall.

For developer-specific details, rules, and commands, please refer to [AGENTS.md](file:///c:/Users/JayRabari/Documents/FacialAnalysis/AGENTS.md).

---

## Quick Start Guide

### 1. Backend (Python FastAPI)
The computer vision, PDF engine, database persistence, and assistant run inside a FastAPI backend.

```bash
# From the repository root
python -m venv .venv

# Activate (Windows PowerShell)
.\.venv\Scripts\activate
# Activate (macOS/Linux)
source .venv/bin/activate

# Install dependencies (includes SegFormer / torch CPU wheels)
python -m pip install -r requirements.txt

# Start API (from repo root)
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
The backend server starts at `http://localhost:8000`. Check `http://localhost:8000/api/health` for DB connectivity.

### 2. Frontend (Next.js 15)
The user interface and dashboard run on a Node/Next.js app under `artifacts/myface`.

```bash
# In the repository root directory
pnpm install
pnpm --filter @workspace/myface run dev
```
Open `http://localhost:3000` in your web browser.

---

## Configuration Settings
Go to Settings (gear icon in the top-right menu) to choose the active provider engine:
- **Free CV:** Runs MediaPipe and Canvas math locally in the browser ($0 cost).
- **AWS Rekognition:** Connects AWS credentials to run server-side face detection for emotion, head pose, image quality verification, and accessories.
- **OpenAI:** Uses OpenAI models to output AI narrative reports.

---

## Feature Comparison Matrix

| Feature | Free CV (Local) | Free CV + AWS | Free CV + OpenAI |
| :--- | :---: | :---: | :---: |
| Landmark Measurements (Symmetry, third ratios, jaw, lips, brows) | ✅ | ✅ | ✅ |
| Skin Quality Color Analysis | ✅ | ✅ | ✅ |
| Structured Sidebar Report | ✅ | ✅ | ❌ |
| Emotion & Pose Detection | ❌ | ✅ | ❌ |
| Photo Quality Warnings | ❌ | ✅ | ❌ |
| AI Narrative & Custom Protocol | ❌ | ❌ | ✅ |
| Cost Per Scan | **$0** | **~$0.004** | **~$0.005** |

---

## Deployment (Vercel)
1. Push this repository to a remote GitHub account.
2. Go to [vercel.com](https://vercel.com) and click **Add New Project**.
3. Import the repository. Vercel will auto-detect Next.js 15 configuration.
4. Deploy the project. Setup your environment values (`NEXT_PUBLIC_API_URL` and `PUBLIC_APP_URL`) in the project settings.
