"""Business logic for landing-page paid account import."""

from __future__ import annotations

import hmac
import json
import os
import re
import secrets
from typing import Any, Optional

from .auth import hash_password
from .email_service import public_app_url
from .entitlements import VALID_PACKAGE_IDS, effective_addon_ids, normalize_addon_ids
from .password_setup_service import (
    generate_setup_token,
    setup_token_expires_at,
)
from .repositories.password_setup_repository import (
    create_password_setup_token,
    invalidate_unused_setup_tokens_for_user,
)
from .repositories.payment_repository import create_payment, get_payment_by_provider_ref
from .repositories.user_repository import (
    create_imported_user,
    get_user_with_password_by_email,
    refresh_user_entitlements_from_payments,
    serialize_user,
)

LANDING_IMPORT_PROVIDER = "myface_landing"
ALLOWED_SOURCE_SYSTEM = "myface.de"
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PI_RE = re.compile(r"^pi_[A-Za-z0-9_]+$")
CUS_RE = re.compile(r"^cus_[A-Za-z0-9_]+$")

# Optional commercial / support fields stored in payments.raw (not in idempotency fingerprint).
METADATA_ALLOWLIST = frozenset(
    {
        "landingOrderId",
        "packageName",
        "addons",
        "delivery",
        "discountCodeUsed",
        "source",
        "secondPersonEmail",
        "currency",
    }
)


class LandingImportError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


def _import_secret() -> str:
    return os.environ.get("MYFACE_IMPORT_SECRET", "").strip()


def verify_import_secret(authorization: Optional[str]) -> None:
    secret = _import_secret()
    if not secret:
        raise LandingImportError(503, "Landing import is not configured.")
    if not authorization or not authorization.startswith("Bearer "):
        raise LandingImportError(401, "Missing or invalid import bearer secret.")
    token = authorization[7:].strip()
    if not token or not hmac.compare_digest(token, secret):
        raise LandingImportError(401, "Missing or invalid import bearer secret.")


def _normalize_email(email: str) -> str:
    normalized = email.lower().strip()
    if not EMAIL_RE.match(normalized):
        raise LandingImportError(400, "Invalid customer email.")
    return normalized


def _validate_stripe_ids(payment_intent_id: str, stripe_customer_id: str) -> None:
    if not payment_intent_id or not PI_RE.match(payment_intent_id):
        raise LandingImportError(400, "payment.paymentIntentId must be a Stripe PaymentIntent id (pi_…).")
    if not stripe_customer_id or not CUS_RE.match(stripe_customer_id):
        raise LandingImportError(400, "payment.stripeCustomerId must be a Stripe Customer id (cus_…).")


def sanitize_metadata(raw_meta: Any) -> dict[str, Any]:
    """Keep only known support fields; drop secrets / oversized junk."""
    if not isinstance(raw_meta, dict):
        return {}
    out: dict[str, Any] = {}
    for key, value in raw_meta.items():
        if key not in METADATA_ALLOWLIST:
            continue
        if value is None:
            continue
        if isinstance(value, str) and len(value) > 2000:
            continue
        if key == "addons" and not isinstance(value, (list, dict, str)):
            continue
        if key == "secondPersonEmail" and isinstance(value, str):
            out[key] = value.lower().strip()
            continue
        out[key] = value
    return out


def import_fingerprint(payload: dict) -> str:
    """Stable JSON fingerprint for money/identity only (metadata excluded)."""
    customer = payload.get("customer") or {}
    order = payload.get("order") or {}
    payment = payload.get("payment") or {}
    canonical = {
        "sourceCustomerId": (payload.get("sourceCustomerId") or "").strip() or None,
        "customerEmail": _normalize_email(customer.get("email", "")),
        "customerFirstName": (customer.get("firstName") or "").strip(),
        "customerLastName": (customer.get("lastName") or "").strip(),
        "orderNumber": (order.get("orderNumber") or "").strip() or None,
        "productId": (order.get("productId") or "").strip(),
        "currency": (order.get("currency") or "").strip().lower(),
        "amountCents": int(order.get("amountCents", -1)),
        "paymentIntentId": (payment.get("paymentIntentId") or "").strip(),
        "stripeCustomerId": (payment.get("stripeCustomerId") or "").strip(),
        "status": (payment.get("status") or "").strip().lower(),
    }
    return json.dumps(canonical, sort_keys=True, separators=(",", ":"))


