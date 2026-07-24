"""PostgreSQL persistence for facial assessments."""

from __future__ import annotations

import copy
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.attributes import flag_modified

from ..database import session_scope
from ..models import Assessment, AssessmentStatus, Conversation
from ._helpers import enum_val, iso, parse_uuid


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _is_active(row: Optional[Assessment]) -> bool:
    return bool(row) and row.deleted_at is None


def _assessment_to_dict(row: Assessment) -> dict:
    return {
        "id": str(row.id),
        "status": enum_val(row.status),
        "userId": str(row.user_id) if row.user_id else None,
        "scanId": row.scan_id,
        "provider": row.provider,
        "answers": row.answers or {},
        "photosKeys": row.photos_keys or [],
        "photos": row.photos or {},
        "analysis": row.analysis or {},
        "aiNarrative": row.ai_narrative,
        "protocolNarrative": row.protocol_narrative,
        "featureNarratives": row.feature_narratives,
        "protocolStorage": row.protocol_storage,
        "aiVisuals": row.ai_visuals,
        "pipeline": row.pipeline,
        "featureParsing": row.feature_parsing,
        "projectedAfter": row.projected_after,
        "projectedAnalysis": row.projected_analysis,
        "adminNotes": row.admin_notes,
        "reviewedBy": row.reviewed_by or {},
        "reviewedAt": iso(row.reviewed_at),
        "reviewLog": row.review_log or [],
        "createdAt": iso(row.created_at),
        "updatedAt": iso(row.updated_at),
        "deletedAt": iso(row.deleted_at),
    }


def _summary_dict(row: Assessment) -> dict:
    full = _assessment_to_dict(row)
    analysis = full.get("analysis") or {}
    cv = analysis.get("cvReport") or {}
    slim_analysis: dict[str, Any] = {}
    if "metrics" in analysis:
        slim_analysis["metrics"] = analysis["metrics"]
    slim_cv: dict[str, Any] = {}
    if "overall" in cv:
        slim_cv["overall"] = cv["overall"]
    for key in ("symmetry", "proportions", "skin", "structure", "jaw", "jawChin"):
        section = cv.get(key)
        if isinstance(section, dict) and "score" in section:
            slim_cv[key] = {"score": section["score"]}
    if slim_cv:
        slim_analysis["cvReport"] = slim_cv
    return {
        "id": full["id"],
        "status": full["status"],
        "userId": full["userId"],
        "provider": full["provider"],
        "scanId": full["scanId"],
        "createdAt": full["createdAt"],
        "updatedAt": full["updatedAt"],
        "pipeline": full.get("pipeline"),
        "analysis": slim_analysis,
    }


async def create_assessment(
    *,
    answers: dict,
    provider: str,
    analysis: dict,
    user_id: Optional[str] = None,
    photos_keys: Optional[list[str]] = None,
    photos: Optional[dict] = None,
    status: str = "draft",
    scan_id: Optional[str] = None,
    pipeline: Optional[dict] = None,
    feature_parsing: Optional[dict] = None,
    projected_after: Optional[dict] = None,
    projected_analysis: Optional[dict] = None,
) -> dict:
    uid = parse_uuid(user_id) if user_id else None
    if scan_id and uid:
        async with session_scope() as session:
            existing = await session.execute(
                select(Assessment).where(
                    Assessment.user_id == uid,
                    Assessment.scan_id == scan_id,
                    Assessment.deleted_at.is_(None),
                )
            )
            row = existing.scalar_one_or_none()
            if row:
                return _assessment_to_dict(row)

    now = _utcnow()
    try:
        status_enum = AssessmentStatus(status)
    except ValueError:
        status_enum = AssessmentStatus.draft

    row = Assessment(
        user_id=uid,
        status=status_enum,
        scan_id=scan_id,
        provider=provider,
        answers=answers or {},
        photos=photos or {},
        photos_keys=photos_keys or [],
        analysis=analysis or {},
        pipeline=pipeline,
        feature_parsing=feature_parsing,
        projected_after=projected_after,
        projected_analysis=projected_analysis,
        created_at=now,
        updated_at=now,
    )
    try:
        async with session_scope() as session:
            session.add(row)
            await session.flush()
            return _assessment_to_dict(row)
    except IntegrityError:
        if scan_id and uid:
            async with session_scope() as session:
                existing = await session.execute(
                    select(Assessment).where(
                        Assessment.user_id == uid,
                        Assessment.scan_id == scan_id,
                        Assessment.deleted_at.is_(None),
                    )
                )
                found = existing.scalar_one_or_none()
                if found:
                    return _assessment_to_dict(found)
        raise


