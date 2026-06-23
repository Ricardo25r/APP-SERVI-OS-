"""Provedor de pagamento **Pix MANUAL** (sem gateway).

Ativo por ``PAYMENT_PROVIDER=manual_pix``. Permite vender créditos **sem**
Mercado Pago: o profissional cria o pedido, vê a **chave Pix do dono**
(copia-e-cola) e paga pelo próprio banco; o pagamento é confirmado pelo **admin**
(que recebe o Pix) via ``POST /payments/orders/{id}/confirmar``. Não há webhook.
"""

from __future__ import annotations

from app.core.config import settings
from app.models import PaymentOrder
from app.services.payments.base import (
    ChargeResult,
    PaymentProvider,
    ProviderEvent,
)
from app.services.payments.exceptions import ProviderError, WebhookSignatureError

__all__ = ["ManualPixProvider"]


class ManualPixProvider(PaymentProvider):
    """Pix manual: mostra a chave do dono; a confirmação é feita pelo admin."""

    slug = "manual_pix"

    async def create_charge(self, order: PaymentOrder) -> ChargeResult:
        key = settings.MANUAL_PIX_KEY
        if not key:
            raise ProviderError("Chave Pix (MANUAL_PIX_KEY) não configurada.")
        return ChargeResult(
            external_reference=f"manual_{order.id}",
            pix_code=key,
            checkout_url=None,
        )

    def verify_webhook(self, headers: dict[str, str], body: bytes) -> dict:
        # Modo manual não recebe webhook — a confirmação é do admin.
        raise WebhookSignatureError("Pix manual não usa webhook.")

    def parse_event(self, payload: dict) -> ProviderEvent:
        raise ProviderError("Pix manual não usa webhook.")
