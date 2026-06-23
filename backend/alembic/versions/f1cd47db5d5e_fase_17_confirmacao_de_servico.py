"""fase 17 confirmacao de servico

Revision ID: f1cd47db5d5e
Revises: b8c9d0e1f2a3
Create Date: 2026-06-23 10:49:23.658469

"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1cd47db5d5e'
down_revision: str | None = 'b8c9d0e1f2a3'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Confirmação de serviço (anti no-show): código de chegada + carimbo de
    # chegada + prazo de segurança; reputação no_show_count no perfil.
    op.add_column('lead_purchases', sa.Column('arrival_code', sa.String(length=8), nullable=True))
    op.add_column('lead_purchases', sa.Column('arrived_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('lead_purchases', sa.Column('no_show_deadline', sa.DateTime(timezone=True), nullable=True))
    op.add_column('professional_profiles', sa.Column('no_show_count', sa.Integer(), server_default=sa.text('0'), nullable=False))
    # ### end Alembic commands ###


def downgrade() -> None:
    op.drop_column('professional_profiles', 'no_show_count')
    op.drop_column('lead_purchases', 'no_show_deadline')
    op.drop_column('lead_purchases', 'arrived_at')
    op.drop_column('lead_purchases', 'arrival_code')