async def get_assessment_by_id(assessment_id: str) -> Optional[dict]:
    aid = parse_uuid(assessment_id)
    if aid is None:
        return None
    async with session_scope() as session:
        row = await session.get(Assessment, aid)
        if not _is_active(row):
            return None
        return _assessment_to_dict(row)


ASSESSMENT_SUMMARY_PROJECTION = {}  # kept for import compatibility; summary shaping is in _summary_dict


async def list_assessments(limit: int = 20, *, summary: bool = True) -> list[dict]:
    async with session_scope() as session:
        result = await session.execute(
            select(Assessment)
            .where(Assessment.deleted_at.is_(None))
            .order_by(Assessment.created_at.desc())
            .limit(limit)
        )
        rows = result.scalars().all()
        mapper = _summary_dict if summary else _assessment_to_dict
        return [mapper(r) for r in rows]


async def count_submitted_assessments_for_user(
    user_id: str,
    *,
    include_deleted: bool = False,
) -> int:
    """Count submitted assessments. Soft-deleted excluded unless include_deleted=True (access unlock)."""
    uid = parse_uuid(user_id)
    if uid is None:
        return 0
    clauses = [
        Assessment.user_id == uid,
        Assessment.status != AssessmentStatus.draft,
        Assessment.pipeline.isnot(None),
    ]
    if not include_deleted:
        clauses.append(Assessment.deleted_at.is_(None))
    async with session_scope() as session:
        result = await session.execute(
            select(func.count()).select_from(Assessment).where(*clauses)
        )
        return int(result.scalar() or 0)


async def get_assessment_by_user_scan(user_id: str, scan_id: str) -> Optional[dict]:
    uid = parse_uuid(user_id)
    if uid is None or not scan_id:
        return None
    async with session_scope() as session:
        result = await session.execute(
            select(Assessment).where(
                Assessment.user_id == uid,
                Assessment.scan_id == scan_id,
                Assessment.deleted_at.is_(None),
            )
        )
        row = result.scalar_one_or_none()
        return _assessment_to_dict(row) if row else None


async def list_assessments_for_user(user_id: str, limit: int = 20, *, summary: bool = True) -> list[dict]:
    uid = parse_uuid(user_id)
    if uid is None:
        return []
    async with session_scope() as session:
        result = await session.execute(
            select(Assessment)
            .where(
                Assessment.user_id == uid,
                # Submitted only — hide photo-only drafts until POST …/submit.
                Assessment.status != AssessmentStatus.draft,
                Assessment.pipeline.isnot(None),
                Assessment.deleted_at.is_(None),
            )
            .order_by(Assessment.created_at.desc())
            .limit(limit)
        )
        rows = result.scalars().all()
        mapper = _summary_dict if summary else _assessment_to_dict
        return [mapper(r) for r in rows]


async def get_latest_draft_for_user(user_id: str) -> Optional[dict]:
    """Latest in-progress draft (photos may be uploaded; not submitted)."""
    uid = parse_uuid(user_id)
    if uid is None:
        return None
    async with session_scope() as session:
        result = await session.execute(
            select(Assessment)
            .where(
                Assessment.user_id == uid,
                Assessment.status == AssessmentStatus.draft,
                Assessment.pipeline.is_(None),
                Assessment.deleted_at.is_(None),
            )
            .order_by(Assessment.updated_at.desc())
            .limit(1)
        )
        row = result.scalar_one_or_none()
        return _assessment_to_dict(row) if row else None


