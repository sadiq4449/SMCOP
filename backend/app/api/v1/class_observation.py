from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.models.monitoring import ClassroomObservation, EvidenceDocument, Visit
from app.models.school import Teacher
from app.models.user import User, UserRole
from app.schemas.class_observation import (
    ClassroomObservationCreate,
    ClassroomObservationOut,
    ClassroomObservationPatch,
    ObservationDocumentSummary,
    PaginatedObservations,
)
from app.schemas.common import APIResponse
from app.schemas.monitoring import EvidenceUploadResult
from app.services.audit import log_activity
from app.services.evidence_storage import ALLOWED_IMAGE_EXT, save_observation_evidence_file
from app.services.observation_access import (
    can_mutate_observation,
    can_read_observation,
    can_review_observation_comments,
    get_observation,
)
from app.services.visit_access import can_mutate_visit, can_read_visit, visit_select_filtered

router = APIRouter(prefix="/class-observation", tags=["classroom observations"])

AuthUser = Annotated[User, Depends(get_current_user)]


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={
            "success": False,
            "message": "Observation not found",
            "errors": {"id": "not found"},
        },
    )


def _resolve_teacher_for_school(
    db: Session,
    *,
    school_id: UUID,
    teacher_id: UUID | None,
    teacher_name: str | None,
) -> tuple[UUID | None, str | None]:
    """Return (teacher_id, normalized teacher_name snapshot)."""
    if teacher_id is not None:
        t = db.get(Teacher, teacher_id)
        if not t or t.school_id != school_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "success": False,
                    "message": "Teacher does not belong to this visit's school",
                    "errors": {"teacher_id": "invalid"},
                },
            )
        return teacher_id, t.name.strip()

    if teacher_name and teacher_name.strip():
        name = teacher_name.strip()
        stmt = select(Teacher).where(Teacher.school_id == school_id, Teacher.name.ilike(name.strip()))
        matches = db.scalars(stmt).all()
        if len(matches) == 1:
            return matches[0].id, matches[0].name.strip()
        if len(matches) == 0:
            return None, name
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "message": "Multiple teachers matched this name — provide teacher_id",
                "errors": {"teacher_name": "ambiguous"},
            },
        )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={
            "success": False,
            "message": "Either teacher_id or teacher_name is required",
            "errors": {"teacher": "required"},
        },
    )


def _serialize(obs: ClassroomObservation, visit: Visit) -> ClassroomObservationOut:
    docs = sorted(obs.documents, key=lambda d: d.created_at) if obs.documents else []
    return ClassroomObservationOut(
        id=str(obs.id),
        visit_id=str(obs.visit_id),
        school_id=str(visit.school_id),
        quarter=visit.quarter,
        teacher_id=str(obs.teacher_id) if obs.teacher_id else None,
        teacher_name=obs.teacher_name,
        subject=obs.subject,
        grade=obs.grade,
        observation_date=obs.observation_date,
        score_engagement=obs.score_engagement,
        score_pedagogy=obs.score_pedagogy,
        score_environment=obs.score_environment,
        strengths=obs.strengths,
        weaknesses=obs.weaknesses,
        recommendations=obs.recommendations,
        remarks=obs.remarks,
        reviewer_comments=obs.reviewer_comments,
        created_at=obs.created_at,
        updated_at=obs.updated_at,
        documents=[
            ObservationDocumentSummary(
                id=str(d.id),
                file_name=d.file_name,
                file_type=d.file_type,
                download_path=f"/documents/{d.id}/download",
                created_at=d.created_at,
            )
            for d in docs
            if d.classroom_observation_id == obs.id
        ],
    )


def _load_observation(db: Session, observation_id: UUID) -> ClassroomObservation | None:
    stmt = (
        select(ClassroomObservation)
        .where(ClassroomObservation.id == observation_id)
        .options(selectinload(ClassroomObservation.documents))
    )
    return db.scalars(stmt).unique().one_or_none()


