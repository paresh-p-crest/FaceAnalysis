"""Initial greenfield schema — UUID PKs + JSONB assessment blobs."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260713_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    user_role = postgresql.ENUM("user", "admin", name="user_role", create_type=False)
    assessment_status = postgresql.ENUM(
        "draft", "pending_review", "approved", "published", name="assessment_status", create_type=False
    )
    message_role = postgresql.ENUM("user", "assistant", name="message_role", create_type=False)
    user_role.create(op.get_bind(), checkfirst=True)
    assessment_status.create(op.get_bind(), checkfirst=True)
    message_role.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("first_name", sa.String(120), nullable=False),
        sa.Column("last_name", sa.String(120), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_role", "users", ["role"])

    op.create_table(
        "assessments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("status", assessment_status, nullable=False),
        sa.Column("scan_id", sa.String(128)),
        sa.Column("provider", sa.String(64), nullable=False),
        sa.Column("admin_notes", sa.Text()),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("reviewed_by", postgresql.JSONB(), nullable=False),
        sa.Column("answers", postgresql.JSONB(), nullable=False),
        sa.Column("photos", postgresql.JSONB(), nullable=False),
        sa.Column("photos_keys", postgresql.JSONB(), nullable=False),
        sa.Column("analysis", postgresql.JSONB(), nullable=False),
        sa.Column("ai_narrative", postgresql.JSONB()),
        sa.Column("protocol_narrative", postgresql.JSONB()),
        sa.Column("feature_narratives", postgresql.JSONB()),
        sa.Column("protocol_storage", postgresql.JSONB()),
        sa.Column("ai_visuals", postgresql.JSONB()),
        sa.Column("review_log", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_assessments_user_id", "assessments", ["user_id"])
    op.create_index("ix_assessments_status", "assessments", ["status"])
    op.create_index("ix_assessments_created_at", "assessments", ["created_at"])
    op.create_index(
        "user_scan_unique",
        "assessments",
        ["user_id", "scan_id"],
        unique=True,
        postgresql_where=sa.text("scan_id IS NOT NULL"),
    )

    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("assessment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("assessments.id", ondelete="SET NULL")),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("provider_ref", sa.String(255)),
        sa.Column("checkout_url", sa.Text()),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(8), nullable=False),
        sa.Column("plan_id", sa.String(64), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("raw", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_payments_user_id", "payments", ["user_id"])
    op.create_index("ix_payments_provider_ref", "payments", ["provider_ref"])
    op.create_index("ix_payments_status", "payments", ["status"])
    op.create_index("ix_payments_created_at", "payments", ["created_at"])

    op.create_table(
        "conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("assessment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("session_summary", sa.Text()),
        sa.Column("summary_at_user_count", sa.Integer()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("assessment_id", "user_id", name="uq_conversation_assessment_user"),
    )
    op.create_index("ix_conversations_updated_at", "conversations", ["updated_at"])

    op.create_table(
        "conversation_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", message_role, nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_conversation_messages_conv_created", "conversation_messages", ["conversation_id", "created_at"])

    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(32), primary_key=True),
        sa.Column("premium_amount_cents", sa.Integer(), nullable=False),
        sa.Column("premium_currency", sa.String(8), nullable=False),
        sa.Column("product_name", sa.String(255), nullable=False),
        sa.Column("product_description", sa.Text(), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("key = 'app'", name="ck_app_settings_singleton"),
    )

    op.create_table(
        "assistant_rate_limits",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("hour_bucket", sa.String(16), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "hour_bucket", name="user_hour_bucket_unique"),
    )


def downgrade() -> None:
    op.drop_table("assistant_rate_limits")
    op.drop_table("app_settings")
    op.drop_table("conversation_messages")
    op.drop_table("conversations")
    op.drop_table("payments")
    op.drop_index("user_scan_unique", table_name="assessments")
    op.drop_table("assessments")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS message_role")
    op.execute("DROP TYPE IF EXISTS assessment_status")
    op.execute("DROP TYPE IF EXISTS user_role")
