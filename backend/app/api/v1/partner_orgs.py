from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.middleware.rbac import role_required
from app.models.partner_org import PartnerOrg
from app.models.user import User, UserRole
from app.schemas.common import APIResponse
from app.schemas.partner_org import PartnerOrgCreate, PartnerOrgOut, PartnerOrgUpdate

router = APIRouter(prefix="/partner-orgs", tags=["partner-orgs"])


@router.get("", response_model=APIResponse[list[PartnerOrgOut]])
def list_partner_orgs(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> APIResponse[list[PartnerOrgOut]]:
    rows = db.scalars(select(PartnerOrg).order_by(PartnerOrg.name)).all()
    return APIResponse(
        success=True,
        message="Partner organizations fetched successfully",
        data=[PartnerOrgOut.model_validate(r) for r in rows],
    )


@router.post("", response_model=APIResponse[PartnerOrgOut])
def create_partner_org(
    payload: PartnerOrgCreate,
    db: Session = Depends(get_db),
    _: User = Depends(role_required(UserRole.SUPER_ADMIN)),
) -> APIResponse[PartnerOrgOut]:
    org = PartnerOrg(
        name=payload.name,
        contact_person=payload.contact_person,
        email=str(payload.email) if payload.email else None,
        phone=payload.phone,
        address=payload.address,
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    return APIResponse(
        success=True,
        message="Partner organization created successfully",
        data=PartnerOrgOut.model_validate(org),
    )


@router.patch("/{partner_org_id}", response_model=APIResponse[PartnerOrgOut])
def update_partner_org(
    partner_org_id: UUID,
    payload: PartnerOrgUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(role_required(UserRole.SUPER_ADMIN)),
) -> APIResponse[PartnerOrgOut]:
    org = db.get(PartnerOrg, partner_org_id)
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "message": "Partner organization not found",
                "errors": {"partner_org_id": "not found"},
            },
        )

    data = payload.model_dump(exclude_unset=True)
    if "email" in data and data["email"] is not None:
        data["email"] = str(data["email"])

    for field, value in data.items():
        setattr(org, field, value)

    db.commit()
    db.refresh(org)
    return APIResponse(
        success=True,
        message="Partner organization updated successfully",
        data=PartnerOrgOut.model_validate(org),
    )


@router.delete("/{partner_org_id}", response_model=APIResponse[dict[str, str]])
def delete_partner_org(
    partner_org_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(role_required(UserRole.SUPER_ADMIN)),
) -> APIResponse[dict[str, str]]:
    org = db.get(PartnerOrg, partner_org_id)
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "message": "Partner organization not found",
                "errors": {"partner_org_id": "not found"},
            },
        )

    db.delete(org)
    db.commit()
    return APIResponse(success=True, message="Partner organization deleted successfully", data={"status": "deleted"})
