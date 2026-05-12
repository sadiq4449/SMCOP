"""classroom observations + observation evidence FK on documents

Revision ID: 0005_classroom_observations
Revises: 0004_monitoring_visits
Create Date: 2026-05-12 18:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005_classroom_observations"
down_revision: Union[str, None] = "0004_monitoring_visits"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "classroom_observations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("visit_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("teacher_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("teacher_name", sa.String(length=150), nullable=True),
        sa.Column("subject", sa.String(length=120), nullable=False),
        sa.Column("grade", sa.String(length=50), nullable=False),
        sa.Column("observation_date", sa.Date(), nullable=True),
        sa.Column("score_engagement", sa.Integer(), nullable=False),
        sa.Column("score_pedagogy", sa.Integer(), nullable=False),
        sa.Column("score_environment", sa.Integer(), nullable=False),
        sa.Column("strengths", sa.Text(), nullable=True),
        sa.Column("weaknesses", sa.Text(), nullable=True),
        sa.Column("recommendations", sa.Text(), nullable=True),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("reviewer_comments", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["visit_id"], ["visits.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["teacher_id"], ["teachers.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_classroom_observations_visit_id"), "classroom_observations", ["visit_id"], unique=False)

    op.add_column(
        "documents",
        sa.Column("classroom_observation_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        op.f("fk_documents_classroom_observation_id_classroom_observations"),
        "documents",
        "classroom_observations",
        ["classroom_observation_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_documents_classroom_observation_id"),
        "documents",
        ["classroom_observation_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_documents_classroom_observation_id"), table_name="documents")
    op.drop_constraint(
        op.f("fk_documents_classroom_observation_id_classroom_observations"),
        "documents",
        type_="foreignkey",
    )
    op.drop_column("documents", "classroom_observation_id")

    op.drop_index(op.f("ix_classroom_observations_visit_id"), table_name="classroom_observations")
    op.drop_table("classroom_observations")
