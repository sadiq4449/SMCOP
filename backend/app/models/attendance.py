from __future__ import annotations

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class TeacherAttendanceApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class TeacherAttendance(Base):
    __tablename__ = "teacher_attendance"
    __table_args__ = (UniqueConstraint("school_id", "attendance_date", "teacher_id", name="uq_teacher_attendance_day"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    attendance_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teachers.id", ondelete="CASCADE"),
        nullable=False,
    )
    present: Mapped[bool] = mapped_column(Boolean, nullable=False)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    verification_photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    approval_status: Mapped[TeacherAttendanceApprovalStatus] = mapped_column(
        Enum(
            TeacherAttendanceApprovalStatus,
            name="teacher_attendance_approval_status",
            values_callable=lambda obj: [m.value for m in obj],
        ),
        nullable=False,
        default=TeacherAttendanceApprovalStatus.PENDING,
    )
    submitted_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    approved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    school: Mapped["School"] = relationship()
    teacher: Mapped["Teacher"] = relationship()
    submitted_by_user: Mapped["User"] = relationship(foreign_keys=[submitted_by_user_id])
    approved_by_user: Mapped["User | None"] = relationship(foreign_keys=[approved_by_user_id])

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class StudentDailyAttendance(Base):
    __tablename__ = "student_daily_attendance"
    __table_args__ = (UniqueConstraint("school_id", "attendance_date", name="uq_student_attendance_school_day"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    attendance_date: Mapped[date] = mapped_column(Date, nullable=False)
    boys_present: Mapped[int] = mapped_column(Integer, nullable=False)
    girls_present: Mapped[int] = mapped_column(Integer, nullable=False)
    submitted_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    school: Mapped["School"] = relationship()
    submitted_by_user: Mapped["User"] = relationship()

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
