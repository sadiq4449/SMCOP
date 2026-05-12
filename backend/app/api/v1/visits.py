from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.models.monitoring import (
    KPI,
    EvidenceDocument,
    InfrastructureChecklistItem,
    InfrastructureItemStatus,
    KpiScore,
    Visit,
    VisitFormStatus as VFStatus,
)
from app.models.user import User, UserRole
from app.schemas.common import APIResponse
from app.schemas.monitoring import (
    DocumentSummary,
    EvidenceUploadResult,
    InfrastructureLineOut,
    KpiScoreOut,
    PaginatedVisits,
    VisitCreate,
    VisitDetail,
    VisitFormStatus as PatchVisitStatus,
    VisitKpiSubmit,
    VisitPatch,
    VisitSummary,
)
from app.services.audit import log_activity
from app.services.evidence_storage import ALLOWED_IMAGE_EXT, save_visit_evidence_file
from app.services.visit_access import can_create_visit_for_school, can_mutate_visit, can_read_visit, visit_select_filtered
from app.services.visit_scoring import recompute_visit_aggregate

router = APIRouter(prefix="/visits", tags=["visits"])

AuthUser = Annotated[User, Depends(get_current_user)]


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={
            "success": False,
            "message": "Visit not found",
            "errors": {"visit_id": "not found"},
        },
    )


def _finalize_guard(db: Session, visit: Visit) -> None:
    if visit.visit_date is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "message": "Visit date is required before finalizing",
                "errors": {"visit_date": "required"},
            },
        )
    master_ids = set(db.scalars(select(KPI.id)).all())
    scored_ids = set(db.scalars(select(KpiScore.kpi_id).where(KpiScore.visit_id == visit.id)).all())
    if master_ids != scored_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "message": "All KPI scores must be submitted before finalizing",
                "errors": {"kpi_scores": "incomplete"},
            },
        )


def _visit_summary(v: Visit) -> VisitSummary:
    agg = float(v.aggregate_score) if v.aggregate_score is not None else None
    return VisitSummary(
        id=str(v.id),
        school_id=str(v.school_id),
        quarter=v.quarter,
        visit_date=v.visit_date,
        status=v.status.value,
        aggregate_score=agg,
        visited_by_id=str(v.visited_by_id),
        created_at=v.created_at,
        updated_at=v.updated_at,
    )


def _visit_detail(db: Session, visit: Visit) -> VisitDetail:
    scores_out: list[KpiScoreOut] = []
    for s in sorted(visit.kpi_scores, key=lambda x: (x.kpi.sort_order if x.kpi else 99, str(x.kpi_id))):
        scores_out.append(
            KpiScoreOut(
                kpi_id=str(s.kpi_id),
                score=s.score,
                remarks=s.remarks,
                kpi_name=s.kpi.name if s.kpi else None,
                kpi_max_score=s.kpi.max_score if s.kpi else None,
            )
        )
    infra_out = [
        InfrastructureLineOut(
            id=str(i.id),
            item_name=i.item_name,
            status=i.status.value,
            remarks=i.remarks,
        )
        for i in visit.infrastructure_items
    ]
    docs_out = [
        DocumentSummary(
            id=str(d.id),
            file_name=d.file_name,
            file_type=d.file_type,
            download_path=f"/documents/{d.id}/download",
            created_at=d.created_at,
            metadata=d.metadata_json,
        )
        for d in sorted(visit.documents, key=lambda x: x.created_at)
    ]
    agg = float(visit.aggregate_score) if visit.aggregate_score is not None else None
    return VisitDetail(
        id=str(visit.id),
        school_id=str(visit.school_id),
        quarter=visit.quarter,
        visit_date=visit.visit_date,
        status=visit.status.value,
        remarks=visit.remarks,
        aggregate_score=agg,
        gps_latitude=visit.gps_latitude,
        gps_longitude=visit.gps_longitude,
        visited_by_id=str(visit.visited_by_id),
        created_at=visit.created_at,
        updated_at=visit.updated_at,
        kpi_scores=scores_out,
        infrastructure=infra_out,
        documents=docs_out,
    )


def _load_visit_detail(db: Session, visit_id: UUID) -> Visit | None:
    stmt = (
        select(Visit)
        .where(Visit.id == visit_id)
        .options(
            selectinload(Visit.kpi_scores).selectinload(KpiScore.kpi),
            selectinload(Visit.infrastructure_items),
            selectinload(Visit.documents),
        )
    )
    return db.scalars(stmt).unique().one_or_none()


