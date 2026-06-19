"""Modelo ``credit_wallets`` (Fase 5 — feature ``credits``).

Carteira de créditos do profissional. 1:1 com ``professional_profiles``.
Sem soft delete. Saldo nunca negativo (CHECK). Ver §2.8 do contrato.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, Integer, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.credit_transaction import CreditTransaction
    from app.models.professional_profile import ProfessionalProfile

__all__ = ["CreditWallet"]


class CreditWallet(UUIDPKMixin, TimestampMixin, Base):
    """Carteira 1:1 do profissional (saldo de créditos)."""

    __tablename__ = "credit_wallets"

    professional_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("professional_profiles.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    balance: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )

    professional: Mapped[ProfessionalProfile] = relationship(
        "ProfessionalProfile", back_populates="wallet"
    )
    transactions: Mapped[list[CreditTransaction]] = relationship(
        "CreditTransaction",
        back_populates="wallet",
    )

    __table_args__ = (
        CheckConstraint("balance >= 0", name="ck_credit_wallets_balance_non_negative"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return (
            f"<CreditWallet id={self.id!s} professional_id={self.professional_id!s} "
            f"balance={self.balance}>"
        )
