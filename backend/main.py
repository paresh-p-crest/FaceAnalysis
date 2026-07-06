"""FastAPI backend server — replaces Vercel serverless API routes.

Provides the same API surface the React frontend expects:
  - POST /api/analyze-face          — AWS Rekognition face detection
  - POST /api/test-aws              — Test AWS credentials
  - POST /api/run-analysis          — Full analysis pipeline (new unified endpoint)
  - POST /api/generate-report       — Generate OpenAI report
  - POST /api/generate-pdf          — Generate PDF report
  - GET  /api/health                — Health check
"""

from __future__ import annotations
import base64
import os
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .api_routes import router as api_router
from .analyze_face import run_face_analysis
from .openai_client import generate_report
from .build_eye_report import build_eye_report
from .build_aws_report import build_aws_report, format_answers_summary


app = FastAPI(
    title="AuraScan Backend",
    description="Python FastAPI backend for facial analysis",
    version="1.0.0",
)

# CORS — allow the Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the /api/analyze-face and /api/test-aws routes (matches original Vercel API)
app.include_router(api_router)


# ── Request models ───────────────────────────────────────────────────────────

class RunAnalysisRequest(BaseModel):
    """Unified analysis request — sends image bytes + config."""
    imageBase64: str  # base64-encoded JPEG/PNG
    answers: dict = {}
    photos: dict = {}  # {"smile": "base64...", "topHead": "base64..."}
    provider: str = "local"
    awsCredentials: Optional[dict] = None  # {accessKeyId, secretAccessKey, sessionToken, region}


class GenerateReportRequest(BaseModel):
    answers: dict = {}
    imagePreview: Optional[str] = None  # data URL
    cvMetrics: Optional[dict] = None
    cvError: Optional[str] = None
    faceDetails: Optional[dict] = None
    protocolWarnings: list = []
    eyeAnalysis: Optional[dict] = None
    apiKey: Optional[str] = None


class GeneratePdfRequest(BaseModel):
    reportMarkdown: str
    reportData: Optional[dict] = None


# ── Helpers ──────────────────────────────────────────────────────────────────

def _decode_image(image_base64: str) -> bytes:
    """Decode base64 image string to bytes."""
    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]
    return base64.b64decode(image_base64)


def _decode_photo_dict(photos: dict) -> dict:
    """Decode base64 photo dict to bytes dict."""
    decoded = {}
    for key, val in photos.items():
        if isinstance(val, str) and val:
            try:
                decoded[key] = _decode_image(val)
            except Exception:
                pass
    return decoded


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "provider": "python-fastapi"}


@app.post("/api/run-analysis")
async def run_analysis(req: RunAnalysisRequest):
    """Unified analysis endpoint — replaces the JS runFaceAnalysis() call.

    Decodes the image and delegates to the appropriate provider path.
    """
    try:
        photo_bytes = _decode_image(req.imageBase64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")

    photos = _decode_photo_dict(req.photos)

    aws_creds = None
    if req.awsCredentials:
        aws_creds = {
            "access_key_id": req.awsCredentials.get("accessKeyId", ""),
            "secret_access_key": req.awsCredentials.get("secretAccessKey", ""),
            "session_token": req.awsCredentials.get("sessionToken"),
            "region": req.awsCredentials.get("region", "us-east-1"),
        }

    try:
        result = run_face_analysis(
            photo_bytes=photo_bytes,
            answers=req.answers,
            photos=photos,
            provider=req.provider,
            aws_credentials=aws_creds,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate-report")
async def generate_report_endpoint(req: GenerateReportRequest):
    """Generate a personalized report — routes to local/aws/openai based on settings."""
    # Local path: build eye report directly
    if not req.cvMetrics:
        raise HTTPException(status_code=400, detail="No analysis data available.")

    # Determine provider from the metrics source or explicit request
    source = req.cvMetrics.get("source", "local")
    provider = source if source in ("aws", "openai") else "local"

    if provider == "aws":
        content = build_aws_report(req.faceDetails, req.cvMetrics, req.answers, req.protocolWarnings)
        if not content:
            raise HTTPException(status_code=400, detail="AWS data missing.")
        return {"content": content, "source": "aws", "error": None}

    if provider == "local":
        if not req.eyeAnalysis:
            raise HTTPException(status_code=400, detail="Eye analysis data missing.")
        content = build_eye_report(req.eyeAnalysis, req.answers)
        return {"content": content, "source": "local", "error": None}

    # OpenAI path
    result = generate_report(
        answers=req.answers,
        image_preview=req.imagePreview,
        cv_metrics=req.cvMetrics,
        cv_error=req.cvError,
        face_details=req.faceDetails,
        protocol_warnings=req.protocolWarnings,
        eye_analysis=req.eyeAnalysis,
        api_key=req.apiKey or os.environ.get("OPENAI_API_KEY"),
    )
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.post("/api/generate-pdf")
async def generate_pdf(req: GeneratePdfRequest):
    """Generate a PDF from the report markdown + optional structured data."""
    from .report_pdf import generate_pdf_bytes

    try:
        pdf_bytes = generate_pdf_bytes(req.reportMarkdown, req.reportData)
        return {
            "pdfBase64": base64.b64encode(pdf_bytes).decode("utf-8"),
            "contentType": "application/pdf",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {e}")


# ── Run server ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)
