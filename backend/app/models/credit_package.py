"""Modelo ``credit_packages`` (Fase 6 — feature ``payments``).

Catálogo de pacotes de créditos. **Sem soft delete** (usa ``active`` para
desativar — mesmo padrão de ``categories``). Preço em **centavos** (``int``),
nunca float (regra de dinheiro do payment-engine). Ver §2.2 do contrato.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.payment_order import PaymentOrder

__all__ = ["CreditPackage"]


class CreditPackage(UUIDPKMixin, TimestampMixin, Base):
    """Pacote de créditos comprável (preço em centavos de BRL)."""

    __tablename__ = "credit_packages"

    name: Mapped[str] = mapped_column(
        String(80), nullable=False, unique=True
    )
    credits: Mapped[int] = mapped_column(Integer, nullable=False)
    # Valor em centavos (ex.: R$ 19,90 → 1990). Nunca float (§2.2).
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="BRL", server_default=text("'BRL'")
    )
    active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
        index=True,
    )
    # Vitrine (Tela 05): selo "X% OFF" (marketing) e destaque "Mais escolhido".
    discount_percent: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    is_popular: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )

    # Relacionamentos (§2.2).
    orders: Mapped[list[PaymentOrder]] = relationship(
        "PaymentOrder",
        back_populates="package",
    )

    __table_args__ = (
        CheckConstraint("credits > 0", name="ck_credit_packages_credits_positive"),
        CheckConstraint(
            "price_cents >= 0", name="ck_credit_packages_price_non_negative"
        ),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return (
            f"<CreditPackage id={self.id!s} name={self.name!r} "
            f"credits={self.credits} price_cents={self.price_cents}>"
        )
