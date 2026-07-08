"""Assessment API — run analysis and persist to MongoDB."""

from __future__ import annotations

import asyncio
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from ..analyze_face import run_face_analysis
from ..auth import get_current_user, get_optional_current_user, require_admin
from ..database import is_mongodb_configured
from ..image_utils import decode_image, decode_photo_dict
from ..openai_client import generate_cv_narrative
from ..repositories.assessment_repository import (
    create_assessment,
    delete_all_assessment_data,
    delete_assessment,
    get_assessment_by_id,
    list_assessments_for_user,
    list_assessments,
    update_assessment_status,
    update_assessment_admin_review,
    update_assessment_ai_narrative,
    update_assessment_ai_visuals,
)
from ..repositories.payment_repository import user_has_completed_payment
from ..serialization import to_json_safe
from ..visual_generation import generate_visual_variants

router = APIRouter(prefix="/api", tags=["assessments"])


class AssessmentCreateRequest(BaseModel):
    imageBase64: str
    answers: dict = {}
    photos: dict = {}
    provider: str = "local"
    awsCredentials: Optional[dict] = None
    scanId: Optional[str] = None


class AssessmentStatusUpdateRequest(BaseModel):
    status: str


class AssessmentAdminReviewRequest(BaseModel):
    status: Optional[str] = None
    adminNotes: Optional[str] = None
    aiNarrative: Optional[dict] = None


class AssessmentVisualsRequest(BaseModel):
    variants: list[str] = ["hair", "outfit", "aging"]


WORKFLOW_STATUSES = {"pending_review", "approved"}
REPORT_STATUSES = WORKFLOW_STATUSES | {"draft", "published"}  # legacy read support
PDF_ALLOWED_STATUSES = {"approved", "published"}


def _aws_creds_from_request(req: AssessmentCreateRequest) -> Optional[dict]:
    if not req.awsCredentials:
        return None
    return {
        "access_key_id": req.awsCredentials.get("accessKeyId", ""),
        "secret_access_key": req.awsCredentials.get("secretAccessKey", ""),
        "session_token": req.awsCredentials.get("sessionToken"),
        "region": req.awsCredentials.get("region", "us-east-1"),
    }


def _can_access_assessment(existing: dict, current_user: Optional[dict]) -> bool:
    if not existing.get("userId"):
        return True
    if not current_user:
        return False
    return current_user.get("role") == "admin" or current_user.get("id") == existing.get("userId")


def _score_line(label: str, data: Optional[dict]) -> Optional[str]:
    if not data:
        return None
    score = data.get("score")
    if score is None:
        return None
    score_label = data.get("scoreLabel")
    suffix = f" - {score_label}" if score_label else ""
    return f"- {label}: {score}/100{suffix}"


