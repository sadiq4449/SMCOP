from __future__ import annotations

import calendar
import csv
import io
from datetime import date, datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.attendance import StudentDailyAttendance, TeacherAttendance, TeacherAttendanceApprovalStatus
from app.models.school import Teacher
from app.models.user import User, UserRole
from app.schemas.attendance import (
    MonthlyStudentAttendanceOut,
    MonthlyTeacherAttendanceOut,
    StudentAttendanceDayOut,
    StudentAttendanceUpsert,
    TeacherAttendanceApprovalPatch,
    TeacherAttendanceBatchCreate,
    TeacherAttendanceRecordOut,
)
from app.schemas.common import APIResponse
from app.services.attendance_access import (
    can_export_attendance,
    can_read_attendance_for_school,
    can_review_teacher_attendance,
    can_submit_student_attendance,
    can_submit_teacher_attendance_batch,
    can_submit_teacher_self_attendance,
    teacher_belongs_to_school,
)
from app.services.audit import log_activity

router = APIRouter(prefix="/attendance", tags=["attendance"])

AuthUser = Annotated[User, Depends(get_current_user)]


def _month_bounds(month: str) -> tuple[date, date]:
    parts = month.strip().split("-")
    if len(parts) != 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "message": "month must be YYYY-MM",
                "errors": {"month": "invalid"},
            },
        )
    try:
        year = int(parts[0])
        mon = int(parts[1])
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "message": "month must be YYYY-MM",
                "errors": {"month": "invalid"},
            },
        ) from exc
    if mon < 1 or mon > 12:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "message": "month must be YYYY-MM",
                "errors": {"month": "invalid"},
            },
        )
    last = calendar.monthrange(year, mon)[1]
    return date(year, mon, 1), date(year, mon, last)


def _resolve_teacher_id(db: Session, school_id: UUID, teacher_id: UUID | None, name: str | None) -> UUID:
    if teacher_id is not None:
        if not teacher_belongs_to_school(db, school_id, teacher_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "success": False,
                    "message": "Teacher not found at this school",
                    "errors": {"teacher_id": "invalid"},
                },
            )
        return teacher_id

    if name and name.strip():
        stmt = select(Teacher).where(Teacher.school_id == school_id, Teacher.name.ilike(name.strip()))
        matches = db.scalars(stmt).all()
        if len(matches) == 1:
            return matches[0].id
        if len(matches) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "success": False,
                    "message": "Teacher name not found — create teacher record or pass teacher_id",
                    "errors": {"name": "not_found"},
                },
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "message": "Ambiguous teacher name — pass teacher_id",
                "errors": {"name": "ambiguous"},
            },
        )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={
            "success": False,
            "message": "Each teacher line requires teacher_id or name",
            "errors": {"teacher": "required"},
        },
    )


def _serialize_teacher_row(row: TeacherAttendance) -> TeacherAttendanceRecordOut:
    tname = row.teacher.name if row.teacher else None
    return TeacherAttendanceRecordOut(
        id=str(row.id),
        school_id=str(row.school_id),
        attendance_date=row.attendance_date,
        teacher_id=str(row.teacher_id),
        teacher_name=tname,
        present=row.present,
        remarks=row.remarks,
        verification_photo_url=row.verification_photo_url,
        approval_status=row.approval_status.value,
        submitted_by_user_id=str(row.submitted_by_user_id),
        approved_by_user_id=str(row.approved_by_user_id) if row.approved_by_user_id else None,
        approved_at=row.approved_at,
    )


