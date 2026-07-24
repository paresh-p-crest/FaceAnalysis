"""Add assessments.deleted_at for soft delete; narrow user_scan_unique to active rows."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260723_0005"
down_revision = "20260714_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("assessments", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(
        "ix_assessments_active",
        "assessments",
        ["deleted_at"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.drop_index("user_scan_unique", table_name="assessments")
    op.create_index(
        "user_scan_unique",
        "assessments",
        ["user_id", "scan_id"],
        unique=True,
        postgresql_where=sa.text("scan_id IS NOT NULL AND deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("user_scan_unique", table_name="assessments")
    op.create_index(
        "user_scan_unique",
        "assessments",
        ["user_id", "scan_id"],
        unique=True,
        postgresql_where=sa.text("scan_id IS NOT NULL"),
    )
    op.drop_index("ix_assessments_active", table_name="assessments")
    op.drop_column("assessments", "deleted_at")
