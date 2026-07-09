"""Payment APIs for Stripe Checkout and PayPal Orders."""

from __future__ import annotations

import os
import hashlib
import hmac
import json
import time
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from ..auth import get_current_user, require_admin
from ..database import is_mongodb_configured
from ..repositories.payment_repository import (
    create_payment,
    delete_all_payments,
    get_payment_by_provider_ref,
    list_payments,
    list_payments_for_user,
    update_payment_status,
)
from ..repositories.settings_repository import get_premium_product
from ..serialization import to_json_safe

router = APIRouter(prefix="/api/payments", tags=["payments"])

DEFAULT_PRODUCT = {
    "id": "myface_report",
    "name": "MyFace Premium Report",
    "description": "Full facial analysis report with review-ready PDF workflow.",
    "amountCents": 50,
    "currency": "usd",
}


class CheckoutRequest(BaseModel):
    assessmentId: Optional[str] = None
    planId: str = Field(default=DEFAULT_PRODUCT["id"])
    successUrl: Optional[str] = None
    cancelUrl: Optional[str] = None


class PayPalCaptureRequest(BaseModel):
    orderId: str


class StripeConfirmRequest(BaseModel):
    sessionId: str


def _public_base_url() -> str:
    return os.environ.get("PUBLIC_APP_URL", "http://localhost:3000").rstrip("/")


def _stripe_key() -> str:
    return os.environ.get("STRIPE_SECRET_KEY", "").strip()


def _stripe_webhook_secret() -> str:
    return os.environ.get("STRIPE_WEBHOOK_SECRET", "").strip()


def _paypal_client_id() -> str:
    return os.environ.get("PAYPAL_CLIENT_ID", "").strip()


def _paypal_secret() -> str:
    return os.environ.get("PAYPAL_CLIENT_SECRET", "").strip()


def _paypal_base_url() -> str:
    env = os.environ.get("PAYPAL_ENV", "sandbox").lower()
    if env == "live":
        return "https://api-m.paypal.com"
    return "https://api-m.sandbox.paypal.com"


def _payment_config() -> dict:
    return {
        "product": DEFAULT_PRODUCT,
        "stripe": {"configured": bool(_stripe_key())},
        "paypal": {"configured": bool(_paypal_client_id() and _paypal_secret())},
    }


async def _payment_config_async() -> dict:
    product = await get_premium_product()
    return {
        "product": product,
        "stripe": {"configured": bool(_stripe_key())},
        "paypal": {"configured": bool(_paypal_client_id() and _paypal_secret())},
    }


def _require_db() -> None:
    if not is_mongodb_configured():
        raise HTTPException(status_code=503, detail="MongoDB not configured.")


def _verify_stripe_signature(payload: bytes, signature_header: str, secret: str) -> bool:
    parts = {}
    for item in signature_header.split(","):
        if "=" in item:
            key, value = item.split("=", 1)
            parts.setdefault(key, []).append(value)
    timestamp = (parts.get("t") or [""])[0]
    signatures = parts.get("v1") or []
    if not timestamp or not signatures:
        return False
    try:
        if abs(time.time() - int(timestamp)) > 300:
            return False
    except ValueError:
        return False
    signed_payload = timestamp.encode("utf-8") + b"." + payload
    expected = hmac.new(secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
    return any(hmac.compare_digest(expected, sig) for sig in signatures)


@router.get("/config")
async def get_payment_config():
    if is_mongodb_configured():
        return await _payment_config_async()
    return _payment_config()


@router.get("/my")
async def get_my_payments(limit: int = 20, current_user: dict = Depends(get_current_user)):
    _require_db()
    limit = min(max(1, limit), 100)
    return {"items": to_json_safe(await list_payments_for_user(current_user["id"], limit=limit))}


@router.get("")
async def get_payments(limit: int = 50, current_user: dict = Depends(require_admin)):
    _require_db()
    limit = min(max(1, limit), 100)
    return {"items": to_json_safe(await list_payments(limit=limit))}


@router.delete("")
async def delete_payments(current_user: dict = Depends(require_admin)):
    _require_db()
    return {"paymentsDeleted": await delete_all_payments()}


def _normalize_stripe_checkout_status(data: dict) -> str:
    payment_status = str(data.get("payment_status") or "").lower()
    session_status = str(data.get("status") or "").lower()
    if payment_status == "paid" or session_status == "complete":
        return "paid"
    if payment_status in ("unpaid", "no_payment_required"):
        return "pending"
    return payment_status or session_status or "pending"


@router.post("/stripe/checkout")
async def create_stripe_checkout(
    req: CheckoutRequest,
    current_user: dict = Depends(get_current_user),
):
    _require_db()
    secret_key = _stripe_key()
    if not secret_key:
        raise HTTPException(status_code=503, detail="Stripe is not configured.")

    product = await get_premium_product()
    success_url = req.successUrl or f"{_public_base_url()}/?payment=stripe-success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = req.cancelUrl or f"{_public_base_url()}/?payment=stripe-cancel"
    form = {
        "mode": "payment",
        "success_url": success_url,
        "cancel_url": cancel_url,
        "client_reference_id": current_user["id"],
        "customer_email": current_user["email"],
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": product["currency"],
        "line_items[0][price_data][unit_amount]": str(product["amountCents"]),
        "line_items[0][price_data][product_data][name]": product["name"],
        "line_items[0][price_data][product_data][description]": product["description"],
        "metadata[userId]": current_user["id"],
        "metadata[planId]": req.planId,
    }
    if req.assessmentId:
        form["metadata[assessmentId]"] = req.assessmentId

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://api.stripe.com/v1/checkout/sessions",
            data=form,
            auth=(secret_key, ""),
        )
    data = response.json()
    if response.status_code >= 400:
        raise HTTPException(status_code=400, detail=data.get("error", {}).get("message", "Stripe checkout failed."))

    payment = await create_payment(
        user_id=current_user["id"],
        assessment_id=req.assessmentId,
        provider="stripe",
        provider_ref=data.get("id"),
        checkout_url=data.get("url"),
        amount_cents=product["amountCents"],
        currency=product["currency"],
        plan_id=req.planId,
        status=_normalize_stripe_checkout_status(data),
        raw=data,
    )
    return {"checkoutUrl": data.get("url"), "payment": to_json_safe(payment)}


