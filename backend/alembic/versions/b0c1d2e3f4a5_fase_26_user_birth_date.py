"""fase 26 — coluna birth_date (data de nascimento) em users

Revision ID: b0c1d2e3f4a5
Revises: a9b0c1d2e3f4
Create Date: 2026-06-24

Guarda a data de nascimento do usuário (idade do prestador para métricas/média
de idade e validação de maioridade). Nullable: contas antigas e de login social
preenchem depois (gate no próximo acesso).
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "b0c1d2e3f4a5"
down_revision = "a9b0c1d2e3f4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("birth_date", sa.Date(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "birth_date")
