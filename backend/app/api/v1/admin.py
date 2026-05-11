from fastapi import APIRouter, Depends

from app.middleware.rbac import role_required
from app.models.user import User, UserRole
from app.schemas.common import APIResponse

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/sample", response_model=APIResponse[dict[str, str]])
def admin_sample(
    current_user: User = Depends(role_required(UserRole.SUPER_ADMIN)),
) -> APIResponse[dict[str, str]]:
    return APIResponse(
        success=True,
        message="Super Admin sample route",
        data={"role": current_user.role.value},
    )
