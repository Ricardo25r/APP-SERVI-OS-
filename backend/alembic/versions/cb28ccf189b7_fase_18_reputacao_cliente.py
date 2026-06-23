"""fase 18 reputacao cliente

Revision ID: cb28ccf189b7
Revises: f1cd47db5d5e
Create Date: 2026-06-23 13:21:12.031004

"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cb28ccf189b7'
down_revision: str | None = 'f1cd47db5d5e'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Reputação do cliente (não-comparecimento comprovado por GPS do profissional).
    op.add_column('users', sa.Column('client_no_show_count', sa.Integer(), server_default=sa.text('0'), nullable=False))


def downgrade() -> None:
    op.drop_column('users', 'client_no_show_count')
