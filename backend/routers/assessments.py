"""Assessment API — run analysis and persist to PostgreSQL."""

from __future__ import annotations

import asyncio
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from ..auth import get_current_user, get_optional_current_user, require_admin
from ..config import PHOTO_POSES
from ..database import is_db_configured
from ..media_storage import assessment_key, get_media_storage, media_key_from_ref
from ..photo_validation import validate_required_poses
from ..ai_access import require_paid_ai_access
from ..protocol_service import (
    delete_stored_protocol,
    enrich_assessment_nl_content,
    ensure_ai_narrative,
    generate_and_store_protocol,
    load_protocol_bundle,
    persist_protocol_bundle,
    refresh_protocol_closing_for_assessment,
    regenerate_protocol_section,
)
from ..repositories.assessment_repository import (
    create_assessment,
    delete_all_assessment_data,
    delete_assessment,
    finalize_assessment_for_processing,
    get_assessment_by_id,
    get_latest_draft_for_user,
    list_assessments_for_user,
    list_assessments,
    remove_assessment_photo,
    requeue_failed_pipeline,
    upsert_assessment_photo,
    update_assessment_status,
    update_assessment_admin_review,
    update_assessment_ai_visuals,
    update_assessment_analysis,
)
from ..projected_after_status import new_projected_after_pending
from ..pipeline_status import (
    format_pipeline_for_api,
    new_feature_parsing_pending,
    new_queued_pipeline,
    pipeline_is_processing,
)
from ..photo_storage import (
    apply_photo_urls_to_cv_report,
    get_photo_storage,
    photos_map_to_urls,
    save_all_poses,
)
from ..repositories.payment_repository import user_has_completed_payment
from ..repositories.user_repository import get_user_by_id
from ..serialization import to_json_safe
from ..dev_config import dev_auto_approve_reports
from ..image_utils import decode_image, decode_photo_dict
from ..report_status import (
    format_report_status,
    is_pdf_allowed_status,
    normalize_report_status,
    parse_status_input,
    serialize_assessment,
    serialize_assessments,
)
from ..photo_storage import load_projected_full
from ..visual_generation import generate_visual_variants
from ..answer_summary import format_answers_summary

# Keep analyze_face out of module import — MediaPipe/matplotlib cold-start is minutes on Replit.


def _normalize_cv_provider(provider: str) -> str:
    if provider in ("openai", "local", ""):
        return "local"
    return provider

router = APIRouter(prefix="/api", tags=["assessments"])


class AssessmentCreateRequest(BaseModel):
    imageBase64: str
    answers: dict = {}
    photos: dict = {}
    provider: str = "local"
    scanId: Optional[str] = None


class AssessmentDraftRequest(BaseModel):
    scanId: Optional[str] = None


class AssessmentSubmitRequest(BaseModel):
    answers: dict = {}
    provider: str = "local"


ALLOWED_POSE_IDS = frozenset(p["id"] for p in PHOTO_POSES)


class AssessmentStatusUpdateRequest(BaseModel):
    status: str


class AssessmentAdminReviewRequest(BaseModel):
    status: Optional[str] = None
    adminNotes: Optional[str] = None
    aiNarrative: Optional[dict] = None
    protocolNarrative: Optional[dict] = None
    featureNarratives: Optional[dict] = None


class AssessmentVisualsRequest(BaseModel):
    variants: list[str] = ["hair", "outfit", "aging"]


class ProtocolSectionRequest(BaseModel):
    sectionId: str


def _parse_status_or_400(status: str) -> str:
    try:
        return parse_status_input(status)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _reject_narrative_edit_if_approved(existing: dict) -> None:
    """Block protocol text edits and regen once a report is approved."""
    if normalize_report_status(existing.get("status")) == "approved":
        raise HTTPException(
            status_code=400,
            detail="Cannot edit protocol narrative on approved reports.",
        )


def _can_access_assessment(existing: dict, current_user: Optional[dict]) -> bool:
    if not existing.get("userId"):
        return True
    if not current_user:
        return False
    return current_user.get("role") == "admin" or current_user.get("id") == existing.get("userId")


