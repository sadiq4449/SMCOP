from __future__ import annotations

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, Enum, Float, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class VisitFormStatus(str, enum.Enum):
    DRAFT = "draft"
    FINALIZED = "finalized"


class InfrastructureItemStatus(str, enum.Enum):
    AVAILABLE = "available"
    NOT_AVAILABLE = "not_available"
    NEEDS_REPAIR = "needs_repair"


class KPI(Base):
    __tablename__ = "kpis"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    max_score: Mapped[int] = mapped_column(Integer, nullable=False)
    category: Mapped[str] = mapped_column(String(120), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    weight: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=1.0, server_default="1.0")


class Visit(Base):
    __tablename__ = "visits"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    quarter: Mapped[str] = mapped_column(String(20), nullable=False)
    visit_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    visited_by_id: Mapped[uuid.UUID] = mapped_column(
        "visited_by",
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    status: Mapped[VisitFormStatus] = mapped_column(
        Enum(VisitFormStatus, name="visit_form_status", values_callable=lambda obj: [m.value for m in obj]),
        nullable=False,
        default=VisitFormStatus.DRAFT,
    )
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    aggregate_score: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    gps_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    gps_longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    school: Mapped["School"] = relationship(back_populates="visits")
    visited_by_user: Mapped["User"] = relationship(back_populates="visits_authored")
    kpi_scores: Mapped[list["KpiScore"]] = relationship(
        back_populates="visit",
        cascade="all, delete-orphan",
    )
    infrastructure_items: Mapped[list["InfrastructureChecklistItem"]] = relationship(
        back_populates="visit",
        cascade="all, delete-orphan",
    )
    documents: Mapped[list["EvidenceDocument"]] = relationship(
        back_populates="visit",
        cascade="all, delete-orphan",
    )
    classroom_observations: Mapped[list["ClassroomObservation"]] = relationship(
        back_populates="visit",
        cascade="all, delete-orphan",
    )

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

    __table_args__ = (UniqueConstraint("school_id", "quarter", name="uq_visit_school_quarter"),)


class KpiScore(Base):
    __tablename__ = "kpi_scores"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    visit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("visits.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kpi_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("kpis.id", ondelete="RESTRICT"),
        nullable=False,
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    visit: Mapped["Visit"] = relationship(back_populates="kpi_scores")
    kpi: Mapped["KPI"] = relationship()

    __table_args__ = (UniqueConstraint("visit_id", "kpi_id", name="uq_kpi_score_visit_kpi"),)


class InfrastructureChecklistItem(Base):
    __tablename__ = "infrastructure_checklist"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    visit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("visits.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    item_name: Mapped[str] = mapped_column(String(150), nullable=False)
    status: Mapped[InfrastructureItemStatus] = mapped_column(
        Enum(
            InfrastructureItemStatus,
            name="infrastructure_item_status",
            values_callable=lambda obj: [m.value for m in obj],
        ),
        nullable=False,
    )
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    visit: Mapped["Visit"] = relationship(back_populates="infrastructure_items")


class ClassroomObservation(Base):
    __tablename__ = "classroom_observations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    visit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("visits.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teachers.id", ondelete="SET NULL"),
        nullable=True,
    )
    teacher_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    subject: Mapped[str] = mapped_column(String(120), nullable=False)
    grade: Mapped[str] = mapped_column(String(50), nullable=False)
    observation_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    score_engagement: Mapped[int] = mapped_column(Integer, nullable=False)
    score_pedagogy: Mapped[int] = mapped_column(Integer, nullable=False)
    score_environment: Mapped[int] = mapped_column(Integer, nullable=False)
    strengths: Mapped[str | None] = mapped_column(Text, nullable=True)
    weaknesses: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommendations: Mapped[str | None] = mapped_column(Text, nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewer_comments: Mapped[str | None] = mapped_column(Text, nullable=True)

    visit: Mapped["Visit"] = relationship(back_populates="classroom_observations")
    teacher: Mapped["Teacher | None"] = relationship(back_populates="classroom_observations")
    documents: Mapped[list["EvidenceDocument"]] = relationship(back_populates="classroom_observation")

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


class EvidenceDocument(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    visit_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("visits.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    classroom_observation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("classroom_observations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_url: Mapped[str] = mapped_column(Text, nullable=False)
    file_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    uploaded_by_id: Mapped[uuid.UUID] = mapped_column(
        "uploaded_by",
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)

    visit: Mapped["Visit | None"] = relationship(back_populates="documents")
    classroom_observation: Mapped["ClassroomObservation | None"] = relationship(back_populates="documents")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
