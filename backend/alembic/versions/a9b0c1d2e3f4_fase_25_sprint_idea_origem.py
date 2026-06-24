"""fase 25 — coluna origem (admin|usuario) em sprint_ideas

Revision ID: a9b0c1d2e3f4
Revises: f8a9b0c1d2e3
Create Date: 2026-06-24

Distingue ideias criadas no painel admin (``origem='admin'``) de bugs reportados
por usuários do app (``origem='usuario'``). Ideias existentes ficam como 'admin'
(server_default).
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "a9b0c1d2e3f4"
down_revision = "f8a9b0c1d2e3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sprint_ideas",
        sa.Column(
            "origem",
            sa.String(length=20),
            nullable=False,
            server_default="admin",
        ),
    )
    op.create_index("ix_sprint_ideas_origem", "sprint_ideas", ["origem"])


def downgrade() -> None:
    op.drop_index("ix_sprint_ideas_origem", table_name="sprint_ideas")
    op.drop_column("sprint_ideas", "origem")