@router.post("/teacher", response_model=APIResponse[list[TeacherAttendanceRecordOut]])
def submit_teacher_attendance(
    payload: TeacherAttendanceBatchCreate,
    current_user: AuthUser,
    db: Session = Depends(get_db),
) -> APIResponse[list[TeacherAttendanceRecordOut]]:
    school_uuid = UUID(payload.school_id)
    if not can_read_attendance_for_school(db, current_user, school_uuid):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "message": "You cannot manage attendance for this school",
                "errors": {"school_id": "forbidden"},
            },
        )

    is_teacher_self = current_user.role == UserRole.TEACHER
    is_principal_batch = can_submit_teacher_attendance_batch(db, current_user, school_uuid)

    if is_teacher_self:
        ltid = current_user.linked_teacher_id
        if ltid is None or not can_submit_teacher_self_attendance(db, current_user, school_uuid, ltid):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "success": False,
                    "message": "Teacher accounts must have linked_teacher_id set by Super Admin",
                    "errors": {"account": "misconfigured"},
                },
            )
        if len(payload.teachers) != 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "success": False,
                    "message": "Teachers may submit only their own attendance row",
                    "errors": {"teachers": "too_many"},
                },
            )
    elif not is_principal_batch and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "message": "Only Principals or Super Admin may submit bulk teacher attendance",
                "errors": {"role": "forbidden"},
            },
        )

    out_rows: list[TeacherAttendance] = []
    now = datetime.now(timezone.utc)

    auto_approve = current_user.role in (UserRole.PRINCIPAL, UserRole.SUPER_ADMIN)

    for line in payload.teachers:
        if is_teacher_self:
            tid_uuid = current_user.linked_teacher_id
            assert tid_uuid is not None
        else:
            tid_raw = UUID(line.teacher_id) if line.teacher_id else None
            tid_uuid = _resolve_teacher_id(db, school_uuid, tid_raw, line.name)

        existing = db.scalar(
            select(TeacherAttendance).where(
                TeacherAttendance.school_id == school_uuid,
                TeacherAttendance.attendance_date == payload.date,
                TeacherAttendance.teacher_id == tid_uuid,
            ),
        )

        if existing and existing.approval_status == TeacherAttendanceApprovalStatus.APPROVED and is_teacher_self:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "success": False,
                    "message": "Approved attendance cannot be changed by teachers — contact your principal",
                    "errors": {"duplicate": "locked"},
                },
            )

        appr = TeacherAttendanceApprovalStatus.APPROVED if auto_approve else TeacherAttendanceApprovalStatus.PENDING
        appr_by = current_user.id if auto_approve else None
        appr_at = now if auto_approve else None

        if existing:
            existing.present = line.present
            existing.remarks = line.remarks
            existing.verification_photo_url = line.verification_photo_url
            existing.submitted_by_user_id = current_user.id
            existing.approval_status = appr
            existing.approved_by_user_id = appr_by
            existing.approved_at = appr_at
            db.add(existing)
            out_rows.append(existing)
        else:
            row = TeacherAttendance(
                school_id=school_uuid,
                attendance_date=payload.date,
                teacher_id=tid_uuid,
                present=line.present,
                remarks=line.remarks,
                verification_photo_url=line.verification_photo_url,
                approval_status=appr,
                submitted_by_user_id=current_user.id,
                approved_by_user_id=appr_by,
                approved_at=appr_at,
            )
            db.add(row)
            out_rows.append(row)

    db.commit()
    for r in out_rows:
        db.refresh(r)

    log_activity(
        db,
        action="attendance.teacher_upsert",
        target=str(school_uuid),
        user_id=current_user.id,
        metadata={"date": str(payload.date), "rows": len(out_rows)},
    )

    loaded = (
        db.scalars(
            select(TeacherAttendance)
            .where(TeacherAttendance.id.in_([x.id for x in out_rows]))
            .options(selectinload(TeacherAttendance.teacher)),
        )
        .unique()
        .all()
    )
    by_id = {x.id: x for x in loaded}
    ordered = [by_id[r.id] for r in out_rows if r.id in by_id]

    return APIResponse(
        success=True,
        message="Teacher attendance saved successfully",
        data=[_serialize_teacher_row(x) for x in ordered],
    )


