"""fase 43 — assinatura (subscription_settings + subscriptions) [#56]

Revision ID: rev_fase43_subs
Revises: rev_fase42_notifprefs
Create Date: 2026-06-25

Id semântico (a família de hex rotacionados colide — ver fase 38).
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "rev_fase43_subs"
down_revision: str | None = "rev_fase42_notifprefs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "subscription_settings",
        sa.Column(
            "enabled", sa.Boolean(), server_default="false", nullable=False
        ),
        sa.Column(
            "plan_name",
            sa.String(length=80),
            server_default="FazTudo PRO",
            nullable=False,
        ),
        sa.Column(
            "price_cents", sa.Integer(), server_default="4990", nullable=False
        ),
        sa.Column(
            "included_credits",
            sa.Integer(),
            server_default="15",
            nullable=False,
        ),
        sa.Column(
            "discount_pct", sa.Integer(), server_default="20", nullable=False
        ),
        sa.Column(
            "trial_days", sa.Integer(), server_default="7", nullable=False
        ),
        sa.Column(
            "trial_credits", sa.Integer(), server_default="5", nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "subscriptions",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            server_default="pending",
            nullable=False,
        ),
        sa.Column(
            "provider",
            sa.String(length=20),
            server_default="mercadopago",
            nullable=False,
        ),
        sa.Column(
            "provider_sub_id", sa.String(length=120), nullable=True
        ),
        sa.Column(
            "current_period_end", sa.DateTime(timezone=True), nullable=True
        ),
        sa.Column("trial_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("grace_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("canceled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_payment_id", sa.String(length=120), nullable=True),
        sa.Column(
            "trial_granted",
            sa.Boolean(),
            server_default="false",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_subscriptions_user"),
        sa.UniqueConstraint(
            "provider_sub_id", name="uq_subscriptions_provider_sub"
        ),
    )
    op.create_index(
        "ix_subscriptions_user_id", "subscriptions", ["user_id"]
    )
    op.create_index(
        "ix_subscriptions_provider_sub_id",
        "subscriptions",
        ["provider_sub_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_subscriptions_provider_sub_id", table_name="subscriptions"
    )
    op.drop_index("ix_subscriptions_user_id", table_name="subscriptions")
    op.drop_table("subscriptions")
    op.drop_table("subscription_settings")
