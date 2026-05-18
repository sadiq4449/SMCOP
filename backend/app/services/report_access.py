"""Report visibility and mutation rules."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import false, select
from sqlalchemy.orm import Session

from app.models.report import Report, ReportStatus
from app.models.school import School
from app.models.user import User, UserRole
from app.services.school_access import parse_assigned_school_ids, user_can_access_school


def reports_select_filtered(user: User):
    """Visible reports for listing."""
    if user.role in (UserRole.SUPER_ADMIN, UserRole.GOVERNMENT):
        return select(Report)

    if user.role == UserRole.PARTNER:
        if user.partner_org_id is None:
            return select(Report).where(false())
        return (
            select(Report)
            .join(School, Report.school_id == School.id)
            .where(School.partner_org_id == user.partner_org_id)
        )

    if user.role == UserRole.IE:
        ids = parse_assigned_school_ids(user.assigned_schools)
        if not ids:
            return select(Report).where(false())
        return select(Report).where(Report.school_id.in_(ids))

    return select(Report).where(false())


def can_read_report(db: Session, user: User, report: Report) -> bool:
    if user.role in (UserRole.SUPER_ADMIN, UserRole.GOVERNMENT):
        return True
    if user.role == UserRole.PARTNER:
        sch = db.get(School, report.school_id)
        return bool(sch and sch.partner_org_id == user.partner_org_id)
    if user.role == UserRole.IE:
        return user_can_access_school(db, user, report.school_id)
    return False


def can_create_report(db: Session, user: User, school_id: UUID) -> bool:
    if user.role == UserRole.SUPER_ADMIN:
        return True
    if user.role == UserRole.IE:
        return user_can_access_school(db, user, school_id)
    return False


def can_edit_report_body(db: Session, user: User, report: Report) -> bool:
    if user.role == UserRole.SUPER_ADMIN:
        return True
    if user.role in (UserRole.GOVERNMENT, UserRole.PARTNER):
        return False
    if report.status != ReportStatus.DRAFT:
        return False
    if user.role == UserRole.IE:
        return user_can_access_school(db, user, report.school_id)
    return False


def can_submit_report(db: Session, user: User, report: Report) -> bool:
    """draft → submitted."""
    if report.status != ReportStatus.DRAFT:
        return False
    if user.role == UserRole.SUPER_ADMIN:
        return True
    if user.role == UserRole.IE:
        return user_can_access_school(db, user, report.school_id)
    return False


def can_review_report_status(db: Session, user: User, report: Report) -> bool:
    """submitted → approved/rejected (Super Admin only; PPP Node is oversight/read-only)."""
    if user.role != UserRole.SUPER_ADMIN:
        return False
    return user_can_access_school(db, user, report.school_id)


def can_export_report(db: Session, user: User, report: Report) -> bool:
    if user.role in (UserRole.SUPER_ADMIN, UserRole.GOVERNMENT):
        return True
    if user.role == UserRole.PARTNER:
        sch = db.get(School, report.school_id)
        return bool(sch and sch.partner_org_id == user.partner_org_id)
    if user.role == UserRole.IE:
        return user_can_access_school(db, user, report.school_id)
    return False


def can_post_oversight_comment(user: User) -> bool:
    """PPP Node (government) and partner org reviewers may thread narrative notes only (no report body edits)."""
    return user.role in (UserRole.GOVERNMENT, UserRole.PARTNER)


def user_can_view_school_for_compare(db: Session, user: User, school_id: UUID) -> bool:
    """Compare endpoint school picker scope."""
    if db.get(School, school_id) is None:
        return False
    if user.role in (UserRole.SUPER_ADMIN, UserRole.GOVERNMENT):
        return True
    if user.role == UserRole.PARTNER:
        sch = db.get(School, school_id)
        return bool(sch and sch.partner_org_id == user.partner_org_id)
    if user.role == UserRole.IE:
        return user_can_access_school(db, user, school_id)
    return False
