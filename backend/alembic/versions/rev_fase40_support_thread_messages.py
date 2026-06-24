"""fase 40 — support_ticket_messages (thread de resposta dos chamados)

Revision ID: rev_fase40_thread
Revises: rev_fase39_savedalert
Create Date: 2026-06-24

Id semântico de propósito (a família de hex rotacionados colide — ver fase 38).
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "rev_fase40_thread"
down_revision: str | None = "rev_fase39_savedalert"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "support_ticket_messages",
        sa.Column("ticket_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "is_staff",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["ticket_id"], ["support_tickets.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["author_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_support_ticket_messages_ticket_created",
        "support_ticket_messages",
        ["ticket_id", "created_at"],
    )
    op.create_index(
        "ix_support_ticket_messages_ticket_id",
        "support_ticket_messages",
        ["ticket_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_support_ticket_messages_ticket_id",
        table_name="support_ticket_messages",
    )
    op.drop_index(
        "ix_support_ticket_messages_ticket_created",
        table_name="support_ticket_messages",
    )
    op.drop_table("support_ticket_messages")
