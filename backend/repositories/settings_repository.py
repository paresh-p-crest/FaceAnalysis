"""App-wide settings stored in PostgreSQL."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import select

from ..database import session_scope
from ..models import AppSettings
#
# NOTE: Admin write/update path intentionally removed.

SETTINGS_ID = "app"
DEFAULT_PREMIUM_AMOUNT_CENTS = 50  # $0.50
DEFAULT_PREMIUM_CURRENCY = "usd"
DEFAULT_PRODUCT_NAME = "MyFace Premium Report"
DEFAULT_PRODUCT_DESCRIPTION = "Full facial analysis report with review-ready PDF workflow."


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


#
# NOTE: Admin write/update path intentionally removed.