@router.post("", response_model=APIResponse[VisitSummary])
def create_visit(
    payload: VisitCreate,
    current_user: AuthUser,
    db: Session = Depends(get_db),
) -> APIResponse[VisitSummary]:
    if current_user.role != UserRole.ENUMERATOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "message": "Only enumerators can create monitoring visits",
                "errors": {"role": "forbidden"},
            },
        )

    school_uuid = UUID(payload.school_id)
    if not can_create_visit_for_school(db, current_user, school_uuid):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "message": "You cannot create visits for this school",
                "errors": {"school_id": "forbidden"},
            },
        )

    quarter = payload.quarter.strip()
    visit = Visit(
        school_id=school_uuid,
        quarter=quarter,
        visit_date=payload.visit_date,
        visited_by_id=current_user.id,
        status=VFStatus.DRAFT,
    )
    db.add(visit)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "success": False,
                "message": "A visit for this school and quarter already exists",
                "errors": {"quarter": "duplicate"},
            },
        ) from None

    db.refresh(visit)
    log_activity(
        db,
        action="visits.create",
        target=str(visit.id),
        user_id=current_user.id,
        metadata={"school_id": str(school_uuid), "quarter": quarter},
    )
    return APIResponse(success=True, message="Visit created successfully", data=_visit_summary(visit))


@router.get("", response_model=APIResponse[PaginatedVisits])
def list_visits(
    current_user: AuthUser,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    school_id: UUID | None = None,
    quarter: str | None = Query(None, max_length=20),
) -> APIResponse[PaginatedVisits]:
    base = visit_select_filtered(current_user, db)
    if school_id is not None:
        base = base.where(Visit.school_id == school_id)
    if quarter:
        base = base.where(Visit.quarter == quarter.strip())

    id_subq = base.with_only_columns(Visit.id).distinct().subquery()
    total = db.scalar(select(func.count()).select_from(id_subq)) or 0

    stmt = (
        select(Visit)
        .where(Visit.id.in_(select(id_subq.c.id)))
        .order_by(Visit.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    rows = db.scalars(stmt).unique().all()

    return APIResponse(
        success=True,
        message="Visits fetched successfully",
        data=PaginatedVisits(items=[_visit_summary(v) for v in rows], total=total),
    )


@router.get("/{visit_id}", response_model=APIResponse[VisitDetail])
def get_visit(
    visit_id: UUID,
    current_user: AuthUser,
    db: Session = Depends(get_db),
) -> APIResponse[VisitDetail]:
    visit = _load_visit_detail(db, visit_id)
    if not visit:
        raise _not_found()
    if not can_read_visit(db, current_user, visit):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "message": "You do not have access to this visit",
                "errors": {"visit_id": "forbidden"},
            },
        )
    return APIResponse(success=True, message="Visit fetched successfully", data=_visit_detail(db, visit))


@router.patch("/{visit_id}", response_model=APIResponse[VisitDetail])
def patch_visit(
    visit_id: UUID,
    payload: VisitPatch,
    current_user: AuthUser,
    db: Session = Depends(get_db),
) -> APIResponse[VisitDetail]:
    visit = db.get(Visit, visit_id)
    if not visit:
        raise _not_found()
    old_status = visit.status
    if not can_read_visit(db, current_user, visit):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "message": "You do not have access to this visit",
                "errors": {"visit_id": "forbidden"},
            },
        )

    if payload.status == PatchVisitStatus.draft and visit.status == VFStatus.FINALIZED:
        if current_user.role != UserRole.SUPER_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "success": False,
                    "message": "Only Super Admin can reopen a finalized visit",
                    "errors": {"status": "forbidden"},
                },
            )

    if not can_mutate_visit(db, current_user, visit):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "message": "This visit cannot be edited",
                "errors": {"visit_id": "immutable"},
            },
        )

    data = payload.model_dump(exclude_unset=True)

    if "visit_date" in data:
        visit.visit_date = data["visit_date"]
    if "remarks" in data:
        visit.remarks = data["remarks"]
    if "gps_latitude" in data:
        visit.gps_latitude = data["gps_latitude"]
    if "gps_longitude" in data:
        visit.gps_longitude = data["gps_longitude"]

    new_finalized = False
    if "status" in data and data["status"] is not None:
        raw = data["status"]
        new_st = VFStatus(raw.value if isinstance(raw, PatchVisitStatus) else raw)
        if new_st == VFStatus.FINALIZED:
            _finalize_guard(db, visit)
        new_finalized = new_st == VFStatus.FINALIZED and old_status != VFStatus.FINALIZED
        visit.status = new_st

    if "infrastructure" in data and data["infrastructure"] is not None:
        db.execute(delete(InfrastructureChecklistItem).where(InfrastructureChecklistItem.visit_id == visit.id))
        for row in data["infrastructure"]:
            st = row["status"]
            status_val = st.value if hasattr(st, "value") else st
            db.add(
                InfrastructureChecklistItem(
                    visit_id=visit.id,
                    item_name=row["item_name"].strip(),
                    status=InfrastructureItemStatus(status_val),
                    remarks=row.get("remarks"),
                )
            )

    db.commit()

    visit = _load_visit_detail(db, visit_id)
    if not visit:
        raise _not_found()

    if new_finalized:
        log_activity(
            db,
            action="visits.finalize",
            target=str(visit.id),
            user_id=current_user.id,
            metadata={"school_id": str(visit.school_id), "quarter": visit.quarter},
        )

    return APIResponse(success=True, message="Visit updated successfully", data=_visit_detail(db, visit))


