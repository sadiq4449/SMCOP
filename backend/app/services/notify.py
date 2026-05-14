"""In-app notifications, email fan-out, and webhook scheduling (Iterations 9–10)."""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.issue import IssueStatus
from app.models.notification import Notification
from app.models.report import ReportStatus
from app.models.school import School
from app.models.user import User, UserRole, UserStatus
from app.services.mailer import send_email_best_effort
from app.services.school_access import school_district_id
from app.services.webhook_dispatch import schedule_webhook_dispatch

logger = logging.getLogger(__name__)


def push_notification(
    db: Session,
    *,
    user_id: UUID,
    title: str,
    message: str,
    kind: str | None = None,
    ref_type: str | None = None,
    ref_id: str | None = None,
) -> None:
    db.add(
        Notification(
            user_id=user_id,
            title=title,
            message=message,
            kind=kind,
            ref_type=ref_type,
            ref_id=ref_id,
        )
    )
    try:
        db.commit()
    except Exception:
        logger.warning("notification insert failed", exc_info=True)
        db.rollback()


def _users_super_admins(db: Session) -> list[User]:
    return list(
        db.scalars(
            select(User).where(User.role == UserRole.SUPER_ADMIN, User.status == UserStatus.ACTIVE),
        ).all()
    )


def _users_deo_for_district(db: Session, district_id: UUID) -> list[User]:
    return list(
        db.scalars(
            select(User).where(
                User.role == UserRole.DEO,
                User.status == UserStatus.ACTIVE,
                User.district_id == district_id,
            ),
        ).all()
    )


def _principals_for_school(db: Session, school_id: UUID) -> list[User]:
    sid = str(school_id)
    principals = db.scalars(
        select(User).where(User.role == UserRole.PRINCIPAL, User.status == UserStatus.ACTIVE),
    ).all()
    out: list[User] = []
    for u in principals:
        raw = u.assigned_schools if isinstance(u.assigned_schools, list) else []
        if sid in [str(x) for x in raw]:
            out.append(u)
    return out


def notify_visit_finalized(visit_id: str, school_id: str) -> None:
    from app.core.database import SessionLocal

    vid = UUID(visit_id)
    sid = UUID(school_id)
    with SessionLocal() as db:
        school = db.get(School, sid)
        school_name = school.name if school else sid.hex[:8]
        recipients: list[User] = []
        recipients.extend(_users_super_admins(db))
        did = school_district_id(db, sid)
        if did:
            recipients.extend(_users_deo_for_district(db, did))
        recipients.extend(_principals_for_school(db, sid))
        seen: set[UUID] = set()
        title = "Visit submitted"
        msg = f"Monitoring visit for «{school_name}» was finalized (visit {vid})."
        for u in recipients:
            if u.id in seen:
                continue
            seen.add(u.id)
            push_notification(db, user_id=u.id, title=title, message=msg, kind="visit_submitted", ref_type="visit", ref_id=str(vid))
            send_email_best_effort(u.email, title, msg)
    schedule_webhook_dispatch("visit_submitted", {"visit_id": str(vid), "school_id": str(sid)})


def notify_report_submitted(report_id: str) -> None:
    from app.core.database import SessionLocal

    rid = UUID(report_id)
    with SessionLocal() as db:
        from app.models.report import Report

        report = db.get(Report, rid)
        if not report:
            return
        school = db.get(School, report.school_id)
        school_name = school.name if school else str(report.school_id)
        recipients: list[User] = _users_super_admins(db)
        did = school_district_id(db, report.school_id)
        if did:
            recipients.extend(_users_deo_for_district(db, did))
        title = "Report pending approval"
        msg = f"Report for «{school_name}» ({report.quarter}) was submitted and awaits review."
        seen: set[UUID] = set()
        for u in recipients:
            if u.id in seen:
                continue
            seen.add(u.id)
            push_notification(
                db,
                user_id=u.id,
                title=title,
                message=msg,
                kind="report_submitted",
                ref_type="report",
                ref_id=str(rid),
            )
            send_email_best_effort(u.email, title, msg)


def notify_report_approved(report_id: str) -> None:
    from app.core.database import SessionLocal
    from app.models.report import Report

    rid = UUID(report_id)
    school_uuid_str = ""
    with SessionLocal() as db:
        report = db.get(Report, rid)
        if not report or report.status != ReportStatus.APPROVED:
            return
        school_uuid_str = str(report.school_id)
        school = db.get(School, report.school_id)
        school_name = school.name if school else school_uuid_str
        title = "Report approved"
        msg = f"Report for «{school_name}» ({report.quarter}) was approved."
        creator = db.get(User, report.created_by_user_id)
        recipients: list[User] = []
        if creator and creator.status == UserStatus.ACTIVE:
            recipients.append(creator)
        recipients.extend(_principals_for_school(db, report.school_id))
        seen: set[UUID] = set()
        for u in recipients:
            if u.id in seen:
                continue
            seen.add(u.id)
            push_notification(
                db,
                user_id=u.id,
                title=title,
                message=msg,
                kind="report_approved",
                ref_type="report",
                ref_id=str(rid),
            )
            send_email_best_effort(u.email, title, msg)
    schedule_webhook_dispatch("report_approved", {"report_id": str(rid), "school_id": school_uuid_str})


def notify_issue_assigned(issue_id: str, assignee_id: str) -> None:
    from app.core.database import SessionLocal

    iid = UUID(issue_id)
    aid = UUID(assignee_id)
    with SessionLocal() as db:
        user = db.get(User, aid)
        if not user:
            return
        title = "Issue assigned to you"
        msg = f"You were assigned issue {iid}."
        push_notification(db, user_id=aid, title=title, message=msg, kind="issue_assigned", ref_type="issue", ref_id=str(iid))
        send_email_best_effort(user.email, title, msg)


def notify_issue_resolved(issue_id: str, school_id: str) -> None:
    schedule_webhook_dispatch("issue_resolved", {"issue_id": str(issue_id), "school_id": str(school_id)})


def notify_task_assigned(task_id: str, assignee_id: str) -> None:
    from app.core.database import SessionLocal

    tid = UUID(task_id)
    aid = UUID(assignee_id)
    with SessionLocal() as db:
        user = db.get(User, aid)
        if not user:
            return
        title = "Task assigned"
        msg = f"A new task was assigned to you ({tid})."
        push_notification(db, user_id=aid, title=title, message=msg, kind="task_assigned", ref_type="task", ref_id=str(tid))
        send_email_best_effort(user.email, title, msg)


def run_issue_resolved_side_effects(issue_id: str, old_status: str, new_status: str, school_id: str) -> None:
    if new_status not in (IssueStatus.RESOLVED.value, IssueStatus.CLOSED.value):
        return
    if old_status in (IssueStatus.RESOLVED.value, IssueStatus.CLOSED.value):
        return
    notify_issue_resolved(issue_id, school_id)
