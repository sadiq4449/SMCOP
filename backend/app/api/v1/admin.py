import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.middleware.rbac import role_required
from app.models.activity_log import ActivityLog
from app.models.user import User, UserRole
from app.models.webhook_subscription import WebhookSubscription
from app.schemas.common import APIResponse
from app.schemas.operational import WebhookCreate, WebhookOut
from app.schemas.user_admin import ActivityLogOut, PaginatedActivityLogs
from app.services.audit import log_activity
from app.services.webhook_dispatch import WEBHOOK_EVENTS

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/sample", response_model=APIResponse[dict[str, str]])
def admin_sample(
    current_user: User = Depends(role_required(UserRole.SUPER_ADMIN)),
) -> APIResponse[dict[str, str]]:
    return APIResponse(
        success=True,
        message="Super Admin sample route",
        data={"role": current_user.role.value},
    )


@router.get("/activity-logs", response_model=APIResponse[PaginatedActivityLogs])
def list_activity_logs(
    _: User = Depends(role_required(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    action: str | None = Query(None, max_length=200),
) -> APIResponse[PaginatedActivityLogs]:
    stmt = select(ActivityLog)
    count_stmt = select(func.count(ActivityLog.id))
    if action:
        stmt = stmt.where(ActivityLog.action == action)
        count_stmt = count_stmt.where(ActivityLog.action == action)

    total = db.scalar(count_stmt) or 0
    stmt = stmt.order_by(ActivityLog.created_at.desc()).offset(skip).limit(limit)
    rows = db.scalars(stmt).all()

    items = [
        ActivityLogOut(
            id=str(r.id),
            user_id=str(r.user_id) if r.user_id else None,
            action=r.action,
            target=r.target,
            metadata=r.metadata_json,
            created_at=r.created_at,
        )
        for r in rows
    ]
    return APIResponse(
        success=True,
        message="Activity logs fetched successfully",
        data=PaginatedActivityLogs(items=items, total=total),
    )


@router.post("/webhooks", response_model=APIResponse[WebhookOut])
def create_webhook(
    payload: WebhookCreate,
    current_user: User = Depends(role_required(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
) -> APIResponse[WebhookOut]:
    evs = list(dict.fromkeys(payload.events))
    if not evs or not all(e in WEBHOOK_EVENTS for e in evs):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "message": "Invalid events list", "errors": {"events": "invalid"}},
        )
    secret = secrets.token_hex(32)
    row = WebhookSubscription(
        url=payload.url.strip(),
        secret=secret,
        events=evs,
        is_active=True,
        created_by_user_id=current_user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    log_activity(
        db,
        action="webhooks.create",
        target=str(row.id),
        user_id=current_user.id,
        metadata={"events": evs},
    )
    return APIResponse(
        success=True,
        message="Webhook registered; store the secret — it is not shown again.",
        data=WebhookOut(
            id=str(row.id),
            url=row.url,
            events=list(row.events) if row.events else [],
            is_active=row.is_active,
            secret=secret,
            created_at=row.created_at,
        ),
    )


@router.get("/webhooks", response_model=APIResponse[list[WebhookOut]])
def list_webhooks(
    _: User = Depends(role_required(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
) -> APIResponse[list[WebhookOut]]:
    rows = db.scalars(select(WebhookSubscription).order_by(WebhookSubscription.created_at.desc())).all()
    return APIResponse(
        success=True,
        message="Webhooks fetched",
        data=[
            WebhookOut(
                id=str(r.id),
                url=r.url,
                events=list(r.events) if r.events else [],
                is_active=r.is_active,
                secret=None,
                created_at=r.created_at,
            )
            for r in rows
        ],
    )


@router.delete("/webhooks/{webhook_id}", response_model=APIResponse[dict[str, str]])
def delete_webhook(
    webhook_id: UUID,
    current_user: User = Depends(role_required(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
) -> APIResponse[dict[str, str]]:
    row = db.get(WebhookSubscription, webhook_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "message": "Not found", "errors": {"webhook_id": "not found"}},
        )
    db.delete(row)
    db.commit()
    log_activity(db, action="webhooks.delete", target=str(webhook_id), user_id=current_user.id)
    return APIResponse(success=True, message="Webhook removed", data={"status": "ok"})
