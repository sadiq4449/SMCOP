"""Role-scoped dashboard APIs (Iteration 8)."""

from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.geography import District
from app.models.school import School
from app.models.user import User, UserRole
from app.schemas.common import APIResponse
from app.services.dashboard_service import (
    district_operational_payload,
    government_dashboard_payload,
    school_dashboard_payload,
    system_dashboard_payload,
)
from app.services.school_access import user_can_access_school
from app.services.visit_access import school_in_district

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

AuthUser = Annotated[User, Depends(get_current_user)]


def _forbidden() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"success": False, "message": "Forbidden", "errors": {"dashboard": "forbidden"}},
    )


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"success": False, "message": "Not found", "errors": {"resource": "not found"}},
    )


def _bad(msg: str, field: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"success": False, "message": msg, "errors": {field: "invalid"}},
    )


def can_access_school_dashboard(db: Session, user: User, school_id: UUID) -> bool:
    if db.get(School, school_id) is None:
        return False
    if user.role in (UserRole.SUPER_ADMIN, UserRole.GOVERNMENT):
        return True
    if user.role == UserRole.DEO:
        return school_in_district(db, user.district_id, school_id)
    if user.role in (UserRole.ENUMERATOR, UserRole.PRINCIPAL, UserRole.TEACHER):
        return user_can_access_school(db, user, school_id)
    return False


@router.get("/system", response_model=APIResponse[dict[str, Any]])
def dashboard_system(
    current_user: AuthUser,
    db: Session = Depends(get_db),
    quarter: str | None = Query(None, max_length=20),
    district_skip: int = Query(0, ge=0),
    district_limit: int = Query(20, ge=1, le=100),
) -> APIResponse[dict[str, Any]]:
    if current_user.role != UserRole.SUPER_ADMIN:
        raise _forbidden()

    district_total = db.scalar(select(func.count()).select_from(District)) or 0
    payload = system_dashboard_payload(db, quarter=quarter, district_skip=district_skip, district_limit=district_limit)
    payload["pagination"] = {
        "district_skip": district_skip,
        "district_limit": district_limit,
        "district_total": int(district_total),
    }
    return APIResponse(success=True, message="System dashboard", data=payload)


@router.get("/government", response_model=APIResponse[dict[str, Any]])
def dashboard_government(
    current_user: AuthUser,
    db: Session = Depends(get_db),
    quarter: str | None = Query(None, max_length=20),
    district_skip: int = Query(0, ge=0),
    district_limit: int = Query(20, ge=1, le=100),
) -> APIResponse[dict[str, Any]]:
    if current_user.role != UserRole.GOVERNMENT:
        raise _forbidden()

    district_total = db.scalar(select(func.count()).select_from(District)) or 0
    payload = government_dashboard_payload(db, quarter=quarter, district_skip=district_skip, district_limit=district_limit)
    payload["pagination"] = {
        "district_skip": district_skip,
        "district_limit": district_limit,
        "district_total": int(district_total),
    }
    return APIResponse(success=True, message="Government dashboard", data=payload)


@router.get("/district", response_model=APIResponse[dict[str, Any]])
def dashboard_district(
    current_user: AuthUser,
    db: Session = Depends(get_db),
    quarter: str | None = Query(None, max_length=20),
    district_id: UUID | None = Query(None),
    school_skip: int = Query(0, ge=0),
    school_limit: int = Query(30, ge=1, le=100),
) -> APIResponse[dict[str, Any]]:
    if current_user.role == UserRole.DEO:
        if current_user.district_id is None:
            raise _forbidden()
        resolved = current_user.district_id
    elif current_user.role in (UserRole.GOVERNMENT, UserRole.SUPER_ADMIN):
        if district_id is None:
            raise _bad("district_id is required", "district_id")
        resolved = district_id
    else:
        raise _forbidden()

    payload = district_operational_payload(
        db,
        district_id=resolved,
        quarter=quarter,
        school_skip=school_skip,
        school_limit=school_limit,
    )
    if payload.get("error") == "district_not_found":
        raise _not_found()
    payload["pagination"] = {"school_skip": school_skip, "school_limit": school_limit}
    return APIResponse(success=True, message="District dashboard", data=payload)


@router.get("/school/{school_id}", response_model=APIResponse[dict[str, Any]])
def dashboard_school(
    school_id: UUID,
    current_user: AuthUser,
    db: Session = Depends(get_db),
    quarter: str | None = Query(None, max_length=20),
    visits_limit: int = Query(12, ge=1, le=50),
) -> APIResponse[dict[str, Any]]:
    if current_user.role not in (
        UserRole.SUPER_ADMIN,
        UserRole.GOVERNMENT,
        UserRole.DEO,
        UserRole.ENUMERATOR,
        UserRole.PRINCIPAL,
        UserRole.TEACHER,
    ):
        raise _forbidden()

    if not can_access_school_dashboard(db, current_user, school_id):
        raise _forbidden()

    payload = school_dashboard_payload(db, school_id=school_id, quarter=quarter, visits_limit=visits_limit)
    if payload.get("error") == "school_not_found":
        raise _not_found()
    return APIResponse(success=True, message="School dashboard", data=payload)
