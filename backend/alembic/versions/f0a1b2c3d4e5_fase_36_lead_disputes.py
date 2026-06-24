"""fase 36 — tabela lead_disputes (disputa/reembolso de lead sem GPS)

Revision ID: f0a1b2c3d4e5
Revises: e9f0a1b2c3d4
Create Date: 2026-06-24

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f0a1b2c3d4e5"
down_revision: str | None = "e9f0a1b2c3d4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "lead_disputes",
        sa.Column("purchase_id", sa.UUID(), nullable=False),
        sa.Column("professional_user_id", sa.UUID(), nullable=False),
        sa.Column("lead_id", sa.UUID(), nullable=False),
        sa.Column("reason", sa.String(length=40), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status", sa.String(length=20), server_default="open", nullable=False
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["purchase_id"], ["lead_purchases.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["professional_user_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["lead_id"], ["leads.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("purchase_id", name="uq_lead_dispute_purchase"),
    )
    op.create_index(
        op.f("ix_lead_disputes_professional_user_id"),
        "lead_disputes",
        ["professional_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lead_disputes_lead_id"), "lead_disputes", ["lead_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_lead_disputes_lead_id"), table_name="lead_disputes")
    op.drop_index(
        op.f("ix_lead_disputes_professional_user_id"), table_name="lead_disputes"
    )
    op.drop_table("lead_disputes")
