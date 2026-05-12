from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


def enum_scalar(value: Any) -> str:
    """API string for a Python / SQLAlchemy enum (or plain str)."""
    if value is None:
        raise TypeError("enum_scalar expected non-None value")
    if isinstance(value, str):
        return value
    inner = getattr(value, "value", value)
    return inner if isinstance(inner, str) else str(inner)


class APIResponse(BaseModel, Generic[T]):
    success: bool
    message: str
    data: T | None = None
    errors: dict[str, Any] | None = None


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    email: str
    role: str
    status: str
