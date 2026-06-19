"""Abstração agnóstica de provedor de pagamento (Fase 6 — §3.2).

A feature de pagamentos depende **só** desta interface (``PaymentProvider``) e
dos DTOs (``ChargeResult``, ``ProviderEvent``). Trocar de provedor = trocar a
implementação concreta (``settings.PAYMENT_PROVIDER``) sem mexer no
service/rotas/modelos.
"""

from __future__ import annotations

import abc
from dataclasses import dataclass

from app.models import PaymentOrder, PaymentOrderStatus

__all__ = ["ChargeResult", "ProviderEvent", "PaymentProvider"]


@dataclass(frozen=True)
class ChargeResult:
    """Resultado de ``create_charge``: o que o provedor devolve ao criar a cobrança.

    - ``external_reference``: correlação webhook ↔ pedido (gravado no order).
    - ``pix_code``: copia-e-cola PIX (``None`` se for só checkout).
    - ``checkout_url``: URL de checkout (``None`` se for só PIX).
    """

    external_reference: str
    pix_code: str | None = None
    checkout_url: str | None = None


@dataclass(frozen=True)
class ProviderEvent:
    """Evento normalizado extraído do webhook do provedor.

    - ``external_reference``: qual cobrança/pedido o evento se refere.
    - ``status``: status normalizado (``paid|failed|refunded|...``).
    - ``provider_event_id``: id único do evento (idempotência — §2.4).
    - ``raw``: payload bruto (auditoria/log).
    """

    external_reference: str
    status: PaymentOrderStatus
    provider_event_id: str
    raw: dict | None = None


class PaymentProvider(abc.ABC):
    """Contrato agnóstico de provedor de pagamento (PIX/cartão — §3.2)."""

    # 'dev' | 'mercadopago' | 'stripe' ... (gravado em payment_orders.provider).
    slug: str

    @abc.abstractmethod
    async def create_charge(self, order: PaymentOrder) -> ChargeResult:
        """Cria a cobrança no provedor a partir do pedido (amount_cents, currency).

        Retorna ``external_reference`` + ``pix_code``/``checkout_url``. **Não**
        credita nada.
        """

    @abc.abstractmethod
    def verify_webhook(self, headers: dict[str, str], body: bytes) -> dict:
        """Valida a autenticidade do callback (assinatura HMAC) e devolve o
        payload já desserializado (``dict``).

        Lança :class:`WebhookSignatureError` (→ 401) se a assinatura for
        inválida/ausente. Recebe o corpo **cru** (``bytes``) para o HMAC.
        """

    @abc.abstractmethod
    def parse_event(self, payload: dict) -> ProviderEvent:
        """Normaliza o payload (já verificado) num :class:`ProviderEvent`.

        Lança :class:`ProviderError` (→ 422) se o payload não mapear para um
        evento conhecido.
        """
