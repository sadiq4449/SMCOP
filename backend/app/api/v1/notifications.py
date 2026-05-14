from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.operational import NotificationOut, PaginatedNotifications, UnreadCountOut

router = APIRouter(prefix="/notifications", tags=["notifications"])
AuthUser = Annotated[User, Depends(get_current_user)]


def _n_out(row: Notification) -> NotificationOut:
    return NotificationOut(
        id=str(row.id),
        title=row.title,
        message=row.message,
        is_read=row.is_read,
        kind=row.kind,
        ref_type=row.ref_type,
        ref_id=row.ref_id,
        created_at=row.created_at,
    )


@router.get("/unread-count", response_model=APIResponse[UnreadCountOut])
def unread_count(current_user: AuthUser, db: Session = Depends(get_db)) -> APIResponse[UnreadCountOut]:
    n = db.scalar(select(func.count(Notification.id)).where(Notification.user_id == current_user.id, Notification.is_read.is_(False))) or 0
    return APIResponse(success=True, message="OK", data=UnreadCountOut(unread=int(n)))


@router.get("", response_model=APIResponse[PaginatedNotifications])
def list_notifications(
    current_user: AuthUser,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    unread_only: bool = False,
) -> APIResponse[PaginatedNotifications]:
    stmt = select(Notification).where(Notification.user_id == current_user.id)
    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))
    count_stmt = select(func.count(Notification.id)).where(Notification.user_id == current_user.id)
    if unread_only:
        count_stmt = count_stmt.where(Notification.is_read.is_(False))
    total = db.scalar(count_stmt) or 0
    rows = db.scalars(stmt.order_by(Notification.created_at.desc()).offset(skip).limit(limit)).all()
    return APIResponse(
        success=True,
        message="Notifications fetched",
        data=PaginatedNotifications(items=[_n_out(r) for r in rows], total=int(total)),
    )


@router.patch("/{notification_id}/read", response_model=APIResponse[NotificationOut])
def mark_read(
    notification_id: UUID,
    current_user: AuthUser,
    db: Session = Depends(get_db),
) -> APIResponse[NotificationOut]:
    row = db.get(Notification, notification_id)
    if row is None or row.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "message": "Not found", "errors": {"notification_id": "not found"}},
        )
    row.is_read = True
    db.commit()
    db.refresh(row)
    return APIResponse(success=True, message="Marked read", data=_n_out(row))


@router.post("/mark-all-read", response_model=APIResponse[dict[str, int]])
def mark_all_read(current_user: AuthUser, db: Session = Depends(get_db)) -> APIResponse[dict[str, int]]:
    rows = db.scalars(select(Notification).where(Notification.user_id == current_user.id, Notification.is_read.is_(False))).all()
    for r in rows:
        r.is_read = True
    db.commit()
    return APIResponse(success=True, message="All marked read", data={"updated": len(rows)})
