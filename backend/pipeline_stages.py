"""Pipeline stage handlers — CV, NL enrichment, face parsing."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional

from .analyze_face import run_face_analysis
from .dev_config import dev_auto_approve_reports
from .face_parsing import extract_feature_crops, face_parsing_enabled, run_face_parsing_on_image
from .face_parsing_metrics import compute_parsing_metrics
from .photo_storage import (
    apply_photo_urls_to_cv_report,
    get_photo_storage,
    photos_map_to_urls,
    save_parsing_crop,
)
from .pipeline_status import _utcnow_iso, new_feature_parsing_pending
from .protocol_service import enrich_assessment_nl_content
from .repositories.assessment_repository import (
    get_assessment_by_id,
    update_assessment_analysis,
    update_assessment_feature_parsing,
    update_assessment_pipeline,
)
from .serialization import to_json_safe

logger = logging.getLogger(__name__)


def _load_pose_bytes(assessment_id: str, pose_id: str) -> Optional[bytes]:
    storage = get_photo_storage()
    path = storage.upload_root / assessment_id / f"{pose_id}.jpg"
    if not path.exists():
        return None
    return path.read_bytes()


def _decode_all_poses(assessment_id: str, photos_meta: dict) -> dict[str, bytes]:
    out: dict[str, bytes] = {}
    for pose_id in photos_meta or {}:
        data = _load_pose_bytes(assessment_id, pose_id)
        if data:
            out[pose_id] = data
    if "front" not in out:
        front = _load_pose_bytes(assessment_id, "front")
        if front:
            out["front"] = front
    return out


async def run_cv_stage(assessment: dict) -> dict:
    """MediaPipe multi-view analysis; persist analysis + photo URLs."""
    assessment_id = assessment["id"]
    photos_meta = assessment.get("photos") or {}
    photos_bytes = await asyncio.to_thread(_decode_all_poses, assessment_id, photos_meta)
    if not photos_bytes.get("front"):
        raise RuntimeError("Front photo missing on disk for CV stage")

    front_bytes = photos_bytes["front"]
    analysis = await asyncio.to_thread(
        run_face_analysis,
        front_bytes,
        assessment.get("answers") or {},
        photos_bytes,
        assessment.get("provider") or "local",
    )
    if not analysis.get("success"):
        raise RuntimeError(analysis.get("error") or "CV analysis failed")

    analysis = to_json_safe(analysis)
    photo_urls = {
        pose_id: (meta.get("publicUrl") if isinstance(meta, dict) else meta)
        for pose_id, meta in photos_meta.items()
        if isinstance(meta, dict) and meta.get("publicUrl")
    }
    if not photo_urls:
        photo_urls = {pid: f"/uploads/assessments/{assessment_id}/{pid}.jpg" for pid in photos_bytes}

    if analysis.get("cvReport") and photo_urls:
        analysis["cvReport"] = apply_photo_urls_to_cv_report(analysis["cvReport"], photo_urls)

    updated = await update_assessment_analysis(assessment_id, analysis, photos_meta)
    if not updated:
        raise RuntimeError("Failed to persist CV analysis")
    return updated


async def run_narratives_stage(assessment: dict) -> dict:
    """Executive + protocol NL enrichment (soft-fail on errors)."""
    refreshed = await get_assessment_by_id(assessment["id"])
    if not refreshed:
        raise RuntimeError("Assessment not found for narratives stage")
    return await enrich_assessment_nl_content(refreshed)


async def run_parsing_stage(assessment: dict) -> dict:
    """SegFormer crops + assumed-scale metrics into feature_parsing."""
    assessment_id = assessment["id"]
    refreshed = await get_assessment_by_id(assessment_id)
    if not refreshed:
        raise RuntimeError("Assessment not found for parsing stage")

    analysis = refreshed.get("analysis") or {}
    landmarks = analysis.get("landmarks") or []
    front_bytes = _load_pose_bytes(assessment_id, "front")
    if not front_bytes:
        raise RuntimeError("Front photo missing for parsing stage")

    fp = dict(refreshed.get("featureParsing") or new_feature_parsing_pending())
    fp["status"] = "running"
    fp["updatedAt"] = _utcnow_iso()
    await update_assessment_feature_parsing(assessment_id, fp)

    if not face_parsing_enabled():
        fp["status"] = "failed"
        fp["lastError"] = "Face parsing disabled or PyTorch/transformers not installed"
        fp["updatedAt"] = _utcnow_iso()
        await update_assessment_feature_parsing(assessment_id, fp)
        return refreshed

    try:
        image_rgb, labels = await asyncio.to_thread(run_face_parsing_on_image, front_bytes)
        h, w = image_rgb.shape[:2]
        crops_data = await asyncio.to_thread(extract_feature_crops, labels, image_rgb)
        metrics = compute_parsing_metrics(landmarks, w, h, labels)

        crops_out: dict[str, Any] = {}
        for feature_id, crop in crops_data.items():
            stored = await asyncio.to_thread(
                save_parsing_crop,
                assessment_id,
                feature_id,
                crop["jpegBytes"],
            )
            crops_out[feature_id] = {
                "publicUrl": stored.publicUrl,
                "bbox": crop["bbox"],
                "labels": crop["labels"],
            }

        fp["status"] = "ready"
        fp["crops"] = crops_out
        fp["metrics"] = metrics
        fp["lastError"] = None
        fp["updatedAt"] = _utcnow_iso()
        await update_assessment_feature_parsing(assessment_id, fp)
    except Exception as exc:
        logger.exception("Face parsing failed for %s", assessment_id)
        fp["status"] = "failed"
        fp["lastError"] = str(exc)
        fp["updatedAt"] = _utcnow_iso()
        await update_assessment_feature_parsing(assessment_id, fp)

    return await get_assessment_by_id(assessment_id) or refreshed


async def finalize_pipeline(assessment_id: str) -> Optional[dict]:
    """Mark pipeline ready and set workflow status."""
    from .pipeline_status import merge_pipeline_update

    existing = await get_assessment_by_id(assessment_id)
    workflow = "approved" if dev_auto_approve_reports() else "pending_review"
    pipeline = merge_pipeline_update(
        existing.get("pipeline") if existing else None,
        status="ready",
        stage="done",
        completedAt=_utcnow_iso(),
        estimatedMinutesRemaining=0,
    )
    return await update_assessment_pipeline(assessment_id, pipeline, status=workflow)
