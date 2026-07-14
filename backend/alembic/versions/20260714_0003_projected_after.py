"""Add projected_after JSONB column to assessments."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260714_0003"
down_revision = "20260714_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("assessments", sa.Column("projected_after", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("assessments", "projected_after")
