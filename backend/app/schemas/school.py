from pydantic import BaseModel, ConfigDict, Field

from app.models.school import ActiveStatus, SchoolGender, SchoolLevel, TeacherGender


class SchoolSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    emis_code: str
    name: str
    uc_id: str
    district_name: str
    taluka_name: str
    uc_name: str
    level: str
    gender: str
    partner_org_id: str | None
    partner_org_name: str | None
    principal_name: str | None
    principal_phone: str | None
    status: str


class SchoolDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    emis_code: str
    name: str
    uc_id: str
    district_id: str
    district_name: str
    taluka_id: str
    taluka_name: str
    uc_name: str
    level: str
    gender: str
    partner_org_id: str | None
    partner_org_name: str | None
    principal_name: str | None
    principal_phone: str | None
    gps_latitude: float | None
    gps_longitude: float | None
    status: str


class SchoolCreate(BaseModel):
    emis_code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=200)
    uc_id: str
    level: SchoolLevel
    gender: SchoolGender
    partner_org_id: str | None = None
    principal_name: str | None = Field(None, max_length=120)
    principal_phone: str | None = Field(None, max_length=50)
    gps_latitude: float | None = None
    gps_longitude: float | None = None
    status: ActiveStatus = ActiveStatus.ACTIVE


class SchoolUpdate(BaseModel):
    emis_code: str | None = Field(None, min_length=1, max_length=50)
    name: str | None = Field(None, min_length=1, max_length=200)
    uc_id: str | None = None
    level: SchoolLevel | None = None
    gender: SchoolGender | None = None
    partner_org_id: str | None = None
    principal_name: str | None = Field(None, max_length=120)
    principal_phone: str | None = Field(None, max_length=50)
    gps_latitude: float | None = None
    gps_longitude: float | None = None
    status: ActiveStatus | None = None


class PaginatedSchools(BaseModel):
    items: list[SchoolSummary]
    total: int


class EnrollmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    school_id: str
    quarter: str
    boys: int
    girls: int
    total: int


class EnrollmentCreate(BaseModel):
    quarter: str = Field(min_length=2, max_length=20)
    boys: int = Field(ge=0)
    girls: int = Field(ge=0)


class EnrollmentUpdate(BaseModel):
    boys: int | None = Field(None, ge=0)
    girls: int | None = Field(None, ge=0)


class TeacherOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    school_id: str
    name: str
    gender: str
    subject: str | None
    status: str


class TeacherCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    gender: TeacherGender
    subject: str | None = Field(None, max_length=150)
    status: ActiveStatus = ActiveStatus.ACTIVE


class TeacherUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=150)
    gender: TeacherGender | None = None
    subject: str | None = Field(None, max_length=150)
    status: ActiveStatus | None = None
