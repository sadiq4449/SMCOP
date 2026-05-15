"""Add weight column to kpis for EPIC 6 weighted scoring.

Revision ID: 0010_kpi_weight
Revises: 0009_user_roles_ie_partner
Create Date: 2026-05-15 13:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0010_kpi_weight"
down_revision: Union[str, None] = "0009_user_roles_ie_partner"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "kpis",
        sa.Column(
            "weight",
            sa.Numeric(5, 2),
            nullable=False,
            server_default=sa.text("1.0"),
        ),
    )


def downgrade() -> None:
    op.drop_column("kpis", "weight")
