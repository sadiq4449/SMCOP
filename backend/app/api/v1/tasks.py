from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.school import School
from app.models.user import User, UserRole
from app.models.work_task import WorkTask
from app.schemas.common import APIResponse
from app.schemas.operational import PaginatedTasks, TaskCreate, TaskOut, TaskPatch
from app.services.audit import log_activity
from app.services.notify import notify_task_assigned
from app.services.school_access import school_scope_filters, user_can_access_school
from app.services.school_assignee_picks import assignee_valid_for_task

router = APIRouter(prefix="/tasks", tags=["tasks"])
AuthUser = Annotated[User, Depends(get_current_user)]


def _forbidden() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"success": False, "message": "Forbidden", "errors": {"tasks": "forbidden"}},
    )


def _task_out(t: WorkTask) -> TaskOut:
    return TaskOut(
        id=str(t.id),
        school_id=str(t.school_id),
        title=t.title,
        details=t.details,
        assignee_user_id=str(t.assignee_user_id),
        due_date=t.due_date,
        is_completed=t.is_completed,
        completed_at=t.completed_at,
        created_by_user_id=str(t.created_by_user_id),
        created_at=t.created_at,
    )


def tasks_select_scoped(user: User):
    stmt = select(WorkTask)
    if user.role == UserRole.IE:
        stmt = stmt.where(WorkTask.assignee_user_id == user.id)
        filters = school_scope_filters(user)
        if filters:
            stmt = stmt.join(School, WorkTask.school_id == School.id).where(*filters)
        return stmt
    filters = school_scope_filters(user)
    if filters:
        stmt = stmt.join(School, WorkTask.school_id == School.id).where(*filters)
    return stmt


def can_create_task(user: User) -> bool:
    return user.role in (UserRole.SUPER_ADMIN, UserRole.GOVERNMENT)


@router.post("", response_model=APIResponse[TaskOut])
def create_task(
    payload: TaskCreate,
    background_tasks: BackgroundTasks,
    current_user: AuthUser,
    db: Session = Depends(get_db),
) -> APIResponse[TaskOut]:
    if not can_create_task(current_user):
        raise _forbidden()
    school_uuid = UUID(payload.school_id)
    if not user_can_access_school(db, current_user, school_uuid):
        raise _forbidden()
    assignee = UUID(payload.assignee_user_id)
    if not assignee_valid_for_task(db, school_uuid, assignee):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "message": "Assignee must be an Independent Evaluator assigned to this school", "errors": {"assignee_user_id": "invalid"}},
        )
    t = WorkTask(
        school_id=school_uuid,
        title=payload.title.strip(),
        details=payload.details.strip() if payload.details else None,
        assignee_user_id=assignee,
        due_date=payload.due_date,
        is_completed=False,
        created_by_user_id=current_user.id,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    log_activity(
        db,
        action="tasks.create",
        target=str(t.id),
        user_id=current_user.id,
        metadata={"school_id": str(school_uuid), "assignee": str(assignee)},
    )
    background_tasks.add_task(notify_task_assigned, str(t.id), str(assignee))
    return APIResponse(success=True, message="Task created", data=_task_out(t))


@router.get("", response_model=APIResponse[PaginatedTasks])
def list_tasks(
    current_user: AuthUser,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    school_id: UUID | None = None,
) -> APIResponse[PaginatedTasks]:
    if current_user.role == UserRole.GOVERNMENT:
        # Read-only national — allow viewing tasks in scope (all schools)
        pass
    stmt = tasks_select_scoped(current_user)
    if school_id is not None:
        if not user_can_access_school(db, current_user, school_id):
            raise _forbidden()
        stmt = stmt.where(WorkTask.school_id == school_id)

    id_subq = stmt.with_only_columns(WorkTask.id).distinct().subquery()
    total = db.scalar(select(func.count()).select_from(id_subq)) or 0
    rows = db.scalars(
        select(WorkTask)
        .where(WorkTask.id.in_(select(id_subq.c.id)))
        .order_by(WorkTask.created_at.desc())
        .offset(skip)
        .limit(limit),
    ).all()
    return APIResponse(success=True, message="Tasks fetched", data=PaginatedTasks(items=[_task_out(r) for r in rows], total=total))


@router.patch("/{task_id}", response_model=APIResponse[TaskOut])
def patch_task(
    task_id: UUID,
    payload: TaskPatch,
    current_user: AuthUser,
    db: Session = Depends(get_db),
) -> APIResponse[TaskOut]:
    t = db.get(WorkTask, task_id)
    if t is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "message": "Task not found", "errors": {"task_id": "not found"}},
        )
    if not user_can_access_school(db, current_user, t.school_id) and t.assignee_user_id != current_user.id:
        raise _forbidden()

    data = payload.model_dump(exclude_unset=True)

    if any(k in data for k in ("title", "details", "due_date")):
        if current_user.role == UserRole.SUPER_ADMIN:
            if not user_can_access_school(db, current_user, t.school_id):
                raise _forbidden()
        elif current_user.role == UserRole.GOVERNMENT:
            if not user_can_access_school(db, current_user, t.school_id):
                raise _forbidden()
            if t.created_by_user_id != current_user.id:
                raise _forbidden()
        else:
            raise _forbidden()

    if "title" in data and data["title"] is not None:
        t.title = data["title"].strip()
    if "details" in data and data["details"] is not None:
        t.details = data["details"].strip()
    if "due_date" in data:
        t.due_date = data["due_date"]

    if "is_completed" in data and data["is_completed"] is not None:
        can_complete = current_user.id == t.assignee_user_id or current_user.role == UserRole.SUPER_ADMIN
        if not can_complete:
            raise _forbidden()
        t.is_completed = bool(data["is_completed"])
        t.completed_at = datetime.now(UTC) if t.is_completed else None

    db.commit()
    db.refresh(t)
    log_activity(db, action="tasks.update", target=str(t.id), user_id=current_user.id, metadata={"completed": t.is_completed})
    return APIResponse(success=True, message="Task updated", data=_task_out(t))
