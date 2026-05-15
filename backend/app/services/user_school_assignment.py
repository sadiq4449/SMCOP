"""DEO-scoped school assignment (merge with out-of-district schools)."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.school import School
from app.models.user import User, UserRole
from app.services.school_access import parse_assigned_school_ids
from app.services.visit_access import school_in_district

FIELD_ROLES = (UserRole.ENUMERATOR, UserRole.PRINCIPAL, UserRole.TEACHER)


def district_school_ids(db: Session, district_id: UUID) -> set[UUID]:
    from app.models.geography import Taluka, UnionCouncil

    rows = db.scalars(
        select(School.id)
        .join(UnionCouncil, School.uc_id == UnionCouncil.id)
        .join(Taluka, UnionCouncil.taluka_id == Taluka.id)
        .where(Taluka.district_id == district_id),
    ).all()
    return set(rows)


def deo_can_manage_field_user(db: Session, *, deo: User, target: User) -> bool:
    """Whether a DEO may list or patch assignments for this user."""
    if deo.role != UserRole.DEO or deo.district_id is None:
        return False
    if target.role not in FIELD_ROLES:
        return False
    if target.district_id is not None and target.district_id == deo.district_id:
        return True
    for sid in parse_assigned_school_ids(target.assigned_schools):
        if school_in_district(db, deo.district_id, sid):
            return True
    return False


def merge_assigned_schools_for_deo(
    db: Session,
    *,
    deo_district_id: UUID,
    current_assigned: list[str],
    district_school_ids_payload: list[UUID],
) -> list[str]:
    """Keep schools outside the DEO district; replace in-district slice with payload (validated)."""
    old_ids = parse_assigned_school_ids(current_assigned)
    unique_payload = list(dict.fromkeys(district_school_ids_payload))
    for sid in unique_payload:
        if not school_in_district(db, deo_district_id, sid):
            raise ValueError(f"school {sid} is not in your district")
    kept = [sid for sid in old_ids if not school_in_district(db, deo_district_id, sid)]
    merged = list(dict.fromkeys(kept + unique_payload))
    return [str(x) for x in merged]
