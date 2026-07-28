"""Transactional email facade — sole public API for sending emails."""

from __future__ import annotations

import logging
import os
import uuid

from .email.providers.resend_provider import ResendProvider, _resend_configured
from .email.providers.smtp_provider import SmtpProvider, smtp_configured
from .email.templates import EmailTemplate, render_template
from .repositories.email_send_log_repository import create_email_send_log

logger = logging.getLogger(__name__)

_PROVIDERS = {
    "resend": ResendProvider,
    "smtp": SmtpProvider,
}


def email_config() -> dict:
    """Return provider configuration status for admin diagnostics."""
    default = os.environ.get("EMAIL_DEFAULT_PROVIDER", "resend").strip().lower() or "resend"
    from_address = os.environ.get("EMAIL_FROM_ADDRESS", "").strip() or os.environ.get(
        "SMTP_FROM_EMAIL", ""
    ).strip()
    from_name = os.environ.get("EMAIL_FROM_NAME", "").strip() or os.environ.get("SMTP_FROM_NAME", "MyFace")
    return {
        "defaultProvider": default,
        "configured": _resend_configured() if default == "resend" else smtp_configured(),
        "resendConfigured": _resend_configured(),
        "smtpConfigured": smtp_configured(),
        "fromEmail": from_address,
        "fromName": from_name,
    }


def _resolve_provider(name: str | None) -> str:
    provider = (name or os.environ.get("EMAIL_DEFAULT_PROVIDER", "resend")).strip().lower() or "resend"
    if provider not in _PROVIDERS:
        raise ValueError(f"Unknown email provider: {provider}")
    return provider


def _get_provider_adapter(provider: str):
    return _PROVIDERS[provider]()


async def send_email(
    *,
    to: str,
    template: EmailTemplate,
    data: dict,
    provider: str | None = None,
    user_id: str | None = None,
) -> dict:
    """Send a templated email and log the attempt. Returns normalized result dict."""
    provider_name = _resolve_provider(provider)
    subject, html, text = render_template(template, data)
    log_id = uuid.uuid4()
    uid = None
    if user_id:
        try:
            uid = uuid.UUID(str(user_id))
        except (ValueError, TypeError, AttributeError):
            uid = None

    try:
        adapter = _get_provider_adapter(provider_name)
        result = await adapter.send(to=to, subject=subject, html=html, text=text)
        row = await create_email_send_log(
            log_id=log_id,
            recipient=to,
            template=template,
            provider=provider_name,
            status="sent",
            provider_message_id=result.provider_message_id,
            error_message=None,
            user_id=uid,
            raw=result.raw,
        )
        return {
            "id": row["id"],
            "status": "sent",
            "provider": provider_name,
            "providerMessageId": result.provider_message_id,
        }
    except Exception as exc:
        error_message = str(exc) or "Email send failed."
        logger.warning("Email send failed (%s → %s): %s", template, to, error_message)
        try:
            row = await create_email_send_log(
                log_id=log_id,
                recipient=to,
                template=template,
                provider=provider_name,
                status="failed",
                provider_message_id=None,
                error_message=error_message,
                user_id=uid,
                raw={"error": error_message},
            )
            log_id_str = row["id"]
        except Exception:
            log_id_str = str(log_id)
        return {
            "id": log_id_str,
            "status": "failed",
            "provider": provider_name,
            "error": error_message,
        }


def public_app_url() -> str:
    return os.environ.get("PUBLIC_APP_URL", "http://localhost:3000").rstrip("/")
