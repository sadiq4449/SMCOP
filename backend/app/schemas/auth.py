from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import UserPublic


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginData(BaseModel):
    token: str
    refresh_token: str
    role: str
    user: UserPublic


class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshData(BaseModel):
    token: str
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str | None = None
