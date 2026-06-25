"""fase 45 — professional_profiles.welcome_credits_granted

Gate do bônus de boas-vindas: os 10 créditos passam a ser liberados só quando o
perfil fica 100% completo. Profissionais EXISTENTES são marcados como já
concedidos (não dar surpresa de 10 créditos a quem já recebeu o bônus antigo).

Revision ID: rev_fase45_welcome
Revises: rev_fase44_alertemails
Create Date: 2026-06-25
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "rev_fase45_welcome"
down_revision: str | None = "rev_fase44_alertemails"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "professional_profiles",
        sa.Column(
            "welcome_credits_granted",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    # Profissionais já existentes: marca como concedido (novos começam false).
    op.execute("UPDATE professional_profiles SET welcome_credits_granted = true")


def downgrade() -> None:
    op.drop_column("professional_profiles", "welcome_credits_granted")
