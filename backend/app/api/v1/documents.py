from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.models.monitoring import ClassroomObservation, EvidenceDocument, Visit
from app.models.user import User
from app.services.evidence_storage import resolve_under_root
from app.services.observation_access import can_read_observation
from app.services.visit_access import can_read_visit

router = APIRouter(tags=["documents"])


@router.get("/documents/{document_id}/download")
def download_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    doc = db.get(EvidenceDocument, document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "message": "Document not found",
                "errors": {"document_id": "not found"},
            },
        )

    allowed = False
    if doc.visit_id is not None:
        visit = db.get(Visit, doc.visit_id)
        if visit and can_read_visit(db, current_user, visit):
            allowed = True

    if not allowed and doc.classroom_observation_id is not None:
        observation = db.get(ClassroomObservation, doc.classroom_observation_id)
        if observation and can_read_observation(db, current_user, observation):
            allowed = True

    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "message": "You do not have access to this file",
                "errors": {"document_id": "forbidden"},
            },
        )

    settings = get_settings()
    try:
        path = resolve_under_root(settings.upload_root, doc.file_url)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "message": "Stored file path is invalid",
                "errors": {"document_id": "invalid"},
            },
        ) from None

    if not path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "message": "File no longer on disk",
                "errors": {"document_id": "missing"},
            },
        )

    media = doc.file_type or "application/octet-stream"
    return FileResponse(path, filename=doc.file_name, media_type=media)
