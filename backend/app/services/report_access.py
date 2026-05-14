"""Report visibility and mutation rules (Iteration 7)."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import false, select
from sqlalchemy.orm import Session

from app.models.report import Report, ReportStatus
from app.models.school import School
from app.models.geography import Taluka, UnionCouncil
from app.models.user import User, UserRole
from app.services.visit_access import school_in_district
from app.services.school_access import parse_assigned_school_ids, user_can_access_school


def reports_select_filtered(user: User):
    """Visible reports for listing."""
    if user.role in (UserRole.SUPER_ADMIN, UserRole.GOVERNMENT):
        return select(Report)

    if user.role == UserRole.DEO:
        if user.district_id is None:
            return select(Report).where(false())
        uc_subq = select(UnionCouncil.id).join(Taluka).where(Taluka.district_id == user.district_id)
        school_subq = select(School.id).where(School.uc_id.in_(uc_subq))
        return select(Report).where(Report.school_id.in_(school_subq))

    if user.role in (UserRole.ENUMERATOR, UserRole.PRINCIPAL):
        ids = parse_assigned_school_ids(user.assigned_schools)
        if not ids:
            return select(Report).where(false())
        return select(Report).where(Report.school_id.in_(ids))

    return select(Report).where(false())


def can_read_report(db: Session, user: User, report: Report) -> bool:
    if user.role in (UserRole.SUPER_ADMIN, UserRole.GOVERNMENT):
        return True
    if user.role == UserRole.DEO:
        return school_in_district(db, user.district_id, report.school_id)
    if user.role in (UserRole.ENUMERATOR, UserRole.PRINCIPAL):
        return user_can_access_school(db, user, report.school_id)
    return False


def can_create_report(db: Session, user: User, school_id: UUID) -> bool:
    if user.role == UserRole.SUPER_ADMIN:
        return True
    if user.role in (UserRole.ENUMERATOR, UserRole.PRINCIPAL):
        return user_can_access_school(db, user, school_id)
    return False


def can_edit_report_body(db: Session, user: User, report: Report) -> bool:
    if user.role == UserRole.SUPER_ADMIN:
        return True
    if user.role in (UserRole.GOVERNMENT, UserRole.DEO):
        return False
    if report.status != ReportStatus.DRAFT:
        return False
    if user.role in (UserRole.ENUMERATOR, UserRole.PRINCIPAL):
        return user_can_access_school(db, user, report.school_id)
    return False


def can_submit_report(db: Session, user: User, report: Report) -> bool:
    """draft → submitted."""
    if report.status != ReportStatus.DRAFT:
        return False
    if user.role == UserRole.SUPER_ADMIN:
        return True
    if user.role in (UserRole.ENUMERATOR, UserRole.PRINCIPAL):
        return user_can_access_school(db, user, report.school_id)
    return False


def can_review_report_status(db: Session, user: User, report: Report) -> bool:
    """submitted → approved/rejected (DEO district scope)."""
    if user.role == UserRole.SUPER_ADMIN:
        return True
    if user.role != UserRole.DEO:
        return False
    return school_in_district(db, user.district_id, report.school_id)


def can_export_report(db: Session, user: User, report: Report) -> bool:
    if user.role == UserRole.SUPER_ADMIN:
        return True
    if user.role == UserRole.GOVERNMENT:
        return True
    if user.role == UserRole.DEO:
        return school_in_district(db, user.district_id, report.school_id)
    if user.role in (UserRole.ENUMERATOR, UserRole.PRINCIPAL):
        return user_can_access_school(db, user, report.school_id)
    return False


def can_comment_as_government(user: User) -> bool:
    return user.role == UserRole.GOVERNMENT


def user_can_view_school_for_compare(db: Session, user: User, school_id: UUID) -> bool:
    """Compare endpoint school picker scope."""
    from app.models.school import School

    if db.get(School, school_id) is None:
        return False
    if user.role in (UserRole.SUPER_ADMIN, UserRole.GOVERNMENT):
        return True
    if user.role == UserRole.DEO:
        return school_in_district(db, user.district_id, school_id)
    if user.role in (UserRole.ENUMERATOR, UserRole.PRINCIPAL):
        return user_can_access_school(db, user, school_id)
    return False
