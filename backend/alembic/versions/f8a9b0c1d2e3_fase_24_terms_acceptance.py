"""fase 24 — aceite dos Termos de Uso (terms_accepted_at + terms_version) em users

Revision ID: f8a9b0c1d2e3
Revises: e7f8a9b0c1d2
Create Date: 2026-06-24

Registra o aceite dos Termos de Uso por usuário (quando aceitou + versão aceita).
O banner de aceite reaparece quando ``settings.TERMS_VERSION`` muda. Usuários
existentes ficam com ``NULL`` → o banner aparece no próximo acesso.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "f8a9b0c1d2e3"
down_revision = "e7f8a9b0c1d2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("terms_accepted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("terms_version", sa.String(length=20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "terms_version")
    op.drop_column("users", "terms_accepted_at")
