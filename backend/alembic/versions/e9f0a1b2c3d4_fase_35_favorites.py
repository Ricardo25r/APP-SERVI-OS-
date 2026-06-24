"""fase 35 — tabela favorites (profissionais salvos pelo cliente)

Revision ID: e9f0a1b2c3d4
Revises: d8e9f0a1b2c3
Create Date: 2026-06-24

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e9f0a1b2c3d4"
down_revision: str | None = "d8e9f0a1b2c3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "favorites",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("professional_user_id", sa.UUID(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["professional_user_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id", "professional_user_id", name="uq_favorite_user_pro"
        ),
    )
    op.create_index(
        op.f("ix_favorites_user_id"), "favorites", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_favorites_professional_user_id"),
        "favorites",
        ["professional_user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_favorites_professional_user_id"), table_name="favorites")
    op.drop_index(op.f("ix_favorites_user_id"), table_name="favorites")
    op.drop_table("favorites")
