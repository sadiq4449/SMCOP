"""Who may create, list, or mutate issues (Iteration 9)."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.issue import Issue, IssueStatus
from app.models.school import School
from app.models.user import User, UserRole
from app.services.school_access import school_scope_filters, user_can_access_school


def can_raise_issue(user: User) -> bool:
    return user.role in (
        UserRole.SUPER_ADMIN,
        UserRole.GOVERNMENT,
        UserRole.DEO,
        UserRole.ENUMERATOR,
        UserRole.PRINCIPAL,
    )


def can_list_issues_for_school(db: Session, user: User, school_id: UUID) -> bool:
    return user_can_access_school(db, user, school_id)


def issues_select_scoped(user: User):
    stmt = select(Issue)
    filters = school_scope_filters(user)
    if filters:
        stmt = stmt.join(School, Issue.school_id == School.id).where(*filters)
    return stmt


def can_assign_or_admin_issue(user: User, db: Session, issue: Issue) -> bool:
    """DEO (district) and Super Admin may assign and set arbitrary status."""
    if user.role == UserRole.SUPER_ADMIN:
        return user_can_access_school(db, user, issue.school_id)
    if user.role == UserRole.DEO:
        return user_can_access_school(db, user, issue.school_id)
    return False


def can_principal_resolve(db: Session, user: User, issue: Issue) -> bool:
    if user.role != UserRole.PRINCIPAL:
        return False
    if not user_can_access_school(db, user, issue.school_id):
        return False
    if issue.assigned_to_user_id == user.id:
        return True
    if issue.assigned_to_user_id is None:
        return issue.status in (IssueStatus.OPEN, IssueStatus.ASSIGNED)
    return False


def can_enumerator_update_status(db: Session, user: User, issue: Issue) -> bool:
    if user.role != UserRole.ENUMERATOR:
        return False
    if not user_can_access_school(db, user, issue.school_id):
        return False
    return issue.assigned_to_user_id == user.id
