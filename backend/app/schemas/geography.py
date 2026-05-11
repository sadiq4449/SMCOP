from pydantic import BaseModel, ConfigDict


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


class SchoolSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    emis_code: str
    name: str
    level: str
    gender: str
    status: str
