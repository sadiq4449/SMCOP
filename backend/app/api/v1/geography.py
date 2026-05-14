from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.middleware.rbac import role_required
from app.models.geography import District, Taluka, UnionCouncil
from app.models.school import School
from app.models.user import User, UserRole
from app.schemas.common import APIResponse
from app.schemas.geography import (
    DistrictCreate,
    DistrictOut,
    DistrictUpdate,
    TalukaCreate,
    TalukaOut,
    TalukaUpdate,
    UnionCouncilCreate,
    UnionCouncilOut,
    UnionCouncilUpdate,
)
from app.schemas.school import SchoolSummary
from app.services.school_access import school_scope_filters
from app.services.school_serializers import school_summary_from

router = APIRouter(tags=["geography"])

SuperAdmin = Annotated[User, Depends(role_required(UserRole.SUPER_ADMIN))]


def _require_uuid(value: str, field: str) -> UUID:
    try:
        return UUID(value)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "message": "Invalid identifier",
                "errors": {field: "must be a valid UUID"},
            },
        ) from None


def _school_count_in_district(db: Session, district_id: UUID) -> int:
    return db.scalar(
        select(func.count(School.id))
        .join(UnionCouncil, School.uc_id == UnionCouncil.id)
        .join(Taluka, UnionCouncil.taluka_id == Taluka.id)
        .where(Taluka.district_id == district_id),
    ) or 0


def _school_count_in_taluka(db: Session, taluka_id: UUID) -> int:
    return db.scalar(
        select(func.count(School.id))
        .join(UnionCouncil, School.uc_id == UnionCouncil.id)
        .where(UnionCouncil.taluka_id == taluka_id),
    ) or 0


def _school_count_in_uc(db: Session, uc_id: UUID) -> int:
    return db.scalar(select(func.count(School.id)).where(School.uc_id == uc_id)) or 0


def _geography_delete_conflict() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={
            "success": False,
            "message": "Cannot delete: schools are linked under this geography. Reassign or remove schools first.",
            "errors": {"delete": "schools_present"},
        },
    )


@router.get("/districts", response_model=APIResponse[list[DistrictOut]])
def list_districts(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> APIResponse[list[DistrictOut]]:
    rows = db.scalars(select(District).order_by(District.name)).all()
    return APIResponse(
        success=True,
        message="Districts fetched successfully",
        data=[DistrictOut.model_validate(r) for r in rows],
    )


@router.post("/districts", response_model=APIResponse[DistrictOut])
def create_district(
    payload: DistrictCreate,
    _: SuperAdmin,
    db: Session = Depends(get_db),
) -> APIResponse[DistrictOut]:
    code = payload.code.strip() if payload.code else None
    if code and db.scalar(select(District.id).where(District.code == code)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "success": False,
                "message": "District code already in use",
                "errors": {"code": "duplicate"},
            },
        )
    row = District(name=payload.name.strip(), code=code)
    db.add(row)
    db.commit()
    db.refresh(row)
    return APIResponse(success=True, message="District created successfully", data=DistrictOut.model_validate(row))


@router.patch("/districts/{district_id}", response_model=APIResponse[DistrictOut])
def update_district(
    district_id: str,
    payload: DistrictUpdate,
    _: SuperAdmin,
    db: Session = Depends(get_db),
) -> APIResponse[DistrictOut]:
    did = _require_uuid(district_id, "district_id")
    row = db.get(District, did)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "message": "District not found",
                "errors": {"district_id": "not found"},
            },
        )
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        data["name"] = data["name"].strip()
    if "code" in data:
        code = data["code"].strip() if data["code"] else None
        data["code"] = code
        if code and db.scalar(select(District.id).where(District.code == code, District.id != did)):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "success": False,
                    "message": "District code already in use",
                    "errors": {"code": "duplicate"},
                },
            )
    for field, value in data.items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return APIResponse(success=True, message="District updated successfully", data=DistrictOut.model_validate(row))


