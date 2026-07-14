"""Add pipeline and feature_parsing JSONB columns to assessments."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260714_0002"
down_revision = "20260713_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("assessments", sa.Column("pipeline", postgresql.JSONB(), nullable=True))
    op.add_column("assessments", sa.Column("feature_parsing", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("assessments", "feature_parsing")
    op.drop_column("assessments", "pipeline")
