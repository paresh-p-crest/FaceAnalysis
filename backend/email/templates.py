"""Transactional email template registry."""

from __future__ import annotations

from html import escape
from typing import Literal

EmailTemplate = Literal["signup_confirmation", "report_ready", "password_reset"]

_TEMPLATE_REQUIRED_KEYS: dict[str, frozenset[str]] = {
    "signup_confirmation": frozenset({"firstName", "loginUrl"}),
    "password_reset": frozenset({"firstName", "resetUrl", "expiresInMinutes"}),
    "report_ready": frozenset({"firstName", "reportUrl", "assessmentId"}),
}


def _validate_data(template: EmailTemplate, data: dict) -> None:
    required = _TEMPLATE_REQUIRED_KEYS[template]
    missing = required - set(data.keys())
    if missing:
        raise ValueError(f"Template {template} missing keys: {', '.join(sorted(missing))}")


def _wrap_html(body: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; line-height: 1.5;">
  <div style="max-width: 560px; margin: 0 auto; padding: 24px;">
    {body}
    <p style="margin-top: 32px; font-size: 12px; color: #666;">MyFace — AI facial analysis</p>
  </div>
</body>
</html>"""


def render_template(template: EmailTemplate, data: dict) -> tuple[str, str, str]:
    """Return (subject, html, text) for the given template."""
    _validate_data(template, data)
    first_name = escape(str(data["firstName"] or "there"))

    if template == "signup_confirmation":
        login_url = str(data["loginUrl"])
        subject = "Welcome to MyFace"
        html = _wrap_html(
            f"<h1 style=\"font-size: 22px;\">Welcome, {first_name}!</h1>"
            f"<p>Your MyFace account is ready. Sign in to start your facial analysis.</p>"
            f"<p><a href=\"{escape(login_url)}\" style=\"color: #0d9488;\">Go to MyFace</a></p>"
        )
        text = f"Welcome, {data['firstName'] or 'there'}!\n\nYour MyFace account is ready.\nSign in: {login_url}"
        return subject, html, text

    if template == "password_reset":
        reset_url = str(data["resetUrl"])
        expires = int(data["expiresInMinutes"])
        subject = "Reset your MyFace password"
        html = _wrap_html(
            f"<h1 style=\"font-size: 22px;\">Password reset</h1>"
            f"<p>Hi {first_name}, we received a request to reset your password.</p>"
            f"<p><a href=\"{escape(reset_url)}\" style=\"color: #0d9488;\">Reset password</a></p>"
            f"<p>This link expires in {expires} minutes. If you did not request this, you can ignore this email.</p>"
        )
        text = (
            f"Hi {data['firstName'] or 'there'},\n\n"
            f"Reset your password: {reset_url}\n\n"
            f"This link expires in {expires} minutes."
        )
        return subject, html, text

    if template == "report_ready":
        report_url = str(data["reportUrl"])
        subject = "Your MyFace report is ready"
        html = _wrap_html(
            f"<h1 style=\"font-size: 22px;\">Your report is ready</h1>"
            f"<p>Hi {first_name}, your facial analysis report has been approved.</p>"
            f"<p><a href=\"{escape(report_url)}\" style=\"color: #0d9488;\">View your report</a></p>"
        )
        text = (
            f"Hi {data['firstName'] or 'there'},\n\n"
            f"Your facial analysis report is ready.\nView it: {report_url}"
        )
        return subject, html, text

    raise ValueError(f"Unknown template: {template}")
