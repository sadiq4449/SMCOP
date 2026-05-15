from datetime import date, datetime, time
from enum import Enum

from pydantic import BaseModel, Field


class InfrastructureStatus(str, Enum):
    available = "available"
    not_available = "not_available"
    needs_repair = "needs_repair"


class VisitFormStatus(str, Enum):
    draft = "draft"
    finalized = "finalized"


class KPIOut(BaseModel):
    id: str
    name: str
    description: str | None
    max_score: int
    category: str
    sort_order: int
    weight: float


class KpiScoreOut(BaseModel):
    kpi_id: str
    score: int
    remarks: str | None
    kpi_name: str | None = None
    kpi_max_score: int | None = None


class InfrastructureLineOut(BaseModel):
    id: str
    item_name: str
    status: str
    remarks: str | None


class DocumentSummary(BaseModel):
    id: str
    file_name: str
    file_type: str | None
    download_path: str
    created_at: datetime
    metadata: dict | None = None


class VisitSummary(BaseModel):
    id: str
    school_id: str
    school_name: str | None = None
    quarter: str
    visit_date: date | None
    scheduled_date: date | None = None
    scheduled_time_start: time | None = None
    scheduled_time_end: time | None = None
    status: str
    aggregate_score: float | None
    visited_by_id: str
    created_at: datetime
    updated_at: datetime


class VisitDetail(BaseModel):
    id: str
    school_id: str
    quarter: str
    visit_date: date | None
    scheduled_date: date | None = None
    scheduled_time_start: time | None = None
    scheduled_time_end: time | None = None
    status: str
    remarks: str | None
    aggregate_score: float | None
    gps_latitude: float | None
    gps_longitude: float | None
    visited_by_id: str
    created_at: datetime
    updated_at: datetime
    kpi_scores: list[KpiScoreOut]
    infrastructure: list[InfrastructureLineOut]
    documents: list[DocumentSummary]


class PaginatedVisits(BaseModel):
    items: list[VisitSummary]
    total: int


class InfrastructureLineIn(BaseModel):
    item_name: str = Field(min_length=1, max_length=150)
    status: InfrastructureStatus
    remarks: str | None = None


class VisitCreate(BaseModel):
    school_id: str
    quarter: str = Field(min_length=3, max_length=20)
    visit_date: date | None = None
    scheduled_date: date | None = None
    scheduled_time_start: time | None = None
    scheduled_time_end: time | None = None


class VisitPatch(BaseModel):
    visit_date: date | None = None
    scheduled_date: date | None = None
    scheduled_time_start: time | None = None
    scheduled_time_end: time | None = None
    remarks: str | None = None
    gps_latitude: float | None = None
    gps_longitude: float | None = None
    status: VisitFormStatus | None = None
    infrastructure: list[InfrastructureLineIn] | None = None


class KpiScoreItem(BaseModel):
    kpi_id: str
    score: int = Field(ge=0)
    remarks: str | None = None


class VisitKpiSubmit(BaseModel):
    scores: list[KpiScoreItem]
    remarks: str | None = None


class PresignedUploadOffer(BaseModel):
    """Returned when S3 presigned uploads are configured (optional)."""

    upload_url: str
    headers: dict[str, str] | None = None


class EvidenceUploadResult(BaseModel):
    document_id: str
    download_path: str
    presigned: PresignedUploadOffer | None = None