@router.post("", response_model=APIResponse[ClassroomObservationOut])
def create_observation(
    payload: ClassroomObservationCreate,
    current_user: AuthUser,
    db: Session = Depends(get_db),
) -> APIResponse[ClassroomObservationOut]:
    if current_user.role in (UserRole.GOVERNMENT, UserRole.PRINCIPAL, UserRole.TEACHER):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "message": "Your role cannot create classroom observations",
                "errors": {"role": "forbidden"},
            },
        )

    visit = db.get(Visit, UUID(payload.visit_id))
    if not visit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "message": "Visit not found",
                "errors": {"visit_id": "not found"},
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

    tid_raw = UUID(payload.teacher_id) if payload.teacher_id else None
    tid, tname = _resolve_teacher_for_school(
        db,
        school_id=visit.school_id,
        teacher_id=tid_raw,
        teacher_name=payload.teacher_name,
    )

    obs = ClassroomObservation(
        visit_id=visit.id,
        teacher_id=tid,
        teacher_name=tname,
        subject=payload.subject.strip(),
        grade=payload.grade.strip(),
        observation_date=payload.observation_date,
        score_engagement=payload.score_engagement,
        score_pedagogy=payload.score_pedagogy,
        score_environment=payload.score_environment,
        strengths=payload.strengths,
        weaknesses=payload.weaknesses,
        recommendations=payload.recommendations,
        remarks=payload.remarks,
    )
    db.add(obs)
    db.commit()
    db.refresh(obs)

    log_activity(
        db,
        action="class_observation.create",
        target=str(obs.id),
        user_id=current_user.id,
        metadata={"visit_id": str(visit.id), "school_id": str(visit.school_id)},
    )

    obs = _load_observation(db, obs.id)
    if not obs:
        raise _not_found()
    return APIResponse(success=True, message="Observation created successfully", data=_serialize(obs, visit))


@router.patch("/{observation_id}", response_model=APIResponse[ClassroomObservationOut])
def patch_observation(
    observation_id: UUID,
    payload: ClassroomObservationPatch,
    current_user: AuthUser,
    db: Session = Depends(get_db),
) -> APIResponse[ClassroomObservationOut]:
    obs = _load_observation(db, observation_id)
    if not obs:
        raise _not_found()
    visit = db.get(Visit, obs.visit_id)
    if not visit:
        raise _not_found()

    data = payload.model_dump(exclude_unset=True)
    reviewer_only = set(data.keys()) <= {"reviewer_comments"}

    if reviewer_only and can_review_observation_comments(db, current_user, obs):
        obs.reviewer_comments = data.get("reviewer_comments")
        db.commit()
        obs = _load_observation(db, observation_id)
        if not obs or not visit:
            raise _not_found()
        return APIResponse(success=True, message="Observation updated successfully", data=_serialize(obs, visit))

    if not can_read_observation(db, current_user, obs):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "message": "You do not have access to this observation",
                "errors": {"id": "forbidden"},
            },
        )
    if not can_mutate_observation(db, current_user, obs):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "message": "This observation cannot be edited",
                "errors": {"id": "immutable"},
            },
        )

    if "teacher_id" in data or "teacher_name" in data:
        tid_raw = UUID(data["teacher_id"]) if data.get("teacher_id") else obs.teacher_id
        tname_raw = data.get("teacher_name") if "teacher_name" in data else obs.teacher_name
        tid, tname = _resolve_teacher_for_school(
            db,
            school_id=visit.school_id,
            teacher_id=tid_raw,
            teacher_name=tname_raw,
        )
        obs.teacher_id = tid
        obs.teacher_name = tname

    if "subject" in data and data["subject"] is not None:
        obs.subject = data["subject"].strip()
    if "grade" in data and data["grade"] is not None:
        obs.grade = data["grade"].strip()
    if "observation_date" in data:
        obs.observation_date = data["observation_date"]
    if "score_engagement" in data and data["score_engagement"] is not None:
        obs.score_engagement = data["score_engagement"]
    if "score_pedagogy" in data and data["score_pedagogy"] is not None:
        obs.score_pedagogy = data["score_pedagogy"]
    if "score_environment" in data and data["score_environment"] is not None:
        obs.score_environment = data["score_environment"]
    if "strengths" in data:
        obs.strengths = data["strengths"]
    if "weaknesses" in data:
        obs.weaknesses = data["weaknesses"]
    if "recommendations" in data:
        obs.recommendations = data["recommendations"]
    if "remarks" in data:
        obs.remarks = data["remarks"]
    if "reviewer_comments" in data and current_user.role == UserRole.SUPER_ADMIN:
        obs.reviewer_comments = data["reviewer_comments"]

    db.commit()
    obs = _load_observation(db, observation_id)
    if not obs:
        raise _not_found()
    visit = db.get(Visit, obs.visit_id)
    if not visit:
        raise _not_found()

    log_activity(
        db,
        action="class_observation.update",
        target=str(obs.id),
        user_id=current_user.id,
        metadata={"visit_id": str(visit.id)},
    )

    return APIResponse(success=True, message="Observation updated successfully", data=_serialize(obs, visit))


