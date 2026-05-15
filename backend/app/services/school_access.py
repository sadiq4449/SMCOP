"""School row visibility derived from user role and assignment fields."""

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

    if user.role == UserRole.PARTNER:
        if user.partner_org_id is None:
            return [false()]
        return [School.partner_org_id == user.partner_org_id]

    if user.role == UserRole.IE:
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


def school_district_id(db: Session, school_id: UUID) -> UUID | None:
    """Return the district id for a school's UC hierarchy, or None if missing."""
    return db.scalar(
        select(Taluka.district_id)
        .select_from(School)
        .join(UnionCouncil, School.uc_id == UnionCouncil.id)
        .join(Taluka, UnionCouncil.taluka_id == Taluka.id)
        .where(School.id == school_id),
    )
