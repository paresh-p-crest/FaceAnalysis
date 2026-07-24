"""PostgreSQL persistence for payment attempts and captures."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import delete, select

from ..database import session_scope
from ..models import Assessment, Payment
from ._helpers import iso, parse_uuid


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _payment_to_dict(row: Payment) -> dict:
    return {
        "id": str(row.id),
        "userId": str(row.user_id),
        "assessmentId": str(row.assessment_id) if row.assessment_id else None,
        "provider": row.provider,
        "providerRef": row.provider_ref,
        "checkoutUrl": row.checkout_url,
        "amountCents": row.amount_cents,
        "currency": row.currency,
        "planId": row.plan_id,
        "status": row.status,
        "raw": row.raw or {},
        "createdAt": iso(row.created_at),
        "updatedAt": iso(row.updated_at),
    }


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
    uid = parse_uuid(user_id)
    if uid is None:
        raise ValueError("Invalid user id")
    aid = parse_uuid(assessment_id) if assessment_id else None
    now = _utcnow()
    row = Payment(
        user_id=uid,
        assessment_id=aid,
        provider=provider,
        provider_ref=provider_ref,
        checkout_url=checkout_url,
        amount_cents=amount_cents,
        currency=currency.lower(),
        plan_id=plan_id,
        status=status,
        raw=raw or {},
        created_at=now,
        updated_at=now,
    )
    async with session_scope() as session:
        session.add(row)
        await session.flush()
        return _payment_to_dict(row)


async def get_payment_by_provider_ref(provider: str, provider_ref: str) -> Optional[dict]:
    async with session_scope() as session:
        result = await session.execute(
            select(Payment).where(Payment.provider == provider, Payment.provider_ref == provider_ref)
        )
        row = result.scalar_one_or_none()
        return _payment_to_dict(row) if row else None


async def list_payments_for_user(user_id: str, limit: int = 20) -> list[dict]:
    uid = parse_uuid(user_id)
    if uid is None:
        return []
    async with session_scope() as session:
        result = await session.execute(
            select(Payment).where(Payment.user_id == uid).order_by(Payment.created_at.desc()).limit(limit)
        )
        return [_payment_to_dict(r) for r in result.scalars().all()]


async def user_has_completed_payment(user_id: str) -> bool:
    uid = parse_uuid(user_id)
    if uid is None:
        return False
    async with session_scope() as session:
        result = await session.execute(
            select(Payment.id)
            .where(
                Payment.user_id == uid,
                Payment.status.in_(("paid", "complete", "completed")),
            )
            .limit(1)
        )
        if result.scalar_one_or_none() is not None:
            return True
        # Legacy unlock: any active (non-soft-deleted) assessment for this user.
        assessment = await session.execute(
            select(Assessment.id)
            .where(
                Assessment.user_id == uid,
                Assessment.deleted_at.is_(None),
            )
            .limit(1)
        )
        return assessment.scalar_one_or_none() is not None


async def list_payments(limit: int = 50) -> list[dict]:
    async with session_scope() as session:
        result = await session.execute(select(Payment).order_by(Payment.created_at.desc()).limit(limit))
        return [_payment_to_dict(r) for r in result.scalars().all()]


async def delete_all_payments() -> int:
    async with session_scope() as session:
        result = await session.execute(delete(Payment))
        return result.rowcount or 0


async def update_payment_status(
    provider: str,
    provider_ref: str,
    *,
    status: str,
    raw: Optional[dict] = None,
) -> Optional[dict]:
    async with session_scope() as session:
        result = await session.execute(
            select(Payment).where(Payment.provider == provider, Payment.provider_ref == provider_ref)
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        row.status = status
        row.updated_at = _utcnow()
        if raw is not None:
            row.raw = raw
        await session.flush()
        return _payment_to_dict(row)


async def get_payment_by_id(payment_id: str) -> Optional[dict]:
    pid = parse_uuid(payment_id)
    if pid is None:
        return None
    async with session_scope() as session:
        row = await session.get(Payment, pid)
        return _payment_to_dict(row) if row else None
