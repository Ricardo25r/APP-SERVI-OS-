"""Pacote de pagamentos (Fase 6 — §3.1).

Reexporta a interface/DTOs do provedor, a factory e o service de orquestração
para conveniência. A orquestração fica em ``service.py`` (``PaymentService``) e
os provedores ao lado (``base.py``, ``dev.py``), evitando colisão arquivo↔pacote.
"""

from app.services.payments.base import (
    ChargeResult,
    PaymentProvider,
    ProviderEvent,
)
from app.services.payments.exceptions import ProviderError, WebhookSignatureError
from app.services.payments.factory import get_payment_provider
from app.services.payments.service import PaymentService

__all__ = [
    "ChargeResult",
    "ProviderEvent",
    "PaymentProvider",
    "get_payment_provider",
    "PaymentService",
    "ProviderError",
    "WebhookSignatureError",
]
