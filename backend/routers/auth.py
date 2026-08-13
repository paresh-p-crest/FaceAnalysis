"""Auth API routes for users and admins."""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from ..auth import create_access_token, get_current_user, hash_password, require_admin, verify_password
from ..auth_rate_limit import check_forgot_password_rate_limit, record_forgot_password_attempt
from ..database import is_db_configured
from ..email_service import public_app_url, send_email
from ..password_reset_service import (
    RESET_TOKEN_ERROR,
    RESET_TOKEN_TTL_MINUTES,
    generate_reset_token,
    hash_reset_token,
    reset_token_expires_at,
)
from ..repositories.password_reset_repository import (
    create_password_reset_token,
    get_valid_reset_token,
    invalidate_unused_tokens_for_user,
    mark_reset_token_used,
)
from ..repositories.user_repository import (
    count_users,
    create_user,
    delete_user_and_related_data,
    get_user_by_email,
    get_user_with_password_by_email,
    get_user_with_password_by_id,
    list_users,
    serialize_user,
    update_user_password,
    update_user_profile,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger(__name__)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class AuthRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(AuthRequest):
    firstName: str
    lastName: str


class AuthResponse(BaseModel):
    token: str
    user: dict


class UpdateProfileRequest(BaseModel):
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    email: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    newPassword: str


def _validate_auth_request(req: AuthRequest) -> tuple[str, str]:
    email = req.email.lower().strip()
    password = req.password
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    return email, password


def _validate_email(email: str) -> str:
    normalized = email.lower().strip()
    if not EMAIL_RE.match(normalized):
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    return normalized


def _validate_new_password(password: str) -> str:
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    return password


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host or "unknown"
    return "unknown"


async def _send_signup_welcome(*, user: dict) -> None:
    try:
        await send_email(
            to=user["email"],
            template="signup_confirmation",
            data={
                "firstName": user.get("firstName") or "",
                "loginUrl": f"{public_app_url()}/auth",
            },
            user_id=user.get("id"),
        )
    except Exception as exc:
        logger.warning("Signup welcome email task failed: %s", exc)


@router.post("/register", response_model=AuthResponse)
async def register(req: RegisterRequest):
    if not is_db_configured():
        raise HTTPException(status_code=503, detail="Database not configured")
    email, password = _validate_auth_request(req)
    first_name = req.firstName.strip()
    last_name = req.lastName.strip()
    if len(first_name) < 1 or len(last_name) < 1:
        raise HTTPException(status_code=400, detail="First and last name are required")
    try:
        user = await create_user(
            email=email,
            password_hash=hash_password(password),
            first_name=first_name,
            last_name=last_name,
            role="user",
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    asyncio.create_task(_send_signup_welcome(user=user))
    return {"token": create_access_token(user), "user": user}


@router.post("/login", response_model=AuthResponse)
async def login(req: AuthRequest):
    if not is_db_configured():
        raise HTTPException(status_code=503, detail="Database not configured")
    email, password = _validate_auth_request(req)
    doc = await get_user_with_password_by_email(email)
    if not doc or not verify_password(password, doc.get("passwordHash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user = serialize_user(doc)
    return {"token": create_access_token(user), "user": user}


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}


@router.patch("/me")
async def update_me(req: UpdateProfileRequest, current_user: dict = Depends(get_current_user)):
    if not is_db_configured():
        raise HTTPException(status_code=503, detail="Database not configured")
    if req.firstName is None and req.lastName is None and req.email is None:
        raise HTTPException(status_code=400, detail="No profile fields to update")
    if req.email is not None:
        email = req.email.lower().strip()
        if not EMAIL_RE.match(email):
            raise HTTPException(status_code=400, detail="Enter a valid email address")
    try:
        user = await update_user_profile(
            current_user["id"],
            first_name=req.firstName,
            last_name=req.lastName,
            email=req.email.lower().strip() if req.email is not None else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"user": user}


@router.post("/change-password")
async def change_password(req: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    if not is_db_configured():
        raise HTTPException(status_code=503, detail="Database not configured")
    new_password = _validate_new_password(req.newPassword)
    doc = await get_user_with_password_by_id(current_user["id"])
    if not doc or not verify_password(req.currentPassword, doc.get("passwordHash", "")):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    try:
        await update_user_password(current_user["id"], hash_password(new_password))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, request: Request):
    """Request a password-reset link. Always returns ok (no email enumeration)."""
    if not is_db_configured():
        raise HTTPException(status_code=503, detail="Database not configured")
    email = _validate_email(req.email)
    client_ip = _client_ip(request)

    if not await check_forgot_password_rate_limit(email=email, client_ip=client_ip):
        return {"ok": True}

    user = await get_user_by_email(email)
    if user:
        await record_forgot_password_attempt(email=email, client_ip=client_ip)
        await invalidate_unused_tokens_for_user(user["id"])
        raw_token, token_hash = generate_reset_token()
        await create_password_reset_token(
            user_id=user["id"],
            token_hash=token_hash,
            expires_at=reset_token_expires_at(),
        )
        reset_url = f"{public_app_url()}/auth/reset?token={raw_token}"
        try:
            await send_email(
                to=user["email"],
                template="password_reset",
                data={
                    "firstName": user.get("firstName") or "",
                    "resetUrl": reset_url,
                    "expiresInMinutes": RESET_TOKEN_TTL_MINUTES,
                },
                user_id=user.get("id"),
            )
        except Exception as exc:
            logger.warning("Password reset email failed for %s: %s", email, exc)

    return {"ok": True}


@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest):
    """Set a new password using a reset token from email."""
    if not is_db_configured():
        raise HTTPException(status_code=503, detail="Database not configured")
    new_password = _validate_new_password(req.newPassword)
    token = (req.token or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail=RESET_TOKEN_ERROR)

    token_row = await get_valid_reset_token(hash_reset_token(token))
    if not token_row:
        raise HTTPException(status_code=400, detail=RESET_TOKEN_ERROR)

    try:
        await update_user_password(token_row["userId"], hash_password(new_password))
        await mark_reset_token_used(token_row["id"])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=RESET_TOKEN_ERROR) from exc
    return {"ok": True}


@router.get("/admin-check")
async def admin_check(current_user: dict = Depends(require_admin)):
    return {"ok": True, "role": current_user["role"]}


@router.get("/users")
async def get_users(limit: int = 50, offset: int = 0, current_user: dict = Depends(require_admin)):
    if not is_db_configured():
        raise HTTPException(status_code=503, detail="Database not configured")
    limit = min(max(1, limit), 100)
    offset = max(0, offset)
    items = await list_users(limit=limit, offset=offset)
    total = await count_users()
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_admin)):
    if not is_db_configured():
        raise HTTPException(status_code=503, detail="Database not configured")
    if user_id == current_user.get("id"):
        raise HTTPException(status_code=400, detail="You cannot delete your own admin account.")
    try:
        result = await delete_user_and_related_data(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return result
