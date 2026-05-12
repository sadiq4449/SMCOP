"""monitoring visits kpis scores infrastructure documents

Revision ID: 0004_monitoring_visits
Revises: 0003_user_district_scope_indexes
Create Date: 2026-05-12 14:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
import uuid as uuid_lib
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_monitoring_visits"
down_revision: Union[str, None] = "0003_user_district_scope_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

visit_form_status = postgresql.ENUM("draft", "finalized", name="visit_form_status", create_type=False)
infrastructure_item_status = postgresql.ENUM(
    "available", "not_available", "needs_repair", name="infrastructure_item_status", create_type=False
)


def upgrade() -> None:
    bind = op.get_bind()
    visit_form_status.create(bind, checkfirst=True)
    infrastructure_item_status.create(bind, checkfirst=True)

    op.create_table(
        "kpis",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("max_score", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(length=120), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    kpi_rows = [
        {
            "id": uuid_lib.UUID("cb8a154b-82ad-508b-83c9-e8c5a6124117"),
            "name": "Enrollment & Attendance",
            "description": "Enrollment trends and attendance regularity.",
            "max_score": 5,
            "category": "Quarterly Monitoring",
            "sort_order": 1,
        },
        {
            "id": uuid_lib.UUID("e5c38374-6645-5c5a-b3e9-02b03b1e1a58"),
            "name": "Classroom Instruction Quality",
            "description": "Quality of teaching and learning processes.",
            "max_score": 5,
            "category": "Quarterly Monitoring",
            "sort_order": 2,
        },
        {
            "id": uuid_lib.UUID("c17c116e-c334-58ee-bdc5-ff37090511b8"),
            "name": "Teacher Availability",
            "description": "Staff presence and timetable coverage.",
            "max_score": 5,
            "category": "Quarterly Monitoring",
            "sort_order": 3,
        },
        {
            "id": uuid_lib.UUID("847c1fb3-d34a-5e5a-b4a6-c0ac2b00b371"),
            "name": "School Infrastructure",
            "description": "Buildings, utilities, and facilities.",
            "max_score": 5,
            "category": "Quarterly Monitoring",
            "sort_order": 4,
        },
        {
            "id": uuid_lib.UUID("e88d93f3-88e4-50fc-97f2-84b66d9ee755"),
            "name": "Student Learning Environment",
            "description": "Safety, hygiene, and learner experience.",
            "max_score": 5,
            "category": "Quarterly Monitoring",
            "sort_order": 5,
        },
        {
            "id": uuid_lib.UUID("c4cc94c1-56f6-568f-ab53-6fc238ae93b4"),
            "name": "Management & Governance",
            "description": "Leadership, records, and SMC engagement.",
            "max_score": 5,
            "category": "Quarterly Monitoring",
            "sort_order": 6,
        },
        {
            "id": uuid_lib.UUID("37daaf67-680c-5338-8a4c-07d8bf3acc9b"),
            "name": "Community Engagement",
            "description": "Parent and community participation.",
            "max_score": 5,
            "category": "Quarterly Monitoring",
            "sort_order": 7,
        },
    ]
    op.bulk_insert(
        sa.table(
            "kpis",
            sa.column("id", postgresql.UUID(as_uuid=True)),
            sa.column("name", sa.String()),
            sa.column("description", sa.Text()),
            sa.column("max_score", sa.Integer()),
            sa.column("category", sa.String()),
            sa.column("sort_order", sa.Integer()),
        ),
        kpi_rows,
    )

    op.create_table(
        "visits",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("quarter", sa.String(length=20), nullable=False),
        sa.Column("visit_date", sa.Date(), nullable=True),
        sa.Column("visited_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", visit_form_status, server_default=sa.text("'draft'::visit_form_status"), nullable=False),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("aggregate_score", sa.Numeric(6, 2), nullable=True),
        sa.Column("gps_latitude", sa.Float(), nullable=True),
        sa.Column("gps_longitude", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["visited_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("school_id", "quarter", name="uq_visit_school_quarter"),
    )
    op.create_index(op.f("ix_visits_school_id"), "visits", ["school_id"], unique=False)
    op.create_index(op.f("ix_visits_visited_by"), "visits", ["visited_by"], unique=False)

    op.create_table(
        "kpi_scores",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("visit_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("kpi_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["kpi_id"], ["kpis.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["visit_id"], ["visits.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("visit_id", "kpi_id", name="uq_kpi_score_visit_kpi"),
    )
    op.create_index(op.f("ix_kpi_scores_visit_id"), "kpi_scores", ["visit_id"], unique=False)

    op.create_table(
        "infrastructure_checklist",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("visit_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("item_name", sa.String(length=150), nullable=False),
        sa.Column("status", infrastructure_item_status, nullable=False),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["visit_id"], ["visits.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_infrastructure_checklist_visit_id"), "infrastructure_checklist", ["visit_id"], unique=False
    )

    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("visit_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_url", sa.Text(), nullable=False),
        sa.Column("file_type", sa.String(length=50), nullable=True),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("metadata", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["visit_id"], ["visits.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_documents_school_id"), "documents", ["school_id"], unique=False)
    op.create_index(op.f("ix_documents_visit_id"), "documents", ["visit_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_documents_visit_id"), table_name="documents")
    op.drop_index(op.f("ix_documents_school_id"), table_name="documents")
    op.drop_table("documents")

    op.drop_index(op.f("ix_infrastructure_checklist_visit_id"), table_name="infrastructure_checklist")
    op.drop_table("infrastructure_checklist")

    op.drop_index(op.f("ix_kpi_scores_visit_id"), table_name="kpi_scores")
    op.drop_table("kpi_scores")

    op.drop_index(op.f("ix_visits_visited_by"), table_name="visits")
    op.drop_index(op.f("ix_visits_school_id"), table_name="visits")
    op.drop_table("visits")

    op.drop_table("kpis")

    bind = op.get_bind()
    infrastructure_item_status.drop(bind, checkfirst=True)
    visit_form_status.drop(bind, checkfirst=True)
