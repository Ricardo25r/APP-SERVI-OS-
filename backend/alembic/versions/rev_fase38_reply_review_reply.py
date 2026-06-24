"""fase 38 — resposta do avaliado (reply) em reviews

Revision ID: rev_fase38_reply
Revises: a1b2c3d4e5f6
Create Date: 2026-06-24

Nota: o id é semântico (não-hex) de propósito — a família de ids rotacionados
``b2c3d4e5f6a7``/``c3d4e5f6a7b8``... já estava em uso (fase 12/13) e colidiu.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "rev_fase38_reply"
down_revision: str | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "reviews", sa.Column("reply", sa.String(length=1000), nullable=True)
    )
    op.add_column(
        "reviews",
        sa.Column("reply_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("reviews", "reply_at")
    op.drop_column("reviews", "reply")
