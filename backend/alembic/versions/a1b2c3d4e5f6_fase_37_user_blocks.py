"""fase 37 — tabela user_blocks (bloqueio entre usuários)

Revision ID: a1b2c3d4e5f6
Revises: f0a1b2c3d4e5
Create Date: 2026-06-24

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "f0a1b2c3d4e5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_blocks",
        sa.Column("blocker_id", sa.UUID(), nullable=False),
        sa.Column("blocked_id", sa.UUID(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["blocker_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["blocked_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("blocker_id", "blocked_id", name="uq_user_block_pair"),
    )
    op.create_index(
        op.f("ix_user_blocks_blocker_id"), "user_blocks", ["blocker_id"], unique=False
    )
    op.create_index(
        op.f("ix_user_blocks_blocked_id"), "user_blocks", ["blocked_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_user_blocks_blocked_id"), table_name="user_blocks")
    op.drop_index(op.f("ix_user_blocks_blocker_id"), table_name="user_blocks")
    op.drop_table("user_blocks")
