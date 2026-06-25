"""Provedor de pagamento **Mercado Pago** (Checkout Pro — Pix + cartão).

Ativo por ``PAYMENT_PROVIDER=mercadopago``. ``create_charge`` cria uma
*preference* de Checkout Pro e devolve o ``init_point`` como ``checkout_url`` (a
página hospedada do MP oferece Pix, cartão e boleto). O webhook do MP traz
apenas o **id do pagamento**; ``parse_event`` consulta a API do MP
(``GET /v1/payments/{id}``) para ler o ``external_reference`` e o ``status``
reais — essa consulta **autenticada** é, por si só, a validação forte do evento
(um webhook forjado não consegue inventar um pagamento aprovado na nossa conta).
A assinatura ``x-signature`` é validada adicionalmente quando
``MERCADOPAGO_WEBHOOK_SECRET`` está definido.

Sem SDK externo: usa ``httpx`` (já é dependência). A consulta do webhook é
síncrona e rápida (volume de webhooks é baixo); a criação da cobrança é async.

Doc: https://www.mercadopago.com.br/developers/pt/docs
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging

import httpx

from app.core.config import settings
from app.models import PaymentOrder, PaymentOrderStatus
from app.services.payments.base import ChargeResult, PaymentProvider, ProviderEvent
from app.services.payments.exceptions import ProviderError, WebhookSignatureError

__all__ = ["MercadoPagoProvider"]

logger = logging.getLogger("faztudo.payments.mercadopago")

# status do pagamento no MP → status normalizado do pedido.
_MP_STATUS_TO_ORDER: dict[str, PaymentOrderStatus] = {
    "approved": PaymentOrderStatus.paid,
    "authorized": PaymentOrderStatus.paid,
    "refunded": PaymentOrderStatus.refunded,
    "charged_back": PaymentOrderStatus.refunded,
    "cancelled": PaymentOrderStatus.failed,
    "rejected": PaymentOrderStatus.failed,
}
# pendentes/em processamento → mantém ``pending`` (no-op no handle_event).
_MP_PENDING = {"pending", "in_process", "in_mediation"}

_TIMEOUT = 20.0


class MercadoPagoProvider(PaymentProvider):
    """Checkout Pro do Mercado Pago (Pix + cartão)."""

    slug = "mercadopago"

    # ------------------------------------------------------------------ #
    # Cobrança (preference)
    # ------------------------------------------------------------------ #
    async def create_charge(self, order: PaymentOrder) -> ChargeResult:
        external_reference = f"mp_{order.id}"
        base = settings.FRONTEND_URL.rstrip("/")
        preference = {
            "items": [
                {
                    "title": f"{order.credits} créditos FazTudo",
                    "quantity": 1,
                    "unit_price": round(order.amount_cents / 100, 2),
                    "currency_id": order.currency,
                }
            ],
            "external_reference": external_reference,
            "notification_url": f"{base}/api/v1/payments/webhook",
            "back_urls": {
                "success": f"{base}/credits?pagamento=sucesso",
                "pending": f"{base}/credits?pagamento=pendente",
                "failure": f"{base}/credits?pagamento=falha",
            },
            "auto_return": "approved",
        }
        async with httpx.AsyncClient(
            base_url=settings.MERCADOPAGO_API_BASE, timeout=_TIMEOUT
        ) as client:
            resp = await client.post(
                "/checkout/preferences",
                json=preference,
                headers=self._auth_headers(),
            )
        if resp.status_code >= 400:
            logger.error(
                "MP create preference falhou: %s %s",
                resp.status_code,
                resp.text[:500],
            )
            raise ProviderError("Falha ao criar a cobrança no Mercado Pago.")

        data = resp.json()
        checkout_url = data.get("init_point") or data.get("sandbox_init_point")
        if not checkout_url:
            raise ProviderError("Mercado Pago não devolveu o link de checkout.")
        return ChargeResult(
            external_reference=external_reference,
            pix_code=None,
            checkout_url=checkout_url,
        )

    # ------------------------------------------------------------------ #
    # Webhook
    # ------------------------------------------------------------------ #
    def verify_webhook(self, headers: dict[str, str], body: bytes) -> dict:
        try:
            payload = json.loads(body.decode("utf-8"))
        except (ValueError, UnicodeDecodeError) as exc:
            raise ProviderError("Corpo do webhook inválido.") from exc
        if not isinstance(payload, dict):
            raise ProviderError("Corpo do webhook inválido.")

        secret = settings.MERCADOPAGO_WEBHOOK_SECRET
        if secret:
            self._verify_signature(headers, payload, secret)
        else:
            logger.warning(
                "MERCADOPAGO_WEBHOOK_SECRET vazio — assinatura do webhook não "
                "validada (confiando na consulta autenticada à API do MP)."
            )
        return payload

    def parse_event(self, payload: dict) -> ProviderEvent:
        # Só tratamos notificações de pagamento (configure só "Pagamentos" no MP).
        topic = payload.get("type") or payload.get("topic")
        if topic != "payment":
            raise ProviderError(f"Tópico de webhook ignorado: {topic!r}.")

        data = payload.get("data") or {}
        payment_id = data.get("id") if isinstance(data, dict) else None
        if not payment_id:
            raise ProviderError("Webhook do Mercado Pago sem id de pagamento.")

        payment = self._fetch_payment(str(payment_id))
        external_reference = payment.get("external_reference")
        mp_status = payment.get("status")
        if not external_reference or not mp_status:
            raise ProviderError(
                "Pagamento do Mercado Pago sem referência/status."
            )

        status = _MP_STATUS_TO_ORDER.get(mp_status)
        if status is None:
            if mp_status in _MP_PENDING:
                status = PaymentOrderStatus.pending
            else:
                raise ProviderError(f"Status do MP desconhecido: {mp_status!r}.")

        return ProviderEvent(
            external_reference=str(external_reference),
            status=status,
            provider_event_id=str(payment_id),
            raw=payment,
        )

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #
    def _auth_headers(self) -> dict[str, str]:
        token = settings.MERCADOPAGO_ACCESS_TOKEN
        if not token:
            raise ProviderError("MERCADOPAGO_ACCESS_TOKEN não configurado.")
        return {"Authorization": f"Bearer {token}"}

    @staticmethod
    def _header(headers: dict[str, str], name: str) -> str | None:
        for key, value in headers.items():
            if key.lower() == name.lower():
                return value
        return None

    def _verify_signature(
        self, headers: dict[str, str], payload: dict, secret: str
    ) -> None:
        """Valida o ``x-signature`` do MP: manifesto
        ``id:<data.id>;request-id:<x-request-id>;ts:<ts>;`` em HMAC-SHA256."""
        signature = self._header(headers, "x-signature")
        request_id = self._header(headers, "x-request-id") or ""
        if not signature:
            raise WebhookSignatureError("Assinatura do webhook ausente.")

        parts: dict[str, str] = {}
        for item in signature.split(","):
            if "=" in item:
                k, v = item.split("=", 1)
                parts[k.strip()] = v.strip()
        ts = parts.get("ts")
        v1 = parts.get("v1")
        if not ts or not v1:
            raise WebhookSignatureError("Assinatura do webhook malformada.")

        data = payload.get("data")
        data_id = str(data["id"]) if isinstance(data, dict) and data.get("id") else ""
        manifest = f"id:{data_id};request-id:{request_id};ts:{ts};"
        expected = hmac.new(
            secret.encode("utf-8"), manifest.encode("utf-8"), hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(v1, expected):
            raise WebhookSignatureError("Assinatura do webhook inválida.")

    def _fetch_payment(self, payment_id: str) -> dict:
        """Consulta o pagamento no MP (autenticado) — fonte da verdade do status."""
        return self._get(f"/v1/payments/{payment_id}")

    def _get(self, path: str) -> dict:
        """GET autenticado na API do MP (síncrono — usado nos webhooks)."""
        try:
            with httpx.Client(
                base_url=settings.MERCADOPAGO_API_BASE, timeout=_TIMEOUT
            ) as client:
                resp = client.get(path, headers=self._auth_headers())
        except httpx.HTTPError as exc:
            raise ProviderError("Falha ao consultar o Mercado Pago.") from exc
        if resp.status_code == 404:
            raise ProviderError("Recurso não encontrado no Mercado Pago.")
        if resp.status_code >= 400:
            raise ProviderError("Erro ao consultar o Mercado Pago.")
        return resp.json()

    # ------------------------------------------------------------------ #
    # Assinatura recorrente (preapproval) — #56
    # ------------------------------------------------------------------ #
    async def create_subscription(
        self,
        *,
        external_reference: str,
        reason: str,
        amount_cents: int,
        currency: str,
        payer_email: str,
        back_url: str,
        free_trial_days: int = 0,
    ) -> tuple[str, str]:
        """Cria uma ``preapproval`` e devolve ``(preapproval_id, init_point)``."""
        base = settings.FRONTEND_URL.rstrip("/")
        auto_recurring: dict = {
            "frequency": 1,
            "frequency_type": "months",
            "transaction_amount": round(amount_cents / 100, 2),
            "currency_id": currency,
        }
        if free_trial_days > 0:
            auto_recurring["free_trial"] = {
                "frequency": free_trial_days,
                "frequency_type": "days",
            }
        body = {
            "reason": reason,
            "external_reference": external_reference,
            "payer_email": payer_email,
            "auto_recurring": auto_recurring,
            "back_url": back_url,
            "notification_url": f"{base}/api/v1/payments/webhook",
            "status": "pending",
        }
        async with httpx.AsyncClient(
            base_url=settings.MERCADOPAGO_API_BASE, timeout=_TIMEOUT
        ) as client:
            resp = await client.post(
                "/preapproval", json=body, headers=self._auth_headers()
            )
        if resp.status_code >= 400:
            logger.error(
                "MP preapproval falhou: %s %s",
                resp.status_code,
                resp.text[:500],
            )
            raise ProviderError("Falha ao criar a assinatura no Mercado Pago.")
        data = resp.json()
        init_point = data.get("init_point") or data.get("sandbox_init_point")
        sub_id = data.get("id")
        if not init_point or not sub_id:
            raise ProviderError(
                "Mercado Pago não devolveu o link da assinatura."
            )
        return str(sub_id), init_point

    def fetch_preapproval(self, preapproval_id: str) -> dict:
        """Estado de uma assinatura (``GET /preapproval/{id}``)."""
        return self._get(f"/preapproval/{preapproval_id}")

    def fetch_authorized_payment(self, payment_id: str) -> dict:
        """Cobrança de um ciclo (``GET /authorized_payments/{id}``)."""
        return self._get(f"/authorized_payments/{payment_id}")

    async def cancel_subscription(self, preapproval_id: str) -> None:
        """Cancela a assinatura no MP (``PUT /preapproval/{id}``)."""
        async with httpx.AsyncClient(
            base_url=settings.MERCADOPAGO_API_BASE, timeout=_TIMEOUT
        ) as client:
            resp = await client.put(
                f"/preapproval/{preapproval_id}",
                json={"status": "cancelled"},
                headers=self._auth_headers(),
            )
        if resp.status_code >= 400:
            logger.error(
                "MP cancelar preapproval falhou: %s %s",
                resp.status_code,
                resp.text[:300],
            )
            raise ProviderError(
                "Falha ao cancelar a assinatura no Mercado Pago."
            )