def _payment_raw(payload: dict) -> dict:
    customer = payload.get("customer") or {}
    order = payload.get("order") or {}
    payment = payload.get("payment") or {}
    meta = sanitize_metadata(payload.get("metadata"))
    product_id = (order.get("productId") or "").strip()
    # Promote common order-level optional fields into metadata if not already set.
    if order.get("packageName") and "packageName" not in meta:
        meta["packageName"] = order.get("packageName")
    if order.get("landingOrderId") and "landingOrderId" not in meta:
        meta["landingOrderId"] = order.get("landingOrderId")

    raw_addons = meta.get("addons")
    if raw_addons is None:
        raw_addons = ""
    addon_ids = normalize_addon_ids(raw_addons)
    effective = effective_addon_ids(product_id, addon_ids)

    raw: dict[str, Any] = {
        "sourceSystem": payload.get("sourceSystem") or ALLOWED_SOURCE_SYSTEM,
        "sourceCustomerId": payload.get("sourceCustomerId"),
        "sourceSessionId": payload.get("sourceSessionId"),
        "orderNumber": order.get("orderNumber"),
        "productId": order.get("productId"),
        "packageId": product_id,
        "addons": raw_addons,
        "addonIds": addon_ids,
        "effectiveAddonIds": effective,
        "paymentIntentId": payment.get("paymentIntentId"),
        "stripeCustomerId": payment.get("stripeCustomerId"),
        "paidAt": payment.get("paidAt"),
        "locale": customer.get("locale"),
        "importFingerprint": import_fingerprint(payload),
        "metadata": meta,
    }
    if payment.get("checkoutSessionId"):
        raw["checkoutSessionId"] = payment.get("checkoutSessionId")
    return raw


def _login_url() -> str:
    return f"{public_app_url()}/auth"


async def _issue_setup_token(user_id: str) -> tuple[str, str, str]:
    await invalidate_unused_setup_tokens_for_user(user_id)
    raw_token, token_hash = generate_setup_token()
    expires_at = setup_token_expires_at()
    await create_password_setup_token(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    redirect_url = f"{public_app_url()}/auth/setup?token={raw_token}"
    return raw_token, redirect_url, expires_at.isoformat().replace("+00:00", "Z")


def _success_body(
    *,
    user: dict,
    created: bool,
    order_number: Optional[str],
    setup_required: bool,
    setup_token: Optional[str] = None,
    setup_url: Optional[str] = None,
    setup_expires: Optional[str] = None,
) -> dict:
    body: dict[str, Any] = {
        "success": True,
        "status": "created" if created else "already_registered",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "created": created,
        },
        "order": {
            "orderNumber": order_number,
            "status": "paid",
        },
    }
    if setup_required:
        body["passwordSetup"] = {
            "required": True,
            "redirectToken": setup_token,
            "expiresAt": setup_expires,
            "redirectUrl": setup_url,
        }
    else:
        body["passwordSetup"] = {"required": False}
        body["loginUrl"] = _login_url()
    return body


