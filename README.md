# AuraScan — AI Facial Analysis POC

## Quick Start

```bash
npm install
npm run dev
```

## Configuration

**.env** — only app mode:

```env
VITE_APP_MODE=demo   # or real
```

**Settings (gear icon)** — provider & credentials:
- **Tab 1 · AWS** — Rekognition credentials (active tab = AWS CV)
- **Tab 2 · OpenAI** — API key (active tab = MediaPipe/OpenCV + OpenAI report)

Whichever tab is active when you Save = the active LLM provider.

Restart `npm run dev` after changing `.env`.

## Deploy (Vercel — free)

1. Push this repo to GitHub (see commands below).
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your GitHub repo.
3. Vercel auto-detects Vite. Click **Deploy**.
4. In Vercel → **Settings → Environment Variables**, add:
   - `VITE_APP_MODE` = `demo` or `real`
5. Redeploy after adding env vars.

**Notes:**
- **Demo mode** works out of the box on Vercel.
- **Real + AWS** uses the `/api/analyze-face` serverless function (included).
- **Real + OpenAI** calls OpenAI from the browser with the key from Settings.
- AWS/OpenAI keys stay in the browser (localStorage) — not in Vercel env.

## Modes

| VITE_APP_MODE | Active tab | Result |
|---------------|------------|--------|
| demo | any | All mock |
| real | AWS | AWS Rekognition CV + template report |
| real | OpenAI | MediaPipe + OpenCV + OpenAI report |
