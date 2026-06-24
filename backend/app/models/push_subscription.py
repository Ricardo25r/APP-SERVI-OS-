"""Modelo ``push_subscriptions`` (Web Push — notificação com o app fechado).

Guarda a inscrição Web Push (``endpoint`` + chaves ``p256dh``/``auth``) de um
dispositivo/navegador do usuário. O backend usa isso para enviar push via VAPID
(``pywebpush``). ``endpoint`` é único; inscrições mortas (404/410 ao enviar) são
removidas. Um usuário pode ter várias (vários dispositivos).
"""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

__all__ = ["PushSubscription"]


class PushSubscription(UUIDPKMixin, CreatedAtMixin, Base):
    """Inscrição Web Push de um dispositivo do usuário."""

    __tablename__ = "push_subscriptions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # URL do push service (FCM/Mozilla/Apple). Único por inscrição.
    endpoint: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    # Chaves da inscrição (criptografia da mensagem — geradas pelo navegador).
    p256dh: Mapped[str] = mapped_column(String(255), nullable=False)
    auth: Mapped[str] = mapped_column(String(255), nullable=False)
    user_agent: Mapped[str | None] = mapped_column(String(400), nullable=True)

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<PushSubscription user={self.user_id!s}>"
