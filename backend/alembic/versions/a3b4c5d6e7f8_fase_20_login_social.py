"""fase 20 login social (campos de auth provider)

Revision ID: a3b4c5d6e7f8
Revises: d7e8f9a0b1c2
Create Date: 2026-06-23

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a3b4c5d6e7f8"
down_revision: str | None = "d7e8f9a0b1c2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Login social: provedor + ids estáveis; senha local passa a ser opcional.
    op.add_column(
        "users",
        sa.Column(
            "auth_provider",
            sa.String(length=20),
            server_default="local",
            nullable=False,
        ),
    )
    op.add_column(
        "users", sa.Column("google_sub", sa.String(length=255), nullable=True)
    )
    op.add_column(
        "users", sa.Column("apple_sub", sa.String(length=255), nullable=True)
    )
    op.add_column(
        "users",
        sa.Column("phone_verified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.alter_column(
        "users",
        "password_hash",
        existing_type=sa.String(length=255),
        nullable=True,
    )
    op.create_index(
        "uq_users_google_sub_active",
        "users",
        ["google_sub"],
        unique=True,
        postgresql_where=sa.text("google_sub IS NOT NULL AND deleted_at IS NULL"),
    )
    op.create_index(
        "uq_users_apple_sub_active",
        "users",
        ["apple_sub"],
        unique=True,
        postgresql_where=sa.text("apple_sub IS NOT NULL AND deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_users_apple_sub_active", table_name="users")
    op.drop_index("uq_users_google_sub_active", table_name="users")
    op.alter_column(
        "users",
        "password_hash",
        existing_type=sa.String(length=255),
        nullable=False,
    )
    op.drop_column("users", "phone_verified_at")
    op.drop_column("users", "apple_sub")
    op.drop_column("users", "google_sub")
    op.drop_column("users", "auth_provider")
