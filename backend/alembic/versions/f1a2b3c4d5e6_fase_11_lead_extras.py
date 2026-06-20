"""fase 11 lead extras (orcamento, coordenadas, midia)

Revision ID: f1a2b3c4d5e6
Revises: 77994af88f5c
Create Date: 2026-06-20 00:00:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: str | None = '77994af88f5c'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Leads: faixa de orçamento + coordenadas do serviço.
    op.add_column('leads', sa.Column('budget_range', sa.String(length=20), nullable=True))
    op.add_column('leads', sa.Column('latitude', sa.Numeric(precision=9, scale=6), nullable=True))
    op.add_column('leads', sa.Column('longitude', sa.Numeric(precision=9, scale=6), nullable=True))
    # Profissional: coordenadas (para distância até o lead).
    op.add_column('professional_profiles', sa.Column('latitude', sa.Numeric(precision=9, scale=6), nullable=True))
    op.add_column('professional_profiles', sa.Column('longitude', sa.Numeric(precision=9, scale=6), nullable=True))
    # Fotos/mídia do lead (objetos no MinIO).
    op.create_table(
        'lead_media',
        sa.Column('lead_id', sa.UUID(), nullable=False),
        sa.Column('object_key', sa.String(length=512), nullable=False),
        sa.Column('content_type', sa.String(length=120), nullable=True),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['lead_id'], ['leads.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_lead_media_lead_id'), 'lead_media', ['lead_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_lead_media_lead_id'), table_name='lead_media')
    op.drop_table('lead_media')
    op.drop_column('professional_profiles', 'longitude')
    op.drop_column('professional_profiles', 'latitude')
    op.drop_column('leads', 'longitude')
    op.drop_column('leads', 'latitude')
    op.drop_column('leads', 'budget_range')
