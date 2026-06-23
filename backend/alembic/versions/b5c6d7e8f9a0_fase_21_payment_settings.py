"""fase 21 payment_settings (dados de recebimento editaveis no admin)

Revision ID: b5c6d7e8f9a0
Revises: a3b4c5d6e7f8
Create Date: 2026-06-23

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b5c6d7e8f9a0"
down_revision: str | None = "a3b4c5d6e7f8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "payment_settings",
        sa.Column("pix_key", sa.String(length=140), nullable=True),
        sa.Column("pix_key_type", sa.String(length=20), nullable=True),
        sa.Column("recipient_name", sa.String(length=120), nullable=True),
        sa.Column("bank_name", sa.String(length=120), nullable=True),
        sa.Column("bank_agency", sa.String(length=20), nullable=True),
        sa.Column("bank_account", sa.String(length=30), nullable=True),
        sa.Column("bank_account_type", sa.String(length=20), nullable=True),
        sa.Column("holder_name", sa.String(length=120), nullable=True),
        sa.Column("holder_document", sa.String(length=20), nullable=True),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("payment_settings")
