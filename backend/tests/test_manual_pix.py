"""Teste do :class:`ManualPixProvider` (Pix manual — os dados de recebimento
vêm do painel admin via ``payment_settings``, não de variável de ambiente)."""

from __future__ import annotations

import uuid

import pytest
from app.models import PaymentOrder
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
async def test_manual_pix_create_charge() -> None:
    result = await ManualPixProvider().create_charge(_order())
    assert result.external_reference.startswith("manual_")
    assert result.pix_code is None
    assert result.checkout_url is None
