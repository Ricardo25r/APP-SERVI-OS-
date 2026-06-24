"""fase 34 — tabela reports (denúncias de abuso)

Revision ID: d8e9f0a1b2c3
Revises: c7d8e9f0a1b2
Create Date: 2026-06-24

Encadeada após a fase 33 (token_version). A fase 33 e esta são ambas adições
puras (coluna nova / tabela nova) — seguras em produção.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d8e9f0a1b2c3"
down_revision: str | None = "c7d8e9f0a1b2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "reports",
        sa.Column("reporter_id", sa.UUID(), nullable=False),
        sa.Column("target_type", sa.String(length=20), nullable=False),
        sa.Column("target_id", sa.UUID(), nullable=False),
        sa.Column("reason", sa.String(length=40), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status", sa.String(length=20), server_default="open", nullable=False
        ),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["reporter_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_reports_reporter_id"), "reports", ["reporter_id"], unique=False
    )
    op.create_index(
        "ix_reports_status_created", "reports", ["status", "created_at"], unique=False
    )
    op.create_index(
        "ix_reports_target", "reports", ["target_type", "target_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_reports_target", table_name="reports")
    op.drop_index("ix_reports_status_created", table_name="reports")
    op.drop_index(op.f("ix_reports_reporter_id"), table_name="reports")
    op.drop_table("reports")
