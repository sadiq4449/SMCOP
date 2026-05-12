"""Visit row visibility and mutation rules (Iteration 4)."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import false, select
from sqlalchemy.orm import Session

from app.models.geography import Taluka, UnionCouncil
from app.models.monitoring import Visit, VisitFormStatus
from app.models.school import School
from app.models.user import User, UserRole
from app.services.school_access import parse_assigned_school_ids, user_can_access_school


def school_in_district(db: Session, district_id: UUID | None, school_id: UUID) -> bool:
    if district_id is None:
        return False
    stmt = (
        select(School.id)
        .join(UnionCouncil, School.uc_id == UnionCouncil.id)
        .join(Taluka, UnionCouncil.taluka_id == Taluka.id)
        .where(School.id == school_id, Taluka.district_id == district_id)
    )
    return db.scalar(stmt) is not None


def visit_select_filtered(user: User, db: Session):
    """Base selectable for visits visible to ``user``."""
    if user.role in (UserRole.SUPER_ADMIN, UserRole.GOVERNMENT):
        return select(Visit)

    if user.role == UserRole.ENUMERATOR:
        ids = parse_assigned_school_ids(user.assigned_schools)
        if not ids:
            return select(Visit).where(false())
        return select(Visit).where(Visit.visited_by_id == user.id, Visit.school_id.in_(ids))

    if user.role == UserRole.DEO:
        if user.district_id is None:
            return select(Visit).where(false())
        return (
            select(Visit)
            .join(School, Visit.school_id == School.id)
            .join(UnionCouncil, School.uc_id == UnionCouncil.id)
            .join(Taluka, UnionCouncil.taluka_id == Taluka.id)
            .where(Taluka.district_id == user.district_id)
        )

    if user.role in (UserRole.PRINCIPAL, UserRole.TEACHER):
        ids = parse_assigned_school_ids(user.assigned_schools)
        if not ids:
            return select(Visit).where(false())
        return select(Visit).where(Visit.school_id.in_(ids))

    return select(Visit).where(false())


def can_read_visit(db: Session, user: User, visit: Visit) -> bool:
    if user.role in (UserRole.SUPER_ADMIN, UserRole.GOVERNMENT):
        return True
    if user.role == UserRole.ENUMERATOR:
        return visit.visited_by_id == user.id and user_can_access_school(db, user, visit.school_id)
    if user.role == UserRole.DEO:
        return school_in_district(db, user.district_id, visit.school_id)
    if user.role in (UserRole.PRINCIPAL, UserRole.TEACHER):
        return user_can_access_school(db, user, visit.school_id)
    return False


def can_create_visit_for_school(db: Session, user: User, school_id: UUID) -> bool:
    return user.role == UserRole.ENUMERATOR and user_can_access_school(db, user, school_id)


def can_mutate_visit(db: Session, user: User, visit: Visit) -> bool:
    if user.role == UserRole.SUPER_ADMIN:
        return True
    if visit.status == VisitFormStatus.FINALIZED:
        return False
    if user.role != UserRole.ENUMERATOR:
        return False
    return visit.visited_by_id == user.id and user_can_access_school(db, user, visit.school_id)
