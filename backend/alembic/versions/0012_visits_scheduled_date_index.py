"""Index visits.scheduled_date for month/calendar list queries.

Revision ID: 0012_visits_scheduled_date_index
Revises: 0011_visit_schedule
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012_visits_scheduled_date_index"
down_revision: Union[str, None] = "0011_visit_schedule"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        sa.text("CREATE INDEX IF NOT EXISTS ix_visits_scheduled_date ON visits (scheduled_date)"),
    )


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS ix_visits_scheduled_date"))
