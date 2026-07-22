"""PostgreSQL persistence for MyFace users."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

from ..database import session_scope
from ..models import Assessment, Conversation, Payment, User, UserRole
from ._helpers import iso, parse_uuid


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def serialize_user(doc: dict) -> dict:
    out = dict(doc)
    out.pop("passwordHash", None)
    for key in ("createdAt", "updatedAt"):
        if key in out and hasattr(out[key], "isoformat"):
            out[key] = out[key].isoformat()
    return out


def _user_to_dict(user: User, *, keep_password: bool = False) -> dict:
    data = {
        "id": str(user.id),
        "email": user.email,
        "firstName": user.first_name,
        "lastName": user.last_name,
        "role": user.role.value if hasattr(user.role, "value") else user.role,
        "createdAt": iso(user.created_at),
        "updatedAt": iso(user.updated_at),
    }
    if keep_password:
        data["passwordHash"] = user.password_hash
    return data


async def create_user(
    *,
    email: str,
    password_hash: str,
    first_name: str = "",
    last_name: str = "",
    role: str = "user",
) -> dict:
    now = _utcnow()
    user = User(
        email=email.lower().strip(),
        first_name=first_name.strip(),
        last_name=last_name.strip(),
        password_hash=password_hash,
        role=UserRole(role) if role in ("user", "admin") else UserRole.user,
        created_at=now,
        updated_at=now,
    )
    try:
        async with session_scope() as session:
            session.add(user)
            await session.flush()
            return serialize_user(_user_to_dict(user))
    except IntegrityError as exc:
        raise ValueError("Email already registered") from exc


async def ensure_user(*, email: str, password_hash: str, role: str = "user") -> dict:
    """Create or update a known system user, used for local admin bootstrap."""
    normalized_email = email.lower().strip()
    now = _utcnow()
    role_enum = UserRole(role) if role in ("user", "admin") else UserRole.user
    async with session_scope() as session:
        result = await session.execute(select(User).where(User.email == normalized_email))
        user = result.scalar_one_or_none()
        if user is None:
            user = User(
                email=normalized_email,
                first_name="",
                last_name="",
                password_hash=password_hash,
                role=role_enum,
                created_at=now,
                updated_at=now,
            )
            session.add(user)
        else:
            user.password_hash = password_hash
            user.role = role_enum
            user.updated_at = now
        await session.flush()
        return serialize_user(_user_to_dict(user))


async def get_user_with_password_by_email(email: str) -> Optional[dict]:
    async with session_scope() as session:
        result = await session.execute(select(User).where(User.email == email.lower().strip()))
        user = result.scalar_one_or_none()
        return _user_to_dict(user, keep_password=True) if user else None


async def get_user_by_email(email: str) -> Optional[dict]:
    doc = await get_user_with_password_by_email(email)
    return serialize_user(doc) if doc else None


async def get_user_by_id(user_id: str) -> Optional[dict]:
    uid = parse_uuid(user_id)
    if uid is None:
        return None
    async with session_scope() as session:
        user = await session.get(User, uid)
        return serialize_user(_user_to_dict(user)) if user else None


async def get_user_with_password_by_id(user_id: str) -> Optional[dict]:
    uid = parse_uuid(user_id)
    if uid is None:
        return None
    async with session_scope() as session:
        user = await session.get(User, uid)
        return _user_to_dict(user, keep_password=True) if user else None


async def update_user_profile(
    user_id: str,
    *,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    email: Optional[str] = None,
) -> dict:
    uid = parse_uuid(user_id)
    if uid is None:
        raise ValueError("Invalid user id")
    now = _utcnow()
    async with session_scope() as session:
        user = await session.get(User, uid)
        if not user:
            raise ValueError("User not found")
        if first_name is not None:
            first = first_name.strip()
            if len(first) < 1:
                raise ValueError("First name is required")
            user.first_name = first
        if last_name is not None:
            last = last_name.strip()
            if len(last) < 1:
                raise ValueError("Last name is required")
            user.last_name = last
        if email is not None:
            normalized = email.lower().strip()
            if not normalized:
                raise ValueError("Email is required")
            user.email = normalized
        user.updated_at = now
        try:
            await session.flush()
        except IntegrityError as exc:
            raise ValueError("Email already registered") from exc
        return serialize_user(_user_to_dict(user))


async def update_user_password(user_id: str, password_hash: str) -> dict:
    uid = parse_uuid(user_id)
    if uid is None:
        raise ValueError("Invalid user id")
    now = _utcnow()
    async with session_scope() as session:
        user = await session.get(User, uid)
        if not user:
            raise ValueError("User not found")
        user.password_hash = password_hash
        user.updated_at = now
        await session.flush()
        return serialize_user(_user_to_dict(user))


async def list_users(limit: int = 100) -> list[dict]:
    async with session_scope() as session:
        result = await session.execute(select(User).order_by(User.created_at.desc()).limit(limit))
        users = result.scalars().all()
        return [serialize_user(_user_to_dict(u)) for u in users]


async def delete_user_and_related_data(user_id: str) -> dict:
    """Delete a user and their assessments, conversations, and payments (FK CASCADE)."""
    uid = parse_uuid(user_id)
    if uid is None:
        raise ValueError("Invalid user id")

    async with session_scope() as session:
        user = await session.get(User, uid)
        if not user:
            raise ValueError("User not found")

        assessments = await session.execute(delete(Assessment).where(Assessment.user_id == uid))
        conversations = await session.execute(delete(Conversation).where(Conversation.user_id == uid))
        payments = await session.execute(delete(Payment).where(Payment.user_id == uid))
        await session.delete(user)

        return {
            "userId": user_id,
            "assessmentsDeleted": assessments.rowcount or 0,
            "conversationsDeleted": conversations.rowcount or 0,
            "paymentsDeleted": payments.rowcount or 0,
        }
