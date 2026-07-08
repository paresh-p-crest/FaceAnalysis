"""MongoDB connection (Motor async driver)."""

from __future__ import annotations

import os
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError, OperationFailure

_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None


def get_mongodb_uri() -> Optional[str]:
    return os.environ.get("MONGODB_URI") or os.environ.get("MONGO_URI")


def is_mongodb_configured() -> bool:
    return bool(get_mongodb_uri())


async def connect_db() -> None:
    """Connect on app startup."""
    global _client, _db
    uri = get_mongodb_uri()
    if not uri:
        return
    _client = AsyncIOMotorClient(uri)
    _db = _client.get_default_database()
    if _db is None:
        raise RuntimeError("MONGODB_URI must include a database name, e.g. .../aurascan")
    await _client.admin.command("ping")
    await _ensure_indexes()


async def close_db() -> None:
    global _client, _db
    if _client:
        _client.close()
    _client = None
    _db = None


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("MongoDB is not connected. Set MONGODB_URI in your environment.")
    return _db


async def ping_db() -> bool:
    if _client is None:
        return False
    try:
        await _client.admin.command("ping")
        return True
    except Exception:
        return False


async def _dedupe_assessment_scan_ids() -> int:
    """Remove duplicate assessments sharing the same userId + scanId (keeps oldest)."""
    db = get_db()
    pipeline = [
        {"$match": {"scanId": {"$exists": True, "$type": "string", "$ne": ""}}},
        {
            "$group": {
                "_id": {"userId": "$userId", "scanId": "$scanId"},
                "ids": {"$push": "$_id"},
                "count": {"$sum": 1},
            }
        },
        {"$match": {"count": {"$gt": 1}}},
    ]
    removed = 0
    async for group in db.assessments.aggregate(pipeline):
        ids = sorted(group.get("ids") or [])
        if len(ids) <= 1:
            continue
        result = await db.assessments.delete_many({"_id": {"$in": ids[1:]}})
        removed += result.deleted_count
    return removed


async def _ensure_scan_unique_index() -> None:
    db = get_db()
    for index_name in ("user_scan_unique", "userId_1_scanId_1"):
        try:
            await db.assessments.drop_index(index_name)
        except Exception:
            pass

    await _dedupe_assessment_scan_ids()

    try:
        await db.assessments.create_index(
            [("userId", 1), ("scanId", 1)],
            unique=True,
            partialFilterExpression={"scanId": {"$exists": True, "$type": "string"}},
            name="user_scan_unique",
        )
    except (DuplicateKeyError, OperationFailure) as err:
        if getattr(err, "code", None) != 11000:
            raise
        await _dedupe_assessment_scan_ids()
        await db.assessments.create_index(
            [("userId", 1), ("scanId", 1)],
            unique=True,
            partialFilterExpression={"scanId": {"$exists": True, "$type": "string"}},
            name="user_scan_unique",
        )


async def _ensure_indexes() -> None:
    db = get_db()
    await db.assessments.create_index("createdAt")
    await db.assessments.create_index("status")
    await db.assessments.create_index("userId")
    await _ensure_scan_unique_index()
    await db.users.create_index("email", unique=True)
    await db.users.create_index("role")
    await db.payments.create_index("userId")
    await db.payments.create_index("providerRef")
    await db.payments.create_index("status")
    await db.payments.create_index("createdAt")
    await db.conversations.create_index([("assessmentId", 1), ("userId", 1)], unique=True)
    await db.conversations.create_index("updatedAt")
