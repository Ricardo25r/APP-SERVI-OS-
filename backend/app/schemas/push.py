"""Schemas Pydantic da feature ``push`` (Web Push VAPID)."""

from __future__ import annotations

from pydantic import BaseModel, Field

__all__ = [
    "PushKeys",
    "PushSubscriptionIn",
    "PushUnsubscribeIn",
    "PushPublicKeyOut",
]


class PushKeys(BaseModel):
    """Chaves da inscrição (geradas pelo navegador)."""

    p256dh: str = Field(min_length=1, max_length=255)
    auth: str = Field(min_length=1, max_length=255)


class PushSubscriptionIn(BaseModel):
    """Corpo de ``POST /push/subscribe`` — o ``PushSubscription`` do navegador."""

    endpoint: str = Field(min_length=1, max_length=2000)
    keys: PushKeys


class PushUnsubscribeIn(BaseModel):
    """Corpo de ``POST /push/unsubscribe``."""

    endpoint: str = Field(min_length=1, max_length=2000)


class PushPublicKeyOut(BaseModel):
    """``GET /push/public-key`` — a chave pública VAPID (aplicationServerKey)."""

    public_key: str
