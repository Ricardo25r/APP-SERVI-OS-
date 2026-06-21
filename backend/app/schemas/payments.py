"""Schemas Pydantic v2 da feature ``payments`` (Fase 6).

Contrato §4.1 (Fase 6 — Pagamentos) e §2.2/§2.3 (modelo). Padrão de nomes do
contrato §3.3.

Regras de exposição / mass assignment (§4.1): o cliente **nunca** envia
``amount_cents``, ``credits``, ``status``, ``user_id`` ou ``external_reference``
— todos derivados do pacote/servidor. ``CreateOrderIn`` só carrega ``package_id``.

Os aliases ``PackageOut``/``CreateOrderIn``/``OrderOut``/``RefundResult`` pedidos
na tarefa apontam para os schemas canônicos do contrato.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import PaymentOrderStatus

__all__ = [
    "CreditPackageRead",
    "PaymentOrderCreate",
    "PaymentOrderRead",
    "PaymentOrderListResponse",
    "DevConfirmRequest",
    "RefundRequest",
    "WebhookReceived",
    "RefundResult",
    # Aliases pedidos pela tarefa.
    "PackageOut",
    "CreateOrderIn",
    "OrderOut",
]


# --------------------------------------------------------------------------- #
# Saída
# --------------------------------------------------------------------------- #
class CreditPackageRead(BaseModel):
    """Pacote de créditos (``CreditPackageRead`` do contrato §4.1).

    ``price_cents`` é o valor em centavos; o front formata (``price_cents/100``).
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    credits: int
    price_cents: int
    currency: str
    active: bool
    discount_percent: int = 0
    is_popular: bool = False


class PaymentOrderRead(BaseModel):
    """Pedido de compra (``PaymentOrderRead`` do contrato §4.1).

    Expõe ``pix_code``/``checkout_url`` para o front exibir a cobrança e o
    ``status`` para o acompanhamento.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    package_id: uuid.UUID
    provider: str
    amount_cents: int
    credits: int
    currency: str
    status: PaymentOrderStatus
    external_reference: str
    pix_code: str | None = None
    checkout_url: str | None = None
    paid_at: datetime | None = None
    refunded_at: datetime | None = None
    created_at: datetime


class PaymentOrderListResponse(BaseModel):
    """Envelope paginado (§4: ``{items, page, page_size, total}``)."""

    items: list[PaymentOrderRead]
    page: int
    page_size: int
    total: int


class WebhookReceived(BaseModel):
    """Resposta do webhook (sempre ``200`` em evento válido — §4 #5)."""

    received: bool = True


# --------------------------------------------------------------------------- #
# Entrada
# --------------------------------------------------------------------------- #
class PaymentOrderCreate(BaseModel):
    """Corpo de ``POST /payments/orders`` (professional).

    Único campo do cliente (mass-assignment safe — §4.1). ``user_id``,
    ``amount_cents``, ``credits``, ``currency``, ``status`` e ``external_reference``
    são derivados do servidor a partir do pacote e do ``current_user``.
    """

    package_id: uuid.UUID


class DevConfirmRequest(BaseModel):
    """Corpo de ``POST /payments/dev/confirm/{order_id}`` (dev-only — §4 #6)."""

    event: Literal["paid", "failed", "refunded"] = "paid"


class RefundRequest(BaseModel):
    """Corpo de ``POST /payments/orders/{id}/refund`` (admin — §4 #7)."""

    model_config = ConfigDict(str_strip_whitespace=True)

    reason: str | None = Field(default=None, max_length=255)


# --------------------------------------------------------------------------- #
# Aliases pedidos pela tarefa
# --------------------------------------------------------------------------- #
PackageOut = CreditPackageRead
CreateOrderIn = PaymentOrderCreate
OrderOut = PaymentOrderRead
# RefundResult: o contrato devolve o ``PaymentOrderRead`` atualizado (status
# refunded). Alias canônico para o que a tarefa chama de ``RefundResult``.
RefundResult = PaymentOrderRead
