"""
Authentication routes for NUCLEUS AI.

Endpoints:
- POST /api/auth/register : Register a new researcher account (starts as 'pending')
- POST /api/auth/login    : Authenticate researcher / admin with credential and status checks
- GET  /api/auth/me       : Get current authenticated user profile
- POST /api/auth/logout   : Client-side session logout acknowledgement
"""

from __future__ import annotations

import re
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from db.store import run_store
from services.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# --------------------------------------------------------------------------- #
# Schemas
# --------------------------------------------------------------------------- #
class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    email: str = Field(..., min_length=3, max_length=160)
    password: str = Field(..., min_length=6, max_length=128)
    confirm_password: Optional[str] = None
    organization: Optional[str] = Field("", max_length=160)
    research_domain: Optional[str] = Field("", max_length=120)

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_REGEX.match(v):
            raise ValueError("Invalid email format.")
        return v


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=160)
    password: str = Field(..., min_length=1)

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_REGEX.match(v):
            raise ValueError("Invalid email format.")
        return v


class UserProfile(BaseModel):
    id: str
    full_name: str
    email: str
    organization: str
    research_domain: str
    role: str
    status: str
    created_at: str
    approved_at: Optional[str] = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfile
    message: str = "Authentication successful"


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #
@router.post("/register", response_model=Dict[str, Any], summary="Register new researcher account")
def register(req: RegisterRequest) -> Dict[str, Any]:
    """
    Register a new researcher account.
    All new registrations enter 'pending' status awaiting administrator approval.
    """
    if req.confirm_password is not None and req.password != req.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match.",
        )

    clean_email = req.email.strip().lower()
    existing = run_store.get_user_by_email(clean_email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    pwd_hash = hash_password(req.password)
    user = run_store.create_user(
        full_name=req.full_name,
        email=clean_email,
        password_hash=pwd_hash,
        organization=req.organization or "",
        research_domain=req.research_domain or "",
        role="researcher",
        status="pending",
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to register user. Database error.",
        )

    user.pop("password_hash", None)
    return {
        "status": "pending",
        "message": (
            "Registration submitted successfully. "
            "Your account is awaiting admin approval."
        ),
        "user": user,
    }


@router.post("/login", response_model=AuthResponse, summary="Authenticate user")
def login(req: LoginRequest) -> AuthResponse:
    """
    Authenticate user by email and password.
    Enforces account status check:
    - pending: 403 Forbidden ("Your account is waiting for administrator approval.")
    - rejected: 403 Forbidden ("Your registration was not approved.")
    - suspended: 403 Forbidden ("Your account has been suspended. Contact the administrator.")
    - approved: 200 OK + JWT access token
    """
    clean_email = req.email.strip().lower()
    user = run_store.get_user_by_email(clean_email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    user_status = user.get("status")
    if user_status == "pending":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is waiting for administrator approval.",
        )
    elif user_status == "rejected":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your registration was not approved.",
        )
    elif user_status == "suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been suspended. Contact the administrator.",
        )
    elif user_status != "approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized account status.",
        )

    token = create_access_token({
        "sub": user["id"],
        "email": user["email"],
        "role": user["role"],
        "name": user["full_name"],
    })

    user_copy = dict(user)
    user_copy.pop("password_hash", None)

    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user=UserProfile(**user_copy),
        message="Login successful",
    )


@router.get("/me", response_model=UserProfile, summary="Current user profile")
def get_me(current_user: Dict[str, Any] = Depends(get_current_user)) -> UserProfile:
    """Return profile of currently authenticated user."""
    user_copy = dict(current_user)
    user_copy.pop("password_hash", None)
    return UserProfile(**user_copy)


@router.post("/logout", summary="Logout current session")
def logout() -> Dict[str, str]:
    """Client-side token invalidation acknowledgement."""
    return {"status": "ok", "message": "Logged out successfully."}
