from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.geography import District, Taluka, UnionCouncil
from app.models.report import Report, ReportComment, ReportStatus
from app.models.school import School
from app.models.user import User, UserRole
from app.schemas.common import APIResponse
from app.schemas.report import (
    CompareDistrictMetrics,
    CompareDistrictsOut,
    CompareQuarterMetrics,
    CompareQuartersOut,
    CompareReportsOut,
    CompareSchoolMetrics,
    PaginatedReports,
    ReportCommentCreate,
    ReportCommentOut,
    ReportCreate,
    ReportOut,
    ReportPatch,
    ReportReviewPatch,
)
from app.services.audit import log_activity
from app.services.report_access import (
    can_create_report,
    can_edit_report_body,
    can_export_report,
    can_read_report,
    can_review_report_status,
    can_post_oversight_comment,
    can_submit_report,
    reports_select_filtered,
    user_can_view_school_for_compare,
)
from app.services.notify import notify_report_approved, notify_report_submitted
from app.services.report_export import report_to_pdf, report_to_xlsx
from app.services.report_generation import (
    build_snapshot,
    compare_district_metrics,
    compare_school_across_quarters,
    compare_school_metrics,
    normalize_quarter,
)

router = APIRouter(prefix="/reports", tags=["reports"])

AuthUser = Annotated[User, Depends(get_current_user)]


def _comment_out(c: ReportComment) -> ReportCommentOut:
    author = getattr(c, "user", None)
    author_name = author.full_name if author else None
    return ReportCommentOut(
        id=str(c.id),
        user_id=str(c.user_id),
        author_name=author_name,
        body=c.body,
        created_at=c.created_at,
    )


def _forbidden() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"success": False, "message": "Forbidden", "errors": {"report": "forbidden"}},
    )


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"success": False, "message": "Report not found", "errors": {"report_id": "not found"}},
    )


def _bad(message: str, field: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"success": False, "message": message, "errors": {field: "invalid"}},
    )


def _report_out(r: Report) -> ReportOut:
    return ReportOut(
        id=str(r.id),
        school_id=str(r.school_id),
        quarter=r.quarter,
        visit_id=str(r.visit_id) if r.visit_id else None,
        summary=r.summary,
        recommendations=r.recommendations,
        principal_infrastructure_notes=r.principal_infrastructure_notes,
        principal_daily_activity_notes=r.principal_daily_activity_notes,
        generated_snapshot=r.generated_snapshot,
        status=r.status.value,
        review_remarks=r.review_remarks,
        reviewed_by_user_id=str(r.reviewed_by_user_id) if r.reviewed_by_user_id else None,
        reviewed_at=r.reviewed_at,
        created_by_user_id=str(r.created_by_user_id),
        created_at=r.created_at,
        updated_at=r.updated_at,
    )


def _load_report(db: Session, report_id: UUID) -> Report | None:
    stmt = select(Report).where(Report.id == report_id).options(selectinload(Report.comments))
    return db.scalars(stmt).unique().one_or_none()


@router.post("", response_model=APIResponse[ReportOut])
def create_report(
    payload: ReportCreate,
    current_user: AuthUser,
    db: Session = Depends(get_db),
) -> APIResponse[ReportOut]:
    school_uuid = UUID(payload.school_id)
    if not can_create_report(db, current_user, school_uuid):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "message": (
                    "You cannot create a report for this school. "
                    "Super admins may draft for any school; others must pick a school assigned to their account "
                    "(see Assigned schools)."
                ),
                "errors": {"school_id": "forbidden"},
            },
        )

    try:
        norm_q = normalize_quarter(payload.quarter)
    except ValueError as exc:
        raise _bad(str(exc), "quarter") from exc

    snapshot, visit_id = build_snapshot(db, school_id=school_uuid, quarter=norm_q)

    report = Report(
        school_id=school_uuid,
        quarter=norm_q,
        visit_id=visit_id,
        summary=payload.summary,
        recommendations=payload.recommendations,
        generated_snapshot=snapshot,
        status=ReportStatus.DRAFT,
        created_by_user_id=current_user.id,
    )
    db.add(report)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "success": False,
                "message": "A report already exists for this school and quarter",
                "errors": {"quarter": "duplicate"},
            },
        ) from None

    db.refresh(report)
    log_activity(
        db,
        action="reports.create",
        target=str(report.id),
        user_id=current_user.id,
        metadata={"school_id": str(school_uuid), "quarter": norm_q},
    )
    return APIResponse(success=True, message="Report created successfully", data=_report_out(report))


