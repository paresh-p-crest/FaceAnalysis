"""App-wide settings stored in PostgreSQL."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select

from ..database import session_scope
from ..models import AppSettings
from ._helpers import parse_uuid

SETTINGS_ID = "app"
DEFAULT_PREMIUM_AMOUNT_CENTS = 50  # $0.50
DEFAULT_PREMIUM_CURRENCY = "usd"
DEFAULT_PRODUCT_NAME = "MyFace Premium Report"
DEFAULT_PRODUCT_DESCRIPTION = "Full facial analysis report with review-ready PDF workflow."


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _defaults() -> dict:
    return {
        "_id": SETTINGS_ID,
        "premiumAmountCents": DEFAULT_PREMIUM_AMOUNT_CENTS,
        "premiumCurrency": DEFAULT_PREMIUM_CURRENCY,
        "productName": DEFAULT_PRODUCT_NAME,
        "productDescription": DEFAULT_PRODUCT_DESCRIPTION,
    }


def _row_to_doc(row: AppSettings) -> dict:
    return {
        "_id": row.key,
        "premiumAmountCents": row.premium_amount_cents,
        "premiumCurrency": row.premium_currency,
        "productName": row.product_name,
        "productDescription": row.product_description,
        "updatedBy": str(row.updated_by) if row.updated_by else None,
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
    }


async def get_settings_doc() -> dict:
    async with session_scope() as session:
        result = await session.execute(select(AppSettings).where(AppSettings.key == SETTINGS_ID))
        row = result.scalar_one_or_none()
        if row:
            return _row_to_doc(row)
        return _defaults()


async def get_premium_product() -> dict:
    doc = await get_settings_doc()
    return {
        "id": "myface_report",
        "name": doc.get("productName") or DEFAULT_PRODUCT_NAME,
        "description": doc.get("productDescription") or DEFAULT_PRODUCT_DESCRIPTION,
        "amountCents": int(doc.get("premiumAmountCents") or DEFAULT_PREMIUM_AMOUNT_CENTS),
        "currency": (doc.get("premiumCurrency") or DEFAULT_PREMIUM_CURRENCY).lower(),
    }


async def update_premium_pricing(
    *,
    amount_cents: int,
    currency: str = DEFAULT_PREMIUM_CURRENCY,
    product_name: Optional[str] = None,
    product_description: Optional[str] = None,
    updated_by: Optional[str] = None,
) -> dict:
    now = _utcnow()
    uid = parse_uuid(updated_by) if updated_by else None
    async with session_scope() as session:
        result = await session.execute(select(AppSettings).where(AppSettings.key == SETTINGS_ID))
        row = result.scalar_one_or_none()
        if row is None:
            row = AppSettings(
                key=SETTINGS_ID,
                premium_amount_cents=max(1, int(amount_cents)),
                premium_currency=(currency or DEFAULT_PREMIUM_CURRENCY).lower(),
                product_name=(product_name.strip() if product_name else None) or DEFAULT_PRODUCT_NAME,
                product_description=(
                    product_description.strip() if product_description else None
                )
                or DEFAULT_PRODUCT_DESCRIPTION,
                updated_by=uid,
                created_at=now,
                updated_at=now,
            )
            session.add(row)
        else:
            row.premium_amount_cents = max(1, int(amount_cents))
            row.premium_currency = (currency or DEFAULT_PREMIUM_CURRENCY).lower()
            row.updated_at = now
            if product_name is not None:
                row.product_name = product_name.strip() or DEFAULT_PRODUCT_NAME
            if product_description is not None:
                row.product_description = product_description.strip() or DEFAULT_PRODUCT_DESCRIPTION
            if updated_by:
                row.updated_by = uid
        await session.flush()
    return await get_premium_product()
