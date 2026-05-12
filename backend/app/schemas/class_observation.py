from datetime import date, datetime

from pydantic import BaseModel, Field


class ObservationDocumentSummary(BaseModel):
    id: str
    file_name: str
    file_type: str | None
    download_path: str
    created_at: datetime


class ClassroomObservationCreate(BaseModel):
    visit_id: str
    teacher_id: str | None = None
    teacher_name: str | None = Field(default=None, max_length=150)
    subject: str = Field(min_length=1, max_length=120)
    grade: str = Field(min_length=1, max_length=50)
    observation_date: date | None = None
    score_engagement: int = Field(ge=1, le=5)
    score_pedagogy: int = Field(ge=1, le=5)
    score_environment: int = Field(ge=1, le=5)
    strengths: str | None = None
    weaknesses: str | None = None
    recommendations: str | None = None
    remarks: str | None = None


class ClassroomObservationPatch(BaseModel):
    teacher_id: str | None = None
    teacher_name: str | None = Field(default=None, max_length=150)
    subject: str | None = Field(default=None, min_length=1, max_length=120)
    grade: str | None = Field(default=None, min_length=1, max_length=50)
    observation_date: date | None = None
    score_engagement: int | None = Field(default=None, ge=1, le=5)
    score_pedagogy: int | None = Field(default=None, ge=1, le=5)
    score_environment: int | None = Field(default=None, ge=1, le=5)
    strengths: str | None = None
    weaknesses: str | None = None
    recommendations: str | None = None
    remarks: str | None = None
    reviewer_comments: str | None = None


class ClassroomObservationOut(BaseModel):
    id: str
    visit_id: str
    school_id: str
    quarter: str
    teacher_id: str | None
    teacher_name: str | None
    subject: str
    grade: str
    observation_date: date | None
    score_engagement: int
    score_pedagogy: int
    score_environment: int
    strengths: str | None
    weaknesses: str | None
    recommendations: str | None
    remarks: str | None
    reviewer_comments: str | None
    created_at: datetime
    updated_at: datetime
    documents: list[ObservationDocumentSummary] = Field(default_factory=list)


class PaginatedObservations(BaseModel):
    items: list[ClassroomObservationOut]
    total: int
