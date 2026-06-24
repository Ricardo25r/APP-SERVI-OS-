"""fase 33: users.token_version (revogacao de access token / reset uso unico)

Laudo de seguranca 2026-06-24 (V3/V5): coluna inteira ``token_version`` em
``users``, default 0. Incrementada ao bloquear/suspender a conta e ao trocar a
senha; o claim ``ver`` dos tokens e comparado em get_current_user/refresh.

Revision ID: c7d8e9f0a1b2
Revises: b6c7d8e9f0a1
Create Date: 2026-06-24
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "c7d8e9f0a1b2"
down_revision = "b6c7d8e9f0a1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "token_version",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "token_version")
