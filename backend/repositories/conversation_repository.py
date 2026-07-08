"""MongoDB persistence for Beauty Assistant conversations."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from pymongo import ReturnDocument

from ..database import get_db


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _serialize_doc(doc: dict) -> dict:
    out = dict(doc)
    if "_id" in out:
        out["id"] = str(out.pop("_id"))
    for key in ("createdAt", "updatedAt"):
        if key in out and hasattr(out[key], "isoformat"):
            out[key] = out[key].isoformat()
    return out


async def get_or_create_conversation(*, assessment_id: str, user_id: str) -> dict:
    db = get_db()
    now = _utcnow()
    doc = await db.conversations.find_one_and_update(
        {"assessmentId": assessment_id, "userId": user_id},
        {
            "$setOnInsert": {
                "assessmentId": assessment_id,
                "userId": user_id,
                "messages": [],
                "createdAt": now,
            },
            "$set": {"updatedAt": now},
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return _serialize_doc(doc)


async def get_conversation(*, assessment_id: str, user_id: str) -> Optional[dict]:
    db = get_db()
    doc = await db.conversations.find_one({"assessmentId": assessment_id, "userId": user_id})
    return _serialize_doc(doc) if doc else None


async def append_messages(*, conversation_id: str, messages: list[dict]) -> Optional[dict]:
    db = get_db()
    try:
        oid = ObjectId(conversation_id)
    except Exception:
        return None
    stamped = [{**message, "createdAt": _utcnow()} for message in messages]
    doc = await db.conversations.find_one_and_update(
        {"_id": oid},
        {"$push": {"messages": {"$each": stamped}}, "$set": {"updatedAt": _utcnow()}},
        return_document=ReturnDocument.AFTER,
    )
    return _serialize_doc(doc) if doc else None
