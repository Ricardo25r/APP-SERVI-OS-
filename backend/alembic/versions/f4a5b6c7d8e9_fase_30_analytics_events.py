"""fase 30 — tabela analytics_events (analytics de uso, sem PII)

Revision ID: f4a5b6c7d8e9
Revises: e3f4a5b6c7d8
Create Date: 2026-06-24

Visualizações de página agregáveis (rota, aparelho, SO, região, papel). Sem IP,
sem id de usuário.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "f4a5b6c7d8e9"
down_revision = "e3f4a5b6c7d8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "analytics_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("path", sa.String(length=200), nullable=False),
        sa.Column("device", sa.String(length=20), nullable=False),
        sa.Column("os", sa.String(length=20), nullable=True),
        sa.Column("region", sa.String(length=2), nullable=True),
        sa.Column("user_role", sa.String(length=20), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_analytics_events_created", "analytics_events", ["created_at"]
    )
    op.create_index("ix_analytics_events_path", "analytics_events", ["path"])


def downgrade() -> None:
    op.drop_index("ix_analytics_events_path", table_name="analytics_events")
    op.drop_index("ix_analytics_events_created", table_name="analytics_events")
    op.drop_table("analytics_events")
