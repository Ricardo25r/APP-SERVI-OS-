"""Testes do :class:`MercadoPagoProvider` (Checkout Pro) com ``httpx`` mockado.

Cobre: criação da preference (checkout_url), parse do webhook consultando a API
do MP (status approved → paid), tópico não-pagamento ignorado e validação da
assinatura ``x-signature`` (válida/ inválida/ ausente). Sem rede real.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import uuid

import httpx
import pytest
from app.core.config import settings
from app.models import PaymentOrder, PaymentOrderStatus
from app.services.payments.exceptions import ProviderError, WebhookSignatureError
from app.services.payments.mercadopago import MercadoPagoProvider


@pytest.fixture(autouse=True)
def _mp_env(monkeypatch):
    monkeypatch.setattr(settings, "MERCADOPAGO_ACCESS_TOKEN", "test-token")
    monkeypatch.setattr(settings, "MERCADOPAGO_API_BASE", "https://api.mercadopago.com")
    monkeypatch.setattr(settings, "MERCADOPAGO_WEBHOOK_SECRET", "")


def _order() -> PaymentOrder:
    order = PaymentOrder(
        user_id=uuid.uuid4(),
        package_id=uuid.uuid4(),
        provider="mercadopago",
        amount_cents=1990,
        credits=20,
        currency="BRL",
    )
    order.id = uuid.uuid4()
    return order


@pytest.mark.asyncio
async def test_create_charge_returns_checkout_url(monkeypatch) -> None:
    order = _order()

    async def fake_post(self, url, **kwargs):
        assert "/checkout/preferences" in url
        assert kwargs["headers"]["Authorization"] == "Bearer test-token"
        return httpx.Response(
            201,
            json={"id": "pref1", "init_point": "https://mp/checkout/pref1"},
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    result = await MercadoPagoProvider().create_charge(order)
    assert result.checkout_url == "https://mp/checkout/pref1"
    assert result.external_reference == f"mp_{order.id}"
    assert result.pix_code is None


def test_parse_event_paid_fetches_payment(monkeypatch) -> None:
    ext = f"mp_{uuid.uuid4()}"

    def fake_get(self, url, **kwargs):
        assert "/v1/payments/9999" in url
        return httpx.Response(
            200,
            json={"id": 9999, "status": "approved", "external_reference": ext},
            request=httpx.Request("GET", url),
        )

    monkeypatch.setattr(httpx.Client, "get", fake_get)

    event = MercadoPagoProvider().parse_event(
        {"type": "payment", "data": {"id": "9999"}}
    )
    assert event.status == PaymentOrderStatus.paid
    assert event.external_reference == ext
    assert event.provider_event_id == "9999"


def test_parse_event_pending(monkeypatch) -> None:
    def fake_get(self, url, **kwargs):
        return httpx.Response(
            200,
            json={"id": 1, "status": "in_process", "external_reference": "mp_x"},
            request=httpx.Request("GET", url),
        )

    monkeypatch.setattr(httpx.Client, "get", fake_get)
    event = MercadoPagoProvider().parse_event({"type": "payment", "data": {"id": "1"}})
    assert event.status == PaymentOrderStatus.pending


def test_parse_event_ignores_non_payment_topic() -> None:
    with pytest.raises(ProviderError):
        MercadoPagoProvider().parse_event(
            {"type": "merchant_order", "data": {"id": "1"}}
        )


def test_verify_webhook_skips_without_secret() -> None:
    payload = {"type": "payment", "data": {"id": "1"}}
    body = json.dumps(payload).encode()
    assert MercadoPagoProvider().verify_webhook({}, body) == payload


def test_verify_webhook_validates_signature(monkeypatch) -> None:
    monkeypatch.setattr(settings, "MERCADOPAGO_WEBHOOK_SECRET", "shh")
    payload = {"type": "payment", "data": {"id": "777"}}
    body = json.dumps(payload).encode()
    ts, request_id = "1700000000", "req-1"
    manifest = f"id:777;request-id:{request_id};ts:{ts};"
    v1 = hmac.new(b"shh", manifest.encode(), hashlib.sha256).hexdigest()

    ok_headers = {"x-signature": f"ts={ts},v1={v1}", "x-request-id": request_id}
    assert MercadoPagoProvider().verify_webhook(ok_headers, body) == payload

    bad_headers = {"x-signature": f"ts={ts},v1=deadbeef", "x-request-id": request_id}
    with pytest.raises(WebhookSignatureError):
        MercadoPagoProvider().verify_webhook(bad_headers, body)

    with pytest.raises(WebhookSignatureError):
        MercadoPagoProvider().verify_webhook({}, body)  # assinatura ausente
