"""Tests for landing-page paid account import helpers."""

import os

import pytest

from backend.landing_import_service import (
    LandingImportError,
    import_fingerprint,
    verify_import_secret,
)


SAMPLE_PAYLOAD = {
    "sourceSystem": "myface.de",
    "sourceCustomerId": "cust_8f2a91bc-4e3d-4c1a-9b7e-landing-uuid",
    "order": {
        "orderNumber": "MF-2026-004821",
        "productId": "premium",
        "currency": "EUR",
        "amountCents": 4990,
    },
    "customer": {
        "email": "jane.doe@example.com",
        "firstName": "Jane",
        "lastName": "Doe",
        "locale": "de",
    },
    "payment": {
        "provider": "myface_landing",
        "status": "paid",
        "paymentIntentId": "pi_3QxYzExampleLanding0001",
        "stripeCustomerId": "cus_RkLandingCustomer01",
        "paidAt": "2026-09-07T12:34:56Z",
    },
}


def test_import_fingerprint_stable():
    a = import_fingerprint(SAMPLE_PAYLOAD)
    b = import_fingerprint(SAMPLE_PAYLOAD)
    assert a == b


def test_import_fingerprint_changes_when_amount_differs():
    other = {**SAMPLE_PAYLOAD, "order": {**SAMPLE_PAYLOAD["order"], "amountCents": 5990}}
    assert import_fingerprint(SAMPLE_PAYLOAD) != import_fingerprint(other)


def test_verify_import_secret_accepts_bearer(monkeypatch):
    monkeypatch.setenv("MYFACE_IMPORT_SECRET", "test-secret-abc")
    verify_import_secret("Bearer test-secret-abc")


def test_verify_import_secret_rejects_wrong_token(monkeypatch):
    monkeypatch.setenv("MYFACE_IMPORT_SECRET", "test-secret-abc")
    with pytest.raises(LandingImportError) as exc:
        verify_import_secret("Bearer wrong")
    assert exc.value.status_code == 401


def test_verify_import_secret_requires_config(monkeypatch):
    monkeypatch.delenv("MYFACE_IMPORT_SECRET", raising=False)
    with pytest.raises(LandingImportError) as exc:
        verify_import_secret("Bearer anything")
    assert exc.value.status_code == 503


def test_sanitize_metadata_allowlist_only():
    from backend.landing_import_service import sanitize_metadata

    cleaned = sanitize_metadata(
        {
            "addons": ["express"],
            "delivery": "standard",
            "discountCodeUsed": "WELCOME10",
            "source": "fragebogen",
            "secondPersonEmail": "Partner@Example.com",
            "stripeSecret": "sk_live_should_drop",
            "packageName": "Premium",
        }
    )
    assert cleaned["secondPersonEmail"] == "partner@example.com"
    assert "stripeSecret" not in cleaned
    assert cleaned["addons"] == ["express"]


def test_import_fingerprint_ignores_metadata():
    with_meta = {
        **SAMPLE_PAYLOAD,
        "metadata": {"addons": ["a"], "delivery": "express"},
    }
    assert import_fingerprint(SAMPLE_PAYLOAD) == import_fingerprint(with_meta)