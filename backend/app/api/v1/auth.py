import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.password_reset import PasswordResetToken
from app.models.user import User, UserStatus
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginData,
    LoginRequest,
    LogoutRequest,
    RefreshData,
    RefreshRequest,
    ResetPasswordRequest,
)
from app.schemas.common import APIResponse, UserPublic
from app.services.audit import log_activity
from app.services.mailer import send_email_best_effort

router = APIRouter(prefix="/auth", tags=["auth"])


def _serialize_user(user: User) -> UserPublic:
    raw_schools = user.assigned_schools if isinstance(user.assigned_schools, list) else []
    schools = [str(x) for x in raw_schools]
    return UserPublic(
        id=str(user.id),
        full_name=user.full_name,
        email=user.email,
        role=user.role.value,
        status=user.status.value,
        partner_org_id=str(user.partner_org_id) if user.partner_org_id else None,
        district_id=str(user.district_id) if user.district_id else None,
        linked_teacher_id=str(user.linked_teacher_id) if user.linked_teacher_id else None,
        assigned_schools=schools,
    )


@router.post("/login", response_model=APIResponse[LoginData])
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> APIResponse[LoginData]:
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None or not verify_password(payload.password, user.password_hash):
        log_activity(
            db,
            action="auth.login_failed",
            target=payload.email,
            metadata={"reason": "invalid_credentials"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "success": False,
                "message": "Invalid email or password",
                "errors": {"credentials": "invalid"},
            },
        )

    if user.status != UserStatus.ACTIVE:
        log_activity(
            db,
            action="auth.login_failed",
            target=str(user.id),
            user_id=user.id,
            metadata={"reason": "inactive_user"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "success": False,
                "message": "Account is inactive",
                "errors": {"status": "inactive"},
            },
        )

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    log_activity(
        db,
        action="auth.login_success",
        target=str(user.id),
        user_id=user.id,
        metadata={"role": user.role.value},
    )

    return APIResponse(
        success=True,
        message="Login successful",
        data=LoginData(
            token=access_token,
            refresh_token=refresh_token,
            role=user.role.value,
            user=_serialize_user(user),
        ),
    )


@router.get("/me", response_model=APIResponse[UserPublic])
def me(current_user: User = Depends(get_current_user)) -> APIResponse[UserPublic]:
    return APIResponse(
        success=True,
        message="Profile fetched successfully",
        data=_serialize_user(current_user),
    )


@router.post("/refresh", response_model=APIResponse[RefreshData])
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> APIResponse[RefreshData]:
    try:
        token_payload = decode_token(payload.refresh_token, "refresh")
        user_id = UUID(token_payload["sub"])
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "success": False,
                "message": "Invalid or expired refresh token",
                "errors": {"refresh_token": "invalid"},
            },
        ) from None

    user = db.get(User, user_id)
    if user is None or user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "success": False,
                "message": "Invalid or expired refresh token",
                "errors": {"refresh_token": "invalid"},
            },
        )

    new_access = create_access_token(user.id)
    new_refresh = create_refresh_token(user.id)
    log_activity(
        db,
        action="auth.refresh_success",
        target=str(user.id),
        user_id=user.id,
    )

    return APIResponse(
        success=True,
        message="Token refreshed successfully",
        data=RefreshData(token=new_access, refresh_token=new_refresh),
    )


@router.post("/logout", response_model=APIResponse[dict[str, str]])
def logout(
    payload: LogoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[dict[str, str]]:
    log_activity(
        db,
        action="auth.logout",
        target=str(current_user.id),
        user_id=current_user.id,
        metadata={"refresh_token_present": bool(payload.refresh_token)},
    )
    return APIResponse(
        success=True,
        message="Logged out successfully",
        data={"status": "ok"},
    )


@router.post("/forgot-password", response_model=APIResponse[dict[str, str]])
def forgot_password(
    payload: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> APIResponse[dict[str, str]]:
    settings = get_settings()
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is not None and user.status == UserStatus.ACTIVE:
        raw = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw.encode()).hexdigest()
        expires = datetime.now(timezone.utc) + timedelta(hours=1)
        row = PasswordResetToken(user_id=user.id, token_hash=token_hash, expires_at=expires)
        db.add(row)
        db.commit()
        link = f"{settings.public_app_url.rstrip('/')}/reset-password?token={raw}"
        body = (
            f"Use this link to reset your password (expires in one hour):\n{link}\n\n"
            "If you did not request a reset, you can ignore this message."
        )
        background_tasks.add_task(send_email_best_effort, user.email, "Password reset — SMCOP", body)
    return APIResponse(
        success=True,
        message="If an account exists for this email, reset instructions were sent.",
        data={"status": "ok"},
    )


@router.post("/reset-password", response_model=APIResponse[dict[str, str]])
def reset_password_endpoint(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
) -> APIResponse[dict[str, str]]:
    token_hash = hashlib.sha256(payload.token.encode()).hexdigest()
    row = db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > datetime.now(timezone.utc),
        ),
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "message": "Invalid or expired reset token",
                "errors": {"token": "invalid"},
            },
        )
    user = db.get(User, row.user_id)
    if user is None or user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "message": "Account unavailable", "errors": {"user": "inactive"}},
        )
    user.password_hash = hash_password(payload.password)
    row.used_at = datetime.now(timezone.utc)
    db.commit()
    log_activity(db, action="auth.password_reset_complete", target=str(user.id), user_id=user.id)
    return APIResponse(success=True, message="Password updated. You can sign in with the new password.", data={"status": "ok"})
