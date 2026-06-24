"""Rotas da feature ``push`` (Web Push VAPID) — ``router = APIRouter()``.

Prefixo ``/push`` é aplicado pelo agregador (``app.api.__init__``).

- ``GET  /push/public-key``  → público, a chave pública VAPID (applicationServerKey).
- ``POST /push/subscribe``   → JWT, registra a inscrição do dispositivo (201).
- ``POST /push/unsubscribe`` → JWT, remove a inscrição pelo endpoint (200).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.ratelimit import rate_limit
from app.database.session import get_db
from app.models import User
from app.schemas.push import (
    PushPublicKeyOut,
    PushSubscriptionIn,
    PushUnsubscribeIn,
)
from app.services.push import PushService

router = APIRouter()


@router.get(
    "/public-key",
    response_model=PushPublicKeyOut,
    summary="Chave pública VAPID (Web Push)",
)
async def public_key() -> PushPublicKeyOut:
    """A chave pública VAPID usada pelo navegador no ``pushManager.subscribe``.
    Vazia se o Web Push não estiver configurado no servidor."""
    return PushPublicKeyOut(public_key=settings.VAPID_PUBLIC_KEY)


@router.post(
    "/subscribe",
    status_code=status.HTTP_201_CREATED,
    summary="Registrar inscrição Web Push do dispositivo",
    dependencies=[
        Depends(rate_limit("push_sub", limit=30, window_seconds=300))
    ],
)
async def subscribe(
    payload: PushSubscriptionIn,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Salva (ou atualiza) a inscrição Web Push do dispositivo do usuário."""
    ua = request.headers.get("user-agent")
    await PushService(db).subscribe(current_user, payload, ua)
    return {"ok": True}


@router.post(
    "/unsubscribe",
    summary="Remover inscrição Web Push do dispositivo",
)
async def unsubscribe(
    payload: PushUnsubscribeIn,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Remove a inscrição pelo ``endpoint`` (idempotente)."""
    await PushService(db).unsubscribe(payload.endpoint)
    return {"ok": True}
