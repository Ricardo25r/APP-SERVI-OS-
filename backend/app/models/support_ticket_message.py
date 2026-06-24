"""Modelo ``support_ticket_messages`` — thread de resposta de um chamado (#50).

Cada mensagem pertence a um :class:`SupportTicket`. ``is_staff`` marca respostas
do suporte/admin (renderizadas diferente do lado do usuário). ``author_id`` é
``SET NULL`` para preservar o histórico se a conta for removida.
"""

from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

__all__ = ["SupportTicketMessage"]


class SupportTicketMessage(UUIDPKMixin, CreatedAtMixin, Base):
    """Uma mensagem na conversa de um chamado de suporte."""

    __tablename__ = "support_ticket_messages"

    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("support_tickets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_staff: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    __table_args__ = (
        Index(
            "ix_support_ticket_messages_ticket_created",
            "ticket_id",
            "created_at",
        ),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return (
            f"<SupportTicketMessage ticket={self.ticket_id!s} "
            f"staff={self.is_staff}>"
        )
