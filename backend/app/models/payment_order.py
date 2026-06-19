"""Modelo ``payment_orders`` (Fase 6 — feature ``payments``).

Pedido de compra de um pacote de créditos. **Sem soft delete** (transações
financeiras nunca são apagadas — o "cancelamento" é uma transição de
``status``). Valores monetários em **centavos** (``int``). Ver §2.3 do contrato.

**Idempotência (§2.4):** ``external_reference`` UNIQUE (correlação 1:1
cobrança↔pedido) + ``provider_event_id`` UNIQUE (de-duplicação do evento que
confirmou). ``amount_cents``/``credits``/``currency`` são **snapshots** imutáveis
do pacote no momento da criação (financeiro auditável).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.enums import PaymentOrderStatus
from app.models.mixins import TimestampMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.credit_package import CreditPackage
    from app.models.user import User

# Reexport para `from app.models.payment_order import PaymentOrder, PaymentOrderStatus`.
__all__ = ["PaymentOrder", "PaymentOrderStatus"]


class PaymentOrder(UUIDPKMixin, TimestampMixin, Base):
    """Pedido de compra de um pacote (mutável só nas transições de status §5)."""

    __tablename__ = "payment_orders"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    package_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("credit_packages.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    # Slug do provedor que gerou a cobrança (de settings.PAYMENT_PROVIDER).
    provider: Mapped[str] = mapped_column(String(20), nullable=False)
    # Snapshots imutáveis do pacote no momento da criação (§2.3).
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    credits: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="BRL", server_default="BRL"
    )
    status: Mapped[PaymentOrderStatus] = mapped_column(
        Enum(
            PaymentOrderStatus,
            name="payment_order_status",
            native_enum=True,
            validate_strings=True,
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        default=PaymentOrderStatus.pending,
        server_default=PaymentOrderStatus.pending.value,
        index=True,
    )
    # Correlação webhook ↔ pedido (chave de idempotência — §2.4).
    external_reference: Mapped[str] = mapped_column(
        String(120), nullable=False, unique=True, index=True
    )
    # Id do evento que confirmou (UNIQUE → o mesmo evento não credita 2× — §2.4).
    provider_event_id: Mapped[str | None] = mapped_column(
        String(120), nullable=True, unique=True
    )
    pix_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    checkout_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    refunded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    failed_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # FK lógica → credit_transactions.id (sem FK rígida — padrão reference_id §2.3).
    credit_transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    # Relacionamentos (§2.3).
    user: Mapped[User] = relationship("User", foreign_keys=[user_id])
    package: Mapped[CreditPackage] = relationship(
        "CreditPackage", back_populates="orders"
    )

    __table_args__ = (
        CheckConstraint(
            "amount_cents >= 0", name="ck_payment_orders_amount_non_negative"
        ),
        # Listagem paginada do próprio histórico (§2.3).
        Index("ix_payment_orders_user_created", "user_id", "created_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return (
            f"<PaymentOrder id={self.id!s} status={self.status} "
            f"amount_cents={self.amount_cents} credits={self.credits}>"
        )
