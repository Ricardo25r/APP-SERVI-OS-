"""Modelo ``notification_preferences`` — preferências de push do usuário (#53).

Permite ao usuário desligar categorias de notificação push (conversa, novos
pedidos, novidades/marketing). Categorias transacionais (KYC, suporte, avaliação,
disputa) são sempre enviadas. Ausência de linha = tudo permitido (padrão opt-in).
"""

from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

__all__ = ["NotificationPreference"]


class NotificationPreference(UUIDPKMixin, CreatedAtMixin, Base):
    """Preferências de push de um usuário (1:1)."""

    __tablename__ = "notification_preferences"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    allow_chat: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    allow_leads: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    allow_marketing: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return (
            f"<NotificationPreference user={self.user_id!s} "
            f"chat={self.allow_chat} leads={self.allow_leads} "
            f"mkt={self.allow_marketing}>"
        )
