"""Aggregations for role dashboards (Iteration 8)."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import Float, and_, case, cast, func, select
from sqlalchemy.orm import Session

from app.models.attendance import StudentDailyAttendance, TeacherAttendance, TeacherAttendanceApprovalStatus
from app.models.geography import District, Taluka, UnionCouncil
from app.models.monitoring import InfrastructureChecklistItem, InfrastructureItemStatus, Visit, VisitFormStatus
from app.models.report import Report, ReportStatus
from app.models.school import School, SchoolEnrollment
from app.services.report_generation import normalize_quarter, quarter_date_bounds

UTC = timezone.utc


def default_quarter_string(today: date | None = None) -> str:
    d = today or datetime.now(UTC).date()
    qn = (d.month - 1) // 3 + 1
    return f"Q{qn}-{d.year}"


def _norm_q(quarter: str | None) -> str:
    if not quarter or not quarter.strip():
        return default_quarter_string()
    return normalize_quarter(quarter)


def system_dashboard_payload(
    db: Session,
    *,
    quarter: str | None,
    district_skip: int,
    district_limit: int,
) -> dict:
    q = _norm_q(quarter)
    total_schools = db.scalar(select(func.count()).select_from(School)) or 0

    visit_q = select(Visit)
    visit_q = visit_q.where(Visit.quarter == q)
    total_visits_q = select(func.count()).select_from(visit_q.subquery())
    total_visits = db.scalar(total_visits_q) or 0

    fin_q = select(func.count()).select_from(Visit).where(Visit.quarter == q, Visit.status == VisitFormStatus.FINALIZED)
    draft_q = select(func.count()).select_from(Visit).where(Visit.quarter == q, Visit.status == VisitFormStatus.DRAFT)
    visits_finalized = db.scalar(fin_q) or 0
    visits_draft = db.scalar(draft_q) or 0

    avg_all = db.scalar(
        select(func.avg(cast(Visit.aggregate_score, Float))).where(
            Visit.quarter == q,
            Visit.status == VisitFormStatus.FINALIZED,
            Visit.aggregate_score.is_not(None),
        ),
    )

    district_rows = _district_breakdown_page(db, quarter=q, skip=district_skip, limit=district_limit)

    return {
        "quarter": q,
        "generated_at": datetime.now(UTC).isoformat(),
        "totals": {
            "schools": int(total_schools),
            "visits": int(total_visits),
            "visits_finalized": int(visits_finalized),
            "visits_draft": int(visits_draft),
            "overall_avg_aggregate_score": float(avg_all) if avg_all is not None else None,
        },
        "districts": district_rows,
    }


def government_dashboard_payload(
    db: Session,
    *,
    quarter: str | None,
    district_skip: int,
    district_limit: int,
) -> dict:
    from app.models.issue import Issue, IssueStatus

    q = _norm_q(quarter)
    base = system_dashboard_payload(db, quarter=q, district_skip=district_skip, district_limit=district_limit)
    open_cnt = db.scalar(
        select(func.count(Issue.id)).where(Issue.status.in_((IssueStatus.OPEN, IssueStatus.ASSIGNED))),
    ) or 0
    base["issues"] = {"open_count": int(open_cnt)}
    return base


def _district_breakdown_page(db: Session, *, quarter: str, skip: int, limit: int) -> list[dict]:
    """Aggregate per district with a bounded number of queries (no per-district round trips)."""
    q_norm = normalize_quarter(quarter)
    districts = db.scalars(select(District).order_by(District.name.asc()).offset(skip).limit(limit)).all()
    if not districts:
        return []

    district_ids = [d.id for d in districts]

    sch_rows = db.execute(
        select(Taluka.district_id, func.count(School.id))
        .select_from(School)
        .join(UnionCouncil, School.uc_id == UnionCouncil.id)
        .join(Taluka, UnionCouncil.taluka_id == Taluka.id)
        .where(Taluka.district_id.in_(district_ids))
        .group_by(Taluka.district_id),
    ).all()
    school_map: dict[UUID, int] = {row[0]: int(row[1]) for row in sch_rows}

    visit_rows = db.execute(
        select(
            Taluka.district_id,
            func.count(Visit.id).label("visits"),
            func.sum(case((Visit.status == VisitFormStatus.FINALIZED, 1), else_=0)).label("fin_cnt"),
            func.avg(
                case(
                    (
                        and_(
                            Visit.status == VisitFormStatus.FINALIZED,
                            Visit.aggregate_score.is_not(None),
                        ),
                        cast(Visit.aggregate_score, Float),
                    ),
                    else_=None,
                ),
            ).label("avg_sc"),
        )
        .select_from(Visit)
        .join(School, Visit.school_id == School.id)
        .join(UnionCouncil, School.uc_id == UnionCouncil.id)
        .join(Taluka, UnionCouncil.taluka_id == Taluka.id)
        .where(Visit.quarter == q_norm, Taluka.district_id.in_(district_ids))
        .group_by(Taluka.district_id),
    ).all()
    visit_map: dict[UUID, tuple[int, int, float | None]] = {}
    for row in visit_rows:
        did = row[0]
        v_cnt = int(row[1] or 0)
        f_cnt = int(row[2] or 0)
        avg_raw = row[3]
        avg_sc = float(avg_raw) if avg_raw is not None else None
        visit_map[did] = (v_cnt, f_cnt, avg_sc)

    out: list[dict] = []
    for d in districts:
        school_cnt = school_map.get(d.id, 0)
        v_fin_avg = visit_map.get(d.id)
        if v_fin_avg:
            visit_cnt, fin_cnt, avg_sc = v_fin_avg
        else:
            visit_cnt, fin_cnt, avg_sc = 0, 0, None

        ratio = (float(fin_cnt) / float(visit_cnt)) if visit_cnt else None
        out.append(
            {
                "district_id": str(d.id),
                "district_code": d.code,
                "district_name": d.name,
                "school_count": int(school_cnt),
                "visits": int(visit_cnt),
                "visits_finalized": int(fin_cnt),
                "finalized_ratio": round(ratio, 4) if ratio is not None else None,
                "avg_aggregate_score": round(avg_sc, 4) if avg_sc is not None else None,
            },
        )
    return out


def district_operational_payload(
    db: Session,
    *,
    district_id: UUID,
    quarter: str | None,
    school_skip: int,
    school_limit: int,
    low_performer_max: int = 12,
) -> dict:
    q = _norm_q(quarter)
    d = db.get(District, district_id)
    if not d:
        return {"error": "district_not_found"}

    pending_visits = db.scalar(
        select(func.count(Visit.id))
        .join(School, Visit.school_id == School.id)
        .join(UnionCouncil, School.uc_id == UnionCouncil.id)
        .join(Taluka, UnionCouncil.taluka_id == Taluka.id)
        .where(
            Taluka.district_id == district_id,
            Visit.quarter == q,
            Visit.status == VisitFormStatus.DRAFT,
        ),
    ) or 0

    pending_reports = db.scalar(
        select(func.count(Report.id))
        .join(School, Report.school_id == School.id)
        .join(UnionCouncil, School.uc_id == UnionCouncil.id)
        .join(Taluka, UnionCouncil.taluka_id == Taluka.id)
        .where(Taluka.district_id == district_id, Report.quarter == q, Report.status == ReportStatus.SUBMITTED),
    ) or 0

    low_rows = db.execute(
        select(School.id, School.name, Visit.aggregate_score)
        .join(Visit, and_(Visit.school_id == School.id, Visit.quarter == q, Visit.status == VisitFormStatus.FINALIZED))
        .join(UnionCouncil, School.uc_id == UnionCouncil.id)
        .join(Taluka, UnionCouncil.taluka_id == Taluka.id)
        .where(Taluka.district_id == district_id, Visit.aggregate_score.is_not(None))
        .order_by(cast(Visit.aggregate_score, Float).asc())
        .limit(low_performer_max),
    ).all()

    low_performers = [
        {"school_id": str(r[0]), "school_name": r[1], "aggregate_score": float(r[2])} for r in low_rows if r[2] is not None
    ]

    # Facility gaps: schools with any non-available infra item on their visit for this quarter
    gap_schools = db.scalars(
        select(School.id)
        .join(Visit, and_(Visit.school_id == School.id, Visit.quarter == q))
        .join(InfrastructureChecklistItem, InfrastructureChecklistItem.visit_id == Visit.id)
        .join(UnionCouncil, School.uc_id == UnionCouncil.id)
        .join(Taluka, UnionCouncil.taluka_id == Taluka.id)
        .where(
            Taluka.district_id == district_id,
            InfrastructureChecklistItem.status != InfrastructureItemStatus.AVAILABLE,
        )
        .distinct(),
    ).all()
    facility_gap_school_ids = [str(x) for x in gap_schools]

    schools_page = db.scalars(
        select(School)
        .join(UnionCouncil, School.uc_id == UnionCouncil.id)
        .join(Taluka, UnionCouncil.taluka_id == Taluka.id)
        .where(Taluka.district_id == district_id)
        .order_by(School.name.asc())
        .offset(school_skip)
        .limit(school_limit),
    ).all()

    school_cards: list[dict] = []
    school_ids = [sch.id for sch in schools_page]
    visit_by_school: dict[UUID, Visit] = {}
    report_by_school: dict[UUID, Report] = {}
    gap_by_school: dict[UUID, int] = {}

    if school_ids:
        visits_batch = db.scalars(select(Visit).where(Visit.school_id.in_(school_ids), Visit.quarter == q)).all()
        for v in visits_batch:
            sid = v.school_id
            prev = visit_by_school.get(sid)
            if prev is None or v.id > prev.id:
                visit_by_school[sid] = v

        reports_batch = db.scalars(select(Report).where(Report.school_id.in_(school_ids), Report.quarter == q)).all()
        for r in reports_batch:
            sid = r.school_id
            prev = report_by_school.get(sid)
            if prev is None or r.id > prev.id:
                report_by_school[sid] = r

        visit_ids = [v.id for v in visit_by_school.values()]
        if visit_ids:
            gap_rows = db.execute(
                select(Visit.school_id, func.count(InfrastructureChecklistItem.id))
                .join(InfrastructureChecklistItem, InfrastructureChecklistItem.visit_id == Visit.id)
                .where(
                    Visit.id.in_(visit_ids),
                    InfrastructureChecklistItem.status != InfrastructureItemStatus.AVAILABLE,
                )
                .group_by(Visit.school_id),
            ).all()
            gap_by_school = {row[0]: int(row[1]) for row in gap_rows}

    for sch in schools_page:
        vis = visit_by_school.get(sch.id)
        rep = report_by_school.get(sch.id)
        gap_count = gap_by_school.get(sch.id, 0) if vis else 0
        school_cards.append(
            {
                "school_id": str(sch.id),
                "name": sch.name,
                "visit_id": str(vis.id) if vis else None,
                "visit_status": vis.status.value if vis else None,
                "aggregate_score": float(vis.aggregate_score) if vis and vis.aggregate_score is not None else None,
                "report_status": rep.status.value if rep else None,
                "facility_gap_items": int(gap_count),
            },
        )

    return {
        "quarter": q,
        "district_id": str(district_id),
        "district_code": d.code,
        "district_name": d.name,
        "pending_draft_visits": int(pending_visits),
        "pending_report_reviews": int(pending_reports),
        "low_performers": low_performers,
        "facility_gap_school_ids": facility_gap_school_ids,
        "schools": school_cards,
    }


def school_dashboard_payload(db: Session, *, school_id: UUID, quarter: str | None, visits_limit: int = 12) -> dict:
    sch = db.get(School, school_id)
    if not sch:
        return {"error": "school_not_found"}
    q = _norm_q(quarter)

    visits = db.scalars(
        select(Visit)
        .where(Visit.school_id == school_id)
        .order_by(Visit.quarter.desc())
        .limit(visits_limit),
    ).all()

    visit_summaries = [
        {
            "visit_id": str(v.id),
            "quarter": v.quarter,
            "status": v.status.value,
            "visit_date": v.visit_date.isoformat() if v.visit_date else None,
            "aggregate_score": float(v.aggregate_score) if v.aggregate_score is not None else None,
        }
        for v in visits
    ]

    kpi_trend = [
        {
            "quarter": v.quarter,
            "aggregate_score": float(v.aggregate_score) if v.aggregate_score is not None else None,
            "status": v.status.value,
        }
        for v in sorted(visits, key=lambda x: x.quarter)
    ]

    enroll = db.scalars(
        select(SchoolEnrollment)
        .where(SchoolEnrollment.school_id == school_id)
        .order_by(SchoolEnrollment.quarter.desc())
        .limit(6),
    ).all()
    enrollment_trend = [
        {"quarter": e.quarter, "boys": e.boys, "girls": e.girls, "total": e.total} for e in reversed(enroll)
    ]

    start_d, end_d = quarter_date_bounds(q)
    teacher_stats = db.execute(
        select(
            func.count(TeacherAttendance.id),
            func.sum(case((TeacherAttendance.approval_status == TeacherAttendanceApprovalStatus.APPROVED, 1), else_=0)),
        ).where(
            TeacherAttendance.school_id == school_id,
            TeacherAttendance.attendance_date >= start_d,
            TeacherAttendance.attendance_date <= end_d,
        ),
    ).one()
    teacher_rows = int(teacher_stats[0] or 0)
    teacher_approved = int(teacher_stats[1] or 0)

    student_days = db.scalar(
        select(func.count(StudentDailyAttendance.id)).where(
            StudentDailyAttendance.school_id == school_id,
            StudentDailyAttendance.attendance_date >= start_d,
            StudentDailyAttendance.attendance_date <= end_d,
        ),
    ) or 0

    since = datetime.now(UTC).date() - timedelta(days=30)
    recent_teacher = db.scalar(
        select(func.count(TeacherAttendance.id)).where(
            TeacherAttendance.school_id == school_id,
            TeacherAttendance.attendance_date >= since,
        ),
    ) or 0
    recent_student = db.scalar(
        select(func.count(StudentDailyAttendance.id)).where(
            StudentDailyAttendance.school_id == school_id,
            StudentDailyAttendance.attendance_date >= since,
        ),
    ) or 0

    rep = db.scalar(select(Report).where(Report.school_id == school_id, Report.quarter == q))

    return {
        "quarter": q,
        "school_id": str(school_id),
        "school_name": sch.name,
        "report": {"id": str(rep.id), "status": rep.status.value} if rep else None,
        "enrollment_trend": enrollment_trend,
        "attendance": {
            "period_start": start_d.isoformat(),
            "period_end": end_d.isoformat(),
            "teacher_attendance_rows": int(teacher_rows),
            "teacher_approved_rows": int(teacher_approved),
            "student_daily_rows": int(student_days),
            "last_30d_teacher_rows": int(recent_teacher),
            "last_30d_student_days": int(recent_student),
        },
        "visits_recent": visit_summaries,
        "kpi_trend": kpi_trend,
    }
