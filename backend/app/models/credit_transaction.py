"""Modelo ``credit_transactions`` (Fase 5 — feature ``credits``).

Histórico imutável (append-only) de toda movimentação de crédito. Sem
``updated_at``/``deleted_at``. Ver §2.9 do contrato.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.enums import CreditTransactionType
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.credit_wallet import CreditWallet

# Reexport para `from app.models.credit_transaction import ... CreditTransactionType`.
__all__ = ["CreditTransaction", "CreditTransactionType"]


class CreditTransaction(UUIDPKMixin, CreatedAtMixin, Base):
    """Registro imutável de uma movimentação de crédito."""

    __tablename__ = "credit_transactions"

    wallet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("credit_wallets.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    transaction_type: Mapped[CreditTransactionType] = mapped_column(
        Enum(
            CreditTransactionType,
            name="credit_transaction_type",
            native_enum=True,
            validate_strings=True,
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        index=True,
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    balance_before: Mapped[int] = mapped_column(Integer, nullable=False)
    balance_after: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Rastreabilidade da origem (ex.: lead_purchases.id); sem FK rígida (§2.9).
    reference_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    wallet: Mapped[CreditWallet] = relationship(
        "CreditWallet", back_populates="transactions"
    )

    __table_args__ = (
        # Paginação do histórico por carteira.
        Index("ix_credit_transactions_wallet_created", "wallet_id", "created_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return (
            f"<CreditTransaction id={self.id!s} type={self.transaction_type} "
            f"amount={self.amount}>"
        )
