from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.middleware.rbac import role_required
from app.models.geography import Taluka, UnionCouncil
from app.models.partner_org import PartnerOrg
from app.models.school import ActiveStatus, School, SchoolEnrollment, Teacher
from app.models.user import User, UserRole
from app.schemas.common import APIResponse
from app.schemas.school import (
    EnrollmentCreate,
    EnrollmentOut,
    EnrollmentUpdate,
    PaginatedSchools,
    SchoolCreate,
    SchoolDetail,
    SchoolSummary,
    SchoolUpdate,
    TeacherCreate,
    TeacherOut,
    TeacherUpdate,
)
from app.services.school_access import school_scope_filters, user_can_access_school
from app.services.school_serializers import school_detail_from, school_summary_from

router = APIRouter(prefix="/schools", tags=["schools"])

SuperAdmin = Annotated[User, Depends(role_required(UserRole.SUPER_ADMIN))]
AuthUser = Annotated[User, Depends(get_current_user)]

school_load_opts = (
    joinedload(School.uc).joinedload(UnionCouncil.taluka).joinedload(Taluka.district),
    joinedload(School.partner_org),
)


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={
            "success": False,
            "message": "School not found",
            "errors": {"school_id": "not found"},
        },
    )


def _forbidden_school() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "success": False,
            "message": "You do not have access to this school",
            "errors": {"school_id": "forbidden"},
        },
    )


def _require_visible_school(db: Session, user: User, school_id: UUID) -> School:
    exists = db.scalar(select(School.id).where(School.id == school_id))
    if not exists:
        raise _not_found()
    if not user_can_access_school(db, user, school_id):
        raise _forbidden_school()
    loaded = _get_school(db, school_id)
    if not loaded:
        raise _not_found()
    return loaded


def _get_school(db: Session, school_id: UUID) -> School | None:
    stmt = select(School).where(School.id == school_id).options(*school_load_opts)
    return db.scalars(stmt).unique().one_or_none()


def _school_filter_clauses(
    *,
    district_id: UUID | None,
    taluka_id: UUID | None,
    uc_id: UUID | None,
    partner_org_id: UUID | None,
    status_filter: ActiveStatus | None,
    q: str | None,
) -> list:
    clauses: list = []
    if uc_id:
        clauses.append(School.uc_id == uc_id)
    elif taluka_id:
        clauses.append(
            School.uc_id.in_(select(UnionCouncil.id).where(UnionCouncil.taluka_id == taluka_id)),
        )
    elif district_id:
        clauses.append(
            School.uc_id.in_(
                select(UnionCouncil.id).join(Taluka).where(Taluka.district_id == district_id),
            ),
        )

    if partner_org_id:
        clauses.append(School.partner_org_id == partner_org_id)

    if status_filter:
        clauses.append(School.status == status_filter)

    if q:
        pattern = f"%{q}%"
        clauses.append(or_(School.name.ilike(pattern), School.emis_code.ilike(pattern)))

    return clauses


@router.get("", response_model=APIResponse[PaginatedSchools])
def list_schools(
    current_user: AuthUser,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    district_id: UUID | None = None,
    taluka_id: UUID | None = None,
    uc_id: UUID | None = None,
    partner_org_id: UUID | None = None,
    status_filter: ActiveStatus | None = Query(None, alias="status"),
    q: str | None = Query(None, min_length=1, max_length=120),
) -> APIResponse[PaginatedSchools]:
    scope = school_scope_filters(current_user)
    clauses = [
        *scope,
        *_school_filter_clauses(
            district_id=district_id,
            taluka_id=taluka_id,
            uc_id=uc_id,
            partner_org_id=partner_org_id,
            status_filter=status_filter,
            q=q,
        ),
    ]

    count_stmt = select(func.count(School.id))
    if clauses:
        count_stmt = count_stmt.where(*clauses)
    total = db.scalar(count_stmt) or 0

    stmt = select(School).options(*school_load_opts)
    if clauses:
        stmt = stmt.where(*clauses)
    stmt = stmt.order_by(School.name).offset(skip).limit(limit)
    rows = db.scalars(stmt).unique().all()

    return APIResponse(
        success=True,
        message="Schools fetched successfully",
        data=PaginatedSchools(items=[school_summary_from(s) for s in rows], total=total),
    )


