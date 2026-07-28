"""SMTP provider adapter for local dev fallback."""

from __future__ import annotations

import asyncio
import os
import smtplib
from email.message import EmailMessage

from .base import EmailSendOptions, ProviderSendResult


def smtp_configured() -> bool:
    host = os.environ.get("SMTP_HOST", "").strip()
    from_email = os.environ.get("SMTP_FROM_EMAIL", "").strip() or os.environ.get(
        "EMAIL_FROM_ADDRESS", ""
    ).strip()
    username = os.environ.get("SMTP_USERNAME", "").strip()
    password = os.environ.get("SMTP_PASSWORD", "").strip()
    return bool(host and from_email and (username or password))


def _smtp_send_sync(*, to: str, subject: str, html: str, text: str | None) -> dict:
    host = os.environ.get("SMTP_HOST", "").strip()
    port = int(os.environ.get("SMTP_PORT", "587") or 587)
    from_email = os.environ.get("SMTP_FROM_EMAIL", "").strip() or os.environ.get(
        "EMAIL_FROM_ADDRESS", ""
    ).strip()
    from_name = os.environ.get("SMTP_FROM_NAME", "").strip() or os.environ.get("EMAIL_FROM_NAME", "MyFace")
    username = os.environ.get("SMTP_USERNAME", "").strip()
    password = os.environ.get("SMTP_PASSWORD", "").strip()
    use_tls = os.environ.get("SMTP_USE_TLS", "true").lower() != "false"

    msg = EmailMessage()
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text or "")
    if html:
        msg.add_alternative(html, subtype="html")

    with smtplib.SMTP(host, port, timeout=20) as smtp:
        if use_tls:
            smtp.starttls()
        if username or password:
            smtp.login(username, password)
        smtp.send_message(msg)
    return {"transport": "smtp", "to": to}


class SmtpProvider:
    async def send(
        self,
        *,
        to: str,
        subject: str,
        html: str,
        text: str | None = None,
        options: EmailSendOptions | None = None,
    ) -> ProviderSendResult:
        if not smtp_configured():
            raise RuntimeError("SMTP email is not configured.")
        raw = await asyncio.to_thread(
            _smtp_send_sync,
            to=to,
            subject=subject,
            html=html,
            text=text,
        )
        return ProviderSendResult(provider_message_id=None, raw=raw)
