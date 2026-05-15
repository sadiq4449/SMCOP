from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import hash_password
from app.middleware.rbac import role_required
from app.models.geography import District
from app.models.partner_org import PartnerOrg
from app.models.school import School, Teacher
from app.models.user import User, UserRole, UserStatus
from app.schemas.common import APIResponse
from app.schemas.user_admin import AssignedSchoolsPayload, PaginatedUsers, UserAdminOut, UserCreate, UserUpdate
from app.services.audit import log_activity
from app.services.user_school_assignment import (
    FIELD_ROLES,
    deo_can_manage_field_user,
    district_school_ids,
    merge_assigned_schools_for_deo,
)

router = APIRouter(prefix="/users", tags=["users"])

SuperAdmin = Annotated[User, Depends(role_required(UserRole.SUPER_ADMIN))]
DeoOnly = Annotated[User, Depends(role_required(UserRole.DEO))]
DeoOrSuperAdmin = Annotated[User, Depends(role_required(UserRole.SUPER_ADMIN, UserRole.DEO))]


def _school_ids_from_strings(raw: list[str]) -> list[UUID]:
    out: list[UUID] = []
    for item in raw:
        try:
            out.append(UUID(str(item).strip()))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "success": False,
                    "message": "assigned_schools must contain valid school UUID strings",
                    "errors": {"assigned_schools": "invalid_uuid"},
                },
            ) from None
    return out


def _validate_linked_teacher(db: Session, role: UserRole, school_ids: list[UUID], linked_teacher_id: UUID | None) -> None:
    if linked_teacher_id is None:
        return
    if role != UserRole.TEACHER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "message": "linked_teacher_id is only valid for teacher accounts",
                "errors": {"linked_teacher_id": "invalid_role"},
            },
        )
    if not school_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "message": "Teacher accounts need assigned_schools before linking a teacher profile",
                "errors": {"assigned_schools": "required"},
            },
        )
    t = db.get(Teacher, linked_teacher_id)
    if not t:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "message": "Teacher record not found",
                "errors": {"linked_teacher_id": "invalid"},
            },
        )
    if school_ids and t.school_id not in school_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "message": "linked teacher must belong to one of assigned_schools",
                "errors": {"linked_teacher_id": "school_mismatch"},
            },
        )


def _user_out(user: User) -> UserAdminOut:
    raw_schools = user.assigned_schools if isinstance(user.assigned_schools, list) else []
    schools = [str(x) for x in raw_schools]
    return UserAdminOut(
        id=str(user.id),
        full_name=user.full_name,
        email=user.email,
        role=user.role.value,
        status=user.status.value,
        partner_org_id=str(user.partner_org_id) if user.partner_org_id else None,
        district_id=str(user.district_id) if user.district_id else None,
        linked_teacher_id=str(user.linked_teacher_id) if user.linked_teacher_id else None,
        assigned_schools=schools,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def _validate_partner_org(db: Session, pid: UUID | None) -> None:
    if pid is None:
        return
    if not db.scalar(select(PartnerOrg.id).where(PartnerOrg.id == pid)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "message": "Partner organization not found",
                "errors": {"partner_org_id": "invalid"},
            },
        )


def _validate_district(db: Session, did: UUID | None) -> None:
    if did is None:
        return
    if not db.scalar(select(District.id).where(District.id == did)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "message": "District not found",
                "errors": {"district_id": "invalid"},
            },
        )


def _validate_assigned_schools(db: Session, ids: list[UUID]) -> None:
    if not ids:
        return
    unique = list(dict.fromkeys(ids))
    found = db.scalars(select(School.id).where(School.id.in_(unique))).all()
    if len(found) != len(unique):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "message": "One or more assigned schools were not found",
                "errors": {"assigned_schools": "invalid"},
            },
        )


