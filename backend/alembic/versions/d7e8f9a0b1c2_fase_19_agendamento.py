"""fase 19 agendamento

Revision ID: d7e8f9a0b1c2
Revises: cb28ccf189b7
Create Date: 2026-06-23

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d7e8f9a0b1c2"
down_revision: str | None = "cb28ccf189b7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Agendamento: data/hora combinada do serviço (redefine o prazo de no-show).
    op.add_column(
        "lead_purchases",
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("lead_purchases", "scheduled_at")
