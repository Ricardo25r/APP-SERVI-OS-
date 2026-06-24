"""fase 32 — coluna image_key (foto da categoria) em categories

Revision ID: b6c7d8e9f0a1
Revises: a5b6c7d8e9f0
Create Date: 2026-06-24

Permite o admin definir uma foto por categoria (chave no storage público).
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "b6c7d8e9f0a1"
down_revision = "a5b6c7d8e9f0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "categories", sa.Column("image_key", sa.String(length=512), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("categories", "image_key")
