"""MongoDB persistence for payment attempts and captures."""

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


async def create_payment(
    *,
    user_id: str,
    provider: str,
    amount_cents: int,
    currency: str,
    plan_id: str,
    status: str,
    assessment_id: Optional[str] = None,
    provider_ref: Optional[str] = None,
    checkout_url: Optional[str] = None,
    raw: Optional[dict] = None,
) -> dict:
    db = get_db()
    now = _utcnow()
    doc = {
        "userId": user_id,
        "assessmentId": assessment_id,
        "provider": provider,
        "providerRef": provider_ref,
        "checkoutUrl": checkout_url,
        "amountCents": amount_cents,
        "currency": currency.lower(),
        "planId": plan_id,
        "status": status,
        "raw": raw or {},
        "createdAt": now,
        "updatedAt": now,
    }
    result = await db.payments.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize_doc(doc)


async def get_payment_by_provider_ref(provider: str, provider_ref: str) -> Optional[dict]:
    db = get_db()
    doc = await db.payments.find_one({"provider": provider, "providerRef": provider_ref})
    return _serialize_doc(doc) if doc else None


async def list_payments_for_user(user_id: str, limit: int = 20) -> list[dict]:
    db = get_db()
    cursor = db.payments.find({"userId": user_id}).sort("createdAt", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    return [_serialize_doc(doc) for doc in docs]


async def user_has_completed_payment(user_id: str) -> bool:
    db = get_db()
    doc = await db.payments.find_one(
        {
            "userId": user_id,
            "status": {"$in": ["paid", "complete", "completed"]},
        },
        {"_id": 1},
    )
    if doc:
        return True
    assessment = await db.assessments.find_one({"userId": user_id}, {"_id": 1})
    return bool(assessment)


async def list_payments(limit: int = 50) -> list[dict]:
    db = get_db()
    cursor = db.payments.find().sort("createdAt", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    return [_serialize_doc(doc) for doc in docs]


async def delete_all_payments() -> int:
    db = get_db()
    result = await db.payments.delete_many({})
    return result.deleted_count


async def update_payment_status(
    provider: str,
    provider_ref: str,
    *,
    status: str,
    raw: Optional[dict] = None,
) -> Optional[dict]:
    db = get_db()
    update = {"status": status, "updatedAt": _utcnow()}
    if raw is not None:
        update["raw"] = raw
    doc = await db.payments.find_one_and_update(
        {"provider": provider, "providerRef": provider_ref},
        {"$set": update},
        return_document=ReturnDocument.AFTER,
    )
    return _serialize_doc(doc) if doc else None


async def get_payment_by_id(payment_id: str) -> Optional[dict]:
    db = get_db()
    try:
        oid = ObjectId(payment_id)
    except Exception:
        return None
    doc = await db.payments.find_one({"_id": oid})
    return _serialize_doc(doc) if doc else None