async def delete_assessment(assessment_id: str) -> bool:
    """Soft-delete an assessment. Soft-deleted rows still count toward package limits."""
    aid = parse_uuid(assessment_id)
    if aid is None:
        return False
    async with session_scope() as session:
        row = await session.get(Assessment, aid)
        if not _is_active(row):
            return False
        now = _utcnow()
        row.deleted_at = now
        row.updated_at = now
        return True


async def delete_all_assessment_data() -> dict:
    async with session_scope() as session:
        conversations = await session.execute(delete(Conversation))
        assessments = await session.execute(delete(Assessment))
        return {
            "assessmentsDeleted": assessments.rowcount or 0,
            "conversationsDeleted": conversations.rowcount or 0,
        }


async def update_assessment_status(assessment_id: str, status: str) -> Optional[dict]:
    aid = parse_uuid(assessment_id)
    if aid is None:
        return None
    async with session_scope() as session:
        row = await session.get(Assessment, aid)
        if not _is_active(row):
            return None
        try:
            row.status = AssessmentStatus(status)
        except ValueError:
            return None
        row.updated_at = _utcnow()
        await session.flush()
        return _assessment_to_dict(row)


async def update_assessment_admin_review(
    assessment_id: str,
    *,
    status: Optional[str] = None,
    admin_notes: Optional[str] = None,
    ai_narrative: Optional[dict] = None,
    reviewer: Optional[dict] = None,
) -> Optional[dict]:
    aid = parse_uuid(assessment_id)
    if aid is None:
        return None
    now = _utcnow()
    async with session_scope() as session:
        row = await session.get(Assessment, aid)
        if not _is_active(row):
            return None
        row.updated_at = now
        row.reviewed_at = now
        row.reviewed_by = reviewer or {}
        if status is not None:
            try:
                row.status = AssessmentStatus(status)
            except ValueError:
                pass
        if admin_notes is not None:
            row.admin_notes = admin_notes
        if ai_narrative is not None:
            row.ai_narrative = ai_narrative
        log = list(row.review_log or [])
        log.append(
            {
                "at": now.isoformat(),
                "reviewer": reviewer or {},
                "status": status,
                "editedAiNarrative": ai_narrative is not None,
                "hasAdminNotes": bool(admin_notes),
            }
        )
        row.review_log = log
        flag_modified(row, "review_log")
        flag_modified(row, "reviewed_by")
        await session.flush()
        return _assessment_to_dict(row)


async def update_assessment_analysis(
    assessment_id: str, analysis: dict, photos: Optional[dict] = None
) -> Optional[dict]:
    aid = parse_uuid(assessment_id)
    if aid is None:
        return None
    async with session_scope() as session:
        row = await session.get(Assessment, aid)
        if not _is_active(row):
            return None
        row.analysis = analysis
        row.updated_at = _utcnow()
        if photos is not None:
            row.photos = photos
            row.photos_keys = list(photos.keys())
            flag_modified(row, "photos")
            flag_modified(row, "photos_keys")
        flag_modified(row, "analysis")
        await session.flush()
        return _assessment_to_dict(row)


async def set_assessment_photos(assessment_id: str, photos: dict) -> Optional[dict]:
    """Replace the stored per-pose photo metadata + keys (used during draft upload)."""
    aid = parse_uuid(assessment_id)
    if aid is None:
        return None
    async with session_scope() as session:
        row = await session.get(Assessment, aid)
        if not _is_active(row):
            return None
        row.photos = photos or {}
        row.photos_keys = list((photos or {}).keys())
        row.updated_at = _utcnow()
        flag_modified(row, "photos")
        flag_modified(row, "photos_keys")
        await session.flush()
        return _assessment_to_dict(row)


