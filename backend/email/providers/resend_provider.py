"""Resend API adapter — only place the Resend SDK is imported."""

from __future__ import annotations

import asyncio
import os
from typing import Any

from .base import EmailSendOptions, ProviderSendResult


def _resend_configured() -> bool:
    return bool(os.environ.get("RESEND_API_KEY", "").strip())


def _from_address() -> str:
    address = os.environ.get("EMAIL_FROM_ADDRESS", "").strip() or os.environ.get(
        "SMTP_FROM_EMAIL", "noreply@myface.club"
    )
    name = os.environ.get("EMAIL_FROM_NAME", "").strip() or os.environ.get("SMTP_FROM_NAME", "MyFace")
    return f"{name} <{address}>"


def _send_sync(*, to: str, subject: str, html: str, text: str | None) -> dict[str, Any]:
    import resend

    resend.api_key = os.environ.get("RESEND_API_KEY", "").strip()
    params: dict[str, Any] = {
        "from": _from_address(),
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if text:
        params["text"] = text
    result = resend.Emails.send(params)
    if isinstance(result, dict):
        return result
    return {"id": getattr(result, "id", None)}


class ResendProvider:
    async def send(
        self,
        *,
        to: str,
        subject: str,
        html: str,
        text: str | None = None,
        options: EmailSendOptions | None = None,
    ) -> ProviderSendResult:
        if not _resend_configured():
            raise RuntimeError("RESEND_API_KEY is not configured.")
        raw = await asyncio.to_thread(
            _send_sync,
            to=to,
            subject=subject,
            html=html,
            text=text,
        )
        message_id = raw.get("id") if isinstance(raw, dict) else None
        return ProviderSendResult(provider_message_id=message_id, raw=raw if isinstance(raw, dict) else {})
