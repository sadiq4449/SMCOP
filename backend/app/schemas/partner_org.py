from pydantic import BaseModel, ConfigDict, EmailStr, Field


class PartnerOrgOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    contact_person: str | None
    email: str | None
    phone: str | None
    address: str | None


class PartnerOrgCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    contact_person: str | None = Field(None, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=50)
    address: str | None = None


class PartnerOrgUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=150)
    contact_person: str | None = Field(None, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=50)
    address: str | None = None