async def upsert_assessment_photo(
    assessment_id: str, pose_id: str, meta: dict
) -> Optional[dict]:
    """Atomically merge a single pose into the photos map (concurrency-safe).

    Locks the row (``SELECT ... FOR UPDATE``) so parallel per-pose uploads cannot
    clobber each other via read-modify-write of the whole JSONB map.
    """
    aid = parse_uuid(assessment_id)
    if aid is None:
        return None
    async with session_scope() as session:
        row = await session.get(Assessment, aid, with_for_update=True)
        if not _is_active(row):
            return None
        photos = dict(row.photos or {})
        photos[pose_id] = meta
        row.photos = photos
        row.photos_keys = list(photos.keys())
        row.updated_at = _utcnow()
        flag_modified(row, "photos")
        flag_modified(row, "photos_keys")
        await session.flush()
        return _assessment_to_dict(row)


async def remove_assessment_photo(
    assessment_id: str, pose_id: str
) -> tuple[Optional[dict], Optional[Any]]:
    """Atomically remove a single pose from the photos map (concurrency-safe).

    Returns ``(updated_assessment, removed_meta)``; ``removed_meta`` is ``None`` when
    the pose was not present. Locks the row so it cannot race a concurrent upsert.
    """
    aid = parse_uuid(assessment_id)
    if aid is None:
        return None, None
    async with session_scope() as session:
        row = await session.get(Assessment, aid, with_for_update=True)
        if not _is_active(row):
            return None, None
        photos = dict(row.photos or {})
        removed = photos.pop(pose_id, None)
        row.photos = photos
        row.photos_keys = list(photos.keys())
        row.updated_at = _utcnow()
        flag_modified(row, "photos")
        flag_modified(row, "photos_keys")
        await session.flush()
        return _assessment_to_dict(row), removed


async def finalize_assessment_for_processing(
    assessment_id: str,
    *,
    answers: dict,
    provider: str,
    pipeline: dict,
) -> Optional[dict]:
    """Persist answers/provider and enqueue the async pipeline on a draft."""
    aid = parse_uuid(assessment_id)
    if aid is None:
        return None
    async with session_scope() as session:
        row = await session.get(Assessment, aid)
        if not _is_active(row):
            return None
        row.answers = answers or {}
        row.provider = provider
        row.pipeline = pipeline
        row.status = AssessmentStatus.pending_review
        row.updated_at = _utcnow()
        flag_modified(row, "answers")
        flag_modified(row, "pipeline")
        await session.flush()
        return _assessment_to_dict(row)


async def update_assessment_ai_narrative(assessment_id: str, ai_narrative: dict) -> Optional[dict]:
    aid = parse_uuid(assessment_id)
    if aid is None:
        return None
    async with session_scope() as session:
        row = await session.get(Assessment, aid)
        if not _is_active(row):
            return None
        row.ai_narrative = ai_narrative
        row.updated_at = _utcnow()
        flag_modified(row, "ai_narrative")
        await session.flush()
        return _assessment_to_dict(row)


async def update_assessment_ai_visuals(assessment_id: str, ai_visuals: dict) -> Optional[dict]:
    aid = parse_uuid(assessment_id)
    if aid is None:
        return None
    async with session_scope() as session:
        row = await session.get(Assessment, aid)
        if not _is_active(row):
            return None
        row.ai_visuals = ai_visuals
        row.updated_at = _utcnow()
        flag_modified(row, "ai_visuals")
        await session.flush()
        return _assessment_to_dict(row)


async def update_assessment_protocol(
    assessment_id: str,
    *,
    protocol_narrative: Optional[dict] = None,
    protocol_storage: Optional[dict] = None,
    feature_narratives: Optional[dict] = None,
    unset_protocol_data: bool = False,
) -> Optional[dict]:
    aid = parse_uuid(assessment_id)
    if aid is None:
        return None
    async with session_scope() as session:
        row = await session.get(Assessment, aid)
        if not _is_active(row):
            return None
        row.updated_at = _utcnow()
        if protocol_narrative is not None:
            row.protocol_narrative = protocol_narrative
            flag_modified(row, "protocol_narrative")
        if feature_narratives is not None:
            row.feature_narratives = feature_narratives
            flag_modified(row, "feature_narratives")
        if protocol_storage is not None:
            row.protocol_storage = protocol_storage
            flag_modified(row, "protocol_storage")
        # protocolData legacy field no longer stored
        _ = unset_protocol_data
        await session.flush()
        return _assessment_to_dict(row)