@router.delete("/districts/{district_id}", response_model=APIResponse[dict[str, str]])
def delete_district(
    district_id: str,
    _: SuperAdmin,
    db: Session = Depends(get_db),
) -> APIResponse[dict[str, str]]:
    did = _require_uuid(district_id, "district_id")
    row = db.get(District, did)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "message": "District not found",
                "errors": {"district_id": "not found"},
            },
        )
    if _school_count_in_district(db, did) > 0:
        raise _geography_delete_conflict()
    db.delete(row)
    db.commit()
    return APIResponse(success=True, message="District deleted successfully", data={"status": "deleted"})


@router.get("/districts/{district_id}/talukas", response_model=APIResponse[list[TalukaOut]])
def list_talukas(
    district_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> APIResponse[list[TalukaOut]]:
    did = _require_uuid(district_id, "district_id")
    exists = db.scalar(select(District.id).where(District.id == did))
    if not exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "message": "District not found",
                "errors": {"district_id": "not found"},
            },
        )

    rows = db.scalars(select(Taluka).where(Taluka.district_id == did).order_by(Taluka.name)).all()
    return APIResponse(
        success=True,
        message="Talukas fetched successfully",
        data=[TalukaOut.model_validate(r) for r in rows],
    )


@router.post("/districts/{district_id}/talukas", response_model=APIResponse[TalukaOut])
def create_taluka(
    district_id: str,
    payload: TalukaCreate,
    _: SuperAdmin,
    db: Session = Depends(get_db),
) -> APIResponse[TalukaOut]:
    did = _require_uuid(district_id, "district_id")
    if not db.scalar(select(District.id).where(District.id == did)):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "message": "District not found",
                "errors": {"district_id": "not found"},
            },
        )
    row = Taluka(district_id=did, name=payload.name.strip())
    db.add(row)
    db.commit()
    db.refresh(row)
    return APIResponse(success=True, message="Taluka created successfully", data=TalukaOut.model_validate(row))


@router.patch("/talukas/{taluka_id}", response_model=APIResponse[TalukaOut])
def update_taluka(
    taluka_id: str,
    payload: TalukaUpdate,
    _: SuperAdmin,
    db: Session = Depends(get_db),
) -> APIResponse[TalukaOut]:
    tid = _require_uuid(taluka_id, "taluka_id")
    row = db.get(Taluka, tid)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "message": "Taluka not found",
                "errors": {"taluka_id": "not found"},
            },
        )
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        data["name"] = data["name"].strip()
    if "district_id" in data and data["district_id"] is not None:
        new_did = _require_uuid(str(data["district_id"]), "district_id")
        if not db.scalar(select(District.id).where(District.id == new_did)):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "success": False,
                    "message": "District not found",
                    "errors": {"district_id": "not found"},
                },
            )
        data["district_id"] = new_did
    for field, value in data.items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return APIResponse(success=True, message="Taluka updated successfully", data=TalukaOut.model_validate(row))


@router.delete("/talukas/{taluka_id}", response_model=APIResponse[dict[str, str]])
def delete_taluka(
    taluka_id: str,
    _: SuperAdmin,
    db: Session = Depends(get_db),
) -> APIResponse[dict[str, str]]:
    tid = _require_uuid(taluka_id, "taluka_id")
    row = db.get(Taluka, tid)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "message": "Taluka not found",
                "errors": {"taluka_id": "not found"},
            },
        )
    if _school_count_in_taluka(db, tid) > 0:
        raise _geography_delete_conflict()
    db.delete(row)
    db.commit()
    return APIResponse(success=True, message="Taluka deleted successfully", data={"status": "deleted"})