@router.post("/student", response_model=APIResponse[StudentAttendanceDayOut])
def upsert_student_attendance(
    payload: StudentAttendanceUpsert,
    current_user: AuthUser,
    db: Session = Depends(get_db),
) -> APIResponse[StudentAttendanceDayOut]:
    school_uuid = UUID(payload.school_id)
    if not can_submit_student_attendance(db, current_user, school_uuid):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "message": "You cannot submit student attendance for this school",
                "errors": {"school_id": "forbidden"},
            },
        )

    existing = db.scalar(
        select(StudentDailyAttendance).where(
            StudentDailyAttendance.school_id == school_uuid,
            StudentDailyAttendance.attendance_date == payload.date,
        ),
    )

    if existing:
        existing.boys_present = payload.boys_present
        existing.girls_present = payload.girls_present
        existing.submitted_by_user_id = current_user.id
        db.add(existing)
        db.commit()
        db.refresh(existing)
        row = existing
    else:
        row = StudentDailyAttendance(
            school_id=school_uuid,
            attendance_date=payload.date,
            boys_present=payload.boys_present,
            girls_present=payload.girls_present,
            submitted_by_user_id=current_user.id,
        )
        db.add(row)
        db.commit()
        db.refresh(row)

    log_activity(
        db,
        action="attendance.student_upsert",
        target=str(school_uuid),
        user_id=current_user.id,
        metadata={"date": str(payload.date)},
    )

    data = StudentAttendanceDayOut(
        id=str(row.id),
        school_id=str(row.school_id),
        attendance_date=row.attendance_date,
        boys_present=row.boys_present,
        girls_present=row.girls_present,
        submitted_by_user_id=str(row.submitted_by_user_id),
    )
    return APIResponse(success=True, message="Student attendance saved successfully", data=data)


@router.get("/teacher", response_model=APIResponse[MonthlyTeacherAttendanceOut])
def monthly_teacher_attendance(
    current_user: AuthUser,
    db: Session = Depends(get_db),
    school_id: UUID = Query(...),
    month: str = Query(..., min_length=7, max_length=7),
    approval_status: TeacherAttendanceApprovalStatus | None = None,
) -> APIResponse[MonthlyTeacherAttendanceOut]:
    if not can_read_attendance_for_school(db, current_user, school_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "message": "You cannot view attendance for this school",
                "errors": {"school_id": "forbidden"},
            },
        )

    start, end = _month_bounds(month)
    stmt = (
        select(TeacherAttendance)
        .where(
            TeacherAttendance.school_id == school_id,
            TeacherAttendance.attendance_date >= start,
            TeacherAttendance.attendance_date <= end,
        )
        .options(selectinload(TeacherAttendance.teacher))
        .order_by(TeacherAttendance.attendance_date, TeacherAttendance.teacher_id)
    )
    if approval_status is not None:
        stmt = stmt.where(TeacherAttendance.approval_status == approval_status)

    rows = db.scalars(stmt).unique().all()

    summary: dict[str, dict[str, int]] = {}
    for r in rows:
        key = str(r.teacher_id)
        bucket = summary.setdefault(key, {"present": 0, "absent": 0, "pending": 0})
        if r.approval_status == TeacherAttendanceApprovalStatus.PENDING:
            bucket["pending"] += 1
            continue
        if r.approval_status == TeacherAttendanceApprovalStatus.REJECTED:
            continue
        if r.present:
            bucket["present"] += 1
        else:
            bucket["absent"] += 1

    data = MonthlyTeacherAttendanceOut(
        school_id=str(school_id),
        month=month.strip(),
        records=[_serialize_teacher_row(r) for r in rows],
        summary=summary,
    )
    return APIResponse(success=True, message="Monthly teacher attendance fetched successfully", data=data)


@router.get("/student", response_model=APIResponse[MonthlyStudentAttendanceOut])
def monthly_student_attendance(
    current_user: AuthUser,
    db: Session = Depends(get_db),
    school_id: UUID = Query(...),
    month: str = Query(..., min_length=7, max_length=7),
) -> APIResponse[MonthlyStudentAttendanceOut]:
    if not can_read_attendance_for_school(db, current_user, school_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "message": "You cannot view attendance for this school",
                "errors": {"school_id": "forbidden"},
            },
        )

    start, end = _month_bounds(month)
    rows = db.scalars(
        select(StudentDailyAttendance)
        .where(
            StudentDailyAttendance.school_id == school_id,
            StudentDailyAttendance.attendance_date >= start,
            StudentDailyAttendance.attendance_date <= end,
        )
        .order_by(StudentDailyAttendance.attendance_date),
    ).all()

    totals = {"boys_present_sum": 0, "girls_present_sum": 0, "days_recorded": len(rows)}
    for r in rows:
        totals["boys_present_sum"] += r.boys_present
        totals["girls_present_sum"] += r.girls_present

    days = [
        StudentAttendanceDayOut(
            id=str(r.id),
            school_id=str(r.school_id),
            attendance_date=r.attendance_date,
            boys_present=r.boys_present,
            girls_present=r.girls_present,
            submitted_by_user_id=str(r.submitted_by_user_id),
        )
        for r in rows
    ]

    data = MonthlyStudentAttendanceOut(school_id=str(school_id), month=month.strip(), days=days, totals=totals)
    return APIResponse(success=True, message="Monthly student attendance fetched successfully", data=data)


