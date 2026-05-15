"""Add planned inspection schedule fields on visits.

Revision ID: 0011_visit_schedule
Revises: 0010_kpi_weight
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0011_visit_schedule"
down_revision: Union[str, None] = "0010_kpi_weight"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("visits", sa.Column("scheduled_date", sa.Date(), nullable=True))
    op.add_column("visits", sa.Column("scheduled_time_start", sa.Time(), nullable=True))
    op.add_column("visits", sa.Column("scheduled_time_end", sa.Time(), nullable=True))


def downgrade() -> None:
    op.drop_column("visits", "scheduled_time_end")
    op.drop_column("visits", "scheduled_time_start")
    op.drop_column("visits", "scheduled_date")
