"""user district scope and lookup indexes

Revision ID: 0003_user_district_scope_indexes
Revises: 0002_geo_partner_schools
Create Date: 2026-05-12 12:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003_user_district_scope_indexes"
down_revision: Union[str, None] = "0002_geo_partner_schools"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("district_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_users_district_id_districts",
        "users",
        "districts",
        ["district_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_users_district_id"), "users", ["district_id"], unique=False)
    op.create_index(op.f("ix_users_role"), "users", ["role"], unique=False)
    op.create_index(op.f("ix_users_partner_org_id"), "users", ["partner_org_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_partner_org_id"), table_name="users")
    op.drop_index(op.f("ix_users_role"), table_name="users")
    op.drop_index(op.f("ix_users_district_id"), table_name="users")
    op.drop_constraint("fk_users_district_id_districts", "users", type_="foreignkey")
    op.drop_column("users", "district_id")
