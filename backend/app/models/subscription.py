"""Assinatura recorrente do profissional (#56).

Uma linha por profissional (1:1). O ``status`` e o ``current_period_end`` são a
**fonte da verdade do entitlement** (``is_entitled`` derivado). O flag
denormalizado ``professional_profiles.premium`` é mantido em sincronia pelo
serviço (usado em ordenação/selo, sem precisar consultar esta tabela em toda
query). Provider-agnóstico (hoje Mercado Pago via ``preapproval``).

``status``: ``pending`` (criada, aguardando 1ª cobrança) · ``active`` ·
``past_due`` (cobrança falhou, em carência) · ``canceled`` · ``expired``.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin

__all__ = ["Subscription"]


class Subscription(UUIDPKMixin, TimestampMixin, Base):
    """Estado da assinatura de um profissional."""

    __tablename__ = "subscriptions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="pending", default="pending"
    )
    provider: Mapped[str] = mapped_column(
        String(20), nullable=False,
        server_default="mercadopago", default="mercadopago",
    )
    # id da preapproval no Mercado Pago.
    provider_sub_id: Mapped[str | None] = mapped_column(
        String(120), nullable=True, unique=True, index=True
    )
    current_period_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    trial_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    grace_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    canceled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Último authorized_payment processado (idempotência da concessão por ciclo).
    last_payment_id: Mapped[str | None] = mapped_column(
        String(120), nullable=True
    )
    # Marca se já recebeu os créditos de cortesia do trial (concede 1x só).
    trial_granted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false", default=False
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return (
            f"<Subscription user={self.user_id!s} status={self.status} "
            f"sub={self.provider_sub_id!r}>"
        )
