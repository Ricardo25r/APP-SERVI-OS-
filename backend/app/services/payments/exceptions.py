"""Exceções de domínio da feature ``payments`` (Fase 6).

Subclasses de :class:`DomainError` (§3.9) — o handler global em ``main.py`` as
converte em JSON ``{"detail": ...}`` com o status HTTP correspondente.

| Exceção                 | HTTP |
|-------------------------|------|
| WebhookSignatureError   | 401  |
| ProviderError           | 422  |
"""

from __future__ import annotations

from fastapi import status

from app.core.exceptions import DomainError

__all__ = ["WebhookSignatureError", "ProviderError"]


class WebhookSignatureError(DomainError):
    """Assinatura HMAC do webhook inválida/ausente (§3.2 / §9.1)."""

    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = "Assinatura do webhook inválida."


class ProviderError(DomainError):
    """Payload do provedor não mapeável / falha de provedor (§3.2)."""

    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_detail = "Evento do provedor inválido."
