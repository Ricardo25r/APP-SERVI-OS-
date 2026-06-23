"""Testes do :class:`ManualPixProvider` (Pix manual, sem gateway)."""

from __future__ import annotations

import uuid

import pytest
from app.core.config import settings
from app.models import PaymentOrder
from app.services.payments.exceptions import ProviderError
from app.services.payments.manual_pix import ManualPixProvider


def _order() -> PaymentOrder:
    order = PaymentOrder(
        user_id=uuid.uuid4(),
        package_id=uuid.uuid4(),
        provider="manual_pix",
        amount_cents=1990,
        credits=20,
        currency="BRL",
    )
    order.id = uuid.uuid4()
    return order


@pytest.mark.asyncio
async def test_manual_pix_create_charge_returns_key(monkeypatch) -> None:
    monkeypatch.setattr(settings, "MANUAL_PIX_KEY", "minha-chave-pix")
    result = await ManualPixProvider().create_charge(_order())
    assert result.pix_code == "minha-chave-pix"
    assert result.checkout_url is None
    assert result.external_reference.startswith("manual_")


@pytest.mark.asyncio
async def test_manual_pix_requires_key(monkeypatch) -> None:
    monkeypatch.setattr(settings, "MANUAL_PIX_KEY", "")
    with pytest.raises(ProviderError):
        await ManualPixProvider().create_charge(_order())