@router.get("", response_model=APIResponse[PaginatedUsers])
def list_users(
    _admin: SuperAdmin,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    role: UserRole | None = None,
    status_filter: UserStatus | None = Query(None, alias="status"),
    district_id: UUID | None = None,
    partner_org_id: UUID | None = None,
    q: str | None = Query(None, min_length=1, max_length=150),
) -> APIResponse[PaginatedUsers]:
    stmt = select(User)
    count_stmt = select(func.count(User.id))

    if role:
        stmt = stmt.where(User.role == role)
        count_stmt = count_stmt.where(User.role == role)
    if status_filter:
        stmt = stmt.where(User.status == status_filter)
        count_stmt = count_stmt.where(User.status == status_filter)
    if district_id:
        stmt = stmt.where(User.district_id == district_id)
        count_stmt = count_stmt.where(User.district_id == district_id)
    if partner_org_id:
        stmt = stmt.where(User.partner_org_id == partner_org_id)
        count_stmt = count_stmt.where(User.partner_org_id == partner_org_id)
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(or_(User.full_name.ilike(pattern), User.email.ilike(pattern)))
        count_stmt = count_stmt.where(or_(User.full_name.ilike(pattern), User.email.ilike(pattern)))

    total = db.scalar(count_stmt) or 0
    stmt = stmt.order_by(User.full_name).offset(skip).limit(limit)
    rows = db.scalars(stmt).all()

    return APIResponse(
        success=True,
        message="Users fetched successfully",
        data=PaginatedUsers(items=[_user_out(u) for u in rows], total=total),
    )


@router.get("/assignment-candidates", response_model=APIResponse[PaginatedUsers])
def list_assignment_candidates(
    deo: DeoOnly,
    db: Session = Depends(get_db),
    q: str | None = Query(None, min_length=1, max_length=150),
) -> APIResponse[PaginatedUsers]:
    """DEO-only: field staff (enumerator / principal / teacher) this district may assign schools to."""
    if deo.district_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "message": "Your DEO account has no district_id — contact a Super Admin.",
                "errors": {"district_id": "required"},
            },
        )
    stmt = select(User).where(User.role.in_(FIELD_ROLES))
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(or_(User.full_name.ilike(pattern), User.email.ilike(pattern)))
    stmt = stmt.order_by(User.full_name).limit(500)
    rows = db.scalars(stmt).all()
    candidates = [u for u in rows if deo_can_manage_field_user(db, deo=deo, target=u)]
    return APIResponse(
        success=True,
        message="Field staff you may assign schools to",
        data=PaginatedUsers(items=[_user_out(u) for u in candidates], total=len(candidates)),
    )


@router.patch("/{user_id}/assigned-schools", response_model=APIResponse[UserAdminOut])
def patch_user_assigned_schools(
    user_id: UUID,
    payload: AssignedSchoolsPayload,
    actor: DeoOrSuperAdmin,
    db: Session = Depends(get_db),
) -> APIResponse[UserAdminOut]:
    """Super Admin: replace ``assigned_schools``. DEO: merge in-district slice (out-of-district kept)."""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "message": "User not found",
                "errors": {"user_id": "not found"},
            },
        )
    if user.role not in FIELD_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "message": "assigned_schools apply only to enumerator, principal, and teacher accounts",
                "errors": {"role": "forbidden"},
            },
        )

    school_ids = _school_ids_from_strings(payload.assigned_schools)

    if actor.role == UserRole.SUPER_ADMIN:
        _validate_assigned_schools(db, school_ids)
        new_list = [str(sid) for sid in school_ids]
    else:
        if actor.district_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "success": False,
                    "message": "Your DEO account has no district_id — contact a Super Admin.",
                    "errors": {"district_id": "required"},
                },
            )
        if not deo_can_manage_field_user(db, deo=actor, target=user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "success": False,
                    "message": "You may not assign schools for this user",
                    "errors": {"user_id": "forbidden"},
                },
            )
        raw = user.assigned_schools if isinstance(user.assigned_schools, list) else []
        try:
            new_list = merge_assigned_schools_for_deo(
                db,
                deo_district_id=actor.district_id,
                current_assigned=[str(x) for x in raw],
                district_school_ids_payload=school_ids,
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "success": False,
                    "message": str(exc),
                    "errors": {"assigned_schools": "invalid_district_scope"},
                },
            ) from exc
        merged_ids = _school_ids_from_strings(new_list)
        _validate_assigned_schools(db, merged_ids)

    sch_ids = _school_ids_from_strings(new_list)
    if user.role == UserRole.TEACHER and user.linked_teacher_id is not None:
        _validate_linked_teacher(db, UserRole.TEACHER, sch_ids, user.linked_teacher_id)

    changes: dict = {}
    if new_list != [str(x) for x in (user.assigned_schools or [])]:
        changes["assigned_schools"] = {"from": user.assigned_schools, "to": new_list}
    user.assigned_schools = new_list

    db.commit()
    db.refresh(user)

    log_activity(
        db,
        action="users.assigned_schools",
        target=str(user.id),
        user_id=actor.id,
        metadata={
            "actor_email": actor.email,
            "actor_role": actor.role.value,
            "changes": changes,
        },
    )

    return APIResponse(success=True, message="Assigned schools updated", data=_user_out(user))