@router.get("", response_model=APIResponse[PaginatedReports])
def list_reports(
    current_user: AuthUser,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    school_id: UUID | None = None,
    quarter: str | None = Query(None, max_length=20),
    district_id: UUID | None = None,
    status_filter: ReportStatus | None = Query(None, alias="status"),
) -> APIResponse[PaginatedReports]:
    stmt = reports_select_filtered(current_user)

    if district_id is not None:
        if current_user.role not in (UserRole.SUPER_ADMIN, UserRole.GOVERNMENT):
            raise _forbidden()
        uc_subq = select(UnionCouncil.id).join(Taluka).where(Taluka.district_id == district_id)
        school_filter = select(School.id).where(School.uc_id.in_(uc_subq))
        stmt = stmt.where(Report.school_id.in_(school_filter))

    if school_id is not None:
        stmt = stmt.where(Report.school_id == school_id)
    if quarter:
        try:
            stmt = stmt.where(Report.quarter == normalize_quarter(quarter))
        except ValueError as exc:
            raise _bad(str(exc), "quarter") from exc
    if status_filter is not None:
        stmt = stmt.where(Report.status == status_filter)

    id_subq = stmt.with_only_columns(Report.id).distinct().subquery()
    total = db.scalar(select(func.count()).select_from(id_subq)) or 0

    rows = db.scalars(
        select(Report)
        .where(Report.id.in_(select(id_subq.c.id)))
        .order_by(Report.updated_at.desc())
        .offset(skip)
        .limit(limit),
    ).all()

    return APIResponse(
        success=True,
        message="Reports fetched successfully",
        data=PaginatedReports(items=[_report_out(r) for r in rows], total=total),
    )


@router.get("/compare/districts", response_model=APIResponse[CompareDistrictsOut])
def compare_districts(
    current_user: AuthUser,
    db: Session = Depends(get_db),
    quarter: str = Query(..., min_length=5, max_length=20),
    district_ids: str = Query(..., description="Comma-separated district UUIDs"),
) -> APIResponse[CompareDistrictsOut]:
    """District roll-ups for Government and Super Admin (Iteration 7)."""
    if current_user.role not in (UserRole.SUPER_ADMIN, UserRole.GOVERNMENT):
        raise _forbidden()

    try:
        norm_q = normalize_quarter(quarter)
    except ValueError as exc:
        raise _bad(str(exc), "quarter") from exc

    raw_ids = [x.strip() for x in district_ids.split(",") if x.strip()]
    if len(raw_ids) < 2 or len(raw_ids) > 8:
        raise _bad("Provide between 2 and 8 district IDs", "district_ids")

    parsed: list[UUID] = []
    for item in raw_ids:
        try:
            parsed.append(UUID(item))
        except ValueError:
            raise _bad("Invalid UUID in district_ids", "district_ids") from None

    for did in parsed:
        if db.get(District, did) is None:
            raise _bad("Unknown district_id", "district_ids")

    rows = compare_district_metrics(db, parsed, norm_q)
    districts = [CompareDistrictMetrics.model_validate(r) for r in rows]
    return APIResponse(success=True, message="District comparison generated successfully", data=CompareDistrictsOut(quarter=norm_q, districts=districts))


@router.get("/compare/quarters", response_model=APIResponse[CompareQuartersOut])
def compare_quarters(
    current_user: AuthUser,
    db: Session = Depends(get_db),
    school_id: UUID = Query(...),
    quarters: str = Query(..., description="Comma-separated quarters e.g. Q1-2026,Q2-2026"),
) -> APIResponse[CompareQuartersOut]:
    """Quarter-over-quarter metrics for one school."""
    if not user_can_view_school_for_compare(db, current_user, school_id):
        raise _forbidden()

    raw_q = [x.strip() for x in quarters.split(",") if x.strip()]
    if len(raw_q) < 2 or len(raw_q) > 8:
        raise _bad("Provide between 2 and 8 quarters", "quarters")

    for q in raw_q:
        try:
            normalize_quarter(q)
        except ValueError as exc:
            raise _bad(str(exc), "quarters") from exc

    school = db.get(School, school_id)
    rows = compare_school_across_quarters(db, school_id, raw_q)
    for r in rows:
        r["school_name"] = school.name if school else None
    quarter_rows = [CompareQuarterMetrics.model_validate(r) for r in rows]
    return APIResponse(
        success=True,
        message="Quarter comparison generated successfully",
        data=CompareQuartersOut(
            school_id=str(school_id),
            school_name=school.name if school else None,
            quarters=quarter_rows,
        ),
    )