async def _require_payment_or_admin(current_user: dict) -> None:
    """Analysis entry is payment-gated (admins bypass)."""
    if current_user.get("role") != "admin" and not await user_has_completed_payment(current_user["id"]):
        raise HTTPException(
            status_code=402,
            detail="Payment required before starting analysis.",
        )


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
        "# MyFace Facial Analysis Report",
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

    profile = format_answers_summary(answers)
    lines.extend(["", "## Questionnaire Context", ""])
    for key, label in (
        ("goals", "Goals"),
        ("goalAesthetic", "Goal Aesthetic"),
        ("aestheticDistress", "Aesthetic Distress"),
        ("appearanceFrequency", "Appearance Thought Frequency"),
        ("motivation", "Motivation"),
        ("skinType", "Skin Type"),
        ("skinConcerns", "Skin Concerns"),
        ("severity", "Skin Concern Severity"),
        ("hadNonSurgical", "Had Non-Surgical Treatments"),
        ("hadSurgery", "Had Surgery"),
        ("comfortableTreatments", "Comfortable Treatments"),
        ("medicalConditions", "Medical Conditions"),
        ("medications", "Medications"),
        ("usedRetinoids", "Used Retinoids (Past 6-12 Months)"),
        ("allergies", "Allergies"),
        ("activeInfections", "Active Infections/Conditions"),
        ("proneToHyperpigmentation", "Prone to Hyperpigmentation"),
        ("age", "Age Range"),
        ("gender", "Gender"),
        ("genderPreference", "Gender Preference"),
        ("growBeard", "Can Grow Full Beard"),
        ("ethnicity", "Ethnic Heritage"),
        ("featureLike", "Likes Most About Face"),
        ("featureDislike", "Dislikes Most About Face"),
        ("celebrityMatch", "Celebrity Aesthetic Match"),
        ("occupation", "Occupation"),
        ("smoking", "Smoking Frequency"),
        ("drinking", "Drinking Frequency"),
        ("sleepQuality", "Sleep Quality"),
        ("waterIntake", "Daily Water Intake"),
        ("sunExposure", "Sun Exposure"),
        ("comfortableWeightLoss", "Comfortable with Weight Loss Recommendations"),
        ("additionalNotes", "Additional Notes"),
    ):
        val = profile.get(key)
        if not val:
            val = answers.get(key, "N/A")
        lines.append(f"- {label}: {val}")

    lines.extend(
        [
            "",
            "## Protocol PDF",
            "",
            "The branded Qoves-style protocol PDF is generated from the stored protocol bundle "
            "(featureNarratives, protocolNarrative). "
            "Use the in-app Protocol viewer or client download when a front photo is available.",
        ]
    )
    lines.extend(
        [
            "",
            "## Disclaimer",
            "",
            "This report is educational aesthetic guidance based on facial measurements. It is not medical advice, diagnosis, or a treatment plan.",
        ]
    )
    return "\n".join(lines)


