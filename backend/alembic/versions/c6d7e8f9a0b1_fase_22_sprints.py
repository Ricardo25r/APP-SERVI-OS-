"""fase 22 sprints / esteira de ideias (modulo admin)

Revision ID: c6d7e8f9a0b1
Revises: b5c6d7e8f9a0
Create Date: 2026-06-23

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c6d7e8f9a0b1"
down_revision: str | None = "b5c6d7e8f9a0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_now = sa.text("now()")


def upgrade() -> None:
    op.create_table(
        "sprints",
        sa.Column("nome", sa.String(length=150), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("data_inicio", sa.Date(), nullable=True),
        sa.Column("data_fim", sa.Date(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=20),
            server_default="planejado",
            nullable=False,
        ),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_now, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_now, nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "sprint_ideas",
        sa.Column("titulo", sa.String(length=200), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("tipo", sa.String(length=20), nullable=False),
        sa.Column("urgencia", sa.String(length=20), server_default="media", nullable=False),
        sa.Column("status", sa.String(length=20), server_default="aberta", nullable=False),
        sa.Column("sprint_id", sa.UUID(), nullable=True),
        sa.Column("autor_username", sa.String(length=100), nullable=False),
        sa.Column("autor_nome", sa.String(length=150), nullable=True),
        sa.Column("responsavel_username", sa.String(length=100), nullable=True),
        sa.Column("fixado_topo", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("votos_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("feito_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("feito_por_username", sa.String(length=100), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_now, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_now, nullable=False),
        sa.ForeignKeyConstraint(["sprint_id"], ["sprints.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sprint_ideas_status", "sprint_ideas", ["status"])
    op.create_index("ix_sprint_ideas_sprint_id", "sprint_ideas", ["sprint_id"])
    op.create_index("ix_sprint_ideas_urgencia", "sprint_ideas", ["urgencia"])

    op.create_table(
        "sprint_idea_anexos",
        sa.Column("idea_id", sa.UUID(), nullable=False),
        sa.Column("tipo", sa.String(length=20), nullable=True),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("path_relativo", sa.String(length=500), nullable=False),
        sa.Column("mime", sa.String(length=120), nullable=True),
        sa.Column("tamanho_bytes", sa.Integer(), nullable=True),
        sa.Column("enviado_por_username", sa.String(length=100), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_now, nullable=False),
        sa.ForeignKeyConstraint(["idea_id"], ["sprint_ideas.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sprint_idea_anexos_idea_id", "sprint_idea_anexos", ["idea_id"])

    op.create_table(
        "sprint_idea_comentarios",
        sa.Column("idea_id", sa.UUID(), nullable=False),
        sa.Column("autor_username", sa.String(length=100), nullable=False),
        sa.Column("autor_nome", sa.String(length=150), nullable=True),
        sa.Column("texto", sa.Text(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_now, nullable=False),
        sa.ForeignKeyConstraint(["idea_id"], ["sprint_ideas.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_sprint_idea_comentarios_idea_id", "sprint_idea_comentarios", ["idea_id"]
    )

    op.create_table(
        "sprint_idea_votos",
        sa.Column("idea_id", sa.UUID(), nullable=False),
        sa.Column("username", sa.String(length=100), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_now, nullable=False),
        sa.ForeignKeyConstraint(["idea_id"], ["sprint_ideas.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idea_id", "username", name="uq_sprint_idea_votos"),
    )

    op.create_table(
        "sprint_idea_eventos",
        sa.Column("idea_id", sa.UUID(), nullable=False),
        sa.Column("tipo_evento", sa.String(length=30), nullable=False),
        sa.Column("descricao", sa.String(length=300), nullable=True),
        sa.Column("autor_username", sa.String(length=100), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_now, nullable=False),
        sa.ForeignKeyConstraint(["idea_id"], ["sprint_ideas.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sprint_idea_eventos_idea_id", "sprint_idea_eventos", ["idea_id"])


def downgrade() -> None:
    op.drop_table("sprint_idea_eventos")
    op.drop_table("sprint_idea_votos")
    op.drop_table("sprint_idea_comentarios")
    op.drop_table("sprint_idea_anexos")
    op.drop_index("ix_sprint_ideas_urgencia", table_name="sprint_ideas")
    op.drop_index("ix_sprint_ideas_sprint_id", table_name="sprint_ideas")
    op.drop_index("ix_sprint_ideas_status", table_name="sprint_ideas")
    op.drop_table("sprint_ideas")
    op.drop_table("sprints")
