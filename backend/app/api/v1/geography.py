from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.geography import District, Taluka, UnionCouncil
from app.models.school import School
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.geography import DistrictOut, TalukaOut, UnionCouncilOut
from app.schemas.school import SchoolSummary
from app.services.school_access import school_scope_filters
from app.services.school_serializers import school_summary_from

router = APIRouter(tags=["geography"])


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
