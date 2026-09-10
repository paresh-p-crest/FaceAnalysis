"""Add landing identity + order ref columns; users.secondary_email."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260910_0009"
down_revision = "20260909_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("source_system", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("source_customer_id", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("secondary_email", sa.String(length=320), nullable=True))
    op.create_index("ix_users_source_customer_id", "users", ["source_customer_id"])
    op.create_index("ix_users_secondary_email", "users", ["secondary_email"])

    op.add_column("payments", sa.Column("landing_order_id", sa.Text(), nullable=True))
    op.add_column("payments", sa.Column("order_number", sa.Text(), nullable=True))
    op.create_index("ix_payments_landing_order_id", "payments", ["landing_order_id"])
    op.create_index("ix_payments_order_number", "payments", ["order_number"])


def downgrade() -> None:
    op.drop_index("ix_payments_order_number", table_name="payments")
    op.drop_index("ix_payments_landing_order_id", table_name="payments")
    op.drop_column("payments", "order_number")
    op.drop_column("payments", "landing_order_id")

    op.drop_index("ix_users_secondary_email", table_name="users")
    op.drop_index("ix_users_source_customer_id", table_name="users")
    op.drop_column("users", "secondary_email")
    op.drop_column("users", "source_customer_id")
    op.drop_column("users", "source_system")
