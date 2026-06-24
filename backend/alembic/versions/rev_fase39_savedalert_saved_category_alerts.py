"""fase 39 — saved_category_alerts (alerta/busca salva de categoria)

Revision ID: rev_fase39_savedalert
Revises: rev_fase38_reply
Create Date: 2026-06-24

Id semântico de propósito (a família de hex rotacionados colide — ver fase 38).
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "rev_fase39_savedalert"
down_revision: str | None = "rev_fase38_reply"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "saved_category_alerts",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("city", sa.String(length=120), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["category_id"], ["categories.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "category_id",
            "city",
            name="uq_saved_alert_user_category_city",
        ),
    )
    op.create_index(
        "ix_saved_category_alerts_user_id",
        "saved_category_alerts",
        ["user_id"],
    )
    op.create_index(
        "ix_saved_category_alerts_category_id",
        "saved_category_alerts",
        ["category_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_saved_category_alerts_category_id",
        table_name="saved_category_alerts",
    )
    op.drop_index(
        "ix_saved_category_alerts_user_id",
        table_name="saved_category_alerts",
    )
    op.drop_table("saved_category_alerts")
