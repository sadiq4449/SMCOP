"""School row visibility derived from user role and assignment fields (Iteration 3).

Used by ``app.api.v1.schools`` list/detail and nested resources so Enumerators,
Principals, Teachers, and DEO accounts only see schools within their scope.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import false, select
from sqlalchemy.orm import Session

from app.models.geography import Taluka, UnionCouncil
from app.models.school import School
from app.models.user import User, UserRole


def parse_assigned_school_ids(raw: object) -> list[UUID]:
    if raw is None:
        return []
    if not isinstance(raw, list):
        return []
    out: list[UUID] = []
    for item in raw:
        if isinstance(item, UUID):
            out.append(item)
            continue
        if isinstance(item, str):
            try:
                out.append(UUID(item))
            except ValueError:
                continue
    return out


def school_scope_filters(user: User) -> list:
    """Extra WHERE clauses for ``School`` queries; empty means no extra restriction."""
    if user.role in (UserRole.SUPER_ADMIN, UserRole.GOVERNMENT):
        return []

    if user.role == UserRole.DEO:
        if user.district_id is None:
            return [false()]
        uc_subq = select(UnionCouncil.id).join(Taluka).where(Taluka.district_id == user.district_id)
        return [School.uc_id.in_(uc_subq)]

    if user.role in (UserRole.ENUMERATOR, UserRole.PRINCIPAL, UserRole.TEACHER):
        ids = parse_assigned_school_ids(user.assigned_schools)
        if not ids:
            return [false()]
        return [School.id.in_(ids)]

    return [false()]


def user_can_access_school(db: Session, user: User, school_id: UUID) -> bool:
    scope = school_scope_filters(user)
    stmt = select(School.id).where(School.id == school_id)
    if scope:
        stmt = stmt.where(*scope)
    return db.scalar(stmt) is not None