@router.get("", response_model=APIResponse[PaginatedObservations])
def list_observations(
    current_user: AuthUser,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    school_id: UUID | None = None,
    visit_id: UUID | None = None,
    quarter: str | None = Query(None, max_length=20),
) -> APIResponse[PaginatedObservations]:
    visit_ids_sq = visit_select_filtered(current_user, db).with_only_columns(Visit.id).subquery()

    id_stmt = (
        select(ClassroomObservation.id)
        .join(Visit, ClassroomObservation.visit_id == Visit.id)
        .where(ClassroomObservation.visit_id.in_(select(visit_ids_sq.c.id)))
    )
    if school_id is not None:
        id_stmt = id_stmt.where(Visit.school_id == school_id)
    if visit_id is not None:
        id_stmt = id_stmt.where(ClassroomObservation.visit_id == visit_id)
    if quarter:
        id_stmt = id_stmt.where(Visit.quarter == quarter.strip())

    id_subq = id_stmt.subquery()
    total = db.scalar(select(func.count()).select_from(id_subq)) or 0

    stmt = (
        select(ClassroomObservation)
        .where(ClassroomObservation.id.in_(select(id_subq.c.id)))
        .options(selectinload(ClassroomObservation.documents))
        .order_by(ClassroomObservation.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    rows = db.scalars(stmt).unique().all()

    items: list[ClassroomObservationOut] = []
    for obs in rows:
        v = db.get(Visit, obs.visit_id)
        if v:
            items.append(_serialize(obs, v))

    return APIResponse(success=True, message="Observations fetched successfully", data=PaginatedObservations(items=items, total=total))


@router.get("/{observation_id}", response_model=APIResponse[ClassroomObservationOut])
def get_observation_detail(
    observation_id: UUID,
    current_user: AuthUser,
    db: Session = Depends(get_db),
) -> APIResponse[ClassroomObservationOut]:
    obs = _load_observation(db, observation_id)
    if not obs:
        raise _not_found()
    if not can_read_observation(db, current_user, obs):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "message": "You do not have access to this observation",
                "errors": {"id": "forbidden"},
            },
        )
    visit = db.get(Visit, obs.visit_id)
    if not visit:
        raise _not_found()
    return APIResponse(success=True, message="Observation fetched successfully", data=_serialize(obs, visit))


@router.post("/{observation_id}/evidence", response_model=APIResponse[EvidenceUploadResult])
async def upload_observation_evidence(
    observation_id: UUID,
    current_user: AuthUser,
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
) -> APIResponse[EvidenceUploadResult]:
    obs = db.get(ClassroomObservation, observation_id)
    if not obs:
        raise _not_found()
    visit = db.get(Visit, obs.visit_id)
    if not visit:
        raise _not_found()

    if not can_read_visit(db, current_user, visit):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "message": "You do not have access to this observation",
                "errors": {"id": "forbidden"},
            },
        )
    if not can_mutate_visit(db, current_user, visit):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "message": "Evidence cannot be added after the visit is finalized",
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

    rel = save_observation_evidence_file(settings.upload_root, visit.id, obs.id, file.filename or "photo.jpg", raw)

    doc = EvidenceDocument(
        school_id=visit.school_id,
        visit_id=visit.id,
        classroom_observation_id=obs.id,
        file_name=file.filename or "photo.jpg",
        file_url=rel,
        file_type=file.content_type or "image/jpeg",
        uploaded_by_id=current_user.id,
        metadata_json={"kind": "classroom_observation"},
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    log_activity(
        db,
        action="class_observation.evidence_upload",
        target=str(obs.id),
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
