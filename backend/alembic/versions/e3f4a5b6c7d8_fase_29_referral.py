"""fase 29 — indique e ganhe (referral) em users

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-06-24

Código de indicação (único), quem indicou (self-FK SET NULL) e flag de bônus já
creditado. O bônus do indicador é creditado 1x, na 1ª compra do indicado.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "e3f4a5b6c7d8"
down_revision = "d2e3f4a5b6c7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("referral_code", sa.String(length=12), nullable=True)
    )
    op.create_unique_constraint(
        "uq_users_referral_code", "users", ["referral_code"]
    )
    op.add_column(
        "users",
        sa.Column(
            "referred_by_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_users_referred_by",
        "users",
        "users",
        ["referred_by_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column(
        "users",
        sa.Column(
            "referral_credited",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_referred_by", "users", type_="foreignkey")
    op.drop_constraint("uq_users_referral_code", "users", type_="unique")
    op.drop_column("users", "referral_credited")
    op.drop_column("users", "referred_by_id")
    op.drop_column("users", "referral_code")
