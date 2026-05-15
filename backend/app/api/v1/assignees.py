from __future__ import annotations

from enum import Enum
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User, UserRole
from app.schemas.common import APIResponse
from app.schemas.operational import AssigneeOptionOut, AssigneeOptionsData
from app.services.school_access import user_can_access_school
from app.services.school_assignee_picks import issue_assignee_candidates, task_assignee_candidates

router = APIRouter(prefix="/assignees", tags=["assignees"])
AuthUser = Annotated[User, Depends(get_current_user)]


class AssigneePurpose(str, Enum):
    task = "task"
    issue = "issue"


def _forbidden() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"success": False, "message": "Forbidden", "errors": {"assignees": "forbidden"}},
    )


@router.get("", response_model=APIResponse[AssigneeOptionsData])
def list_school_assignees(
    current_user: AuthUser,
    db: Session = Depends(get_db),
    school_id: UUID = Query(..., description="School UUID"),
    purpose: AssigneePurpose = Query(..., description="task = IE; issue = IE/Government/Super Admin"),
) -> APIResponse[AssigneeOptionsData]:
    """Assignee pickers for tasks/issues at a school."""
    if current_user.role not in (UserRole.SUPER_ADMIN, UserRole.GOVERNMENT):
        raise _forbidden()
    if not user_can_access_school(db, current_user, school_id):
        raise _forbidden()

    if purpose == AssigneePurpose.task:
        rows = task_assignee_candidates(db, school_id)
    else:
        rows = issue_assignee_candidates(db, school_id)

    items = [
        AssigneeOptionOut(id=str(u.id), full_name=u.full_name, email=u.email, role=u.role.value) for u in rows
    ]
    items.sort(key=lambda x: (x.full_name.lower(), x.email.lower()))
    return APIResponse(success=True, message="Assignee options", data=AssigneeOptionsData(items=items))
