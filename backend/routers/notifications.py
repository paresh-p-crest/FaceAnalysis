"""Notification service endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth import require_admin
from ..email_service import email_config, public_app_url, send_email

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class TestEmailRequest(BaseModel):
    toEmail: str


@router.get("/config")
async def get_notification_config(current_user: dict = Depends(require_admin)):
    return {"email": email_config()}


@router.post("/test-email")
async def post_test_email(req: TestEmailRequest, current_user: dict = Depends(require_admin)):
    if "@" not in req.toEmail:
        raise HTTPException(status_code=400, detail="Valid recipient email is required.")
    result = await send_email(
        to=req.toEmail,
        template="signup_confirmation",
        data={
            "firstName": current_user.get("firstName") or "there",
            "loginUrl": f"{public_app_url()}/auth",
        },
        user_id=current_user.get("id"),
    )
    if result.get("status") != "sent":
        raise HTTPException(status_code=503, detail=result.get("error") or "Email send failed.")
    return result
