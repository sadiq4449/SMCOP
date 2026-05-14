from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.issue import Issue, IssueCategory, IssueSeverity, IssueStatus
from app.models.user import User, UserRole, UserStatus
from app.schemas.common import APIResponse
from app.schemas.operational import IssueCreate, IssueOut, IssuePatch, PaginatedIssues
from app.services.audit import log_activity
from app.services.issue_access import (
    can_assign_or_admin_issue,
    can_enumerator_update_status,
    can_list_issues_for_school,
    can_principal_resolve,
    can_raise_issue,
    issues_select_scoped,
)
from app.services.notify import notify_issue_assigned, run_issue_resolved_side_effects
from app.services.school_access import user_can_access_school

router = APIRouter(prefix="/issues", tags=["issues"])
AuthUser = Annotated[User, Depends(get_current_user)]


def _forbidden() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"success": False, "message": "Forbidden", "errors": {"issues": "forbidden"}},
    )


def _issue_out(row: Issue) -> IssueOut:
    return IssueOut(
        id=str(row.id),
        school_id=str(row.school_id),
        category=row.category.value,
        details=row.details,
        severity=row.severity.value,
        status=row.status.value,
        raised_by_user_id=str(row.raised_by_user_id),
        assigned_to_user_id=str(row.assigned_to_user_id) if row.assigned_to_user_id else None,
        attachment_url=row.attachment_url,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _assignee_ok(db: Session, school_id: UUID, assignee_id: UUID) -> bool:
    u = db.get(User, assignee_id)
    if u is None or u.status != UserStatus.ACTIVE:
        return False
    if u.role not in (UserRole.PRINCIPAL, UserRole.DEO, UserRole.SUPER_ADMIN):
        return False
    return user_can_access_school(db, u, school_id)


@router.post("", response_model=APIResponse[IssueOut])
def create_issue(
    payload: IssueCreate,
    current_user: AuthUser,
    db: Session = Depends(get_db),
) -> APIResponse[IssueOut]:
    if not can_raise_issue(current_user):
        raise _forbidden()
    school_uuid = UUID(payload.school_id)
    if not user_can_access_school(db, current_user, school_uuid):
        raise _forbidden()

    issue = Issue(
        school_id=school_uuid,
        category=IssueCategory(payload.category),
        details=payload.details.strip(),
        severity=IssueSeverity(payload.severity),
        status=IssueStatus.OPEN,
        raised_by_user_id=current_user.id,
        attachment_url=payload.attachment_url.strip() if payload.attachment_url else None,
    )
    db.add(issue)
    db.commit()
    db.refresh(issue)
    log_activity(
        db,
        action="issues.create",
        target=str(issue.id),
        user_id=current_user.id,
        metadata={"school_id": str(school_uuid), "severity": issue.severity.value},
    )
    return APIResponse(success=True, message="Issue created", data=_issue_out(issue))


@router.get("", response_model=APIResponse[PaginatedIssues])
def list_issues(
    current_user: AuthUser,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    school_id: UUID | None = None,
    status_filter: str | None = Query(None, alias="status"),
) -> APIResponse[PaginatedIssues]:
    stmt = issues_select_scoped(current_user)
    if school_id is not None:
        if not can_list_issues_for_school(db, current_user, school_id):
            raise _forbidden()
        stmt = stmt.where(Issue.school_id == school_id)
    if status_filter:
        try:
            st = IssueStatus(status_filter)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"success": False, "message": "Invalid status", "errors": {"status": "invalid"}},
            ) from exc
        stmt = stmt.where(Issue.status == st)

    id_subq = stmt.with_only_columns(Issue.id).distinct().subquery()
    total = db.scalar(select(func.count()).select_from(id_subq)) or 0
    rows = db.scalars(
        select(Issue)
        .where(Issue.id.in_(select(id_subq.c.id)))
        .order_by(Issue.updated_at.desc())
        .offset(skip)
        .limit(limit),
    ).all()
    return APIResponse(success=True, message="Issues fetched", data=PaginatedIssues(items=[_issue_out(r) for r in rows], total=total))


@router.patch("/{issue_id}", response_model=APIResponse[IssueOut])
def patch_issue(
    issue_id: UUID,
    payload: IssuePatch,
    background_tasks: BackgroundTasks,
    current_user: AuthUser,
    db: Session = Depends(get_db),
) -> APIResponse[IssueOut]:
    issue = db.get(Issue, issue_id)
    if issue is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "message": "Issue not found", "errors": {"issue_id": "not found"}},
        )
    if not user_can_access_school(db, current_user, issue.school_id):
        raise _forbidden()
    if current_user.role == UserRole.GOVERNMENT:
        raise _forbidden()

    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "message": "No fields to update", "errors": {"body": "empty"}},
        )

    old_status = issue.status.value
    old_assignee = issue.assigned_to_user_id

    admin = can_assign_or_admin_issue(current_user, db, issue)

    if "assigned_to_user_id" in data and data["assigned_to_user_id"] is not None:
        if not admin:
            raise _forbidden()
        aid = UUID(data["assigned_to_user_id"])
        if not _assignee_ok(db, issue.school_id, aid):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "success": False,
                    "message": "Invalid assignee for this school",
                    "errors": {"assigned_to_user_id": "invalid"},
                },
            )
        issue.assigned_to_user_id = aid
        if issue.status == IssueStatus.OPEN:
            issue.status = IssueStatus.ASSIGNED

    if "status" in data and data["status"] is not None:
        new_st = IssueStatus(data["status"])
        if admin:
            issue.status = new_st
        else:
            allowed = can_principal_resolve(db, current_user, issue) or can_enumerator_update_status(db, current_user, issue)
            if not allowed:
                raise _forbidden()
            if new_st not in (IssueStatus.RESOLVED, IssueStatus.CLOSED):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "success": False,
                        "message": "You may only resolve or close this issue",
                        "errors": {"status": "forbidden"},
                    },
                )
            issue.status = new_st

    db.commit()
    db.refresh(issue)

    log_activity(
        db,
        action="issues.update",
        target=str(issue.id),
        user_id=current_user.id,
        metadata={
            "status": issue.status.value,
            "assigned_to": str(issue.assigned_to_user_id) if issue.assigned_to_user_id else None,
        },
    )

    if issue.assigned_to_user_id and issue.assigned_to_user_id != old_assignee:
        background_tasks.add_task(notify_issue_assigned, str(issue.id), str(issue.assigned_to_user_id))

    background_tasks.add_task(
        run_issue_resolved_side_effects,
        str(issue.id),
        old_status,
        issue.status.value,
        str(issue.school_id),
    )

    return APIResponse(success=True, message="Issue updated", data=_issue_out(issue))
