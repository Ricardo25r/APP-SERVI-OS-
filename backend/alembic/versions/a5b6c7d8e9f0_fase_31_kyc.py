"""fase 31 — KYC (validação do profissional) em users

Revision ID: a5b6c7d8e9f0
Revises: f4a5b6c7d8e9
Create Date: 2026-06-24

Status do KYC + chaves das imagens (documento + selfie, bucket privado) + datas
+ motivo de recusa. Revisão manual no admin.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "a5b6c7d8e9f0"
down_revision = "f4a5b6c7d8e9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "kyc_status",
            sa.String(length=20),
            nullable=False,
            server_default="none",
        ),
    )
    op.add_column(
        "users",
        sa.Column("kyc_document_key", sa.String(length=512), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("kyc_selfie_key", sa.String(length=512), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("kyc_submitted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("kyc_reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("kyc_reject_reason", sa.String(length=300), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "kyc_reject_reason")
    op.drop_column("users", "kyc_reviewed_at")
    op.drop_column("users", "kyc_submitted_at")
    op.drop_column("users", "kyc_selfie_key")
    op.drop_column("users", "kyc_document_key")
    op.drop_column("users", "kyc_status")
