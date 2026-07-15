"""Pipeline stage handlers — CV, NL enrichment, face parsing."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional

from .analyze_face import run_face_analysis
from .dev_config import dev_auto_approve_reports
from .face_parsing import (
    extract_feature_crops,
    extract_lips_crop_from_front_landmarks,
    extract_profile_ear_crop,
    extract_smile_crop_from_smile_pose,
    face_parsing_enabled,
    run_face_parsing_on_image,
)
from .face_parsing_metrics import compute_parsing_metrics
from .media_storage import assessment_key, get_media_storage, public_url_for_key
from .photo_storage import (
    apply_photo_urls_to_cv_report,
    load_projected_full,
    photos_map_to_urls,
    save_parsing_crop,
    save_projected_full,
)
from .pipeline_status import _utcnow_iso, new_feature_parsing_pending
from .projected_after_ai import generate_projected_after_bytes, projected_after_enabled
from .projected_after_status import merge_projected_after_update, new_projected_after_pending
from .projected_analysis_status import (
    merge_projected_analysis_update,
    new_projected_analysis_pending,
)
from .protocol_service import enrich_assessment_nl_content
from .repositories.assessment_repository import (
    get_assessment_by_id,
    update_assessment_analysis,
    update_assessment_feature_parsing,
    update_assessment_pipeline,
    update_assessment_projected_after,
    update_assessment_projected_analysis,
)
from .serialization import to_json_safe

logger = logging.getLogger(__name__)


def _load_pose_bytes(assessment_id: str, pose_id: str) -> Optional[bytes]:
    return get_media_storage().get_bytes(assessment_key(assessment_id, f"{pose_id}.jpg"))


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
        photo_urls = {
            pid: public_url_for_key(assessment_key(assessment_id, f"{pid}.jpg"))
            for pid in photos_bytes
        }

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

        if landmarks:
            try:
                lips_crops = await asyncio.to_thread(
                    extract_lips_crop_from_front_landmarks,
                    front_bytes,
                    landmarks,
                )
                crops_data.update(lips_crops)
            except Exception:
                logger.exception("Front landmark lips crop failed for %s", assessment_id)

        smile_bytes = _load_pose_bytes(assessment_id, "smile")
        if smile_bytes:
            try:
                smile_crops = await asyncio.to_thread(extract_smile_crop_from_smile_pose, smile_bytes)
                crops_data.update(smile_crops)
            except Exception:
                logger.exception("Smile mesh crop failed for %s", assessment_id)

        for pose_id, crop_key in (("leftProfile", "earsLeft"), ("rightProfile", "earsRight")):
            pose_bytes = _load_pose_bytes(assessment_id, pose_id)
            if not pose_bytes:
                continue
            try:
                ear = await asyncio.to_thread(extract_profile_ear_crop, pose_bytes, pose_id)
                if ear:
                    crops_data[crop_key] = ear
            except Exception:
                logger.exception("Profile ear crop failed (%s) for %s", pose_id, assessment_id)

        # Aggregate ears hero entry for single-key consumers
        left_ear = crops_data.get("earsLeft")
        right_ear = crops_data.get("earsRight")
        if left_ear or right_ear:
            primary = left_ear or right_ear
            crops_data["ears"] = {
                **primary,
                "labels": ["left_ear", "right_ear"],
                "sourcePose": "profiles",
            }

        crops_out: dict[str, Any] = {}
        for feature_id, crop in crops_data.items():
            stored = await asyncio.to_thread(
                save_parsing_crop,
                assessment_id,
                feature_id,
                crop["jpegBytes"],
            )
            meta: dict[str, Any] = {
                "publicUrl": stored.publicUrl,
                "bbox": crop["bbox"],
                "labels": crop["labels"],
            }
            if crop.get("sourcePose"):
                meta["sourcePose"] = crop["sourcePose"]
            if crop.get("sourceMethod"):
                meta["sourceMethod"] = crop["sourceMethod"]
            crops_out[feature_id] = meta

        if crops_out.get("earsLeft") or crops_out.get("earsRight"):
            ears_meta = dict(crops_out.get("ears") or {})
            if crops_out.get("earsLeft"):
                ears_meta["leftPublicUrl"] = crops_out["earsLeft"]["publicUrl"]
            if crops_out.get("earsRight"):
                ears_meta["rightPublicUrl"] = crops_out["earsRight"]["publicUrl"]
            crops_out["ears"] = ears_meta

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


async def _mark_projected_analysis_skipped(assessment_id: str, existing: Optional[dict] = None) -> None:
    payload = merge_projected_analysis_update(
        existing,
        status="skipped",
        cvReport=None,
        landmarks=None,
        metrics=None,
        eyeAnalysis=None,
        error=None,
    )
    await update_assessment_projected_analysis(assessment_id, payload)


async def run_projected_analysis_now(assessment: dict) -> dict:
    """Run MediaPipe/OpenCV CV on projected AFTER full image → projected_analysis.

    Never mutates BEFORE analysis / analysis.cvReport.
    Soft-fails into projected_analysis.status=failed without touching projected_after.
    """
    assessment_id = assessment["id"]
    refreshed = await get_assessment_by_id(assessment_id)
    if not refreshed:
        raise RuntimeError("Assessment not found for projected analysis")

    existing = refreshed.get("projectedAnalysis")
    pa_meta = refreshed.get("projectedAfter") or {}
    if pa_meta.get("status") != "ready":
        await _mark_projected_analysis_skipped(assessment_id, existing)
        return await get_assessment_by_id(assessment_id) or refreshed

    running = merge_projected_analysis_update(
        existing or new_projected_analysis_pending(),
        status="running",
        error=None,
    )
    await update_assessment_projected_analysis(assessment_id, running)

    after_bytes = await asyncio.to_thread(load_projected_full, assessment_id, pa_meta)
    if not after_bytes:
        failed = merge_projected_analysis_update(
            running,
            status="failed",
            error="Projected AFTER image missing on disk",
            cvReport=None,
            landmarks=None,
            metrics=None,
            eyeAnalysis=None,
        )
        await update_assessment_projected_analysis(assessment_id, failed)
        return await get_assessment_by_id(assessment_id) or refreshed

    answers = refreshed.get("answers") or {}
    # Single-image CV: projected full as front only (no multi-view pose enrichments)
    result = await asyncio.to_thread(run_face_analysis, after_bytes, answers, {})

    if not result.get("success"):
        failed = merge_projected_analysis_update(
            running,
            status="failed",
            error=result.get("error") or "Projected AFTER CV failed",
            cvReport=None,
            landmarks=None,
            metrics=None,
            eyeAnalysis=None,
        )
        await update_assessment_projected_analysis(assessment_id, failed)
        return await get_assessment_by_id(assessment_id) or refreshed

    ready = merge_projected_analysis_update(
        running,
        status="ready",
        source="projected_full",
        cvReport=to_json_safe(result.get("cvReport")),
        landmarks=to_json_safe(result.get("landmarks")),
        metrics=to_json_safe(result.get("metrics")),
        eyeAnalysis=to_json_safe(result.get("eyeAnalysis")),
        error=None,
    )
    await update_assessment_projected_analysis(assessment_id, ready)
    return await get_assessment_by_id(assessment_id) or refreshed


async def generate_projected_after_now(
    assessment: dict,
    *,
    respect_enabled_flag: bool = True,
    raise_on_error: bool = False,
) -> dict:
    """Generate and persist full-face projected AFTER.

    When respect_enabled_flag=False (admin), always run even if PROJECTED_AFTER_ENABLED=false.
    When raise_on_error=True, raise instead of soft-failing into failed status.
    On success, also runs CV into projected_analysis (BEFORE analysis untouched).
    """
    assessment_id = assessment["id"]
    refreshed = await get_assessment_by_id(assessment_id)
    if not refreshed:
        raise RuntimeError("Assessment not found for projected AFTER")

    pa = dict(refreshed.get("projectedAfter") or new_projected_after_pending())
    pa["status"] = "running"
    pa["updatedAt"] = _utcnow_iso()
    await update_assessment_projected_after(assessment_id, pa)

    if respect_enabled_flag and not projected_after_enabled():
        pa = merge_projected_after_update(pa, status="skipped", lastError=None)
        await update_assessment_projected_after(assessment_id, pa)
        await _mark_projected_analysis_skipped(assessment_id, refreshed.get("projectedAnalysis"))
        return await get_assessment_by_id(assessment_id) or refreshed

    analysis = refreshed.get("analysis") or {}
    cv_report = analysis.get("cvReport") or {}
    metrics = analysis.get("metrics")
    front_bytes = _load_pose_bytes(assessment_id, "front")
    if not front_bytes:
        # No source portrait yet — keep pending (retryable) so it re-runs once photos exist.
        msg = "Front photo missing"
        pa = merge_projected_after_update(pa, status="pending", lastError=msg)
        await update_assessment_projected_after(assessment_id, pa)
        await _mark_projected_analysis_skipped(assessment_id, refreshed.get("projectedAnalysis"))
        if raise_on_error:
            raise ValueError(msg)
        return await get_assessment_by_id(assessment_id) or refreshed

    # Generative AFTER (OpenAI Images Edits / OpenRouter chat image modalities).
    try:
        result = await generate_projected_after_bytes(
            front_bytes=front_bytes,
            answers=refreshed.get("answers") or {},
            cv_report=cv_report,
            metrics=metrics,
        )
    except Exception as exc:  # noqa: BLE001 — treated as retryable below
        logger.exception("Projected AFTER generation crashed for %s", assessment_id)
        result = {"imageBytes": None, "error": str(exc) or "Image generation crashed."}

    image_bytes = result.get("imageBytes")
    if not image_bytes:
        # Provider unavailable / failed — mark pending (retryable), do not run AFTER CV.
        msg = result.get("error") or "Image generation returned no image."
        pa = merge_projected_after_update(
            pa,
            status="pending",
            lastError=msg,
            provider=result.get("provider"),
            model=result.get("model"),
        )
        await update_assessment_projected_after(assessment_id, pa)
        await _mark_projected_analysis_skipped(assessment_id, refreshed.get("projectedAnalysis"))
        if raise_on_error:
            raise RuntimeError(f"Projected AFTER generation unavailable: {msg}")
        return await get_assessment_by_id(assessment_id) or refreshed

    try:
        stored = await asyncio.to_thread(save_projected_full, assessment_id, image_bytes)
    except Exception as exc:
        logger.exception("Projected AFTER save failed for %s", assessment_id)
        if raise_on_error:
            raise
        pa = merge_projected_after_update(pa, status="pending", lastError=str(exc))
        await update_assessment_projected_after(assessment_id, pa)
        await _mark_projected_analysis_skipped(assessment_id, refreshed.get("projectedAnalysis"))
        return await get_assessment_by_id(assessment_id) or refreshed

    pa = merge_projected_after_update(
        pa,
        status="ready",
        full={"publicUrl": stored.publicUrl, "relativePath": stored.relativePath},
        lastError=None,
        provider=result.get("provider"),
        model=result.get("model"),
    )
    await update_assessment_projected_after(assessment_id, pa)

    # AFTER image ready — run CV into projected_analysis (does not touch analysis)
    return await run_projected_analysis_now({"id": assessment_id})


async def run_projected_after_stage(assessment: dict) -> dict:
    """Full-face projected AFTER JPEG into projected_after JSONB (pipeline; soft-skip/soft-fail)."""
    return await generate_projected_after_now(
        assessment,
        respect_enabled_flag=True,
        raise_on_error=False,
    )


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
