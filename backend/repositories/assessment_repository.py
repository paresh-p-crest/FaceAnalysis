"""MongoDB persistence for facial assessments."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from ..database import get_db


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _serialize_doc(doc: dict) -> dict:
    """Convert ObjectId and datetimes for JSON responses."""
    out = dict(doc)
    if "_id" in out:
        out["id"] = str(out.pop("_id"))
    for key in ("createdAt", "updatedAt"):
        if key in out and hasattr(out[key], "isoformat"):
            out[key] = out[key].isoformat()
    return out


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
) -> dict:
    db = get_db()
    if scan_id and user_id:
        existing = await db.assessments.find_one({"userId": user_id, "scanId": scan_id})
        if existing:
            return _serialize_doc(existing)

    now = _utcnow()
    doc = {
        "status": status,
        "answers": answers,
        "provider": provider,
        "userId": user_id,
        "photosKeys": photos_keys or [],
        "photos": photos or {},
        "analysis": analysis,
        "scanId": scan_id,
        "createdAt": now,
        "updatedAt": now,
    }
    try:
        result = await db.assessments.insert_one(doc)
    except DuplicateKeyError:
        if scan_id and user_id:
            existing = await db.assessments.find_one({"userId": user_id, "scanId": scan_id})
            if existing:
                return _serialize_doc(existing)
        raise
    doc["_id"] = result.inserted_id
    return _serialize_doc(doc)


async def get_assessment_by_id(assessment_id: str) -> Optional[dict]:
    db = get_db()
    try:
        oid = ObjectId(assessment_id)
    except Exception:
        return None
    doc = await db.assessments.find_one({"_id": oid})
    return _serialize_doc(doc) if doc else None


async def list_assessments(limit: int = 20) -> list[dict]:
    db = get_db()
    cursor = db.assessments.find().sort("createdAt", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    return [_serialize_doc(d) for d in docs]


async def list_assessments_for_user(user_id: str, limit: int = 20) -> list[dict]:
    db = get_db()
    cursor = db.assessments.find({"userId": user_id}).sort("createdAt", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    return [_serialize_doc(d) for d in docs]


async def delete_assessment(assessment_id: str) -> bool:
    db = get_db()
    try:
        oid = ObjectId(assessment_id)
    except Exception:
        return False
    result = await db.assessments.delete_one({"_id": oid})
    if result.deleted_count:
        await db.conversations.delete_many({"assessmentId": assessment_id})
    return bool(result.deleted_count)


async def delete_all_assessment_data() -> dict:
    db = get_db()
    assessments = await db.assessments.delete_many({})
    conversations = await db.conversations.delete_many({})
    return {
        "assessmentsDeleted": assessments.deleted_count,
        "conversationsDeleted": conversations.deleted_count,
    }


async def update_assessment_status(assessment_id: str, status: str) -> Optional[dict]:
    db = get_db()
    try:
        oid = ObjectId(assessment_id)
    except Exception:
        return None
    doc = await db.assessments.find_one_and_update(
        {"_id": oid},
        {"$set": {"status": status, "updatedAt": _utcnow()}},
        return_document=ReturnDocument.AFTER,
    )
    return _serialize_doc(doc) if doc else None


async def update_assessment_admin_review(
    assessment_id: str,
    *,
    status: Optional[str] = None,
    admin_notes: Optional[str] = None,
    ai_narrative: Optional[dict] = None,
    reviewer: Optional[dict] = None,
) -> Optional[dict]:
    db = get_db()
    try:
        oid = ObjectId(assessment_id)
    except Exception:
        return None

    now = _utcnow()
    update_fields: dict[str, Any] = {
        "updatedAt": now,
        "reviewedAt": now,
        "reviewedBy": reviewer or {},
    }
    if status is not None:
        update_fields["status"] = status
    if admin_notes is not None:
        update_fields["adminNotes"] = admin_notes
    if ai_narrative is not None:
        update_fields["aiNarrative"] = ai_narrative

    review_log = {
        "at": now,
        "reviewer": reviewer or {},
        "status": status,
        "editedAiNarrative": ai_narrative is not None,
        "hasAdminNotes": bool(admin_notes),
    }

    doc = await db.assessments.find_one_and_update(
        {"_id": oid},
        {"$set": update_fields, "$push": {"reviewLog": review_log}},
        return_document=ReturnDocument.AFTER,
    )
    return _serialize_doc(doc) if doc else None


async def update_assessment_analysis(assessment_id: str, analysis: dict, photos: Optional[dict] = None) -> Optional[dict]:
    db = get_db()
    try:
        oid = ObjectId(assessment_id)
    except Exception:
        return None
    update_fields: dict[str, Any] = {"analysis": analysis, "updatedAt": _utcnow()}
    if photos is not None:
        update_fields["photos"] = photos
        update_fields["photosKeys"] = list(photos.keys())
    doc = await db.assessments.find_one_and_update(
        {"_id": oid},
        {"$set": update_fields},
        return_document=ReturnDocument.AFTER,
    )
    return _serialize_doc(doc) if doc else None


async def update_assessment_ai_narrative(assessment_id: str, ai_narrative: dict) -> Optional[dict]:
    db = get_db()
    try:
        oid = ObjectId(assessment_id)
    except Exception:
        return None
    doc = await db.assessments.find_one_and_update(
        {"_id": oid},
        {"$set": {"aiNarrative": ai_narrative, "updatedAt": _utcnow()}},
        return_document=ReturnDocument.AFTER,
    )
    return _serialize_doc(doc) if doc else None


async def update_assessment_ai_visuals(assessment_id: str, ai_visuals: dict) -> Optional[dict]:
    db = get_db()
    try:
        oid = ObjectId(assessment_id)
    except Exception:
        return None
    doc = await db.assessments.find_one_and_update(
        {"_id": oid},
        {"$set": {"aiVisuals": ai_visuals, "updatedAt": _utcnow()}},
        return_document=ReturnDocument.AFTER,
    )
    return _serialize_doc(doc) if doc else None


async def update_assessment_protocol(
    assessment_id: str,
    *,
    protocol_data: Optional[dict] = None,
    protocol_narrative: Optional[dict] = None,
    protocol_storage: Optional[dict] = None,
) -> Optional[dict]:
    db = get_db()
    try:
        oid = ObjectId(assessment_id)
    except Exception:
        return None
    update_fields: dict[str, Any] = {"updatedAt": _utcnow()}
    if protocol_data is not None:
        update_fields["protocolData"] = protocol_data
    if protocol_narrative is not None:
        update_fields["protocolNarrative"] = protocol_narrative
    if protocol_storage is not None:
        update_fields["protocolStorage"] = protocol_storage
    doc = await db.assessments.find_one_and_update(
        {"_id": oid},
        {"$set": update_fields},
        return_document=ReturnDocument.AFTER,
    )
    return _serialize_doc(doc) if doc else None
