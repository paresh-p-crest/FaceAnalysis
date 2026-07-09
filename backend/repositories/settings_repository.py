"""App-wide settings stored in MongoDB."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from ..database import get_db

SETTINGS_ID = "app"
DEFAULT_PREMIUM_AMOUNT_CENTS = 50  # $0.50
DEFAULT_PREMIUM_CURRENCY = "usd"
DEFAULT_PRODUCT_NAME = "MyFace Premium Report"
DEFAULT_PRODUCT_DESCRIPTION = "Full facial analysis report with review-ready PDF workflow."


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def get_settings_doc() -> dict:
    db = get_db()
    doc = await db.app_settings.find_one({"_id": SETTINGS_ID})
    if doc:
        return doc
    return {
        "_id": SETTINGS_ID,
        "premiumAmountCents": DEFAULT_PREMIUM_AMOUNT_CENTS,
        "premiumCurrency": DEFAULT_PREMIUM_CURRENCY,
        "productName": DEFAULT_PRODUCT_NAME,
        "productDescription": DEFAULT_PRODUCT_DESCRIPTION,
    }


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
    db = get_db()
    now = _utcnow()
    update = {
        "premiumAmountCents": max(1, int(amount_cents)),
        "premiumCurrency": (currency or DEFAULT_PREMIUM_CURRENCY).lower(),
        "updatedAt": now,
    }
    if product_name is not None:
        update["productName"] = product_name.strip() or DEFAULT_PRODUCT_NAME
    if product_description is not None:
        update["productDescription"] = product_description.strip() or DEFAULT_PRODUCT_DESCRIPTION
    if updated_by:
        update["updatedBy"] = updated_by

    await db.app_settings.update_one(
        {"_id": SETTINGS_ID},
        {
            "$set": update,
            "$setOnInsert": {
                "_id": SETTINGS_ID,
                "createdAt": now,
            },
        },
        upsert=True,
    )
    return await get_premium_product()
