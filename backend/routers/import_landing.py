"""Server-to-server landing paid-checkout import (myface.de → app)."""

from __future__ import annotations

import logging
from typing import Any, Optional
from urllib.parse import urlsplit, urlunsplit

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ..database import is_db_configured
from ..landing_import_service import LandingImportError, import_landing_session, verify_import_secret

logger = logging.getLogger(__name__)

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


def _mask_email(email: str) -> str:
    value = (email or "").strip().lower()
    if "@" not in value:
        return "***"
    local, _, domain = value.partition("@")
    if not local:
        return f"***@{domain}"
    return f"{local[0]}***@{domain}"


def _safe_url(url: Optional[str]) -> Optional[str]:
    """Log origin + path only — drop query/fragment (setup tokens live in query)."""
    if not url:
        return None
    try:
        parts = urlsplit(url)
        return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))
    except Exception:
        return "<invalid-url>"


def _request_log_summary(req: LandingImportRequest, idempotency_key: str) -> dict[str, Any]:
    meta = req.metadata or {}
    addons = meta.get("addons")
    if isinstance(addons, list):
        addon_summary = ",".join(str(x) for x in addons[:12])
    elif isinstance(addons, str):
        addon_summary = addons[:200]
    else:
        addon_summary = None
    return {
        "idempotencyKeyPrefix": (idempotency_key or "")[:10],
        "sourceSystem": req.sourceSystem,
        "hasSourceCustomerId": bool(req.sourceCustomerId),
        "hasSourceSessionId": bool(req.sourceSessionId),
        "email": _mask_email(req.customer.email),
        "hasName": bool((req.customer.firstName or "").strip() or (req.customer.lastName or "").strip()),
        "locale": req.customer.locale,
        "productId": req.order.productId,
        "currency": req.order.currency,
        "amountCents": req.order.amountCents,
        "hasOrderNumber": bool(req.order.orderNumber),
        "hasLandingOrderId": bool(req.order.landingOrderId),
        "paymentStatus": req.payment.status,
        "paymentIntentIdPrefix": (req.payment.paymentIntentId or "")[:10],
        "hasStripeCustomerId": bool(req.payment.stripeCustomerId),
        "hasPaidAt": bool(req.payment.paidAt),
        "metadataKeys": sorted(meta.keys()),
        "addons": addon_summary,
        "hasDelivery": "delivery" in meta,
        "hasSecondPersonEmail": bool(meta.get("secondPersonEmail")),
    }


def _response_log_summary(status_code: int, body: dict[str, Any]) -> dict[str, Any]:
    password_setup = body.get("passwordSetup") or {}
    user = body.get("user") or {}
    return {
        "httpStatus": status_code,
        "success": body.get("success"),
        "status": body.get("status"),
        "userCreated": user.get("created"),
        "userEmail": _mask_email(str(user.get("email") or "")),
        "orderStatus": (body.get("order") or {}).get("status"),
        "hasOrderNumber": bool((body.get("order") or {}).get("orderNumber")),
        "passwordSetupRequired": password_setup.get("required"),
        "redirectUrl": _safe_url(password_setup.get("redirectUrl")),
        "loginUrl": _safe_url(body.get("loginUrl")),
        "hasRedirectToken": bool(password_setup.get("redirectToken")),
        "hasSetupExpiresAt": bool(password_setup.get("expiresAt")),
    }


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
        logger.warning("Landing import auth failed status=%s detail=%s", exc.status_code, exc.detail)
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    key = (idempotency_key or "").strip()
    if not key:
        raise HTTPException(status_code=400, detail="Idempotency-Key header is required.")

    logger.info("Landing import request %s", _request_log_summary(req, key))

    try:
        status_code, body = await import_landing_session(
            idempotency_key=key,
            payload=req.model_dump(),
        )
    except LandingImportError as exc:
        logger.warning(
            "Landing import rejected status=%s detail=%s request=%s",
            exc.status_code,
            exc.detail,
            _request_log_summary(req, key),
        )
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    logger.info("Landing import response %s", _response_log_summary(status_code, body))
    return JSONResponse(status_code=status_code, content=body)
