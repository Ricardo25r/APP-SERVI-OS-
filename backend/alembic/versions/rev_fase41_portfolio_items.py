"""fase 41 — portfolio_items (galeria de trabalhos do profissional)

Revision ID: rev_fase41_portfolio
Revises: rev_fase40_thread
Create Date: 2026-06-24

Id semântico de propósito (a família de hex rotacionados colide — ver fase 38).
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "rev_fase41_portfolio"
down_revision: str | None = "rev_fase40_thread"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "portfolio_items",
        sa.Column(
            "professional_id", postgresql.UUID(as_uuid=True), nullable=False
        ),
        sa.Column("image_key", sa.String(length=400), nullable=False),
        sa.Column("caption", sa.String(length=200), nullable=True),
        sa.Column(
            "sort_order",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["professional_id"],
            ["professional_profiles.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_portfolio_items_professional_id",
        "portfolio_items",
        ["professional_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_portfolio_items_professional_id", table_name="portfolio_items"
    )
    op.drop_table("portfolio_items")
