"""quarterly reports and government comments

Revision ID: 0007_reports
Revises: 0006_attendance
Create Date: 2026-05-12 20:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007_reports"
down_revision: Union[str, None] = "0006_attendance"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

report_status = postgresql.ENUM("draft", "submitted", "approved", "rejected", name="report_status", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    report_status.create(bind, checkfirst=True)

    op.create_table(
        "reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("quarter", sa.String(length=20), nullable=False),
        sa.Column("visit_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("recommendations", sa.Text(), nullable=True),
        sa.Column("principal_infrastructure_notes", sa.Text(), nullable=True),
        sa.Column("principal_daily_activity_notes", sa.Text(), nullable=True),
        sa.Column("generated_snapshot", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("status", report_status, server_default=sa.text("'draft'::report_status"), nullable=False),
        sa.Column("review_remarks", sa.Text(), nullable=True),
        sa.Column("reviewed_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["reviewed_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["visit_id"], ["visits.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("school_id", "quarter", name="uq_report_school_quarter"),
    )
    op.create_index(op.f("ix_reports_school_id"), "reports", ["school_id"], unique=False)
    op.create_index(op.f("ix_reports_quarter"), "reports", ["quarter"], unique=False)
    op.create_index(op.f("ix_reports_status"), "reports", ["status"], unique=False)

    op.create_table(
        "report_comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("report_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["report_id"], ["reports.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_report_comments_report_id"), "report_comments", ["report_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_report_comments_report_id"), table_name="report_comments")
    op.drop_table("report_comments")

    op.drop_index(op.f("ix_reports_status"), table_name="reports")
    op.drop_index(op.f("ix_reports_quarter"), table_name="reports")
    op.drop_index(op.f("ix_reports_school_id"), table_name="reports")
    op.drop_table("reports")

    bind = op.get_bind()
    report_status.drop(bind, checkfirst=True)
