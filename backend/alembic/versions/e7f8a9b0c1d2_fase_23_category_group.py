"""fase 23 — coluna de agrupamento (category_group) em categories

Revision ID: e7f8a9b0c1d2
Revises: c6d7e8f9a0b1
Create Date: 2026-06-23

Adiciona ``category_group`` (nullable) para agrupar categorias na UI do
profissional (acordeão). ``None`` cai no grupo "Outros". O backfill das
categorias existentes é feito por script (por nome), fora da migração.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "e7f8a9b0c1d2"
down_revision = "c6d7e8f9a0b1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "categories",
        sa.Column("category_group", sa.String(length=60), nullable=True),
    )
    op.create_index(
        "ix_categories_category_group", "categories", ["category_group"]
    )


def downgrade() -> None:
    op.drop_index("ix_categories_category_group", table_name="categories")
    op.drop_column("categories", "category_group")
