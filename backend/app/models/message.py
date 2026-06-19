"""Modelo ``messages`` (Fase 8 — feature ``chat``).

Mensagem de texto trocada numa :class:`Conversation`. O campo de conteúdo é
``message`` (nome oficial do schema — doc 04 §MESSAGES; o chat-engine adota
``message`` e **não** ``content`` — §10.4).

Modelagem:
- ``conversation_id`` FK → ``conversations.id`` (índice composto
  ``(conversation_id, created_at)`` para o histórico paginado — doc 04).
- ``sender_id`` FK → ``users.id`` (autor; um dos dois participantes da conversa).
  Mensagens de sistema do MVP usam o ``professional_id`` como remetente (ver
  service / observações — ``message_type``/``is_system`` são deferidos).
- ``read_at`` nullable — recibo de leitura (extensão do chat-engine §4); marcado
  quando a contraparte abre o histórico (``GET .../messages``).

Append-only: usa apenas ``created_at`` (mensagens são imutáveis no MVP; sem
edição). ``deleted_at``/soft delete e moderação avançada são deferidos.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.conversation import Conversation
    from app.models.user import User

__all__ = ["Message"]


class Message(UUIDPKMixin, CreatedAtMixin, Base):
    """Mensagem de texto de uma conversa (campo de conteúdo: ``message``)."""

    __tablename__ = "messages"

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relacionamentos.
    conversation: Mapped[Conversation] = relationship(
        "Conversation", back_populates="messages"
    )
    sender: Mapped[User] = relationship("User", foreign_keys=[sender_id])

    __table_args__ = (
        # Histórico paginado por conversa em ordem cronológica (doc 04 / §3.11).
        Index("ix_messages_conversation_created", "conversation_id", "created_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return (
            f"<Message id={self.id!s} conversation_id={self.conversation_id!s} "
            f"sender_id={self.sender_id!s}>"
        )
