from pydantic import BaseModel, ConfigDict, Field


class DistrictOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    code: str | None


class TalukaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    district_id: str
    name: str


class UnionCouncilOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    taluka_id: str
    name: str


class DistrictCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    code: str | None = Field(default=None, max_length=32)


class DistrictUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    code: str | None = None


class TalukaCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class TalukaUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    district_id: str | None = None


class UnionCouncilCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class UnionCouncilUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    taluka_id: str | None = None


class SchoolSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    emis_code: str
    name: str
    level: str
    gender: str
    status: str
