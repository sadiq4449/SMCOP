from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.activity_log import ActivityLog


def log_activity(
    db: Session,
    *,
    action: str,
    target: str,
    user_id: UUID | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    entry = ActivityLog(
        user_id=user_id,
        action=action,
        target=target,
        metadata_json=metadata,
    )
    db.add(entry)
    db.commit()