@router.post("", response_model=APIResponse[SchoolDetail])
def create_school(
    payload: SchoolCreate,
    _admin: SuperAdmin,
    db: Session = Depends(get_db),
) -> APIResponse[SchoolDetail]:
    uc_uuid = UUID(payload.uc_id)
    uc_exists = db.scalar(select(UnionCouncil.id).where(UnionCouncil.id == uc_uuid))
    if not uc_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "message": "Union council not found",
                "errors": {"uc_id": "invalid"},
            },
        )

    emis = payload.emis_code.strip()
    if db.scalar(select(School.id).where(School.emis_code == emis)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "success": False,
                "message": "A school with this EMIS code already exists",
                "errors": {"emis_code": "duplicate"},
            },
        )

    partner_uuid: UUID | None = None
    if payload.partner_org_id:
        partner_uuid = UUID(payload.partner_org_id)
        if not db.scalar(select(PartnerOrg.id).where(PartnerOrg.id == partner_uuid)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "success": False,
                    "message": "Partner organization not found",
                    "errors": {"partner_org_id": "invalid"},
                },
            )

    school = School(
        emis_code=emis,
        name=payload.name.strip(),
        uc_id=uc_uuid,
        level=payload.level,
        gender=payload.gender,
        partner_org_id=partner_uuid,
        principal_name=payload.principal_name,
        principal_phone=payload.principal_phone,
        gps_latitude=payload.gps_latitude,
        gps_longitude=payload.gps_longitude,
        status=payload.status,
    )
    db.add(school)
    db.commit()

    loaded = _get_school(db, school.id)
    if not loaded:
        raise _not_found()

    return APIResponse(
        success=True,
        message="School created successfully",
        data=school_detail_from(loaded),
    )


@router.get("/{school_id}", response_model=APIResponse[SchoolDetail])
def get_school(
    school_id: UUID,
    current_user: AuthUser,
    db: Session = Depends(get_db),
) -> APIResponse[SchoolDetail]:
    school = _require_visible_school(db, current_user, school_id)

    return APIResponse(
        success=True,
        message="School fetched successfully",
        data=school_detail_from(school),
    )


@router.patch("/{school_id}", response_model=APIResponse[SchoolDetail])
def update_school(
    school_id: UUID,
    payload: SchoolUpdate,
    _admin: SuperAdmin,
    db: Session = Depends(get_db),
) -> APIResponse[SchoolDetail]:
    school = db.get(School, school_id)
    if not school:
        raise _not_found()

    data = payload.model_dump(exclude_unset=True)

    if "emis_code" in data and data["emis_code"] is not None:
        emis = data["emis_code"].strip()
        existing = db.scalar(select(School.id).where(School.emis_code == emis, School.id != school_id))
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "success": False,
                    "message": "A school with this EMIS code already exists",
                    "errors": {"emis_code": "duplicate"},
                },
            )
        data["emis_code"] = emis

    if "name" in data and data["name"] is not None:
        data["name"] = data["name"].strip()

    if "uc_id" in data and data["uc_id"] is not None:
        uc_uuid = UUID(data["uc_id"])
        if not db.scalar(select(UnionCouncil.id).where(UnionCouncil.id == uc_uuid)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "success": False,
                    "message": "Union council not found",
                    "errors": {"uc_id": "invalid"},
                },
            )
        data["uc_id"] = uc_uuid

    if "partner_org_id" in data:
        pid = data["partner_org_id"]
        if pid is None:
            data["partner_org_id"] = None
        else:
            p_uuid = UUID(pid)
            if not db.scalar(select(PartnerOrg.id).where(PartnerOrg.id == p_uuid)):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "success": False,
                        "message": "Partner organization not found",
                        "errors": {"partner_org_id": "invalid"},
                    },
                )
            data["partner_org_id"] = p_uuid

    for field, value in data.items():
        setattr(school, field, value)

    db.commit()

    loaded = _get_school(db, school_id)
    if not loaded:
        raise _not_found()

    return APIResponse(
        success=True,
        message="School updated successfully",
        data=school_detail_from(loaded),
    )


@router.delete("/{school_id}", response_model=APIResponse[dict[str, str]])
def delete_school(
    school_id: UUID,
    _admin: SuperAdmin,
    db: Session = Depends(get_db),
) -> APIResponse[dict[str, str]]:
    school = db.get(School, school_id)
    if not school:
        raise _not_found()

    db.delete(school)
    db.commit()
    return APIResponse(success=True, message="School deleted successfully", data={"status": "deleted"})


@router.get("/{school_id}/enrollment", response_model=APIResponse[list[EnrollmentOut]])
def list_enrollment(
    school_id: UUID,
    current_user: AuthUser,
    db: Session = Depends(get_db),
) -> APIResponse[list[EnrollmentOut]]:
    _require_visible_school(db, current_user, school_id)

    rows = db.scalars(
        select(SchoolEnrollment).where(SchoolEnrollment.school_id == school_id).order_by(SchoolEnrollment.quarter),
    ).all()
    return APIResponse(
        success=True,
        message="Enrollment records fetched successfully",
        data=[EnrollmentOut.model_validate(r) for r in rows],
    )


