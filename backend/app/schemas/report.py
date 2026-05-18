from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class ReportStatusEnum(str, Enum):
    draft = "draft"
    submitted = "submitted"
    approved = "approved"
    rejected = "rejected"


class ReportCreate(BaseModel):
    school_id: str
    quarter: str = Field(min_length=3, max_length=20)
    summary: str | None = None
    recommendations: str | None = None


class ReportPatch(BaseModel):
    summary: str | None = None
    recommendations: str | None = None
    principal_infrastructure_notes: str | None = None
    principal_daily_activity_notes: str | None = None
    """Set to submitted to send for DEO review (draft only)."""
    status: ReportStatusEnum | None = None


class ReportReviewPatch(BaseModel):
    status: Literal["approved", "rejected"]
    remarks: str | None = None


class ReportCommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class ReportCommentOut(BaseModel):
    id: str
    user_id: str
    author_name: str | None = None
    body: str
    created_at: datetime


class ReportOut(BaseModel):
    id: str
    school_id: str
    quarter: str
    visit_id: str | None
    summary: str | None
    recommendations: str | None
    principal_infrastructure_notes: str | None
    principal_daily_activity_notes: str | None
    generated_snapshot: dict | None
    status: str
    review_remarks: str | None
    reviewed_by_user_id: str | None
    reviewed_at: datetime | None
    created_by_user_id: str
    created_at: datetime
    updated_at: datetime


class PaginatedReports(BaseModel):
    items: list[ReportOut]
    total: int


class CompareSchoolMetrics(BaseModel):
    school_id: str
    school_name: str | None
    quarter: str
    visit_found: bool
    visit_status: str | None
    aggregate_score: float | None
    classroom_observation_count: int | None
    report_status: str | None
    report_id: str | None


class CompareReportsOut(BaseModel):
    quarter: str
    schools: list[CompareSchoolMetrics]


class CompareDistrictMetrics(BaseModel):
    district_id: str
    district_name: str | None
    quarter: str
    school_count: int
    visits_recorded: int
    avg_aggregate_score: float | None
    classroom_observations_total: int
    approved_reports_count: int


class CompareDistrictsOut(BaseModel):
    quarter: str
    districts: list[CompareDistrictMetrics]


class CompareQuarterMetrics(BaseModel):
    school_id: str
    school_name: str | None
    quarter: str
    visit_found: bool
    visit_status: str | None
    aggregate_score: float | None
    classroom_observation_count: int | None
    report_status: str | None
    report_id: str | None


class CompareQuartersOut(BaseModel):
    school_id: str
    school_name: str | None
    quarters: list[CompareQuarterMetrics]
