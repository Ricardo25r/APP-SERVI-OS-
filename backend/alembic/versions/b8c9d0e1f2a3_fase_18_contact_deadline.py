"""fase 18 contact deadline (janela de contato pos-desbloqueio)

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-06-21 16:00:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b8c9d0e1f2a3'
down_revision: str | None = 'a7b8c9d0e1f2'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'lead_purchases',
        sa.Column('contact_deadline', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('lead_purchases', 'contact_deadline')