@router.post("/{school_id}/enrollment", response_model=APIResponse[EnrollmentOut])
def create_enrollment(
    school_id: UUID,
    payload: EnrollmentCreate,
    _admin: SuperAdmin,
    db: Session = Depends(get_db),
) -> APIResponse[EnrollmentOut]:
    if not db.scalar(select(School.id).where(School.id == school_id)):
        raise _not_found()

    quarter = payload.quarter.strip()
    exists = db.scalar(
        select(SchoolEnrollment.id).where(
            SchoolEnrollment.school_id == school_id,
            SchoolEnrollment.quarter == quarter,
        ),
    )
    if exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "success": False,
                "message": "Enrollment already exists for this quarter",
                "errors": {"quarter": "duplicate"},
            },
        )

    total = payload.boys + payload.girls
    row = SchoolEnrollment(
        school_id=school_id,
        quarter=quarter,
        boys=payload.boys,
        girls=payload.girls,
        total=total,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return APIResponse(success=True, message="Enrollment created successfully", data=EnrollmentOut.model_validate(row))


@router.patch("/{school_id}/enrollment/{enrollment_id}", response_model=APIResponse[EnrollmentOut])
def update_enrollment(
    school_id: UUID,
    enrollment_id: UUID,
    payload: EnrollmentUpdate,
    _admin: SuperAdmin,
    db: Session = Depends(get_db),
) -> APIResponse[EnrollmentOut]:
    row = db.get(SchoolEnrollment, enrollment_id)
    if not row or row.school_id != school_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "message": "Enrollment record not found",
                "errors": {"enrollment_id": "not found"},
            },
        )

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(row, field, value)

    row.total = row.boys + row.girls
    db.commit()
    db.refresh(row)
    return APIResponse(success=True, message="Enrollment updated successfully", data=EnrollmentOut.model_validate(row))


@router.get("/{school_id}/teachers", response_model=APIResponse[list[TeacherOut]])
def list_teachers(
    school_id: UUID,
    current_user: AuthUser,
    db: Session = Depends(get_db),
) -> APIResponse[list[TeacherOut]]:
    _require_visible_school(db, current_user, school_id)

    rows = db.scalars(select(Teacher).where(Teacher.school_id == school_id).order_by(Teacher.name)).all()
    return APIResponse(
        success=True,
        message="Teachers fetched successfully",
        data=[TeacherOut.model_validate(r) for r in rows],
    )


@router.post("/{school_id}/teachers", response_model=APIResponse[TeacherOut])
def create_teacher(
    school_id: UUID,
    payload: TeacherCreate,
    _admin: SuperAdmin,
    db: Session = Depends(get_db),
) -> APIResponse[TeacherOut]:
    if not db.scalar(select(School.id).where(School.id == school_id)):
        raise _not_found()

    teacher = Teacher(
        school_id=school_id,
        name=payload.name.strip(),
        gender=payload.gender,
        subject=payload.subject,
        status=payload.status,
    )
    db.add(teacher)
    db.commit()
    db.refresh(teacher)
    return APIResponse(success=True, message="Teacher created successfully", data=TeacherOut.model_validate(teacher))


@router.patch("/{school_id}/teachers/{teacher_id}", response_model=APIResponse[TeacherOut])
def update_teacher(
    school_id: UUID,
    teacher_id: UUID,
    payload: TeacherUpdate,
    _admin: SuperAdmin,
    db: Session = Depends(get_db),
) -> APIResponse[TeacherOut]:
    teacher = db.get(Teacher, teacher_id)
    if not teacher or teacher.school_id != school_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "message": "Teacher not found",
                "errors": {"teacher_id": "not found"},
            },
        )

    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        data["name"] = data["name"].strip()

    for field, value in data.items():
        setattr(teacher, field, value)

    db.commit()
    db.refresh(teacher)
    return APIResponse(success=True, message="Teacher updated successfully", data=TeacherOut.model_validate(teacher))


@router.delete("/{school_id}/teachers/{teacher_id}", response_model=APIResponse[dict[str, str]])
def delete_teacher(
    school_id: UUID,
    teacher_id: UUID,
    _admin: SuperAdmin,
    db: Session = Depends(get_db),
) -> APIResponse[dict[str, str]]:
    teacher = db.get(Teacher, teacher_id)
    if not teacher or teacher.school_id != school_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "message": "Teacher not found",
                "errors": {"teacher_id": "not found"},
            },
        )

    db.delete(teacher)
    db.commit()
    return APIResponse(success=True, message="Teacher deleted successfully", data={"status": "deleted"})
