"""Admin settings API."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..auth import require_admin
from ..database import is_mongodb_configured
from ..repositories.settings_repository import get_premium_product, update_premium_pricing

router = APIRouter(prefix="/api/admin", tags=["admin"])


class PricingUpdateRequest(BaseModel):
    amountCents: int = Field(ge=1, le=99999999)
    currency: str = "usd"
    productName: str | None = None
    productDescription: str | None = None


@router.get("/pricing")
async def get_admin_pricing(current_user: dict = Depends(require_admin)):
    if not is_mongodb_configured():
        raise HTTPException(status_code=503, detail="MongoDB not configured.")
    product = await get_premium_product()
    return {"product": product}


@router.patch("/pricing")
async def patch_admin_pricing(
    req: PricingUpdateRequest,
    current_user: dict = Depends(require_admin),
):
    if not is_mongodb_configured():
        raise HTTPException(status_code=503, detail="MongoDB not configured.")
    product = await update_premium_pricing(
        amount_cents=req.amountCents,
        currency=req.currency,
        product_name=req.productName,
        product_description=req.productDescription,
        updated_by=current_user.get("email"),
    )
    return {"product": product}
