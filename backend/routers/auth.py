"""Auth API routes for users and admins."""

from __future__ import annotations

import re
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth import create_access_token, get_current_user, hash_password, require_admin, verify_password
from ..database import is_mongodb_configured
from ..repositories.user_repository import (
    create_user,
    delete_user_and_related_data,
    get_user_with_password_by_email,
    list_users,
    serialize_user,
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


def _validate_auth_request(req: AuthRequest) -> tuple[str, str]:
    email = req.email.lower().strip()
    password = req.password
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    return email, password


@router.post("/register", response_model=AuthResponse)
async def register(req: RegisterRequest):
    if not is_mongodb_configured():
        raise HTTPException(status_code=503, detail="MongoDB not configured")
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
    if not is_mongodb_configured():
        raise HTTPException(status_code=503, detail="MongoDB not configured")
    email, password = _validate_auth_request(req)
    doc = await get_user_with_password_by_email(email)
    if not doc or not verify_password(password, doc.get("passwordHash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user = serialize_user(doc)
    return {"token": create_access_token(user), "user": user}


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}


@router.get("/admin-check")
async def admin_check(current_user: dict = Depends(require_admin)):
    return {"ok": True, "role": current_user["role"]}


@router.get("/users")
async def get_users(limit: int = 100, current_user: dict = Depends(require_admin)):
    if not is_mongodb_configured():
        raise HTTPException(status_code=503, detail="MongoDB not configured")
    limit = min(max(1, limit), 250)
    return {"items": await list_users(limit=limit)}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_admin)):
    if not is_mongodb_configured():
        raise HTTPException(status_code=503, detail="MongoDB not configured")
    if user_id == current_user.get("id"):
        raise HTTPException(status_code=400, detail="You cannot delete your own admin account.")
    try:
        result = await delete_user_and_related_data(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return result
