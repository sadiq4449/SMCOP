from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.middleware.rbac import role_required
from app.models.activity_log import ActivityLog
from app.models.user import User, UserRole
from app.schemas.common import APIResponse
from app.schemas.user_admin import ActivityLogOut, PaginatedActivityLogs

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
