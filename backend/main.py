"""FastAPI backend server — AuraScan facial analysis API."""

from __future__ import annotations

import asyncio
import base64
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# Load backend/.env then project root .env (local dev)
load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .api_routes import router as api_router
from .analyze_face import run_face_analysis
from .auth import ensure_bootstrap_admin
from .build_aws_report import build_aws_report
from .build_eye_report import build_eye_report
from .database import close_db, connect_db, is_mongodb_configured, ping_db
from .image_utils import decode_image, decode_photo_dict
from .openai_client import generate_report
from .routers.auth import router as auth_router
from .routers.assessments import router as assessments_router
from .routers.assistant import router as assistant_router
from .routers.notifications import router as notifications_router
from .routers.payments import router as payments_router
from .routers.admin_settings import router as admin_settings_router
from .serialization import to_json_safe


def _env_list(name: str, default: str) -> list[str]:
    value = os.environ.get(name, default)
    return [item.strip() for item in value.split(",") if item.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    await ensure_bootstrap_admin()
    yield
    await close_db()


app = FastAPI(
    title="AuraScan Backend",
    description="Python FastAPI backend for facial analysis",
    version="1.1.0",
    lifespan=lifespan,
)

cors_origins = _env_list(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://0.0.0.0:3000",
)
cors_origin_regex = os.environ.get(
    "CORS_ORIGIN_REGEX",
    r"https://.*\.(replit\.dev|repl\.co)",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(auth_router)
app.include_router(assessments_router)
app.include_router(assistant_router)
app.include_router(payments_router)
app.include_router(admin_settings_router)
app.include_router(notifications_router)


class RunAnalysisRequest(BaseModel):
    imageBase64: str
    answers: dict = {}
    photos: dict = {}
    provider: str = "local"
    awsCredentials: Optional[dict] = None


class GenerateReportRequest(BaseModel):
    answers: dict = {}
    imagePreview: Optional[str] = None
    cvMetrics: Optional[dict] = None
    cvError: Optional[str] = None
    faceDetails: Optional[dict] = None
    protocolWarnings: list = []
    eyeAnalysis: Optional[dict] = None
    apiKey: Optional[str] = None


class GeneratePdfRequest(BaseModel):
    reportMarkdown: str
    reportData: Optional[dict] = None


def _aws_creds_from_request(req: RunAnalysisRequest) -> Optional[dict]:
    if not req.awsCredentials:
        return None
    return {
        "access_key_id": req.awsCredentials.get("accessKeyId", ""),
        "secret_access_key": req.awsCredentials.get("secretAccessKey", ""),
        "session_token": req.awsCredentials.get("sessionToken"),
        "region": req.awsCredentials.get("region", "us-east-1"),
    }


@app.get("/api/health")
async def health():
    mongo_status = "not_configured"
    if is_mongodb_configured():
        mongo_status = "connected" if await ping_db() else "error"
    return {
        "status": "ok",
        "provider": "python-fastapi",
        "mongodb": mongo_status,
    }


@app.post("/api/run-analysis")
async def run_analysis(req: RunAnalysisRequest):
    """Run analysis without saving to DB (legacy / quick test)."""
    try:
        photo_bytes = decode_image(req.imageBase64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")

    photos = decode_photo_dict(req.photos)
    aws_creds = _aws_creds_from_request(req)

    try:
        result = await asyncio.to_thread(
            run_face_analysis,
            photo_bytes,
            req.answers,
            photos,
            req.provider,
            aws_creds,
        )
        return to_json_safe(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate-report")
async def generate_report_endpoint(req: GenerateReportRequest):
    if not req.cvMetrics:
        raise HTTPException(status_code=400, detail="No analysis data available.")

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
    from .report_pdf import generate_pdf_bytes

    try:
        pdf_bytes = generate_pdf_bytes(req.reportMarkdown, req.reportData)
        return {
            "pdfBase64": base64.b64encode(pdf_bytes).decode("utf-8"),
            "contentType": "application/pdf",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {e}")


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)
