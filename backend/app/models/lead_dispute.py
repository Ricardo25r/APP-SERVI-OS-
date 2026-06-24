"""Modelo ``lead_disputes`` — disputa de um lead comprado (reembolso sem GPS).

O profissional que comprou um lead pode contestá-lo (telefone inválido, cliente
não responde, pedido falso) e pedir reembolso. O admin resolve (reembolsa ou
recusa). Uma disputa por compra.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

__all__ = ["LeadDispute"]


class LeadDispute(UUIDPKMixin, CreatedAtMixin, Base):
    """Contestação de um lead comprado pelo profissional."""

    __tablename__ = "lead_disputes"

    purchase_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("lead_purchases.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    professional_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # telefone_invalido | sem_resposta | pedido_falso | duplicado | outro
    reason: Mapped[str] = mapped_column(String(40), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # open | refunded | rejected
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="open", server_default="open"
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<LeadDispute purchase={self.purchase_id!s} status={self.status}>"
