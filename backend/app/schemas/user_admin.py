from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole, UserStatus


class UserAdminOut(BaseModel):
    id: str
    full_name: str
    email: str
    role: str
    status: str
    partner_org_id: str | None
    district_id: str | None
    assigned_schools: list[str]
    created_at: datetime
    updated_at: datetime


class PaginatedUsers(BaseModel):
    items: list[UserAdminOut]
    total: int


class UserCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    role: UserRole
    status: UserStatus = UserStatus.ACTIVE
    partner_org_id: str | None = None
    district_id: str | None = None
    assigned_schools: list[str] = Field(default_factory=list)


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=6, max_length=128)
    role: UserRole | None = None
    status: UserStatus | None = None
    partner_org_id: str | None = None
    district_id: str | None = None
    assigned_schools: list[str] | None = None


class ActivityLogOut(BaseModel):
    id: str
    user_id: str | None
    action: str
    target: str
    metadata: dict | None = None
    created_at: datetime


class PaginatedActivityLogs(BaseModel):
    items: list[ActivityLogOut]
    total: int
