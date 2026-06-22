# AuraScan — AI Facial Analysis POC

## Quick Start

```bash
npm install
npm run dev
```

## Configuration

Open **Settings** (gear icon, top-right):

- **App mode** — `demo` (mock data) or `real` (live analysis)
- **Tab 1 · AWS** — Rekognition credentials (active tab = AWS CV)
- **Tab 2 · OpenAI** — API key (active tab = MediaPipe/OpenCV + OpenAI report)

Whichever provider tab is active when you Save = the active provider. All settings are stored in the browser.

## Deploy (Vercel — free)

1. Push this repo to GitHub (see commands below).
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your GitHub repo.
3. Vercel auto-detects Vite. Click **Deploy**.

No environment variables required — app mode and API keys are set in the Settings UI.

**Notes:**
- **Demo mode** works out of the box on Vercel.
- **Real + AWS** uses the `/api/analyze-face` serverless function (included).
- **Real + OpenAI** calls OpenAI from the browser with the key from Settings.
- AWS/OpenAI keys stay in the browser (localStorage) — not in Vercel env.

## Modes

| App mode | Active tab | Result |
|---------------|------------|--------|
| demo | any | All mock |
| real | AWS | AWS Rekognition CV + template report |
| real | OpenAI | MediaPipe + OpenCV + OpenAI report |
