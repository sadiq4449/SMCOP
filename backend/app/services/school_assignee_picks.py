"""Resolve valid assignees for issues/tasks at a school (shared rules for API + UI pickers)."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User, UserRole, UserStatus
from app.services.school_access import user_can_access_school


def assignee_valid_for_issue(db: Session, school_id: UUID, assignee_id: UUID) -> bool:
    u = db.get(User, assignee_id)
    if u is None or u.status != UserStatus.ACTIVE:
        return False
    if u.role not in (UserRole.PRINCIPAL, UserRole.DEO, UserRole.SUPER_ADMIN):
        return False
    return user_can_access_school(db, u, school_id)


def assignee_valid_for_task(db: Session, school_id: UUID, assignee_id: UUID) -> bool:
    u = db.get(User, assignee_id)
    if u is None or u.status != UserStatus.ACTIVE:
        return False
    if u.role not in (UserRole.PRINCIPAL, UserRole.TEACHER):
        return False
    return user_can_access_school(db, u, school_id)


def issue_assignee_candidates(db: Session, school_id: UUID) -> list[User]:
    stmt = select(User).where(
        User.status == UserStatus.ACTIVE,
        User.role.in_((UserRole.PRINCIPAL, UserRole.DEO, UserRole.SUPER_ADMIN)),
    )
    rows = db.scalars(stmt).all()
    return [u for u in rows if user_can_access_school(db, u, school_id)]


def task_assignee_candidates(db: Session, school_id: UUID) -> list[User]:
    stmt = select(User).where(
        User.status == UserStatus.ACTIVE,
        User.role.in_((UserRole.PRINCIPAL, UserRole.TEACHER)),
    )
    rows = db.scalars(stmt).all()
    return [u for u in rows if user_can_access_school(db, u, school_id)]