@router.get("/compare", response_model=APIResponse[CompareReportsOut])
def compare_reports(
    current_user: AuthUser,
    db: Session = Depends(get_db),
    quarter: str = Query(..., min_length=5, max_length=20),
    school_ids: str = Query(..., description="Comma-separated school UUIDs"),
) -> APIResponse[CompareReportsOut]:
    try:
        norm_q = normalize_quarter(quarter)
    except ValueError as exc:
        raise _bad(str(exc), "quarter") from exc

    raw_ids = [x.strip() for x in school_ids.split(",") if x.strip()]
    if len(raw_ids) < 2 or len(raw_ids) > 12:
        raise _bad("Provide between 2 and 12 school IDs", "school_ids")

    parsed: list[UUID] = []
    for item in raw_ids:
        try:
            parsed.append(UUID(item))
        except ValueError:
            raise _bad("Invalid UUID in school_ids", "school_ids") from None

    for sid in parsed:
        if not user_can_view_school_for_compare(db, current_user, sid):
            raise _forbidden()

    rows = compare_school_metrics(db, parsed, norm_q)
    schools = [CompareSchoolMetrics.model_validate(r) for r in rows]
    return APIResponse(success=True, message="Comparison generated successfully", data=CompareReportsOut(quarter=norm_q, schools=schools))


@router.get("/{report_id}", response_model=APIResponse[ReportOut])
def get_report(report_id: UUID, current_user: AuthUser, db: Session = Depends(get_db)) -> APIResponse[ReportOut]:
    report = _load_report(db, report_id)
    if not report:
        raise _not_found()
    if not can_read_report(db, current_user, report):
        raise _forbidden()
    return APIResponse(success=True, message="Report fetched successfully", data=_report_out(report))


@router.patch("/{report_id}", response_model=APIResponse[ReportOut])
def patch_report(
    report_id: UUID,
    payload: ReportPatch,
    background_tasks: BackgroundTasks,
    current_user: AuthUser,
    db: Session = Depends(get_db),
) -> APIResponse[ReportOut]:
    if current_user.role in (UserRole.GOVERNMENT, UserRole.PARTNER):
        raise _forbidden()

    report = db.get(Report, report_id)
    if not report:
        raise _not_found()
    if not can_read_report(db, current_user, report):
        raise _forbidden()

    old_status = report.status

    data = payload.model_dump(exclude_unset=True)

    if "status" in data and data["status"] is not None:
        new_st = ReportStatus(data["status"].value if hasattr(data["status"], "value") else data["status"])
        if new_st in (ReportStatus.APPROVED, ReportStatus.REJECTED):
            raise _bad("Use PATCH /reports/{id}/status for approve/reject", "status")
        if new_st == ReportStatus.SUBMITTED:
            if not can_submit_report(db, current_user, report):
                raise _forbidden()
            report.status = ReportStatus.SUBMITTED
        elif new_st == ReportStatus.DRAFT:
            if current_user.role != UserRole.SUPER_ADMIN:
                raise _forbidden()
            if report.status != ReportStatus.REJECTED:
                raise _bad("Only rejected reports can be reopened to draft", "status")
            report.status = ReportStatus.DRAFT
            report.review_remarks = None
            report.reviewed_by_user_id = None
            report.reviewed_at = None
        else:
            raise _bad("Only draft reopen or submit transitions are allowed here", "status")

    body_fields = {"summary", "recommendations", "principal_infrastructure_notes", "principal_daily_activity_notes"}
    if body_fields.intersection(data.keys()):
        if not can_edit_report_body(db, current_user, report):
            raise _forbidden()
        if "summary" in data:
            report.summary = data["summary"]
        if "recommendations" in data:
            report.recommendations = data["recommendations"]
        if "principal_infrastructure_notes" in data:
            report.principal_infrastructure_notes = data["principal_infrastructure_notes"]
        if "principal_daily_activity_notes" in data:
            report.principal_daily_activity_notes = data["principal_daily_activity_notes"]

    db.commit()
    db.refresh(report)

    log_activity(
        db,
        action="reports.update",
        target=str(report.id),
        user_id=current_user.id,
        metadata={"status": report.status.value},
    )

    if old_status != ReportStatus.SUBMITTED and report.status == ReportStatus.SUBMITTED:
        background_tasks.add_task(notify_report_submitted, str(report.id))

    return APIResponse(success=True, message="Report updated successfully", data=_report_out(report))