async def import_landing_session(*, idempotency_key: str, payload: dict) -> tuple[int, dict]:
    """Import a verified paid landing checkout.

    Dedup rules (app-owned — landing need not store import status columns):
    - Same Idempotency-Key / pi_… + same money/identity fingerprint → replay success
      (may re-issue unused setup URL if password still pending).
    - Same key + different money/identity → 409.
    - Same email, new pi_… → same user, new payments row; never overwrite a real password.
    - Optional metadata is stored on first write only; not part of the fingerprint.
    """
    key = idempotency_key.strip()
    if not key or len(key) > 128:
        raise LandingImportError(400, "Idempotency-Key must be 1–128 characters.")

    source_system = (payload.get("sourceSystem") or ALLOWED_SOURCE_SYSTEM).strip()
    if source_system != ALLOWED_SOURCE_SYSTEM:
        raise LandingImportError(400, f"sourceSystem must be {ALLOWED_SOURCE_SYSTEM}.")

    customer = payload.get("customer") or {}
    order = payload.get("order") or {}
    payment = payload.get("payment") or {}

    email = _normalize_email(customer.get("email", ""))
    product_id = (order.get("productId") or "").strip()
    currency = (order.get("currency") or "").strip()
    if not product_id:
        raise LandingImportError(400, "order.productId is required.")
    if product_id not in VALID_PACKAGE_IDS:
        raise LandingImportError(400, f"Unknown order.productId: {product_id}")
    if len(product_id) > 64:
        raise LandingImportError(400, "order.productId must be at most 64 characters.")
    if not currency:
        raise LandingImportError(400, "order.currency is required.")
    try:
        amount_cents = int(order.get("amountCents"))
    except (TypeError, ValueError):
        raise LandingImportError(400, "order.amountCents must be an integer.")
    if amount_cents < 0:
        raise LandingImportError(400, "order.amountCents must be non-negative.")

    payment_intent_id = (payment.get("paymentIntentId") or "").strip()
    stripe_customer_id = (payment.get("stripeCustomerId") or "").strip()
    _validate_stripe_ids(payment_intent_id, stripe_customer_id)

    if payment_intent_id != key:
        raise LandingImportError(400, "Idempotency-Key must equal payment.paymentIntentId.")

    checkout_session_id = (payment.get("checkoutSessionId") or "").strip()
    if checkout_session_id and checkout_session_id != key:
        raise LandingImportError(400, "checkoutSessionId must match Idempotency-Key when provided.")

    status = (payment.get("status") or "").strip().lower()
    if status != "paid":
        raise LandingImportError(400, "payment.status must be paid.")

    # Validate / sanitize metadata early (ignore unknown keys).
    sanitize_metadata(payload.get("metadata"))

    fingerprint = import_fingerprint(payload)
    order_number = (order.get("orderNumber") or "").strip() or None
    first_name = (customer.get("firstName") or "").strip()
    last_name = (customer.get("lastName") or "").strip()

    existing_payment = await get_payment_by_provider_ref(LANDING_IMPORT_PROVIDER, key)
    if existing_payment:
        stored_fp = (existing_payment.get("raw") or {}).get("importFingerprint")
        if stored_fp and stored_fp != fingerprint:
            raise LandingImportError(409, "Idempotency-Key already used with a different request body.")
        from .repositories.user_repository import get_user_by_id

        user = await get_user_by_id(existing_payment["userId"])
        if not user:
            raise LandingImportError(500, "Imported payment references a missing user.")
        user_doc = await get_user_with_password_by_email(user["email"])
        setup_pending = bool(user_doc and user_doc.get("passwordSetupPending"))
        if setup_pending:
            raw_token, setup_url, setup_expires = await _issue_setup_token(user["id"])
            body = _success_body(
                user=user,
                created=False,
                order_number=order_number,
                setup_required=True,
                setup_token=raw_token,
                setup_url=setup_url,
                setup_expires=setup_expires,
            )
            return 200, body
        body = _success_body(
            user=user,
            created=False,
            order_number=order_number,
            setup_required=False,
        )
        return 200, body

    user_doc = await get_user_with_password_by_email(email)
    created = False
    if user_doc is None:
        placeholder_hash = hash_password(secrets.token_urlsafe(32))
        user = await create_imported_user(
            email=email,
            password_hash=placeholder_hash,
            first_name=first_name,
            last_name=last_name,
        )
        created = True
        setup_pending = True
    else:
        user = serialize_user(user_doc)
        setup_pending = bool(user_doc.get("passwordSetupPending"))

    await create_payment(
        user_id=user["id"],
        provider=LANDING_IMPORT_PROVIDER,
        provider_ref=key,
        amount_cents=amount_cents,
        currency=currency,
        plan_id=product_id,
        status="paid",
        raw=_payment_raw(payload),
    )
    user = await refresh_user_entitlements_from_payments(user["id"])

    if setup_pending:
        raw_token, setup_url, setup_expires = await _issue_setup_token(user["id"])
        body = _success_body(
            user=user,
            created=created,
            order_number=order_number,
            setup_required=True,
            setup_token=raw_token,
            setup_url=setup_url,
            setup_expires=setup_expires,
        )
        return (201 if created else 200), body

    body = _success_body(
        user=user,
        created=False,
        order_number=order_number,
        setup_required=False,
    )
    return 200, body
