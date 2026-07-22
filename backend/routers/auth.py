"""Auth API routes for users and admins."""

from __future__ import annotations

import re
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth import create_access_token, get_current_user, hash_password, require_admin, verify_password
from ..database import is_db_configured
from ..repositories.user_repository import (
    create_user,
    delete_user_and_related_data,
    get_user_with_password_by_email,
    get_user_with_password_by_id,
    list_users,
    serialize_user,
    update_user_password,
    update_user_profile,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

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


class ResetPasswordRequest(BaseModel):
    email: str
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


@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest):
    """Set a new password for an account identified by email (forgot-password flow)."""
    if not is_db_configured():
        raise HTTPException(status_code=503, detail="Database not configured")
    email = _validate_email(req.email)
    new_password = _validate_new_password(req.newPassword)
    doc = await get_user_with_password_by_email(email)
    if not doc:
        raise HTTPException(status_code=404, detail="No account found for that email")
    try:
        await update_user_password(doc["id"], hash_password(new_password))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@router.get("/admin-check")
async def admin_check(current_user: dict = Depends(require_admin)):
    return {"ok": True, "role": current_user["role"]}


@router.get("/users")
async def get_users(limit: int = 100, current_user: dict = Depends(require_admin)):
    if not is_db_configured():
        raise HTTPException(status_code=503, detail="Database not configured")
    limit = min(max(1, limit), 250)
    return {"items": await list_users(limit=limit)}


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
