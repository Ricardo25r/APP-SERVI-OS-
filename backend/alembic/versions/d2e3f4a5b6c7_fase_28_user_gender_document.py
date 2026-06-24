"""fase 28 — colunas gender + document (CPF/CNPJ) em users

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-06-24

Gênero (opcional) e documento (CPF/CNPJ, só dígitos) coletados no cadastro.
Ambos nullable: contas antigas e de login social ficam sem.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "d2e3f4a5b6c7"
down_revision = "c1d2e3f4a5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("gender", sa.String(length=20), nullable=True))
    op.add_column(
        "users", sa.Column("document", sa.String(length=20), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("users", "document")
    op.drop_column("users", "gender")
