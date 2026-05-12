import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.geography import UnionCouncil
from app.models.partner_org import PartnerOrg


class SchoolLevel(str, enum.Enum):
    PRIMARY = "primary"
    MIDDLE = "middle"
    HIGH = "high"
    HIGHER_SECONDARY = "higher_secondary"


class SchoolGender(str, enum.Enum):
    BOYS = "boys"
    GIRLS = "girls"
    MIXED = "mixed"


class ActiveStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class School(Base):
    __tablename__ = "schools"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    emis_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    uc_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("union_councils.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    level: Mapped[SchoolLevel] = mapped_column(
        Enum(SchoolLevel, name="school_level", values_callable=lambda obj: [m.value for m in obj]),
        nullable=False,
    )
    gender: Mapped[SchoolGender] = mapped_column(
        Enum(SchoolGender, name="school_gender", values_callable=lambda obj: [m.value for m in obj]),
        nullable=False,
    )
    partner_org_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("partner_orgs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    principal_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    principal_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gps_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    gps_longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[ActiveStatus] = mapped_column(
        Enum(ActiveStatus, name="school_status", values_callable=lambda obj: [m.value for m in obj]),
        nullable=False,
        default=ActiveStatus.ACTIVE,
    )

    uc: Mapped[UnionCouncil] = relationship()
    partner_org: Mapped[PartnerOrg | None] = relationship(back_populates="schools")
    enrollments: Mapped[list["SchoolEnrollment"]] = relationship(back_populates="school")
    teachers: Mapped[list["Teacher"]] = relationship(back_populates="school")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class SchoolEnrollment(Base):
    __tablename__ = "school_enrollment"
    __table_args__ = (UniqueConstraint("school_id", "quarter", name="uq_enrollment_school_quarter"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    quarter: Mapped[str] = mapped_column(String(20), nullable=False)
    boys: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    girls: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    school: Mapped["School"] = relationship(back_populates="enrollments")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class TeacherGender(str, enum.Enum):
    MALE = "male"
    FEMALE = "female"


class Teacher(Base):
    __tablename__ = "teachers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    gender: Mapped[TeacherGender] = mapped_column(
        Enum(TeacherGender, name="teacher_gender", values_callable=lambda obj: [m.value for m in obj]),
        nullable=False,
    )
    subject: Mapped[str | None] = mapped_column(String(150), nullable=True)
    status: Mapped[ActiveStatus] = mapped_column(
        Enum(ActiveStatus, name="teacher_status", values_callable=lambda obj: [m.value for m in obj]),
        nullable=False,
        default=ActiveStatus.ACTIVE,
    )

    school: Mapped["School"] = relationship(back_populates="teachers")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
