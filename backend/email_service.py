"""SMTP email helper for transactional notifications."""

from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage
from typing import Optional


def email_config() -> dict:
    host = os.environ.get("SMTP_HOST", "").strip()
    username = os.environ.get("SMTP_USERNAME", "").strip()
    password = os.environ.get("SMTP_PASSWORD", "").strip()
    from_email = os.environ.get("SMTP_FROM_EMAIL", "").strip()
    return {
        "configured": bool(host and from_email and (username or password)),
        "host": host,
        "port": int(os.environ.get("SMTP_PORT", "587") or 587),
        "fromEmail": from_email,
        "fromName": os.environ.get("SMTP_FROM_NAME", "MyFace"),
    }


def send_email(*, to_email: str, subject: str, text: str, html: Optional[str] = None) -> dict:
    cfg = email_config()
    if not cfg["configured"]:
        return {"sent": False, "error": "SMTP email is not configured."}

    msg = EmailMessage()
    from_name = cfg["fromName"]
    msg["From"] = f"{from_name} <{cfg['fromEmail']}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")

    username = os.environ.get("SMTP_USERNAME", "").strip()
    password = os.environ.get("SMTP_PASSWORD", "").strip()
    use_tls = os.environ.get("SMTP_USE_TLS", "true").lower() != "false"

    try:
        with smtplib.SMTP(cfg["host"], cfg["port"], timeout=20) as smtp:
            if use_tls:
                smtp.starttls()
            if username or password:
                smtp.login(username, password)
            smtp.send_message(msg)
        return {"sent": True, "error": None}
    except Exception as exc:
        return {"sent": False, "error": str(exc) or "Email send failed."}
