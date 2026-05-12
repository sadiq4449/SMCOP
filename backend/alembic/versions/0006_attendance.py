"""teacher/student attendance + optional user.linked_teacher_id

Revision ID: 0006_attendance
Revises: 0005_classroom_observations
Create Date: 2026-05-12 18:30:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006_attendance"
down_revision: Union[str, None] = "0005_classroom_observations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


teacher_attendance_approval = postgresql.ENUM(
    "pending",
    "approved",
    "rejected",
    name="teacher_attendance_approval_status",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    teacher_attendance_approval.create(bind, checkfirst=True)

    op.add_column(
        "users",
        sa.Column("linked_teacher_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        op.f("fk_users_linked_teacher_id_teachers"),
        "users",
        "teachers",
        ["linked_teacher_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_users_linked_teacher_id"), "users", ["linked_teacher_id"], unique=False)

    op.create_table(
        "teacher_attendance",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("attendance_date", sa.Date(), nullable=False),
        sa.Column("teacher_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("present", sa.Boolean(), nullable=False),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("verification_photo_url", sa.Text(), nullable=True),
        sa.Column(
            "approval_status",
            teacher_attendance_approval,
            server_default=sa.text("'pending'::teacher_attendance_approval_status"),
            nullable=False,
        ),
        sa.Column("submitted_by_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("approved_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["approved_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["submitted_by_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["teacher_id"], ["teachers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("school_id", "attendance_date", "teacher_id", name="uq_teacher_attendance_day"),
    )
    op.create_index(op.f("ix_teacher_attendance_school_id"), "teacher_attendance", ["school_id"], unique=False)
    op.create_index(
        op.f("ix_teacher_attendance_attendance_date"),
        "teacher_attendance",
        ["attendance_date"],
        unique=False,
    )

    op.create_table(
        "student_daily_attendance",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("attendance_date", sa.Date(), nullable=False),
        sa.Column("boys_present", sa.Integer(), nullable=False),
        sa.Column("girls_present", sa.Integer(), nullable=False),
        sa.Column("submitted_by_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["submitted_by_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("school_id", "attendance_date", name="uq_student_attendance_school_day"),
    )
    op.create_index(
        op.f("ix_student_daily_attendance_school_id"),
        "student_daily_attendance",
        ["school_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_student_daily_attendance_school_id"), table_name="student_daily_attendance")
    op.drop_table("student_daily_attendance")

    op.drop_index(op.f("ix_teacher_attendance_attendance_date"), table_name="teacher_attendance")
    op.drop_index(op.f("ix_teacher_attendance_school_id"), table_name="teacher_attendance")
    op.drop_table("teacher_attendance")

    op.drop_index(op.f("ix_users_linked_teacher_id"), table_name="users")
    op.drop_constraint(op.f("fk_users_linked_teacher_id_teachers"), "users", type_="foreignkey")
    op.drop_column("users", "linked_teacher_id")

    bind = op.get_bind()
    teacher_attendance_approval.drop(bind, checkfirst=True)
