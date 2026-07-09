"""MongoDB persistence for MyFace users."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from ..database import get_db


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def serialize_user(doc: dict) -> dict:
    out = dict(doc)
    if "_id" in out:
        out["id"] = str(out.pop("_id"))
    out.pop("passwordHash", None)
    for key in ("createdAt", "updatedAt"):
        if key in out and hasattr(out[key], "isoformat"):
            out[key] = out[key].isoformat()
    return out


async def create_user(
    *,
    email: str,
    password_hash: str,
    first_name: str = "",
    last_name: str = "",
    role: str = "user",
) -> dict:
    db = get_db()
    now = _utcnow()
    doc = {
        "email": email.lower().strip(),
        "firstName": first_name.strip(),
        "lastName": last_name.strip(),
        "passwordHash": password_hash,
        "role": role if role in ("user", "admin") else "user",
        "createdAt": now,
        "updatedAt": now,
    }
    try:
        result = await db.users.insert_one(doc)
    except DuplicateKeyError:
        raise ValueError("Email already registered")
    doc["_id"] = result.inserted_id
    return serialize_user(doc)


async def ensure_user(*, email: str, password_hash: str, role: str = "user") -> dict:
    """Create or update a known system user, used for local admin bootstrap."""
    db = get_db()
    now = _utcnow()
    normalized_email = email.lower().strip()
    await db.users.update_one(
        {"email": normalized_email},
        {
            "$set": {
                "passwordHash": password_hash,
                "role": role if role in ("user", "admin") else "user",
                "updatedAt": now,
            },
            "$setOnInsert": {
                "email": normalized_email,
                "createdAt": now,
            },
        },
        upsert=True,
    )
    user = await db.users.find_one({"email": normalized_email})
    return serialize_user(user)


async def get_user_with_password_by_email(email: str) -> Optional[dict]:
    db = get_db()
    return await db.users.find_one({"email": email.lower().strip()})


async def get_user_by_email(email: str) -> Optional[dict]:
    doc = await get_user_with_password_by_email(email)
    return serialize_user(doc) if doc else None


async def get_user_by_id(user_id: str) -> Optional[dict]:
    db = get_db()
    try:
        oid = ObjectId(user_id)
    except Exception:
        return None
    doc = await db.users.find_one({"_id": oid})
    return serialize_user(doc) if doc else None


async def list_users(limit: int = 100) -> list[dict]:
    db = get_db()
    cursor = db.users.find().sort("createdAt", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    return [serialize_user(doc) for doc in docs]


async def delete_user_and_related_data(user_id: str) -> dict:
    """Delete a user and their assessments, conversations, and payments."""
    db = get_db()
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise ValueError("Invalid user id")

    user = await db.users.find_one({"_id": oid})
    if not user:
        raise ValueError("User not found")

    assessments = await db.assessments.delete_many({"userId": user_id})
    conversations = await db.conversations.delete_many({"userId": user_id})
    payments = await db.payments.delete_many({"userId": user_id})
    await db.users.delete_one({"_id": oid})

    return {
        "userId": user_id,
        "assessmentsDeleted": assessments.deleted_count,
        "conversationsDeleted": conversations.deleted_count,
        "paymentsDeleted": payments.deleted_count,
    }
