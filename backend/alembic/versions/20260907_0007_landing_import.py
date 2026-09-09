"""Landing paid-account import: setup tokens, password_setup_pending, payment idempotency."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260907_0007"
down_revision = "20260727_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("password_setup_pending", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )

    op.create_table(
        "password_setup_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_password_setup_tokens_user_id", "password_setup_tokens", ["user_id"])
    op.create_index("ix_password_setup_tokens_token_hash", "password_setup_tokens", ["token_hash"])

    op.create_unique_constraint("uq_payments_provider_ref", "payments", ["provider", "provider_ref"])


def downgrade() -> None:
    op.drop_constraint("uq_payments_provider_ref", "payments", type_="unique")
    op.drop_index("ix_password_setup_tokens_token_hash", table_name="password_setup_tokens")
    op.drop_index("ix_password_setup_tokens_user_id", table_name="password_setup_tokens")
    op.drop_table("password_setup_tokens")
    op.drop_column("users", "password_setup_pending")
