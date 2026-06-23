"""Modelo ``payment_settings`` — dados de recebimento (Pix + banco) editáveis
no painel admin e exibidos ao comprador no fluxo de **Pix/transferência manual**.

Linha única (singleton): o service faz get-or-create. Sem segredos — são dados
para o cliente pagar (chave Pix, banco, agência, conta, titular).
"""

from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin

__all__ = ["PaymentSettings"]


class PaymentSettings(UUIDPKMixin, TimestampMixin, Base):
    """Dados de recebimento para pagamento manual (singleton)."""

    __tablename__ = "payment_settings"

    pix_key: Mapped[str | None] = mapped_column(String(140), nullable=True)
    pix_key_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    recipient_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    bank_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    bank_agency: Mapped[str | None] = mapped_column(String(20), nullable=True)
    bank_account: Mapped[str | None] = mapped_column(String(30), nullable=True)
    bank_account_type: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )
    holder_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    holder_document: Mapped[str | None] = mapped_column(String(20), nullable=True)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<PaymentSettings id={self.id!s}>"