async def update_assessment_pipeline(
    assessment_id: str,
    pipeline: dict,
    *,
    status: Optional[str] = None,
) -> Optional[dict]:
    aid = parse_uuid(assessment_id)
    if aid is None:
        return None
    async with session_scope() as session:
        row = await session.get(Assessment, aid)
        if not _is_active(row):
            return None
        row.pipeline = pipeline
        row.updated_at = _utcnow()
        if status is not None:
            try:
                row.status = AssessmentStatus(status)
            except ValueError:
                pass
        flag_modified(row, "pipeline")
        await session.flush()
        return _assessment_to_dict(row)


async def update_assessment_feature_parsing(
    assessment_id: str,
    feature_parsing: dict,
) -> Optional[dict]:
    aid = parse_uuid(assessment_id)
    if aid is None:
        return None
    async with session_scope() as session:
        row = await session.get(Assessment, aid)
        if not _is_active(row):
            return None
        row.feature_parsing = feature_parsing
        row.updated_at = _utcnow()
        flag_modified(row, "feature_parsing")
        await session.flush()
        return _assessment_to_dict(row)


async def update_assessment_projected_after(
    assessment_id: str,
    projected_after: dict,
) -> Optional[dict]:
    aid = parse_uuid(assessment_id)
    if aid is None:
        return None
    async with session_scope() as session:
        row = await session.get(Assessment, aid)
        if not _is_active(row):
            return None
        row.projected_after = projected_after
        row.updated_at = _utcnow()
        flag_modified(row, "projected_after")
        await session.flush()
        return _assessment_to_dict(row)


async def update_assessment_projected_analysis(
    assessment_id: str,
    projected_analysis: dict,
) -> Optional[dict]:
    aid = parse_uuid(assessment_id)
    if aid is None:
        return None
    async with session_scope() as session:
        row = await session.get(Assessment, aid)
        if not _is_active(row):
            return None
        row.projected_analysis = projected_analysis
        row.updated_at = _utcnow()
        flag_modified(row, "projected_analysis")
        await session.flush()
        return _assessment_to_dict(row)


async def claim_next_queued_assessment() -> Optional[dict]:
    """Claim one queued pipeline job (FOR UPDATE SKIP LOCKED)."""
    async with session_scope() as session:
        stmt = (
            select(Assessment)
            .where(
                Assessment.pipeline["status"].astext == "queued",
                Assessment.deleted_at.is_(None),
            )
            .order_by(Assessment.created_at.asc())
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        result = await session.execute(stmt)
        row = result.scalar_one_or_none()
        if not row:
            return None
        pipeline = dict(row.pipeline or {})
        from ..pipeline_status import _utcnow_iso, merge_pipeline_update

        pipeline = merge_pipeline_update(
            pipeline,
            status="running",
            stage="cv",
            startedAt=pipeline.get("startedAt") or _utcnow_iso(),
            stageStartedAt=_utcnow_iso(),
        )
        row.pipeline = pipeline
        row.updated_at = _utcnow()
        flag_modified(row, "pipeline")
        await session.flush()
        return _assessment_to_dict(row)


async def requeue_failed_pipeline(assessment_id: str) -> Optional[dict]:
    aid = parse_uuid(assessment_id)
    if aid is None:
        return None
    from ..pipeline_status import new_queued_pipeline

    async with session_scope() as session:
        row = await session.get(Assessment, aid)
        if not _is_active(row):
            return None
        row.pipeline = new_queued_pipeline()
        row.status = AssessmentStatus.draft
        row.updated_at = _utcnow()
        flag_modified(row, "pipeline")
        await session.flush()
        return _assessment_to_dict(row)