@router.patch("/{report_id}/status", response_model=APIResponse[ReportOut])
def review_report(
    report_id: UUID,
    payload: ReportReviewPatch,
    background_tasks: BackgroundTasks,
    current_user: AuthUser,
    db: Session = Depends(get_db),
) -> APIResponse[ReportOut]:
    report = db.get(Report, report_id)
    if not report:
        raise _not_found()
    if not can_review_report_status(db, current_user, report):
        raise _forbidden()

    if report.status != ReportStatus.SUBMITTED:
        raise _bad("Only submitted reports can be approved or rejected", "status")

    if payload.status == "approved":
        report.status = ReportStatus.APPROVED
    else:
        report.status = ReportStatus.REJECTED

    report.review_remarks = payload.remarks
    report.reviewed_by_user_id = current_user.id
    from datetime import datetime, timezone

    report.reviewed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(report)

    log_activity(
        db,
        action="reports.review",
        target=str(report.id),
        user_id=current_user.id,
        metadata={"decision": payload.status},
    )

    if payload.status == "approved":
        background_tasks.add_task(notify_report_approved, str(report.id))

    return APIResponse(success=True, message="Report review saved successfully", data=_report_out(report))


@router.post("/{report_id}/comments", response_model=APIResponse[ReportCommentOut])
def add_report_comment(
    report_id: UUID,
    payload: ReportCommentCreate,
    current_user: AuthUser,
    db: Session = Depends(get_db),
) -> APIResponse[ReportCommentOut]:
    if not can_post_oversight_comment(current_user):
        raise _forbidden()

    report = db.get(Report, report_id)
    if not report:
        raise _not_found()
    if not can_read_report(db, current_user, report):
        raise _forbidden()

    c = ReportComment(report_id=report.id, user_id=current_user.id, body=payload.body.strip())
    db.add(c)
    db.commit()
    db.refresh(c)
    row = db.scalars(
        select(ReportComment).where(ReportComment.id == c.id).options(joinedload(ReportComment.user)),
    ).unique().one()

    log_activity(
        db,
        action="reports.comment",
        target=str(report.id),
        user_id=current_user.id,
        metadata={"comment_id": str(c.id)},
    )

    return APIResponse(
        success=True,
        message="Comment posted successfully",
        data=_comment_out(row),
    )


@router.get("/{report_id}/comments", response_model=APIResponse[list[ReportCommentOut]])
def list_report_comments(
    report_id: UUID,
    current_user: AuthUser,
    db: Session = Depends(get_db),
) -> APIResponse[list[ReportCommentOut]]:
    report = db.get(Report, report_id)
    if not report:
        raise _not_found()
    if not can_read_report(db, current_user, report):
        raise _forbidden()

    rows = db.scalars(
        select(ReportComment)
        .where(ReportComment.report_id == report_id)
        .options(joinedload(ReportComment.user))
        .order_by(ReportComment.created_at.asc()),
    ).unique().all()

    return APIResponse(
        success=True,
        message="Comments fetched successfully",
        data=[_comment_out(r) for r in rows],
    )


@router.get("/{report_id}/export")
def export_report(
    report_id: UUID,
    current_user: AuthUser,
    db: Session = Depends(get_db),
    format: str = Query("xlsx", pattern="^(xlsx|pdf)$"),
):
    report = db.get(Report, report_id)
    if not report:
        raise _not_found()
    if not can_export_report(db, current_user, report):
        raise _forbidden()

    if format == "pdf":
        raw = report_to_pdf(report)
        media = "application/pdf"
        ext = "pdf"
    else:
        raw = report_to_xlsx(report)
        media = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ext = "xlsx"

    filename = f"report-{report.quarter}-{report.school_id}.{ext}"
    return Response(
        content=raw,
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
