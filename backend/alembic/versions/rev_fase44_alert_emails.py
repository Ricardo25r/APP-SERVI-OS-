"""fase 44 — alert_settings (e-mails extra para alerta de erro)

Revision ID: rev_fase44_alertemails
Revises: rev_fase43_subs
Create Date: 2026-06-25

Id semântico (a família de hex rotacionados colide — ver fase 38).
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "rev_fase44_alertemails"
down_revision: str | None = "rev_fase43_subs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "alert_settings",
        sa.Column(
            "error_emails", sa.Text(), server_default="", nullable=False
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


def downgrade() -> None:
    op.drop_table("alert_settings")
