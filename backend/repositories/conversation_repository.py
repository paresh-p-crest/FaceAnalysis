"""PostgreSQL persistence for Beauty Assistant conversations."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ..database import session_scope
from ..models import Conversation, ConversationMessage, MessageRole
from ._helpers import iso, parse_uuid


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _conversation_to_dict(row: Conversation) -> dict:
    messages = []
    for msg in row.messages or []:
        messages.append(
            {
                "role": msg.role.value if hasattr(msg.role, "value") else msg.role,
                "content": msg.content,
                "createdAt": iso(msg.created_at),
            }
        )
    return {
        "id": str(row.id),
        "assessmentId": str(row.assessment_id),
        "userId": str(row.user_id),
        "messages": messages,
        "sessionSummary": row.session_summary,
        "summaryAtUserCount": row.summary_at_user_count,
        "createdAt": iso(row.created_at),
        "updatedAt": iso(row.updated_at),
    }


async def get_or_create_conversation(*, assessment_id: str, user_id: str) -> dict:
    aid = parse_uuid(assessment_id)
    uid = parse_uuid(user_id)
    if aid is None or uid is None:
        raise ValueError("Invalid assessment or user id")
    now = _utcnow()
    async with session_scope() as session:
        result = await session.execute(
            select(Conversation)
            .options(selectinload(Conversation.messages))
            .where(Conversation.assessment_id == aid, Conversation.user_id == uid)
        )
        row = result.scalar_one_or_none()
        if row is None:
            row = Conversation(
                assessment_id=aid,
                user_id=uid,
                created_at=now,
                updated_at=now,
            )
            session.add(row)
            await session.flush()
            await session.refresh(row, attribute_names=["messages"])
        else:
            row.updated_at = now
            await session.flush()
        return _conversation_to_dict(row)


async def get_conversation(*, assessment_id: str, user_id: str) -> Optional[dict]:
    aid = parse_uuid(assessment_id)
    uid = parse_uuid(user_id)
    if aid is None or uid is None:
        return None
    async with session_scope() as session:
        result = await session.execute(
            select(Conversation)
            .options(selectinload(Conversation.messages))
            .where(Conversation.assessment_id == aid, Conversation.user_id == uid)
        )
        row = result.scalar_one_or_none()
        return _conversation_to_dict(row) if row else None


async def append_messages(*, conversation_id: str, messages: list[dict]) -> Optional[dict]:
    cid = parse_uuid(conversation_id)
    if cid is None:
        return None
    now = _utcnow()
    async with session_scope() as session:
        result = await session.execute(
            select(Conversation).options(selectinload(Conversation.messages)).where(Conversation.id == cid)
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        for message in messages:
            role_raw = message.get("role") or "user"
            try:
                role = MessageRole(role_raw)
            except ValueError:
                role = MessageRole.user
            session.add(
                ConversationMessage(
                    conversation_id=row.id,
                    role=role,
                    content=str(message.get("content") or ""),
                    created_at=now,
                )
            )
        row.updated_at = now
        await session.flush()
        await session.refresh(row, attribute_names=["messages"])
        return _conversation_to_dict(row)


async def update_session_summary(
    *,
    conversation_id: str,
    session_summary: str,
    summary_at_user_count: int,
) -> Optional[dict]:
    cid = parse_uuid(conversation_id)
    if cid is None:
        return None
    async with session_scope() as session:
        result = await session.execute(
            select(Conversation).options(selectinload(Conversation.messages)).where(Conversation.id == cid)
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        row.session_summary = session_summary
        row.summary_at_user_count = summary_at_user_count
        row.updated_at = _utcnow()
        await session.flush()
        return _conversation_to_dict(row)
