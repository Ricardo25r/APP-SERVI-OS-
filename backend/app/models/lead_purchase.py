"""Modelo ``lead_purchases`` (Fase 5 — feature ``lead_purchases``).

Compra de lead (Lead Exclusivo). Append-only. ``lead_id`` UNIQUE — o primeiro
profissional que comprar leva o lead. Ver §2.10 do contrato.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.lead import Lead
    from app.models.professional_profile import ProfessionalProfile

__all__ = ["LeadPurchase"]


class LeadPurchase(UUIDPKMixin, CreatedAtMixin, Base):
    """Compra exclusiva de um lead por um profissional."""

    __tablename__ = "lead_purchases"

    lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leads.id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,  # Lead Exclusivo (§1.6 / §2.10).
    )
    professional_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("professional_profiles.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    credits_used: Mapped[int] = mapped_column(Integer, nullable=False)
    purchased_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    # Prazo p/ iniciar o contato após desbloquear (purchased_at + janela).
    contact_deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Confirmação de serviço (anti no-show): código de chegada (o cliente mostra,
    # o profissional digita ao chegar), carimbo de chegada e prazo de segurança
    # p/ reabrir a vaga automaticamente se a chegada não for confirmada.
    arrival_code: Mapped[str | None] = mapped_column(String(8), nullable=True)
    arrived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    no_show_deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    lead: Mapped[Lead] = relationship("Lead", back_populates="purchase")
    professional: Mapped[ProfessionalProfile] = relationship(
        "ProfessionalProfile", back_populates="purchases"
    )

    __table_args__ = (
        # Histórico de compras do profissional.
        Index(
            "ix_lead_purchases_professional_purchased",
            "professional_id",
            "purchased_at",
        ),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return (
            f"<LeadPurchase id={self.id!s} lead_id={self.lead_id!s} "
            f"professional_id={self.professional_id!s}>"
        )
