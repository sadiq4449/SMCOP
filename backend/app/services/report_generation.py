"""Assemble quarterly report snapshots from visits and related data."""

from __future__ import annotations

import re
from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.attendance import StudentDailyAttendance, TeacherAttendance, TeacherAttendanceApprovalStatus
from app.models.geography import District, Taluka, UnionCouncil
from app.models.monitoring import ClassroomObservation, KpiScore, Visit
from app.services.visit_scoring import recompute_visit_aggregate
from app.models.report import Report, ReportStatus
from app.models.school import School

_Q_RE = re.compile(r"^Q([1-4])-(\d{4})$", re.IGNORECASE)


def normalize_quarter(quarter: str) -> str:
    q = quarter.strip()
    m = _Q_RE.match(q)
    if not m:
        raise ValueError("quarter must look like Q1-2026")
    num, year = int(m.group(1)), int(m.group(2))
    return f"Q{num}-{year}"


def quarter_date_bounds(quarter: str) -> tuple[date, date]:
    norm = normalize_quarter(quarter)
    m = _Q_RE.match(norm)
    assert m
    qnum, year = int(m.group(1)), int(m.group(2))
    start_month = {1: 1, 2: 4, 3: 7, 4: 10}[qnum]
    end_month = start_month + 2
    start = date(year, start_month, 1)
    from calendar import monthrange

    last_day = monthrange(year, end_month)[1]
    end = date(year, end_month, last_day)
    return start, end


def build_snapshot(db: Session, *, school_id: UUID, quarter: str) -> tuple[dict, UUID | None]:
    """Return (snapshot dict, visit_id or None) from the school's visit for this quarter."""
    norm = normalize_quarter(quarter)
    visit = db.scalar(
        select(Visit)
        .where(Visit.school_id == school_id, Visit.quarter == norm)
        .options(
            selectinload(Visit.kpi_scores).selectinload(KpiScore.kpi),
            selectinload(Visit.infrastructure_items),
        ),
    )

    if not visit:
        return {
            "quarter": norm,
            "visit_found": False,
            "message": "No visit recorded for this school and quarter yet.",
        }, None

    recompute_visit_aggregate(db, visit.id)
    db.refresh(visit)

    scores_out: list[dict] = []
    for s in sorted(visit.kpi_scores, key=lambda x: (x.kpi.sort_order if x.kpi else 99, str(x.kpi_id))):
        scores_out.append(
            {
                "kpi_id": str(s.kpi_id),
                "kpi_name": s.kpi.name if s.kpi else None,
                "max_score": s.kpi.max_score if s.kpi else None,
                "score": s.score,
                "remarks": s.remarks,
            }
        )

    agg = float(visit.aggregate_score) if visit.aggregate_score is not None else None

    infra = [
        {"item_name": i.item_name, "status": i.status.value, "remarks": i.remarks}
        for i in visit.infrastructure_items
    ]

    obs_count = db.scalar(
        select(func.count(ClassroomObservation.id)).where(ClassroomObservation.visit_id == visit.id),
    ) or 0

    start_d, end_d = quarter_date_bounds(norm)

    teacher_days_recorded = db.scalar(
        select(func.count(TeacherAttendance.id)).where(
            TeacherAttendance.school_id == school_id,
            TeacherAttendance.attendance_date >= start_d,
            TeacherAttendance.attendance_date <= end_d,
            TeacherAttendance.approval_status == TeacherAttendanceApprovalStatus.APPROVED,
        ),
    ) or 0

    student_rows = db.scalars(
        select(StudentDailyAttendance).where(
            StudentDailyAttendance.school_id == school_id,
            StudentDailyAttendance.attendance_date >= start_d,
            StudentDailyAttendance.attendance_date <= end_d,
        ),
    ).all()

    student_boys = sum(r.boys_present for r in student_rows)
    student_girls = sum(r.girls_present for r in student_rows)

    snapshot = {
        "quarter": norm,
        "visit_found": True,
        "visit_id": str(visit.id),
        "visit_status": visit.status.value,
        "visit_date": visit.visit_date.isoformat() if visit.visit_date else None,
        "aggregate_score": agg,
        "kpi_scores": scores_out,
        "infrastructure_checklist": infra,
        "classroom_observation_count": obs_count,
        "attendance": {
            "period_start": start_d.isoformat(),
            "period_end": end_d.isoformat(),
            "approved_teacher_attendance_rows": teacher_days_recorded,
            "student_daily_entries": len(student_rows),
            "student_boys_present_sum": student_boys,
            "student_girls_present_sum": student_girls,
        },
    }
    return snapshot, visit.id


