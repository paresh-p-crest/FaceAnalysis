"""FastAPI backend server — MyFace facial analysis API.

Import-light on purpose: Replit Autoscale cold-starts spent minutes importing
assessments/protocol/CV stacks before uvicorn bound :8000, so Next proxied
ECONNREFUSED. Routers load in deferred boot after the port is open.
"""

from __future__ import annotations

import asyncio
import base64
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from .logging_config import configure_backend_logging

configure_backend_logging()

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .database import close_db, connect_db, is_db_configured, ping_db

logger = logging.getLogger(__name__)

_boot_done = asyncio.Event()
_boot_error: Optional[str] = None
_routers_mounted = False


def _env_list(name: str, default: str) -> list[str]:
    value = os.environ.get(name, default)
    return [item.strip() for item in value.split(",") if item.strip()]


def _mount_routers(app: FastAPI) -> None:
    """Import and mount API routers (heavy). Call only from deferred boot."""
    global _routers_mounted
    if _routers_mounted:
        return
    from .routers.assessments import router as assessments_router
    from .routers.assistant import router as assistant_router
    from .routers.auth import router as auth_router
    from .routers.media import router as media_router
    from .routers.notifications import router as notifications_router
    from .routers.payments import router as payments_router

    app.include_router(auth_router)
    app.include_router(assessments_router)
    app.include_router(assistant_router)
    app.include_router(media_router)
    app.include_router(payments_router)
    app.include_router(notifications_router)
    _routers_mounted = True
    logger.info("API routers mounted")


async def _deferred_boot(app: FastAPI) -> None:
    """Bind happens before this runs. Import routers + connect DB here."""
    global _boot_error
    try:
        # Mount routes before DB so once _boot_done is set, paths exist.
        await asyncio.to_thread(_mount_routers, app)
        await connect_db()
        from .auth import ensure_bootstrap_admin

        await ensure_bootstrap_admin()
        from .pipeline_worker import start_pipeline_worker

        start_pipeline_worker()
        logger.info("Deferred boot complete (routers + db + pipeline worker)")
    except Exception as exc:
        _boot_error = str(exc)
        logger.exception("Deferred boot failed")
    finally:
        _boot_done.set()


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_backend_logging()
    _boot_done.clear()
    boot_task = asyncio.create_task(_deferred_boot(app))
    # Yield immediately — uvicorn accepts TCP while boot continues.
    yield
    from .pipeline_worker import stop_pipeline_worker

    await stop_pipeline_worker()
    boot_task.cancel()
    try:
        await boot_task
    except asyncio.CancelledError:
        pass
    await close_db()


app = FastAPI(
    title="MyFace Backend",
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


@app.middleware("http")
async def wait_for_deferred_boot(request: Request, call_next):
    """Port is open immediately; hold /api (except health) until boot finishes."""
    path = request.url.path
    if path.startswith("/api/") and path != "/api/health" and not _boot_done.is_set():
        try:
            await asyncio.wait_for(_boot_done.wait(), timeout=120)
        except asyncio.TimeoutError:
            return JSONResponse(
                {"detail": "Backend still starting, retry shortly"},
                status_code=503,
            )
        if _boot_error:
            return JSONResponse(
                {"detail": f"Backend boot failed: {_boot_error}"},
                status_code=503,
            )
    return await call_next(request)


class RunAnalysisRequest(BaseModel):
    imageBase64: str
    answers: dict = {}
    photos: dict = {}
    provider: str = "local"


class GeneratePdfRequest(BaseModel):
    reportMarkdown: str
    reportData: Optional[dict] = None


@app.get("/api/health")
async def health():
    if not _boot_done.is_set():
        return {
            "status": "starting",
            "provider": "python-fastapi",
            "database": "starting",
        }
    db_status = "not_configured"
    if is_db_configured():
        db_status = "connected" if await ping_db() else "error"
    if _boot_error:
        return {
            "status": "degraded",
            "provider": "python-fastapi",
            "database": db_status,
            "bootError": _boot_error,
        }
    return {
        "status": "ok",
        "provider": "python-fastapi",
        "database": db_status,
    }


@app.post("/api/run-analysis")
async def run_analysis(req: RunAnalysisRequest):
    """Run analysis without saving to DB (legacy / quick test)."""
    from .analyze_face import run_face_analysis
    from .image_utils import decode_image, decode_photo_dict
    from .serialization import to_json_safe

    try:
        photo_bytes = decode_image(req.imageBase64)
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image data: {exc}") from exc

    photos = decode_photo_dict(req.photos)

    try:
        result = await asyncio.to_thread(
            run_face_analysis,
            photo_bytes,
            req.answers,
            photos,
            req.provider,
        )
        return to_json_safe(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
