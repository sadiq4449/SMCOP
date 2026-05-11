from collections.abc import Callable
from functools import wraps
from typing import Any

from fastapi import Depends, HTTPException, status

from app.api.deps import get_current_user
from app.models.user import User, UserRole


def role_required(*allowed_roles: UserRole) -> Callable[..., Any]:
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "success": False,
                    "message": "You do not have permission to access this resource",
                    "errors": {"role": "forbidden"},
                },
            )
        return current_user

    return dependency


def require_roles(*allowed_roles: UserRole) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(func)
        async def wrapper(*args: Any, current_user: User = Depends(get_current_user), **kwargs: Any) -> Any:
            if current_user.role not in allowed_roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "success": False,
                        "message": "You do not have permission to access this resource",
                        "errors": {"role": "forbidden"},
                    },
                )
            return await func(*args, current_user=current_user, **kwargs)

        return wrapper

    return decorator
