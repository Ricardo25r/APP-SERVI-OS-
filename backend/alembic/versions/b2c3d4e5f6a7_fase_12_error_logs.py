"""fase 12 error_logs (monitoramento)

Revision ID: b2c3d4e5f6a7
Revises: f1a2b3c4d5e6
Create Date: 2026-06-20 01:00:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: str | None = 'f1a2b3c4d5e6'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'error_logs',
        sa.Column('error_type', sa.String(length=160), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('traceback', sa.Text(), nullable=True),
        sa.Column('path', sa.String(length=512), nullable=True),
        sa.Column('method', sa.String(length=10), nullable=True),
        sa.Column('status_code', sa.Integer(), nullable=False),
        sa.Column('request_id', sa.String(length=64), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_error_logs_error_type'), 'error_logs', ['error_type'], unique=False)
    op.create_index('ix_error_logs_created', 'error_logs', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_error_logs_created', table_name='error_logs')
    op.drop_index(op.f('ix_error_logs_error_type'), table_name='error_logs')
    op.drop_table('error_logs')
