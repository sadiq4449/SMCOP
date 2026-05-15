from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.announcement import Announcement
from app.models.school import School
from app.models.user import User, UserRole
from app.schemas.common import APIResponse
from app.schemas.operational import AnnouncementCreate, AnnouncementOut, PaginatedAnnouncements
from app.services.audit import log_activity
from app.services.school_access import parse_assigned_school_ids, school_district_id

router = APIRouter(prefix="/announcements", tags=["announcements"])
AuthUser = Annotated[User, Depends(get_current_user)]


def _out(a: Announcement) -> AnnouncementOut:
    return AnnouncementOut(
        id=str(a.id),
        title=a.title,
        body=a.body,
        attachment_url=a.attachment_url,
        district_id=str(a.district_id) if a.district_id else None,
        created_by_user_id=str(a.created_by_user_id),
        created_at=a.created_at,
    )


def _district_ids_for_partner(db: Session, user: User) -> set[UUID]:
    if user.partner_org_id is None:
        return set()
    out: set[UUID] = set()
    for row in db.scalars(select(School.id).where(School.partner_org_id == user.partner_org_id)).all():
        did = school_district_id(db, row)
        if did:
            out.add(did)
    return out


def _visible_announcements_stmt(user: User, db: Session):
    """National (district_id NULL) plus rows in district(s) relevant to the viewer."""
    stmt = select(Announcement)
    if user.role in (UserRole.SUPER_ADMIN, UserRole.GOVERNMENT):
        return stmt
    if user.role == UserRole.PARTNER:
        d_ids = _district_ids_for_partner(db, user)
        if not d_ids:
            return stmt.where(Announcement.district_id.is_(None))
        return stmt.where(Announcement.district_id.is_(None) | Announcement.district_id.in_(d_ids))
    if user.role == UserRole.IE:
        school_ids = parse_assigned_school_ids(user.assigned_schools)
        if not school_ids:
            return stmt.where(Announcement.district_id.is_(None))
        district_ids: set[UUID] = set()
        for sid in school_ids:
            did = school_district_id(db, sid)
            if did:
                district_ids.add(did)
        conds = [Announcement.district_id.is_(None)]
        for d in district_ids:
            conds.append(Announcement.district_id == d)
        return stmt.where(or_(*conds))
    return stmt.where(Announcement.district_id.is_(None))


@router.post("", response_model=APIResponse[AnnouncementOut])
def create_announcement(
    payload: AnnouncementCreate,
    current_user: AuthUser,
    db: Session = Depends(get_db),
) -> APIResponse[AnnouncementOut]:
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"success": False, "message": "Forbidden"})

    did: UUID | None = UUID(payload.district_id) if payload.district_id else None

    a = Announcement(
        district_id=did,
        title=payload.title.strip(),
        body=payload.body.strip(),
        attachment_url=payload.attachment_url.strip() if payload.attachment_url else None,
        created_by_user_id=current_user.id,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    log_activity(
        db,
        action="announcements.create",
        target=str(a.id),
        user_id=current_user.id,
        metadata={"district_id": str(did) if did else None},
    )
    return APIResponse(success=True, message="Announcement published", data=_out(a))


@router.get("", response_model=APIResponse[PaginatedAnnouncements])
def list_announcements(
    current_user: AuthUser,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> APIResponse[PaginatedAnnouncements]:
    stmt = _visible_announcements_stmt(current_user, db)
    id_subq = stmt.with_only_columns(Announcement.id).subquery()
    total = db.scalar(select(func.count()).select_from(id_subq)) or 0
    rows = db.scalars(
        select(Announcement)
        .where(Announcement.id.in_(select(id_subq.c.id)))
        .order_by(Announcement.created_at.desc())
        .offset(skip)
        .limit(limit),
    ).all()
    return APIResponse(success=True, message="Announcements fetched", data=PaginatedAnnouncements(items=[_out(r) for r in rows], total=total))
