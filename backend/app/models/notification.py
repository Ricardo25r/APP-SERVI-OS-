"""Modelo ``notifications`` (Fase 14 — notification engine, MVP).

Notificação in-app entregue a um usuário. Criada nos eventos do domínio (nova
mensagem, lead comprado, avaliação recebida, etc.). ``read_at`` nulo = não lida.
Entrega em tempo real (push/WebSocket) é deferida — aqui é leitura por polling.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

__all__ = ["Notification"]


class Notification(UUIDPKMixin, CreatedAtMixin, Base):
    """Notificação in-app de um usuário."""

    __tablename__ = "notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Categoria do evento (ex.: message, lead, review, credits, system).
    type: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # Destino interno opcional ao clicar (ex.: /conversas/{id}).
    href: Mapped[str | None] = mapped_column(String(512), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        Index("ix_notifications_user_created", "user_id", "created_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<Notification {self.type!s} user={self.user_id!s}>"
