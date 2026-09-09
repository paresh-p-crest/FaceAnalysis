"""Server-to-server landing paid-checkout import (myface.de → app)."""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ..database import is_db_configured
from ..landing_import_service import LandingImportError, import_landing_session, verify_import_secret

router = APIRouter(prefix="/api/import", tags=["import"])


class LandingImportCustomer(BaseModel):
    email: str
    firstName: str = ""
    lastName: str = ""
    locale: str = "de"


class LandingImportOrder(BaseModel):
    orderNumber: Optional[str] = None
    productId: str
    currency: str
    amountCents: int = Field(..., ge=0)
    packageName: Optional[str] = None
    landingOrderId: Optional[str] = None


class LandingImportPayment(BaseModel):
    provider: str = "myface_landing"
    status: str
    paymentIntentId: str
    stripeCustomerId: str
    paidAt: Optional[str] = None
    checkoutSessionId: Optional[str] = None


class LandingImportRequest(BaseModel):
    sourceSystem: str = "myface.de"
    sourceCustomerId: Optional[str] = None
    sourceSessionId: Optional[str] = None
    order: LandingImportOrder
    customer: LandingImportCustomer
    payment: LandingImportPayment
    # Commercial / support extras from landing orders row — stored in payments.raw.
    # Not part of the idempotency fingerprint. secondPersonEmail is stored for support
    # only; app still creates one user (the payer).
    metadata: Optional[dict[str, Any]] = None


def _require_db() -> None:
    if not is_db_configured():
        raise HTTPException(status_code=503, detail="Database not configured.")


@router.post("/myface-session")
async def import_myface_session(
    req: LandingImportRequest,
    authorization: Optional[str] = Header(default=None),
    idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
):
    _require_db()
    try:
        verify_import_secret(authorization)
    except LandingImportError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    key = (idempotency_key or "").strip()
    if not key:
        raise HTTPException(status_code=400, detail="Idempotency-Key header is required.")

    try:
        status_code, body = await import_landing_session(
            idempotency_key=key,
            payload=req.model_dump(),
        )
    except LandingImportError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    return JSONResponse(status_code=status_code, content=body)
