from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

IssueCategoryLiteral = Literal["infrastructure", "teachers", "students", "facility"]
IssueSeverityLiteral = Literal["low", "medium", "high", "critical"]
IssueStatusLiteral = Literal["open", "assigned", "resolved", "closed"]


class IssueCreate(BaseModel):
    school_id: str
    category: IssueCategoryLiteral
    details: str = Field(min_length=1, max_length=16000)
    severity: IssueSeverityLiteral
    attachment_url: str | None = Field(None, max_length=500)


class IssuePatch(BaseModel):
    status: IssueStatusLiteral | None = None
    assigned_to_user_id: str | None = None
    comment: str | None = Field(None, max_length=4000)


class IssueOut(BaseModel):
    id: str
    school_id: str
    category: str
    details: str
    severity: str
    status: str
    raised_by_user_id: str
    assigned_to_user_id: str | None
    attachment_url: str | None
    created_at: object
    updated_at: object


class PaginatedIssues(BaseModel):
    items: list[IssueOut]
    total: int


class TaskCreate(BaseModel):
    school_id: str
    title: str = Field(min_length=1, max_length=200)
    details: str | None = Field(None, max_length=8000)
    assignee_user_id: str
    due_date: date | None = None


class TaskPatch(BaseModel):
    is_completed: bool | None = None
    title: str | None = Field(None, max_length=200)
    details: str | None = Field(None, max_length=8000)
    due_date: date | None = None


class TaskOut(BaseModel):
    id: str
    school_id: str
    title: str
    details: str | None
    assignee_user_id: str
    due_date: date | None
    is_completed: bool
    completed_at: object | None
    created_by_user_id: str
    created_at: object


class PaginatedTasks(BaseModel):
    items: list[TaskOut]
    total: int


class AssigneeOptionOut(BaseModel):
    id: str
    full_name: str
    email: str
    role: str


class AssigneeOptionsData(BaseModel):
    items: list[AssigneeOptionOut]


class NotificationOut(BaseModel):
    id: str
    title: str
    message: str
    is_read: bool
    kind: str | None
    ref_type: str | None
    ref_id: str | None
    created_at: object


class PaginatedNotifications(BaseModel):
    items: list[NotificationOut]
    total: int


class UnreadCountOut(BaseModel):
    unread: int


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=32000)
    attachment_url: str | None = Field(None, max_length=500)
    district_id: str | None = Field(
        None,
        description="Null = national broadcast (Super Admin only). DEO must omit or use own district.",
    )


class AnnouncementOut(BaseModel):
    id: str
    title: str
    body: str
    attachment_url: str | None
    district_id: str | None
    created_by_user_id: str
    created_at: object


class PaginatedAnnouncements(BaseModel):
    items: list[AnnouncementOut]
    total: int


class WebhookCreate(BaseModel):
    url: str = Field(min_length=8, max_length=2000)
    events: list[Literal["report_approved", "visit_submitted", "issue_resolved"]]


class WebhookOut(BaseModel):
    id: str
    url: str
    events: list[str]
    is_active: bool
    secret: str | None = Field(None, description="Returned only on create")
    created_at: object
