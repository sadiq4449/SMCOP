"""Add ie/partner roles and migrate away from enumerator/deo/principal/teacher.

Revision ID: 0009_user_roles_ie_partner
Revises: 0008_issues_notify
Create Date: 2026-05-15 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009_user_roles_ie_partner"
down_revision: Union[str, None] = "0008_issues_notify"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # PostgreSQL: extend enum; existing rows updated before app stops emitting old labels.
    op.execute(sa.text("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ie'"))
    op.execute(sa.text("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'partner'"))
    op.execute(
        sa.text("UPDATE users SET role = 'ie'::user_role WHERE role::text = 'enumerator'"),
    )
    op.execute(
        sa.text(
            "UPDATE users SET role = 'partner'::user_role "
            "WHERE role::text IN ('principal', 'teacher') AND partner_org_id IS NOT NULL",
        ),
    )
    op.execute(
        sa.text(
            "UPDATE users SET role = 'government'::user_role "
            "WHERE role::text IN ('deo', 'principal', 'teacher')",
        ),
    )


def downgrade() -> None:
    raise NotImplementedError("Downgrade would require mapping ie/partner back to legacy roles")
