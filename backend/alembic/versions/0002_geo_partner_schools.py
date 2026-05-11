"""geo hierarchy partner schools enrollment teachers

Revision ID: 0002_geo_partner_schools
Revises: 0001_initial_auth_tables
Create Date: 2026-05-11 12:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_geo_partner_schools"
down_revision: Union[str, None] = "0001_initial_auth_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

school_level = postgresql.ENUM(
    "primary", "middle", "high", "higher_secondary", name="school_level", create_type=False
)
school_gender = postgresql.ENUM("boys", "girls", "mixed", name="school_gender", create_type=False)
school_status = postgresql.ENUM("active", "inactive", name="school_status", create_type=False)
teacher_gender = postgresql.ENUM("male", "female", name="teacher_gender", create_type=False)
teacher_status = postgresql.ENUM("active", "inactive", name="teacher_status", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    school_level.create(bind, checkfirst=True)
    school_gender.create(bind, checkfirst=True)
    school_status.create(bind, checkfirst=True)
    teacher_gender.create(bind, checkfirst=True)
    teacher_status.create(bind, checkfirst=True)

    op.create_table(
        "districts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("code", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )

    op.create_table(
        "talukas",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("district_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["district_id"], ["districts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_talukas_district_id"), "talukas", ["district_id"], unique=False)

    op.create_table(
        "union_councils",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("taluka_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.ForeignKeyConstraint(["taluka_id"], ["talukas.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_union_councils_taluka_id"), "union_councils", ["taluka_id"], unique=False)

    op.create_table(
        "partner_orgs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("contact_person", sa.String(length=120), nullable=True),
        sa.Column("email", sa.String(length=150), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "schools",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("emis_code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("uc_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("level", school_level, nullable=False),
        sa.Column("gender", school_gender, nullable=False),
        sa.Column("partner_org_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("principal_name", sa.String(length=120), nullable=True),
        sa.Column("principal_phone", sa.String(length=50), nullable=True),
        sa.Column("gps_latitude", sa.Float(), nullable=True),
        sa.Column("gps_longitude", sa.Float(), nullable=True),
        sa.Column("status", school_status, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["partner_org_id"], ["partner_orgs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["uc_id"], ["union_councils.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("emis_code"),
    )
    op.create_index(op.f("ix_schools_partner_org_id"), "schools", ["partner_org_id"], unique=False)
    op.create_index(op.f("ix_schools_uc_id"), "schools", ["uc_id"], unique=False)

    op.create_table(
        "school_enrollment",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("quarter", sa.String(length=20), nullable=False),
        sa.Column("boys", sa.Integer(), nullable=False),
        sa.Column("girls", sa.Integer(), nullable=False),
        sa.Column("total", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("school_id", "quarter", name="uq_enrollment_school_quarter"),
    )
    op.create_index(op.f("ix_school_enrollment_school_id"), "school_enrollment", ["school_id"], unique=False)

    op.create_table(
        "teachers",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("gender", teacher_gender, nullable=False),
        sa.Column("subject", sa.String(length=150), nullable=True),
        sa.Column("status", teacher_status, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_teachers_school_id"), "teachers", ["school_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_teachers_school_id"), table_name="teachers")
    op.drop_table("teachers")
    op.drop_index(op.f("ix_school_enrollment_school_id"), table_name="school_enrollment")
    op.drop_table("school_enrollment")
    op.drop_index(op.f("ix_schools_uc_id"), table_name="schools")
    op.drop_index(op.f("ix_schools_partner_org_id"), table_name="schools")
    op.drop_table("schools")
    op.drop_table("partner_orgs")
    op.drop_index(op.f("ix_union_councils_taluka_id"), table_name="union_councils")
    op.drop_table("union_councils")
    op.drop_index(op.f("ix_talukas_district_id"), table_name="talukas")
    op.drop_table("talukas")
    op.drop_table("districts")

    bind = op.get_bind()
    teacher_status.drop(bind, checkfirst=True)
    teacher_gender.drop(bind, checkfirst=True)
    school_status.drop(bind, checkfirst=True)
    school_gender.drop(bind, checkfirst=True)
    school_level.drop(bind, checkfirst=True)
