"""Provedor de pagamento DEV (Fase 6 — §3.3). Ativo por ``PAYMENT_PROVIDER=dev``.

Cria cobranças **fake determinísticas** (sem rede) e valida o webhook com a
**mesma** verificação HMAC do caminho real. O endpoint
``POST /payments/dev/confirm/{order_id}`` assina internamente o corpo com o
mesmo secret (:func:`sign_payload`) e chama o mesmo handler do webhook — sem
atalho que mascare bugs de assinatura (§3.3 / decisão §10.7).
"""

from __future__ import annotations

import hashlib
import hmac
import json

from app.core.config import settings
from app.models import PaymentOrder, PaymentOrderStatus
from app.services.payments.base import ChargeResult, PaymentProvider, ProviderEvent
from app.services.payments.exceptions import ProviderError, WebhookSignatureError

__all__ = ["DevPaymentProvider", "SIGNATURE_HEADER", "compute_signature", "sign_payload"]

# Header que carrega a assinatura HMAC-SHA256 hex do corpo cru (§3.3 / §9.1).
SIGNATURE_HEADER = "X-Webhook-Signature"

# type do payload do provedor → status normalizado (§3.3).
_EVENT_TYPE_TO_STATUS: dict[str, PaymentOrderStatus] = {
    "payment.paid": PaymentOrderStatus.paid,
    "payment.failed": PaymentOrderStatus.failed,
    "payment.refunded": PaymentOrderStatus.refunded,
}


def compute_signature(body: bytes) -> str:
    """HMAC-SHA256 hex do corpo cru com ``PAYMENT_WEBHOOK_SECRET`` (§9.1)."""
    return hmac.new(
        settings.PAYMENT_WEBHOOK_SECRET.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()


def sign_payload(payload: dict) -> tuple[bytes, dict[str, str]]:
    """Serializa o payload e devolve ``(body, headers)`` com a assinatura HMAC.

    Usado pelo endpoint dev ``/payments/dev/confirm`` para assinar internamente o
    corpo e passar pela **mesma** verificação do webhook real (§3.3).
    """
    body = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    headers = {SIGNATURE_HEADER: compute_signature(body)}
    return body, headers


class DevPaymentProvider(PaymentProvider):
    """Provedor fake para dev/testes (sem chaves externas, sem rede)."""

    slug = "dev"

    async def create_charge(self, order: PaymentOrder) -> ChargeResult:
        """Gera valores fake determinísticos a partir do pedido (§3.3)."""
        external_reference = f"dev_{order.id}"
        order_hex = order.id.hex[:8]
        pix_code = f"00020126DEV{order_hex}5204000053039865802BR6007FAZTUDO"
        checkout_url = f"{settings.PAYMENT_DEV_CHECKOUT_BASE}/{order.id}"
        return ChargeResult(
            external_reference=external_reference,
            pix_code=pix_code,
            checkout_url=checkout_url,
        )

    def verify_webhook(self, headers: dict[str, str], body: bytes) -> dict:
        """Valida o ``X-Webhook-Signature`` (HMAC) e devolve o payload (§3.3).

        Comparação ``hmac.compare_digest`` (resistente a timing). Assinatura
        inválida/ausente → :class:`WebhookSignatureError` (401). Corpo não-JSON
        → :class:`ProviderError` (422).
        """
        # Header case-insensitive (gateways variam a capitalização).
        provided = None
        for key, value in headers.items():
            if key.lower() == SIGNATURE_HEADER.lower():
                provided = value
                break
        if not provided:
            raise WebhookSignatureError("Assinatura do webhook ausente.")

        expected = compute_signature(body)
        if not hmac.compare_digest(provided, expected):
            raise WebhookSignatureError("Assinatura do webhook inválida.")

        try:
            payload = json.loads(body.decode("utf-8"))
        except (ValueError, UnicodeDecodeError) as exc:
            raise ProviderError("Corpo do webhook inválido.") from exc
        if not isinstance(payload, dict):
            raise ProviderError("Corpo do webhook inválido.")
        return payload

    def parse_event(self, payload: dict) -> ProviderEvent:
        """Normaliza ``{external_reference, event_id, type}`` num ProviderEvent."""
        external_reference = payload.get("external_reference")
        event_id = payload.get("event_id")
        event_type = payload.get("type")
        if not external_reference or not event_id or not event_type:
            raise ProviderError("Payload do evento incompleto.")

        status = _EVENT_TYPE_TO_STATUS.get(event_type)
        if status is None:
            raise ProviderError(f"Tipo de evento desconhecido: {event_type!r}.")

        return ProviderEvent(
            external_reference=str(external_reference),
            status=status,
            provider_event_id=str(event_id),
            raw=payload,
        )
