"""Notification service endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth import require_admin
from ..email_service import email_config, send_email

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
    result = send_email(
        to_email=req.toEmail,
        subject="MyFace email test",
        text="MyFace transactional email is configured correctly.",
        html="<p>MyFace transactional email is configured correctly.</p>",
    )
    if not result.get("sent"):
        raise HTTPException(status_code=503, detail=result.get("error") or "Email send failed.")
    return result