@router.post("/assessments")
async def post_assessment(
    req: AssessmentCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Validate photos, persist upload, enqueue async pipeline (CV → NL → parsing)."""
    if not is_db_configured():
        raise HTTPException(
            status_code=503,
            detail="Database not configured. Set DATABASE_URL in backend environment.",
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
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image data: {exc}") from exc

    photos = decode_photo_dict(req.photos)
    photos_with_front = {**photos, "front": photo_bytes}
    missing = validate_required_poses(photos_with_front)
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required photo poses: {', '.join(missing)}",
        )
    provider = _normalize_cv_provider(req.provider)

    # Idempotent: return existing assessment for same user + scanId
    from ..repositories.assessment_repository import create_assessment as _create

    saved = await _create(
        answers=to_json_safe(req.answers or {}),
        provider=provider,
        analysis={},
        user_id=current_user["id"],
        photos_keys=list(photos_with_front.keys()),
        status="draft",
        scan_id=req.scanId,
        pipeline=new_queued_pipeline(),
        feature_parsing=new_feature_parsing_pending(),
        projected_after=new_projected_after_pending(),
    )

    assessment_id = saved["id"]

    # If duplicate returned and already past upload, skip re-save
    if not pipeline_is_processing(saved.get("pipeline")) and saved.get("analysis", {}).get("cvReport"):
        return {
            "assessmentId": assessment_id,
            "scanId": req.scanId,
            "status": format_report_status(saved["status"]),
            "pipeline": format_pipeline_for_api(saved.get("pipeline")),
            "featureParsing": saved.get("featureParsing"),
            "processing": False,
            "analysis": saved.get("analysis"),
            "photos": saved.get("photos"),
            "aiNarrative": saved.get("aiNarrative"),
            "protocolNarrative": saved.get("protocolNarrative"),
            "featureNarratives": saved.get("featureNarratives"),
            "protocolStorage": saved.get("protocolStorage"),
            "createdAt": saved["createdAt"],
        }

    all_photo_bytes = {**photos_with_front}
    stored = await asyncio.to_thread(save_all_poses, assessment_id, all_photo_bytes, photo_bytes)
    photos_doc = {pose_id: s.to_dict() for pose_id, s in stored.items()}

    await update_assessment_analysis(assessment_id, {}, photos_doc)

    pipeline = format_pipeline_for_api(saved.get("pipeline") or new_queued_pipeline())

    return {
        "assessmentId": assessment_id,
        "scanId": req.scanId,
        "status": "Processing",
        "pipeline": pipeline,
        "featureParsing": saved.get("featureParsing") or new_feature_parsing_pending(),
        "processing": True,
        "photos": photos_doc,
        "createdAt": saved["createdAt"],
    }


@router.post("/assessments/draft")
async def post_assessment_draft(
    req: AssessmentDraftRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create (or reuse) a draft assessment so validated poses can be uploaded to the
    active media backend before the user submits. Idempotent by (user, scanId)."""
    if not is_db_configured():
        raise HTTPException(
            status_code=503,
            detail="Database not configured. Set DATABASE_URL in backend environment.",
        )
    await _require_payment_or_admin(current_user)

    saved = await create_assessment(
        answers={},
        provider="local",
        analysis={},
        user_id=current_user["id"],
        photos_keys=[],
        photos={},
        status="draft",
        scan_id=req.scanId,
        pipeline=None,
        feature_parsing=new_feature_parsing_pending(),
        projected_after=new_projected_after_pending(),
    )
    return {"assessmentId": saved["id"], "scanId": saved.get("scanId")}


@router.put("/assessments/{assessment_id}/photos/{pose_id}")
async def put_assessment_photo(
    assessment_id: str,
    pose_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Store one original-quality pose image (multipart, no re-encode) on a draft."""
    if not is_db_configured():
        raise HTTPException(status_code=503, detail="Database not configured.")
    if pose_id not in ALLOWED_POSE_IDS:
        raise HTTPException(status_code=400, detail=f"Unknown pose: {pose_id}")

    existing = await get_assessment_by_id(assessment_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if not _can_access_assessment(existing, current_user):
        raise HTTPException(status_code=403, detail="You do not have access to this assessment")
    if existing.get("pipeline") is not None:
        raise HTTPException(status_code=400, detail="Assessment already submitted; photos are locked")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty image upload")

    storage = get_photo_storage()
    stored = await asyncio.to_thread(
        storage.save_pose, assessment_id, pose_id, data, file.content_type
    )

    # Atomic single-pose merge under a row lock so concurrent pose uploads
    # cannot clobber each other (lost-update race on the photos JSONB map).
    updated = await upsert_assessment_photo(assessment_id, pose_id, stored.to_dict())
    if updated is None:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return stored.to_dict()


@router.delete("/assessments/{assessment_id}/photos/{pose_id}")
async def delete_assessment_photo(
    assessment_id: str,
    pose_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Remove one stored pose from a draft (object + metadata)."""
    if not is_db_configured():
        raise HTTPException(status_code=503, detail="Database not configured.")
    existing = await get_assessment_by_id(assessment_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if not _can_access_assessment(existing, current_user):
        raise HTTPException(status_code=403, detail="You do not have access to this assessment")
    if existing.get("pipeline") is not None:
        raise HTTPException(status_code=400, detail="Assessment already submitted; photos are locked")

    # Atomically drop the pose under a row lock, then delete the stored object.
    updated, meta = await remove_assessment_photo(assessment_id, pose_id)
    if updated is None:
        raise HTTPException(status_code=404, detail="Assessment not found")
    media = get_media_storage()
    rel = meta.get("relativePath") if isinstance(meta, dict) else None
    key = (media_key_from_ref(str(rel)) or rel) if rel else assessment_key(assessment_id, f"{pose_id}.jpg")
    await asyncio.to_thread(media.delete, key)
    return {"ok": True}


@router.post("/assessments/{assessment_id}/submit")
async def post_assessment_submit(
    assessment_id: str,
    req: AssessmentSubmitRequest,
    current_user: dict = Depends(get_current_user),
):
    """Finalize a draft: verify required poses, persist answers, enqueue the pipeline."""
    if not is_db_configured():
        raise HTTPException(status_code=503, detail="Database not configured.")
    await _require_payment_or_admin(current_user)

    existing = await get_assessment_by_id(assessment_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if not _can_access_assessment(existing, current_user):
        raise HTTPException(status_code=403, detail="You do not have access to this assessment")

    pipeline_existing = existing.get("pipeline") or {}
    # Idempotent: a second submit while processing/ready just echoes current state.
    if pipeline_is_processing(pipeline_existing) or pipeline_existing.get("status") == "ready":
        return {
            "assessmentId": assessment_id,
            "scanId": existing.get("scanId"),
            "status": format_report_status(existing.get("status")),
            "pipeline": format_pipeline_for_api(pipeline_existing),
            "processing": pipeline_is_processing(pipeline_existing),
            "photos": existing.get("photos"),
            "createdAt": existing.get("createdAt"),
        }

    photos = existing.get("photos") or {}
    missing = validate_required_poses(photos)
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required photo poses: {', '.join(missing)}",
        )

    provider = _normalize_cv_provider(req.provider)
    pipeline = new_queued_pipeline()
    await finalize_assessment_for_processing(
        assessment_id,
        answers=to_json_safe(req.answers or {}),
        provider=provider,
        pipeline=pipeline,
    )
    return {
        "assessmentId": assessment_id,
        "scanId": existing.get("scanId"),
        "status": "Processing",
        "pipeline": format_pipeline_for_api(pipeline),
        "processing": True,
        "photos": photos,
        "createdAt": existing.get("createdAt"),
    }


@router.get("/assessments/{assessment_id}/pdf")
async def get_assessment_pdf(
    assessment_id: str,
    current_user: dict = Depends(get_current_user),
):
    if not is_db_configured():
        raise HTTPException(status_code=503, detail="Database not configured.")

    existing = await get_assessment_by_id(assessment_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if not _can_access_assessment(existing, current_user):
        raise HTTPException(status_code=403, detail="You do not have access to this assessment")
    if not is_pdf_allowed_status(existing.get("status")):
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
        headers={"Content-Disposition": f'attachment; filename="MyFace-{assessment_id}.pdf"'},
    )


@router.get("/assessments/{assessment_id}")
async def get_assessment(
    assessment_id: str,
    current_user: Optional[dict] = Depends(get_optional_current_user),
):
    if not is_db_configured():
        raise HTTPException(status_code=503, detail="Database not configured.")

    doc = await get_assessment_by_id(assessment_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if not _can_access_assessment(doc, current_user):
        raise HTTPException(status_code=403, detail="You do not have access to this assessment")
    safe = serialize_assessment(doc)
    # Subject for report/PDF naming — never use the viewer (admin) identity by mistake
    if isinstance(safe, dict) and safe.get("userId"):
        owner = await get_user_by_id(safe["userId"])
        if owner:
            safe["ownerUser"] = {
                "id": owner.get("id"),
                "firstName": owner.get("firstName") or "",
                "lastName": owner.get("lastName") or "",
                "email": owner.get("email") or "",
            }
    return safe


@router.get("/assessments")
async def get_assessments_list(limit: int = 20, current_user: dict = Depends(require_admin)):
    if not is_db_configured():
        raise HTTPException(status_code=503, detail="Database not configured.")
    limit = min(max(1, limit), 100)
    return {"items": serialize_assessments(await list_assessments(limit=limit), summary=True)}


@router.get("/my/assessments/draft")
async def get_my_assessment_draft(current_user: dict = Depends(get_current_user)):
    """Latest in-progress draft (photo uploads without submit). Not listed in GET /my/assessments."""
    if not is_db_configured():
        raise HTTPException(status_code=503, detail="Database not configured.")
    draft = await get_latest_draft_for_user(current_user["id"])
    if not draft:
        return {"item": None}
    return {"item": serialize_assessment(draft)}


@router.get("/my/assessments")
async def get_my_assessments(limit: int = 20, current_user: dict = Depends(get_current_user)):
    if not is_db_configured():
        raise HTTPException(status_code=503, detail="Database not configured.")
    limit = min(max(1, limit), 100)
    return {"items": serialize_assessments(await list_assessments_for_user(current_user["id"], limit=limit), summary=True)}


@router.delete("/assessments")
async def delete_assessments_data(current_user: dict = Depends(require_admin)):
    if not is_db_configured():
        raise HTTPException(status_code=503, detail="Database not configured.")
    return to_json_safe(await delete_all_assessment_data())


@router.delete("/assessments/{assessment_id}")
async def delete_assessment_by_id(
    assessment_id: str,
    current_user: dict = Depends(get_current_user),
):
    if not is_db_configured():
        raise HTTPException(status_code=503, detail="Database not configured.")
    existing = await get_assessment_by_id(assessment_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if not _can_access_assessment(existing, current_user):
        raise HTTPException(status_code=403, detail="You do not have access to this assessment")
    deleted = await delete_assessment(assessment_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Assessment not found")
    await delete_stored_protocol(assessment_id)
    return {"deleted": True, "assessmentId": assessment_id}


@router.patch("/assessments/{assessment_id}/status")
async def patch_assessment_status(
    assessment_id: str,
    req: AssessmentStatusUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    if not is_db_configured():
        raise HTTPException(status_code=503, detail="Database not configured.")
    canonical_status = _parse_status_or_400(req.status)
    existing = await get_assessment_by_id(assessment_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if normalize_report_status(existing.get("status")) == "approved" and canonical_status != "approved":
        raise HTTPException(
            status_code=400,
            detail="Approved reports cannot be moved back to pending review",
        )
    is_admin = current_user.get("role") == "admin"
    is_owner = existing.get("userId") == current_user.get("id")
    if not is_admin:
        raise HTTPException(status_code=403, detail="Only admins can update report status")
    doc = await update_assessment_status(assessment_id, canonical_status)
    return serialize_assessment(doc)


@router.patch("/assessments/{assessment_id}/admin-review")
async def patch_assessment_admin_review(
    assessment_id: str,
    req: AssessmentAdminReviewRequest,
    current_user: dict = Depends(require_admin),
):
    if not is_db_configured():
        raise HTTPException(status_code=503, detail="Database not configured.")
    canonical_status = None
    if req.status is not None:
        canonical_status = _parse_status_or_400(req.status)

    existing = await get_assessment_by_id(assessment_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if (
        normalize_report_status(existing.get("status")) == "approved"
        and canonical_status is not None
        and canonical_status != "approved"
    ):
        raise HTTPException(
            status_code=400,
            detail="Approved reports cannot be moved back to pending review",
        )

    if req.protocolNarrative is not None or req.featureNarratives is not None:
        _reject_narrative_edit_if_approved(existing)

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
        status=canonical_status,
        admin_notes=req.adminNotes,
        ai_narrative=ai_narrative,
        reviewer=reviewer,
    )

    if req.protocolNarrative is not None or req.featureNarratives is not None:
        try:
            persisted = await persist_protocol_bundle(
                assessment_id,
                protocol_narrative=(
                    req.protocolNarrative
                    if req.protocolNarrative is not None
                    else (updated or existing).get("protocolNarrative")
                ),
                feature_narratives=(
                    req.featureNarratives
                    if req.featureNarratives is not None
                    else (updated or existing).get("featureNarratives")
                ),
            )
            if persisted.get("assessment"):
                updated = persisted["assessment"]
            else:
                updated = await get_assessment_by_id(assessment_id) or updated
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Could not save protocol text: {exc}",
            ) from exc

    if ai_narrative is not None and updated:
        try:
            refreshed = await refresh_protocol_closing_for_assessment(updated)
            if refreshed and refreshed.get("assessment"):
                updated = refreshed["assessment"]
            else:
                updated = await get_assessment_by_id(assessment_id) or updated
        except Exception:
            # Admin narrative save succeeded; closing refresh is best-effort
            pass
    return serialize_assessment(updated)


@router.post("/assessments/{assessment_id}/ai-narrative")
async def post_assessment_ai_narrative(
    assessment_id: str,
    force: bool = False,
    current_user: dict = Depends(get_current_user),
):
    """Return stored narrative, or generate once. Admin may pass force=true to regenerate."""
    if not is_db_configured():
        raise HTTPException(status_code=503, detail="Database not configured.")

    await require_paid_ai_access(current_user)

    existing = await get_assessment_by_id(assessment_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Assessment not found")

    if not _can_access_assessment(existing, current_user):
        raise HTTPException(status_code=403, detail="You do not have access to this assessment")

    analysis = existing.get("analysis") or {}
    if not analysis.get("cvReport"):
        raise HTTPException(status_code=400, detail="Stored cvReport is required for AI narrative.")

    # Non-admin callers cannot force-regenerate; always reuse stored content.
    allow_force = force and current_user.get("role") == "admin"
    if not allow_force and existing.get("aiNarrative"):
        content = (existing.get("aiNarrative") or {}).get("content")
        if content or (existing.get("aiNarrative") or {}).get("summary"):
            return serialize_assessment(existing)

    ai_narrative = await ensure_ai_narrative(existing, force=allow_force)
    if not ai_narrative:
        raise HTTPException(status_code=400, detail="AI narrative generation failed.")

    updated = await get_assessment_by_id(assessment_id)
    return serialize_assessment(updated or existing)


@router.post("/assessments/{assessment_id}/ai-visuals")
async def post_assessment_ai_visuals(
    assessment_id: str,
    req: AssessmentVisualsRequest,
    current_user: dict = Depends(get_current_user),
):
    if not is_db_configured():
        raise HTTPException(status_code=503, detail="Database not configured.")

    await require_paid_ai_access(current_user)

    existing = await get_assessment_by_id(assessment_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if not _can_access_assessment(existing, current_user):
        raise HTTPException(status_code=403, detail="You do not have access to this assessment")

    analysis = existing.get("analysis") or {}
    cv_report = analysis.get("cvReport")
    if not cv_report:
        raise HTTPException(status_code=400, detail="Stored cvReport is required for AI visuals.")

    projected = existing.get("projectedAfter") or {}
    if projected.get("status") != "ready":
        raise HTTPException(
            status_code=400,
            detail="Projected AFTER must be ready before generating AI visuals.",
        )
    if not load_projected_full(assessment_id, projected):
        raise HTTPException(
            status_code=400,
            detail="Projected AFTER image could not be loaded.",
        )

    try:
        ai_visuals = await generate_visual_variants(
            answers=existing.get("answers") or {},
            cv_report=cv_report,
            metrics=analysis.get("metrics"),
            variant_types=req.variants,
            assessment_id=assessment_id,
            projected_after=projected,
            require_projected_after=True,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"AI visuals generation failed: {exc}",
        ) from exc
    updated = await update_assessment_ai_visuals(assessment_id, ai_visuals)
    return serialize_assessment(updated)


@router.get("/assessments/{assessment_id}/protocol")
async def get_assessment_protocol(
    assessment_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Load persisted protocol bundle from storage (Database fallback)."""
    if not is_db_configured():
        raise HTTPException(status_code=503, detail="Database not configured.")

    existing = await get_assessment_by_id(assessment_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if not _can_access_assessment(existing, current_user):
        raise HTTPException(status_code=403, detail="You do not have access to this assessment")

    bundle = load_protocol_bundle(assessment_id, existing)
    if not bundle or not (
        bundle.get("protocolNarrative") or bundle.get("featureNarratives")
    ):
        raise HTTPException(status_code=404, detail="Protocol not generated for this assessment.")

    if bundle.get("source") == "database":
        await persist_protocol_bundle(
            assessment_id,
            protocol_narrative=bundle.get("protocolNarrative"),
            feature_narratives=bundle.get("featureNarratives"),
        )

    return to_json_safe(bundle)


@router.post("/assessments/{assessment_id}/ai-protocol")
async def post_assessment_ai_protocol(
    assessment_id: str,
    force: bool = False,
    current_user: dict = Depends(get_current_user),
):
    """Generate protocol once, persist to storage + Database. Admin may force regenerate."""
    if not is_db_configured():
        raise HTTPException(status_code=503, detail="Database not configured.")

    await require_paid_ai_access(current_user)

    existing = await get_assessment_by_id(assessment_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if not _can_access_assessment(existing, current_user):
        raise HTTPException(status_code=403, detail="You do not have access to this assessment")

    analysis = existing.get("analysis") or {}
    if not analysis.get("cvReport"):
        raise HTTPException(status_code=400, detail="Stored cvReport is required for AI protocol.")

    _reject_narrative_edit_if_approved(existing)

    allow_force = force and current_user.get("role") == "admin"
    if force and not allow_force:
        raise HTTPException(status_code=403, detail="Only admins can force-regenerate protocol text")

    try:
        bundle = await generate_and_store_protocol(existing, force=allow_force)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"AI protocol generation failed: {exc}",
        ) from exc
    updated = bundle.get("assessment") or existing
    return serialize_assessment(updated)


@router.post("/assessments/{assessment_id}/ai-protocol/section")
async def post_assessment_ai_protocol_section(
    assessment_id: str,
    req: ProtocolSectionRequest,
    current_user: dict = Depends(require_admin),
):
    """Admin: regenerate one protocol overview / closing / feature section."""
    if not is_db_configured():
        raise HTTPException(status_code=503, detail="Database not configured.")

    await require_paid_ai_access(current_user)

    existing = await get_assessment_by_id(assessment_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Assessment not found")

    analysis = existing.get("analysis") or {}
    if not analysis.get("cvReport"):
        raise HTTPException(status_code=400, detail="Stored cvReport is required for AI protocol.")

    _reject_narrative_edit_if_approved(existing)

    try:
        bundle = await regenerate_protocol_section(existing, req.sectionId)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Section generation failed: {exc}",
        ) from exc

    updated = bundle.get("assessment") or await get_assessment_by_id(assessment_id) or existing
    return serialize_assessment(updated)


@router.post("/assessments/{assessment_id}/projected-after")
async def post_assessment_projected_after(
    assessment_id: str,
    current_user: dict = Depends(require_admin),
):
    """Admin: generate/overwrite projected AFTER image (ignores PROJECTED_AFTER_ENABLED)."""
    if not is_db_configured():
        raise HTTPException(status_code=503, detail="Database not configured.")

    existing = await get_assessment_by_id(assessment_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Assessment not found")

    from ..pipeline_stages import generate_projected_after_now

    try:
        updated = await generate_projected_after_now(
            existing,
            respect_enabled_flag=False,
            raise_on_error=True,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Projected AFTER generation failed: {exc}",
        ) from exc

    return serialize_assessment(updated)


@router.post("/assessments/{assessment_id}/retry-pipeline")
async def post_retry_pipeline(
    assessment_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Re-enqueue a failed pipeline job (admin or owner)."""
    if not is_db_configured():
        raise HTTPException(status_code=503, detail="Database not configured.")

    existing = await get_assessment_by_id(assessment_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if not _can_access_assessment(existing, current_user):
        raise HTTPException(status_code=403, detail="You do not have access to this assessment")

    pipeline = existing.get("pipeline") or {}
    if pipeline.get("status") in ("queued", "running"):
        return serialize_assessment(existing)
    if pipeline.get("status") == "ready":
        raise HTTPException(status_code=400, detail="Pipeline already completed")
    if pipeline.get("status") != "failed" and pipeline.get("status") is not None:
        raise HTTPException(status_code=400, detail="Pipeline is not in a failed state")

    updated = await requeue_failed_pipeline(assessment_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return serialize_assessment(updated)