def _assessment_pdf_markdown(existing: dict) -> str:
    analysis = existing.get("analysis") or {}
    cv_report = analysis.get("cvReport") or {}
    metrics = analysis.get("metrics") or {}
    answers = existing.get("answers") or {}
    narrative = existing.get("aiNarrative") or analysis.get("aiNarrative") or {}
    narrative_content = narrative.get("content") if isinstance(narrative, dict) else None

    overall = cv_report.get("overall") or {}
    face_shape = cv_report.get("faceShape") or {}
    proportions = cv_report.get("proportions") or {}
    lines = [
        "# AuraScan Facial Analysis Report",
        "",
        f"Report status: {existing.get('status', 'draft')}",
        f"Assessment ID: {existing.get('id', '')}",
        "",
        "## Executive Summary",
        "",
        f"Overall score: {overall.get('score', metrics.get('harmonyScore', 'N/A'))}/100",
        f"Overall label: {overall.get('scoreLabel', 'Analysis complete')}",
    ]

    if isinstance(narrative_content, dict) and narrative_content.get("summary"):
        lines.extend(["", narrative_content["summary"]])
    elif cv_report.get("symmetry", {}).get("explanation"):
        lines.extend(["", cv_report["symmetry"]["explanation"]])

    lines.extend(["", "## Measured Scores", ""])
    for label, key in (
        ("Symmetry", "symmetry"),
        ("Proportions", "proportions"),
        ("Jaw and Chin", "jawChin"),
        ("Nose", "nose"),
        ("Lips", "lips"),
        ("Skin", "skin"),
        ("Hair", "hair"),
        ("Neck", "neck"),
        ("Ears", "ears"),
    ):
        line = _score_line(label, cv_report.get(key))
        if line:
            lines.append(line)

    lines.extend(
        [
            "",
            "## Key Measurements",
            "",
            f"- Harmony score: {metrics.get('harmonyScore', 'N/A')}/100",
            f"- Symmetry: {metrics.get('symmetry', 'N/A')}%",
            f"- Proportionality: {metrics.get('proportionality', 'N/A')}%",
            f"- Visual age estimate: {metrics.get('visualAge', 'N/A')}",
            f"- Face shape: {face_shape.get('shape', 'N/A')}",
            f"- Face width/height ratio: {face_shape.get('widthHeightRatio', 'N/A')}",
            f"- Facial thirds: {proportions.get('upperThird', 'N/A')} / {proportions.get('middleThird', 'N/A')} / {proportions.get('lowerThird', 'N/A')}",
        ]
    )

    if isinstance(narrative_content, dict):
        for title, key in (
            ("Strengths", "strengths"),
            ("Focus Areas", "focusAreas"),
            ("Recommendations", "recommendations"),
        ):
            items = narrative_content.get(key)
            if isinstance(items, list) and items:
                lines.extend(["", f"## {title}", ""])
                lines.extend([f"- {item}" for item in items])

    lines.extend(
        [
            "",
            "## Questionnaire Context",
            "",
            f"- Goals: {answers.get('goals', 'N/A')}",
            f"- Skin type: {answers.get('skinType', 'N/A')}",
            f"- Skin concerns: {answers.get('skinConcerns', 'N/A')}",
            f"- Sleep quality: {answers.get('sleepQuality', 'N/A')}",
            f"- Water intake: {answers.get('waterIntake', 'N/A')}",
            f"- Sun exposure: {answers.get('sunExposure', 'N/A')}",
            "",
            "## Disclaimer",
            "",
            "This report is educational aesthetic guidance based on computer vision measurements. It is not medical advice, diagnosis, or a treatment plan.",
        ]
    )
    return "\n".join(lines)