@router.post("/{visit_id}/kpis", response_model=APIResponse[VisitDetail])
def submit_visit_kpis(
    visit_id: UUID,
    payload: VisitKpiSubmit,
    current_user: AuthUser,
    db: Session = Depends(get_db),
) -> APIResponse[VisitDetail]:
    visit = db.get(Visit, visit_id)
    if not visit:
        raise _not_found()
    if not can_read_visit(db, current_user, visit):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "message": "You do not have access to this visit",
                "errors": {"visit_id": "forbidden"},
            },
        )
    if not can_mutate_visit(db, current_user, visit):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "message": "This visit cannot be edited",
                "errors": {"visit_id": "immutable"},
            },
        )

    kpi_rows = {k.id: k for k in db.scalars(select(KPI)).all()}

    for row in payload.scores:
        kid = UUID(row.kpi_id)
        if kid not in kpi_rows:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "success": False,
                    "message": "Unknown KPI id",
                    "errors": {"kpi_id": "invalid"},
                },
            )
        mx = kpi_rows[kid].max_score
        if row.score > mx:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "success": False,
                    "message": f"Score exceeds max ({mx}) for this KPI",
                    "errors": {"score": "too_high"},
                },
            )

        existing = db.execute(
            select(KpiScore).where(KpiScore.visit_id == visit.id, KpiScore.kpi_id == kid),
        ).scalar_one_or_none()
        if existing:
            existing.score = row.score
            existing.remarks = row.remarks
        else:
            db.add(KpiScore(visit_id=visit.id, kpi_id=kid, score=row.score, remarks=row.remarks))

    if payload.remarks is not None:
        visit.remarks = payload.remarks

    recompute_visit_aggregate(db, visit.id)
    db.commit()

    visit = _load_visit_detail(db, visit_id)
    if not visit:
        raise _not_found()
    return APIResponse(success=True, message="KPI scores saved successfully", data=_visit_detail(db, visit))


@router.post("/{visit_id}/evidence", response_model=APIResponse[EvidenceUploadResult])
async def upload_visit_evidence(
    visit_id: UUID,
    current_user: AuthUser,
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
    gps_latitude: str | None = Form(None),
    gps_longitude: str | None = Form(None),
) -> APIResponse[EvidenceUploadResult]:
    visit = db.get(Visit, visit_id)
    if not visit:
        raise _not_found()
    if not can_read_visit(db, current_user, visit):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "message": "You do not have access to this visit",
                "errors": {"visit_id": "forbidden"},
            },
        )
    if not can_mutate_visit(db, current_user, visit):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "message": "Evidence cannot be added to a finalized visit",
                "errors": {"visit_id": "immutable"},
            },
        )

    suffix = ""
    if file.filename and "." in file.filename:
        suffix = f".{file.filename.rsplit('.', 1)[-1].lower()}"
    if suffix not in ALLOWED_IMAGE_EXT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "message": "Only common image uploads are allowed",
                "errors": {"file": "invalid_type"},
            },
        )

    settings = get_settings()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    chunks: list[bytes] = []
    total = 0
    while True:
        piece = await file.read(1024 * 1024)
        if not piece:
            break
        total += len(piece)
        if total > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "success": False,
                    "message": f"File too large (max {settings.max_upload_mb} MB)",
                    "errors": {"file": "too_large"},
                },
            )
        chunks.append(piece)
    raw = b"".join(chunks)

    rel = save_visit_evidence_file(settings.upload_root, visit.id, file.filename or "photo.jpg", raw)

    meta: dict | None = None
    if gps_latitude or gps_longitude:
        meta = {}
        try:
            if gps_latitude:
                meta["gps_latitude"] = float(gps_latitude)
            if gps_longitude:
                meta["gps_longitude"] = float(gps_longitude)
        except ValueError:
            meta = {"gps_latitude_raw": gps_latitude, "gps_longitude_raw": gps_longitude}

    doc = EvidenceDocument(
        school_id=visit.school_id,
        visit_id=visit.id,
        file_name=file.filename or "photo.jpg",
        file_url=rel,
        file_type=file.content_type or "image/jpeg",
        uploaded_by_id=current_user.id,
        metadata_json=meta,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    log_activity(
        db,
        action="visits.evidence_upload",
        target=str(visit.id),
        user_id=current_user.id,
        metadata={"document_id": str(doc.id)},
    )

    return APIResponse(
        success=True,
        message="Evidence uploaded successfully",
        data=EvidenceUploadResult(
            document_id=str(doc.id),
            download_path=f"/documents/{doc.id}/download",
            presigned=None,
        ),
    )
