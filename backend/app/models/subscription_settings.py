"""Configuração da assinatura (plano PRO) — editável no admin (#56).

Singleton get-or-create (mesmo padrão de ``PaymentSettings``). **``enabled``
começa FALSE** — a modalidade fica pronta porém desligada; o dono liga e ajusta
os valores no painel admin sem precisar de deploy.
"""

from __future__ import annotations

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin

__all__ = ["SubscriptionSettings"]


class SubscriptionSettings(UUIDPKMixin, TimestampMixin, Base):
    """Parâmetros do plano de assinatura, editáveis pelo admin."""

    __tablename__ = "subscription_settings"

    # Liga/desliga geral da modalidade (entregue DESLIGADO).
    enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false", default=False
    )
    plan_name: Mapped[str] = mapped_column(
        String(80), nullable=False,
        server_default="FazTudo PRO", default="FazTudo PRO",
    )
    # Preço mensal em centavos (4990 = R$ 49,90).
    price_cents: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="4990", default=4990
    )
    included_credits: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="15", default=15
    )
    # Desconto (%) no crédito avulso para assinante.
    discount_pct: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="20", default=20
    )
    trial_days: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="7", default=7
    )
    trial_credits: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="5", default=5
    )