@router.patch("/teacher-record/{record_id}", response_model=APIResponse[TeacherAttendanceRecordOut])
def review_teacher_attendance_record(
    record_id: UUID,
    payload: TeacherAttendanceApprovalPatch,
    current_user: AuthUser,
    db: Session = Depends(get_db),
) -> APIResponse[TeacherAttendanceRecordOut]:
    row = db.get(TeacherAttendance, record_id)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "message": "Attendance record not found",
                "errors": {"record_id": "not_found"},
            },
        )

    if not can_review_teacher_attendance(db, current_user, row.school_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "message": "You cannot approve attendance for this school",
                "errors": {"record_id": "forbidden"},
            },
        )

    st = TeacherAttendanceApprovalStatus(payload.approval_status.value)
    row.approval_status = st
    row.approved_by_user_id = current_user.id if st != TeacherAttendanceApprovalStatus.PENDING else None
    row.approved_at = datetime.now(timezone.utc) if st != TeacherAttendanceApprovalStatus.PENDING else None
    db.add(row)
    db.commit()
    db.refresh(row)
    loaded = db.scalar(
        select(TeacherAttendance).where(TeacherAttendance.id == row.id).options(selectinload(TeacherAttendance.teacher)),
    )
    if loaded is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "message": "Attendance row missing after update",
                "errors": {"record_id": "inconsistent"},
            },
        )

    log_activity(
        db,
        action="attendance.teacher_review",
        target=str(record_id),
        user_id=current_user.id,
        metadata={"status": st.value},
    )

    return APIResponse(success=True, message="Attendance updated successfully", data=_serialize_teacher_row(loaded))


@router.get("/export.csv")
def export_attendance_csv(
    current_user: AuthUser,
    db: Session = Depends(get_db),
    school_id: UUID = Query(...),
    month: str = Query(..., min_length=7, max_length=7),
    kind: str = Query("teacher", pattern="^(teacher|student)$"),
):
    if not can_export_attendance(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "message": "Export is limited to Principals and Super Admin",
                "errors": {"role": "forbidden"},
            },
        )

    if current_user.role == UserRole.PRINCIPAL and not can_review_teacher_attendance(db, current_user, school_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "message": "You cannot export attendance for this school",
                "errors": {"school_id": "forbidden"},
            },
        )

    if not can_read_attendance_for_school(db, current_user, school_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "message": "You cannot export attendance for this school",
                "errors": {"school_id": "forbidden"},
            },
        )

    start, end = _month_bounds(month)
    buf = io.StringIO()
    writer = csv.writer(buf)

    if kind == "teacher":
        writer.writerow(
            ["school_id", "date", "teacher_id", "teacher_name", "present", "approval_status", "remarks"],
        )
        t_rows = db.scalars(
            select(TeacherAttendance)
            .where(
                TeacherAttendance.school_id == school_id,
                TeacherAttendance.attendance_date >= start,
                TeacherAttendance.attendance_date <= end,
            )
            .options(selectinload(TeacherAttendance.teacher))
            .order_by(TeacherAttendance.attendance_date, TeacherAttendance.teacher_id),
        ).unique().all()
        for r in t_rows:
            writer.writerow(
                [
                    str(r.school_id),
                    r.attendance_date.isoformat(),
                    str(r.teacher_id),
                    r.teacher.name if r.teacher else "",
                    "1" if r.present else "0",
                    r.approval_status.value,
                    r.remarks or "",
                ],
            )
    else:
        writer.writerow(["school_id", "date", "boys_present", "girls_present"])
        s_rows = db.scalars(
            select(StudentDailyAttendance)
            .where(
                StudentDailyAttendance.school_id == school_id,
                StudentDailyAttendance.attendance_date >= start,
                StudentDailyAttendance.attendance_date <= end,
            )
            .order_by(StudentDailyAttendance.attendance_date),
        ).all()
        for r in s_rows:
            writer.writerow(
                [
                    str(r.school_id),
                    r.attendance_date.isoformat(),
                    r.boys_present,
                    r.girls_present,
                ],
            )

    filename = f"attendance-{kind}-{school_id}-{month}.csv"
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
