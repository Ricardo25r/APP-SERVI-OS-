"""Modelo ``support_tickets`` (Fase 15 — chamados de suporte).

Um chamado aberto por um usuário na Central de Suporte. ``status`` simples
(``open``/``closed``) — gestão/respostas pelo admin ficam para uma evolução; no
MVP o chamado é registrado e o dono é notificado por e-mail.
"""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

__all__ = ["SupportTicket"]


class SupportTicket(UUIDPKMixin, CreatedAtMixin, Base):
    """Chamado de suporte aberto por um usuário."""

    __tablename__ = "support_tickets"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    subject: Mapped[str] = mapped_column(String(160), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    # open | closed (string simples — sem enum no banco para o MVP).
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="open", server_default="open"
    )

    __table_args__ = (
        Index("ix_support_tickets_user_created", "user_id", "created_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<SupportTicket {self.subject!r} status={self.status}>"