def compare_district_metrics(db: Session, district_ids: list[UUID], quarter: str) -> list[dict]:
    """Roll up visit/KPI/observation/report signals per district for one quarter."""
    norm = normalize_quarter(quarter)
    rows: list[dict] = []
    for did in district_ids:
        dist = db.get(District, did)
        uc_subq = select(UnionCouncil.id).join(Taluka).where(Taluka.district_id == did)
        school_ids = list(db.scalars(select(School.id).where(School.uc_id.in_(uc_subq))).all())

        scores: list[float] = []
        obs_total = 0
        visits_found = 0
        for sid in school_ids:
            snap, _vid = build_snapshot(db, school_id=sid, quarter=norm)
            if snap.get("visit_found"):
                visits_found += 1
                agg = snap.get("aggregate_score")
                if agg is not None:
                    scores.append(float(agg))
                obs_total += int(snap.get("classroom_observation_count") or 0)

        rep_approved = db.scalar(
            select(func.count(Report.id))
            .select_from(Report)
            .join(School, Report.school_id == School.id)
            .join(UnionCouncil, School.uc_id == UnionCouncil.id)
            .join(Taluka, UnionCouncil.taluka_id == Taluka.id)
            .where(
                Taluka.district_id == did,
                Report.quarter == norm,
                Report.status == ReportStatus.APPROVED,
            ),
        ) or 0

        avg_score = sum(scores) / len(scores) if scores else None
        rows.append(
            {
                "district_id": str(did),
                "district_name": dist.name if dist else None,
                "quarter": norm,
                "school_count": len(school_ids),
                "visits_recorded": visits_found,
                "avg_aggregate_score": round(avg_score, 4) if avg_score is not None else None,
                "classroom_observations_total": obs_total,
                "approved_reports_count": int(rep_approved),
            },
        )
    return rows


def compare_school_across_quarters(db: Session, school_id: UUID, quarters: list[str]) -> list[dict]:
    """Same school across multiple quarters (quarter-vs-quarter)."""
    rows: list[dict] = []
    for q in quarters:
        norm = normalize_quarter(q)
        snap, _vid = build_snapshot(db, school_id=school_id, quarter=norm)
        rep = db.scalar(select(Report).where(Report.school_id == school_id, Report.quarter == norm))
        vf = bool(snap.get("visit_found"))
        rows.append(
            {
                "school_id": str(school_id),
                "quarter": norm,
                "visit_found": vf,
                "visit_status": snap.get("visit_status") if vf else None,
                "aggregate_score": snap.get("aggregate_score") if vf else None,
                "classroom_observation_count": snap.get("classroom_observation_count") if vf else None,
                "report_status": rep.status.value if rep else None,
                "report_id": str(rep.id) if rep else None,
            },
        )
    return rows


def compare_school_metrics(db: Session, school_ids: list[UUID], quarter: str) -> list[dict]:
    norm = normalize_quarter(quarter)
    rows: list[dict] = []
    for sid in school_ids:
        school = db.get(School, sid)
        snap, _vid = build_snapshot(db, school_id=sid, quarter=norm)
        rep = db.scalar(select(Report).where(Report.school_id == sid, Report.quarter == norm))
        vf = bool(snap.get("visit_found"))
        rows.append(
            {
                "school_id": str(sid),
                "school_name": school.name if school else None,
                "quarter": norm,
                "visit_found": vf,
                "visit_status": snap.get("visit_status") if vf else None,
                "aggregate_score": snap.get("aggregate_score") if vf else None,
                "classroom_observation_count": snap.get("classroom_observation_count") if vf else None,
                "report_status": rep.status.value if rep else None,
                "report_id": str(rep.id) if rep else None,
            },
        )
    return rows