@router.get("/talukas/{taluka_id}/ucs", response_model=APIResponse[list[UnionCouncilOut]])
def list_ucs(
    taluka_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> APIResponse[list[UnionCouncilOut]]:
    tid = _require_uuid(taluka_id, "taluka_id")
    exists = db.scalar(select(Taluka.id).where(Taluka.id == tid))
    if not exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "message": "Taluka not found",
                "errors": {"taluka_id": "not found"},
            },
        )

    rows = db.scalars(select(UnionCouncil).where(UnionCouncil.taluka_id == tid).order_by(UnionCouncil.name)).all()
    return APIResponse(
        success=True,
        message="Union councils fetched successfully",
        data=[UnionCouncilOut.model_validate(r) for r in rows],
    )


@router.post("/talukas/{taluka_id}/ucs", response_model=APIResponse[UnionCouncilOut])
def create_union_council(
    taluka_id: str,
    payload: UnionCouncilCreate,
    _: SuperAdmin,
    db: Session = Depends(get_db),
) -> APIResponse[UnionCouncilOut]:
    tid = _require_uuid(taluka_id, "taluka_id")
    if not db.scalar(select(Taluka.id).where(Taluka.id == tid)):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "message": "Taluka not found",
                "errors": {"taluka_id": "not found"},
            },
        )
    row = UnionCouncil(taluka_id=tid, name=payload.name.strip())
    db.add(row)
    db.commit()
    db.refresh(row)
    return APIResponse(
        success=True,
        message="Union council created successfully",
        data=UnionCouncilOut.model_validate(row),
    )


@router.patch("/ucs/{uc_id}", response_model=APIResponse[UnionCouncilOut])
def update_union_council(
    uc_id: str,
    payload: UnionCouncilUpdate,
    _: SuperAdmin,
    db: Session = Depends(get_db),
) -> APIResponse[UnionCouncilOut]:
    uid = _require_uuid(uc_id, "uc_id")
    row = db.get(UnionCouncil, uid)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "message": "Union council not found",
                "errors": {"uc_id": "not found"},
            },
        )
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        data["name"] = data["name"].strip()
    if "taluka_id" in data and data["taluka_id"] is not None:
        new_tid = _require_uuid(str(data["taluka_id"]), "taluka_id")
        if not db.scalar(select(Taluka.id).where(Taluka.id == new_tid)):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "success": False,
                    "message": "Taluka not found",
                    "errors": {"taluka_id": "not found"},
                },
            )
        data["taluka_id"] = new_tid
    for field, value in data.items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return APIResponse(
        success=True,
        message="Union council updated successfully",
        data=UnionCouncilOut.model_validate(row),
    )


@router.delete("/ucs/{uc_id}", response_model=APIResponse[dict[str, str]])
def delete_union_council(
    uc_id: str,
    _: SuperAdmin,
    db: Session = Depends(get_db),
) -> APIResponse[dict[str, str]]:
    uid = _require_uuid(uc_id, "uc_id")
    row = db.get(UnionCouncil, uid)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "message": "Union council not found",
                "errors": {"uc_id": "not found"},
            },
        )
    if _school_count_in_uc(db, uid) > 0:
        raise _geography_delete_conflict()
    db.delete(row)
    db.commit()
    return APIResponse(success=True, message="Union council deleted successfully", data={"status": "deleted"})


@router.get("/ucs/{uc_id}/schools", response_model=APIResponse[list[SchoolSummary]])
def list_schools_under_uc(
    uc_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> APIResponse[list[SchoolSummary]]:
    uid = _require_uuid(uc_id, "uc_id")
    exists = db.scalar(select(UnionCouncil.id).where(UnionCouncil.id == uid))
    if not exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "message": "Union council not found",
                "errors": {"uc_id": "not found"},
            },
        )

    scope = school_scope_filters(current_user)
    stmt = (
        select(School)
        .where(School.uc_id == uid)
        .options(
            joinedload(School.uc).joinedload(UnionCouncil.taluka).joinedload(Taluka.district),
            joinedload(School.partner_org),
        )
        .order_by(School.name)
    )
    if scope:
        stmt = stmt.where(*scope)
    schools = db.scalars(stmt).unique().all()

    return APIResponse(
        success=True,
        message="Schools fetched successfully",
        data=[school_summary_from(s) for s in schools],
    )