@router.get("/{user_id}", response_model=APIResponse[UserAdminOut])
def get_user(user_id: UUID, _admin: SuperAdmin, db: Session = Depends(get_db)) -> APIResponse[UserAdminOut]:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "message": "User not found",
                "errors": {"user_id": "not found"},
            },
        )
    return APIResponse(success=True, message="User fetched successfully", data=_user_out(user))


@router.post("", response_model=APIResponse[UserAdminOut])
def create_user(payload: UserCreate, admin: SuperAdmin, db: Session = Depends(get_db)) -> APIResponse[UserAdminOut]:
    email_norm = str(payload.email).strip().lower()
    if db.scalar(select(User.id).where(func.lower(User.email) == email_norm)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "success": False,
                "message": "A user with this email already exists",
                "errors": {"email": "duplicate"},
            },
        )

    partner_uuid = UUID(payload.partner_org_id) if payload.partner_org_id else None
    district_uuid = UUID(payload.district_id) if payload.district_id else None
    _validate_partner_org(db, partner_uuid)
    if payload.role == UserRole.DEO:
        if district_uuid is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "success": False,
                    "message": "DEO accounts require district_id",
                    "errors": {"district_id": "required"},
                },
            )
        _validate_district(db, district_uuid)
    elif payload.role in FIELD_ROLES:
        if district_uuid is not None:
            _validate_district(db, district_uuid)
    else:
        district_uuid = None

    school_ids = _school_ids_from_strings(payload.assigned_schools)
    if payload.role in (UserRole.ENUMERATOR, UserRole.PRINCIPAL, UserRole.TEACHER):
        _validate_assigned_schools(db, school_ids)
    else:
        school_ids = []

    linked_uuid = UUID(payload.linked_teacher_id) if payload.linked_teacher_id else None
    if payload.role != UserRole.TEACHER:
        linked_uuid = None
    _validate_linked_teacher(db, payload.role, school_ids, linked_uuid)

    user = User(
        full_name=payload.full_name.strip(),
        email=email_norm,
        password_hash=hash_password(payload.password),
        role=payload.role,
        status=payload.status,
        partner_org_id=partner_uuid,
        district_id=district_uuid,
        linked_teacher_id=linked_uuid,
        assigned_schools=[str(sid) for sid in school_ids],
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log_activity(
        db,
        action="users.create",
        target=str(user.id),
        user_id=admin.id,
        metadata={
            "actor_email": admin.email,
            "email": user.email,
            "role": user.role.value,
        },
    )

    return APIResponse(success=True, message="User created successfully", data=_user_out(user))


@router.patch("/{user_id}", response_model=APIResponse[UserAdminOut])
def update_user(
    user_id: UUID,
    payload: UserUpdate,
    admin: SuperAdmin,
    db: Session = Depends(get_db),
) -> APIResponse[UserAdminOut]:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "message": "User not found",
                "errors": {"user_id": "not found"},
            },
        )

    data = payload.model_dump(exclude_unset=True)
    changes: dict = {}

    if "email" in data and data["email"] is not None:
        email_norm = str(data["email"]).strip().lower()
        conflict = db.scalar(select(User.id).where(func.lower(User.email) == email_norm, User.id != user_id))
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "success": False,
                    "message": "A user with this email already exists",
                    "errors": {"email": "duplicate"},
                },
            )
        if email_norm != user.email:
            changes["email"] = {"from": user.email, "to": email_norm}
        user.email = email_norm

    if "full_name" in data and data["full_name"] is not None:
        fn = data["full_name"].strip()
        if fn != user.full_name:
            changes["full_name"] = {"from": user.full_name, "to": fn}
        user.full_name = fn

    if "password" in data and data["password"] is not None:
        user.password_hash = hash_password(data["password"])
        changes["password"] = {"updated": True}

    if "role" in data and data["role"] is not None:
        new_role = data["role"]
        if new_role != user.role:
            changes["role"] = {"from": user.role.value, "to": new_role.value}
        user.role = new_role

    if "status" in data and data["status"] is not None:
        new_status = data["status"]
        if new_status != user.status:
            changes["status"] = {"from": user.status.value, "to": new_status.value}
        user.status = new_status

    if "partner_org_id" in data:
        pid = data["partner_org_id"]
        partner_uuid = UUID(pid) if pid else None
        _validate_partner_org(db, partner_uuid)
        old_p = str(user.partner_org_id) if user.partner_org_id else None
        new_p = str(partner_uuid) if partner_uuid else None
        if old_p != new_p:
            changes["partner_org_id"] = {"from": old_p, "to": new_p}
        user.partner_org_id = partner_uuid

    if "district_id" in data:
        did = data["district_id"]
        district_uuid = UUID(did) if did else None
        _validate_district(db, district_uuid)
        old_d = str(user.district_id) if user.district_id else None
        new_d = str(district_uuid) if district_uuid else None
        if old_d != new_d:
            changes["district_id"] = {"from": old_d, "to": new_d}
        user.district_id = district_uuid

    if "assigned_schools" in data and data["assigned_schools"] is not None:
        school_ids = _school_ids_from_strings(data["assigned_schools"])
        _validate_assigned_schools(db, school_ids)
        new_list = [str(sid) for sid in school_ids]
        if new_list != [str(x) for x in (user.assigned_schools or [])]:
            changes["assigned_schools"] = {"from": user.assigned_schools, "to": new_list}
        user.assigned_schools = new_list

    if user.role not in (UserRole.ENUMERATOR, UserRole.PRINCIPAL, UserRole.TEACHER):
        if user.assigned_schools:
            user.assigned_schools = []
            changes["assigned_schools_cleared_for_role"] = True

    roles_allow_optional_district = (
        UserRole.DEO,
        UserRole.ENUMERATOR,
        UserRole.PRINCIPAL,
        UserRole.TEACHER,
    )
    if user.role not in roles_allow_optional_district and user.district_id is not None:
        prev = str(user.district_id)
        user.district_id = None
        changes["district_scope_cleared"] = {"reason": "role_has_no_district_scope", "previous_district_id": prev}

    if user.role != UserRole.TEACHER:
        if user.linked_teacher_id is not None:
            user.linked_teacher_id = None
            changes["linked_teacher_id_cleared_for_role"] = True
    elif "linked_teacher_id" in data:
        raw_lt = data["linked_teacher_id"]
        lt_uuid = UUID(raw_lt) if raw_lt else None
        sch_ids = _school_ids_from_strings([str(x) for x in (user.assigned_schools or [])])
        _validate_linked_teacher(db, UserRole.TEACHER, sch_ids, lt_uuid)
        user.linked_teacher_id = lt_uuid
    elif user.linked_teacher_id is not None:
        sch_ids = _school_ids_from_strings([str(x) for x in (user.assigned_schools or [])])
        _validate_linked_teacher(db, UserRole.TEACHER, sch_ids, user.linked_teacher_id)

    db.commit()
    db.refresh(user)

    log_activity(
        db,
        action="users.update",
        target=str(user.id),
        user_id=admin.id,
        metadata={"actor_email": admin.email, "changes": changes},
    )

    return APIResponse(success=True, message="User updated successfully", data=_user_out(user))


@router.delete("/{user_id}", response_model=APIResponse[dict[str, str]])
def delete_user(user_id: UUID, admin: SuperAdmin, db: Session = Depends(get_db)) -> APIResponse[dict[str, str]]:
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "message": "You cannot delete your own account",
                "errors": {"user_id": "self_delete"},
            },
        )

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "message": "User not found",
                "errors": {"user_id": "not found"},
            },
        )

    snapshot = {
        "email": user.email,
        "role": user.role.value,
        "full_name": user.full_name,
    }

    db.delete(user)
    db.commit()

    log_activity(
        db,
        action="users.delete",
        target=str(user_id),
        user_id=admin.id,
        metadata={"actor_email": admin.email, "deleted_user": snapshot},
    )

    return APIResponse(success=True, message="User deleted successfully", data={"status": "deleted"})
