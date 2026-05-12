"""Attendance read/write scope (Iteration 6)."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.models.school import Teacher
from app.models.user import User, UserRole
from app.services.school_access import user_can_access_school


def can_read_attendance_for_school(db: Session, user: User, school_id: UUID) -> bool:
    if user.role in (UserRole.SUPER_ADMIN, UserRole.GOVERNMENT):
        return True
    if user.role == UserRole.DEO:
        return user_can_access_school(db, user, school_id)
    if user.role == UserRole.ENUMERATOR:
        return False
    if user.role in (UserRole.PRINCIPAL, UserRole.TEACHER):
        return user_can_access_school(db, user, school_id)
    return False


def can_submit_student_attendance(db: Session, user: User, school_id: UUID) -> bool:
    if user.role == UserRole.SUPER_ADMIN:
        return True
    if user.role in (UserRole.PRINCIPAL, UserRole.TEACHER):
        return user_can_access_school(db, user, school_id)
    return False


def can_submit_teacher_attendance_batch(db: Session, user: User, school_id: UUID) -> bool:
    if user.role == UserRole.SUPER_ADMIN:
        return True
    if user.role == UserRole.PRINCIPAL:
        return user_can_access_school(db, user, school_id)
    return False


def can_submit_teacher_self_attendance(db: Session, user: User, school_id: UUID, teacher_id: UUID) -> bool:
    if user.role != UserRole.TEACHER:
        return False
    if user.linked_teacher_id is None:
        return False
    if user.linked_teacher_id != teacher_id:
        return False
    return user_can_access_school(db, user, school_id)


def can_review_teacher_attendance(db: Session, user: User, school_id: UUID) -> bool:
    if user.role == UserRole.SUPER_ADMIN:
        return True
    if user.role == UserRole.PRINCIPAL:
        return user_can_access_school(db, user, school_id)
    return False


def can_export_attendance(user: User) -> bool:
    return user.role in (UserRole.SUPER_ADMIN, UserRole.PRINCIPAL)


def teacher_belongs_to_school(db: Session, school_id: UUID, teacher_id: UUID) -> bool:
    t = db.get(Teacher, teacher_id)
    return bool(t and t.school_id == school_id)
