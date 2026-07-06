# AuraScan — AI Facial Analysis

## Quick Start (Frontend + Python Backend)

### Frontend (React + Vite)

```bash
npm install
npm run dev
```

### Backend (Python FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate          # macOS/Linux
venv\Scripts\activate             # Windows
pip install -r requirements.txt
python -m main
```

Backend starts at `http://localhost:8000`. Update `vite.config.js` proxy to forward `/api` to the backend.

## Configuration

Open **Settings** (gear icon, top-right) and choose a provider tab:

- **Free CV** — MediaPipe + OpenCV (no API keys, $0 cost)
- **AWS** — Enter Rekognition credentials for server-side analysis
- **OpenAI** — Enter API key for AI-generated narrative reports

The active tab becomes the active provider.

## Python Backend (New)

The entire JavaScript backend has been ported to Python FastAPI. All CV processing, AWS integration, and PDF generation run server-side.

See [backend/README.md](backend/README.md) for full documentation.

### Provider Modes

| Provider | CV Engine | Report |
|----------|-----------|--------|
| Free CV (local) | MediaPipe + OpenCV | Rule-based eye analysis + CV metrics |
| AWS | AWS Rekognition + MediaPipe | Template from AWS facial data |
| OpenAI | MediaPipe + OpenCV | GPT-4o-mini narrative report |

### Backend API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/analyze-face` | AWS Rekognition face detection |
| `POST` | `/api/test-aws` | Test AWS credentials |
| `POST` | `/api/run-analysis` | Full analysis pipeline |
| `POST` | `/api/generate-report` | Generate personalized report |
| `POST` | `/api/generate-pdf` | Generate PDF report |

## Deploy (Vercel — free)

1. Push this repo to GitHub.
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your GitHub repo.
3. Vercel auto-detects Vite. Click **Deploy**.

No environment variables required — API keys are set in the Settings UI.

**Notes:**
- **Free CV** works out of the box — fully local processing.
- **AWS** uses the `/api/analyze-face` endpoint.
- **OpenAI** calls OpenAI for AI-generated reports.
- Keys are passed in request body — not stored server-side.