@router.post("/stripe/confirm")
async def confirm_stripe_checkout(
    req: StripeConfirmRequest,
    current_user: dict = Depends(get_current_user),
):
    _require_db()
    secret_key = _stripe_key()
    if not secret_key:
        raise HTTPException(status_code=503, detail="Stripe is not configured.")

    payment = await get_payment_by_provider_ref("stripe", req.sessionId)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment session not found.")
    if payment.get("userId") != current_user["id"] and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="You do not have access to this payment.")

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            f"https://api.stripe.com/v1/checkout/sessions/{req.sessionId}",
            auth=(secret_key, ""),
        )
    data = response.json()
    if response.status_code >= 400:
        raise HTTPException(status_code=400, detail=data.get("error", {}).get("message", "Stripe confirmation failed."))

    status = _normalize_stripe_checkout_status(data)
    updated = await update_payment_status("stripe", req.sessionId, status=status, raw=data)
    return {"payment": to_json_safe(updated)}


@router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    _require_db()
    payload = await request.body()
    webhook_secret = _stripe_webhook_secret()
    if webhook_secret:
        signature = request.headers.get("stripe-signature", "")
        if not _verify_stripe_signature(payload, signature, webhook_secret):
            raise HTTPException(status_code=400, detail="Invalid Stripe webhook signature.")

    try:
        event = json.loads(payload.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Stripe webhook payload.")

    event_type = event.get("type")
    obj = (event.get("data") or {}).get("object") or {}
    if event_type == "checkout.session.completed" and obj.get("id"):
        await update_payment_status("stripe", obj["id"], status="paid", raw=event)
    elif event_type == "checkout.session.expired" and obj.get("id"):
        await update_payment_status("stripe", obj["id"], status="expired", raw=event)

    return {"received": True}


async def _paypal_access_token() -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{_paypal_base_url()}/v1/oauth2/token",
            data={"grant_type": "client_credentials"},
            auth=(_paypal_client_id(), _paypal_secret()),
        )
    data = response.json()
    if response.status_code >= 400 or not data.get("access_token"):
        raise HTTPException(status_code=400, detail=data.get("error_description") or "PayPal authentication failed.")
    return data["access_token"]


@router.post("/paypal/orders")
async def create_paypal_order(
    req: CheckoutRequest,
    current_user: dict = Depends(get_current_user),
):
    _require_db()
    if not (_paypal_client_id() and _paypal_secret()):
        raise HTTPException(status_code=503, detail="PayPal is not configured.")

    product = await get_premium_product()
    token = await _paypal_access_token()
    body = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "reference_id": req.assessmentId or current_user["id"],
                "custom_id": current_user["id"],
                "description": product["description"],
                "amount": {
                    "currency_code": product["currency"].upper(),
                    "value": f"{product['amountCents'] / 100:.2f}",
                },
            }
        ],
        "application_context": {
            "brand_name": "MyFace",
            "shipping_preference": "NO_SHIPPING",
            "user_action": "PAY_NOW",
            "return_url": req.successUrl or f"{_public_base_url()}/?payment=paypal-success",
            "cancel_url": req.cancelUrl or f"{_public_base_url()}/?payment=paypal-cancel",
        },
    }
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{_paypal_base_url()}/v2/checkout/orders",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=body,
        )
    data = response.json()
    if response.status_code >= 400:
        raise HTTPException(status_code=400, detail=data.get("message") or "PayPal order creation failed.")

    approve_url = next((link.get("href") for link in data.get("links", []) if link.get("rel") == "approve"), None)
    payment = await create_payment(
        user_id=current_user["id"],
        assessment_id=req.assessmentId,
        provider="paypal",
        provider_ref=data.get("id"),
        checkout_url=approve_url,
        amount_cents=product["amountCents"],
        currency=product["currency"],
        plan_id=req.planId,
        status=data.get("status", "created").lower(),
        raw=data,
    )
    return {"orderId": data.get("id"), "approveUrl": approve_url, "payment": to_json_safe(payment)}


@router.post("/paypal/capture")
async def capture_paypal_order(
    req: PayPalCaptureRequest,
    current_user: dict = Depends(get_current_user),
):
    _require_db()
    payment = await get_payment_by_provider_ref("paypal", req.orderId)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment order not found.")
    if payment.get("userId") != current_user["id"] and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="You do not have access to this payment.")

    token = await _paypal_access_token()
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{_paypal_base_url()}/v2/checkout/orders/{req.orderId}/capture",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
    data = response.json()
    if response.status_code >= 400:
        raise HTTPException(status_code=400, detail=data.get("message") or "PayPal capture failed.")

    status = "paid" if data.get("status") == "COMPLETED" else data.get("status", "pending").lower()
    updated = await update_payment_status("paypal", req.orderId, status=status, raw=data)
    return {"payment": to_json_safe(updated)}
