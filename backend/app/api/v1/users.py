from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import hash_password
from app.middleware.rbac import role_required
from app.models.partner_org import PartnerOrg
from app.models.school import School
from app.models.user import User, UserRole, UserStatus
from app.schemas.common import APIResponse
from app.schemas.user_admin import AssignedSchoolsPayload, PaginatedUsers, UserAdminOut, UserCreate, UserUpdate
from app.services.audit import log_activity
from app.services.user_school_assignment import FIELD_ROLES

router = APIRouter(prefix="/users", tags=["users"])

SuperAdmin = Annotated[User, Depends(role_required(UserRole.SUPER_ADMIN))]


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


@router.patch("/{user_id}/assigned-schools", response_model=APIResponse[UserAdminOut])
def patch_user_assigned_schools(
    user_id: UUID,
    payload: AssignedSchoolsPayload,
    actor: SuperAdmin,
    db: Session = Depends(get_db),
) -> APIResponse[UserAdminOut]:
    """Super Admin: replace IE ``assigned_schools``."""
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
                "message": "assigned_schools apply only to Independent Evaluator accounts",
                "errors": {"role": "forbidden"},
            },
        )

    school_ids = _school_ids_from_strings(payload.assigned_schools)
    _validate_assigned_schools(db, school_ids)
    new_list = [str(sid) for sid in school_ids]

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
    _validate_partner_org(db, partner_uuid)

    if payload.role == UserRole.PARTNER:
        if partner_uuid is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "success": False,
                    "message": "Partner accounts require partner_org_id",
                    "errors": {"partner_org_id": "required"},
                },
            )

    school_ids = _school_ids_from_strings(payload.assigned_schools)
    if payload.role == UserRole.IE:
        _validate_assigned_schools(db, school_ids)
    else:
        school_ids = []

    district_uuid = None

    user = User(
        full_name=payload.full_name.strip(),
        email=email_norm,
        password_hash=hash_password(payload.password),
        role=payload.role,
        status=payload.status,
        partner_org_id=partner_uuid if payload.role == UserRole.PARTNER else None,
        district_id=district_uuid,
        linked_teacher_id=None,
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

    if user.role != UserRole.PARTNER and user.partner_org_id is not None:
        user.partner_org_id = None
        changes["partner_org_id_cleared_for_role"] = True

    if user.role == UserRole.PARTNER and user.partner_org_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "message": "Partner accounts require partner_org_id",
                "errors": {"partner_org_id": "required"},
            },
        )

    # District-scoped roles removed; clear legacy district_id.
    if user.district_id is not None:
        user.district_id = None
        changes["district_scope_cleared"] = True

    if "assigned_schools" in data and data["assigned_schools"] is not None:
        school_ids = _school_ids_from_strings(data["assigned_schools"])
        _validate_assigned_schools(db, school_ids)
        new_list = [str(sid) for sid in school_ids]
        if new_list != [str(x) for x in (user.assigned_schools or [])]:
            changes["assigned_schools"] = {"from": user.assigned_schools, "to": new_list}
        user.assigned_schools = new_list

    if user.role != UserRole.IE:
        if user.assigned_schools:
            user.assigned_schools = []
            changes["assigned_schools_cleared_for_role"] = True

    if user.linked_teacher_id is not None:
        user.linked_teacher_id = None
        changes["linked_teacher_id_cleared"] = True

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
