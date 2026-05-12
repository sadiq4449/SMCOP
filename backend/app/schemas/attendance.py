from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, Field


class TeacherAttendanceLine(BaseModel):
    teacher_id: str | None = None
    name: str | None = Field(default=None, max_length=150)
    present: bool
    remarks: str | None = None
    verification_photo_url: str | None = None


class TeacherAttendanceBatchCreate(BaseModel):
    school_id: str
    date: date
    teachers: list[TeacherAttendanceLine] = Field(min_length=1)


class StudentAttendanceUpsert(BaseModel):
    school_id: str
    date: date
    boys_present: int = Field(ge=0)
    girls_present: int = Field(ge=0)


class TeacherAttendanceApproval(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class TeacherAttendanceRecordOut(BaseModel):
    id: str
    school_id: str
    attendance_date: date
    teacher_id: str
    teacher_name: str | None
    present: bool
    remarks: str | None
    verification_photo_url: str | None
    approval_status: str
    submitted_by_user_id: str
    approved_by_user_id: str | None
    approved_at: datetime | None = None


class StudentAttendanceDayOut(BaseModel):
    id: str
    school_id: str
    attendance_date: date
    boys_present: int
    girls_present: int
    submitted_by_user_id: str


class MonthlyTeacherAttendanceOut(BaseModel):
    school_id: str
    month: str
    records: list[TeacherAttendanceRecordOut]
    summary: dict[str, dict[str, int]]


class MonthlyStudentAttendanceOut(BaseModel):
    school_id: str
    month: str
    days: list[StudentAttendanceDayOut]
    totals: dict[str, int]


class TeacherAttendanceApprovalPatch(BaseModel):
    approval_status: TeacherAttendanceApproval