@router.post("/assessments")
async def post_assessment(
    req: AssessmentCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Run MediaPipe analysis and save full result to MongoDB."""
    if not is_mongodb_configured():
        raise HTTPException(
            status_code=503,
            detail="MongoDB not configured. Set MONGODB_URI in backend environment.",
        )

    if current_user.get("role") != "admin" and not await user_has_completed_payment(current_user["id"]):
        raise HTTPException(
            status_code=402,
            detail="Payment required before starting analysis.",
        )

    if not req.scanId:
        raise HTTPException(status_code=400, detail="scanId is required for assessment creation")

    try:
        photo_bytes = decode_image(req.imageBase64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")

    photos = decode_photo_dict(req.photos)
    aws_creds = _aws_creds_from_request(req)

    analysis = await asyncio.to_thread(
        run_face_analysis,
        photo_bytes,
        req.answers,
        photos,
        req.provider,
        aws_creds,
    )

    if not analysis.get("success"):
        raise HTTPException(status_code=422, detail=analysis.get("error") or "Analysis failed")

    analysis = to_json_safe(analysis)

    saved = await create_assessment(
        answers=req.answers,
        provider=req.provider,
        analysis=analysis,
        user_id=current_user["id"],
        photos_keys=list(req.photos.keys()),
        status="pending_review",
        scan_id=req.scanId,
    )

    return {
        "assessmentId": saved["id"],
        "status": saved["status"],
        "createdAt": saved["createdAt"],
        "analysis": analysis,
    }


@router.get("/assessments/{assessment_id}/pdf")
async def get_assessment_pdf(
    assessment_id: str,
    current_user: dict = Depends(get_current_user),
):
    if not is_mongodb_configured():
        raise HTTPException(status_code=503, detail="MongoDB not configured.")

    existing = await get_assessment_by_id(assessment_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if not _can_access_assessment(existing, current_user):
        raise HTTPException(status_code=403, detail="You do not have access to this assessment")
    if existing.get("status") not in PDF_ALLOWED_STATUSES:
        raise HTTPException(status_code=403, detail="PDF download is available after admin approval")

    analysis = existing.get("analysis") or {}
    cv_report = analysis.get("cvReport")
    if not cv_report:
        raise HTTPException(status_code=400, detail="Stored cvReport is required for PDF export.")

    from ..report_pdf import generate_pdf_bytes

    pdf_bytes = await asyncio.to_thread(
        generate_pdf_bytes,
        _assessment_pdf_markdown(existing),
        cv_report,
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="AuraScan-{assessment_id}.pdf"'},
    )


@router.get("/assessments/{assessment_id}")
async def get_assessment(
    assessment_id: str,
    current_user: Optional[dict] = Depends(get_optional_current_user),
):
    if not is_mongodb_configured():
        raise HTTPException(status_code=503, detail="MongoDB not configured.")

    doc = await get_assessment_by_id(assessment_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if not _can_access_assessment(doc, current_user):
        raise HTTPException(status_code=403, detail="You do not have access to this assessment")
    return to_json_safe(doc)


@router.get("/assessments")
async def get_assessments_list(limit: int = 20, current_user: dict = Depends(require_admin)):
    if not is_mongodb_configured():
        raise HTTPException(status_code=503, detail="MongoDB not configured.")
    limit = min(max(1, limit), 100)
    return {"items": to_json_safe(await list_assessments(limit=limit))}


@router.get("/my/assessments")
async def get_my_assessments(limit: int = 20, current_user: dict = Depends(get_current_user)):
    if not is_mongodb_configured():
        raise HTTPException(status_code=503, detail="MongoDB not configured.")
    limit = min(max(1, limit), 100)
    return {"items": to_json_safe(await list_assessments_for_user(current_user["id"], limit=limit))}


@router.delete("/assessments")
async def delete_assessments_data(current_user: dict = Depends(require_admin)):
    if not is_mongodb_configured():
        raise HTTPException(status_code=503, detail="MongoDB not configured.")
    return to_json_safe(await delete_all_assessment_data())


@router.delete("/assessments/{assessment_id}")
async def delete_assessment_by_id(
    assessment_id: str,
    current_user: dict = Depends(get_current_user),
):
    if not is_mongodb_configured():
        raise HTTPException(status_code=503, detail="MongoDB not configured.")
    existing = await get_assessment_by_id(assessment_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if not _can_access_assessment(existing, current_user):
        raise HTTPException(status_code=403, detail="You do not have access to this assessment")
    deleted = await delete_assessment(assessment_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return {"deleted": True, "assessmentId": assessment_id}


@router.patch("/assessments/{assessment_id}/status")
async def patch_assessment_status(
    assessment_id: str,
    req: AssessmentStatusUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    if not is_mongodb_configured():
        raise HTTPException(status_code=503, detail="MongoDB not configured.")
    if req.status not in WORKFLOW_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Status must be one of: pending_review, approved",
        )
    existing = await get_assessment_by_id(assessment_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if existing.get("status") == "approved" and req.status != "approved":
        raise HTTPException(
            status_code=400,
            detail="Approved reports cannot be moved back to pending review",
        )
    is_admin = current_user.get("role") == "admin"
    is_owner = existing.get("userId") == current_user.get("id")
    if not is_admin:
        raise HTTPException(status_code=403, detail="Only admins can update report status")
    doc = await update_assessment_status(assessment_id, req.status)
    return to_json_safe(doc)


@router.patch("/assessments/{assessment_id}/admin-review")
async def patch_assessment_admin_review(
    assessment_id: str,
    req: AssessmentAdminReviewRequest,
    current_user: dict = Depends(require_admin),
):
    if not is_mongodb_configured():
        raise HTTPException(status_code=503, detail="MongoDB not configured.")
    if req.status is not None and req.status not in WORKFLOW_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Status must be one of: pending_review, approved",
        )

    existing = await get_assessment_by_id(assessment_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if existing.get("status") == "approved" and req.status not in (None, "approved"):
        raise HTTPException(
            status_code=400,
            detail="Approved reports cannot be moved back to pending review",
        )

    ai_narrative = req.aiNarrative
    if ai_narrative is not None:
        content = ai_narrative.get("content") if isinstance(ai_narrative, dict) else None
        if content is None:
            ai_narrative = {
                "source": "admin",
                "model": None,
                "content": ai_narrative,
            }
        else:
            ai_narrative = {
                **ai_narrative,
                "source": "admin",
            }

    reviewer = {
        "id": current_user.get("id"),
        "email": current_user.get("email"),
        "role": current_user.get("role"),
    }
    updated = await update_assessment_admin_review(
        assessment_id,
        status=req.status,
        admin_notes=req.adminNotes,
        ai_narrative=ai_narrative,
        reviewer=reviewer,
    )
    return to_json_safe(updated)


@router.post("/assessments/{assessment_id}/ai-narrative")
async def post_assessment_ai_narrative(
    assessment_id: str,
    current_user: dict = Depends(get_current_user),
):
    if not is_mongodb_configured():
        raise HTTPException(status_code=503, detail="MongoDB not configured.")

    existing = await get_assessment_by_id(assessment_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Assessment not found")

    if not _can_access_assessment(existing, current_user):
        raise HTTPException(status_code=403, detail="You do not have access to this assessment")

    analysis = existing.get("analysis") or {}
    cv_report = analysis.get("cvReport")
    if not cv_report:
        raise HTTPException(status_code=400, detail="Stored cvReport is required for AI narrative.")

    result = await asyncio.to_thread(
        generate_cv_narrative,
        answers=existing.get("answers") or {},
        cv_report=cv_report,
        metrics=analysis.get("metrics"),
    )
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])

    ai_narrative = {
        "source": result.get("source"),
        "model": result.get("model"),
        "content": result.get("content"),
    }
    updated = await update_assessment_ai_narrative(assessment_id, ai_narrative)
    return to_json_safe(updated)


@router.post("/assessments/{assessment_id}/ai-visuals")
async def post_assessment_ai_visuals(
    assessment_id: str,
    req: AssessmentVisualsRequest,
    current_user: dict = Depends(get_current_user),
):
    if not is_mongodb_configured():
        raise HTTPException(status_code=503, detail="MongoDB not configured.")

    existing = await get_assessment_by_id(assessment_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if not _can_access_assessment(existing, current_user):
        raise HTTPException(status_code=403, detail="You do not have access to this assessment")

    analysis = existing.get("analysis") or {}
    cv_report = analysis.get("cvReport")
    if not cv_report:
        raise HTTPException(status_code=400, detail="Stored cvReport is required for AI visuals.")

    source_image = (
        cv_report.get("faceShape", {}).get("imageSrc")
        or cv_report.get("symmetry", {}).get("imageSrc")
        or cv_report.get("proportions", {}).get("imageSrc")
    )
    ai_visuals = await generate_visual_variants(
        answers=existing.get("answers") or {},
        cv_report=cv_report,
        metrics=analysis.get("metrics"),
        source_image=source_image,
        variant_types=req.variants,
    )
    updated = await update_assessment_ai_visuals(assessment_id, ai_visuals)
    return to_json_safe(updated)
