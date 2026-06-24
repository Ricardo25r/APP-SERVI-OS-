"""Service da feature ``push`` (Web Push VAPID).

- Inscrição/remoção de dispositivos (``subscribe``/``unsubscribe``).
- Envio best-effort de push a um usuário ou a vários (``send_to_user`` /
  ``send_to_users``). O envio real (``pywebpush``) é síncrono → roda em thread
  (``asyncio.to_thread``) para não travar o event loop. Inscrições mortas
  (404/410) são removidas. Sem VAPID configurado, é no-op (não quebra eventos).
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import PushSubscription, User
from app.repositories.push import PushRepository
from app.schemas.push import PushSubscriptionIn

__all__ = ["PushService", "push_enabled"]

logger = logging.getLogger("app.services.push")


def push_enabled() -> bool:
    """True se as chaves VAPID estão configuradas (senão envio é no-op)."""
    return bool(settings.VAPID_PRIVATE_KEY and settings.VAPID_PUBLIC_KEY)


def _send_one(sub_info: dict, payload: str) -> str:
    """Envia 1 push (SÍNCRONO — chamar via ``to_thread``). 'ok'|'dead'|'fail'."""
    try:
        from pywebpush import WebPushException, webpush
    except Exception:  # noqa: BLE001 — lib ausente: trata como falha silenciosa
        return "fail"
    try:
        webpush(
            subscription_info=sub_info,
            data=payload,
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_SUBJECT},
            ttl=3600,
        )
        return "ok"
    except WebPushException as exc:
        status = getattr(getattr(exc, "response", None), "status_code", None)
        if status in (404, 410):
            return "dead"
        logger.warning("Falha no push (status=%s)", status)
        return "fail"
    except Exception:  # noqa: BLE001 — push é best-effort, nunca propaga
        logger.warning("Erro inesperado ao enviar push", exc_info=True)
        return "fail"


class PushService:
    """Inscrição e envio de Web Push."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = PushRepository(db)

    async def subscribe(
        self, user: User, data: PushSubscriptionIn, user_agent: str | None
    ) -> None:
        await self.repo.upsert(
            user_id=user.id,
            endpoint=data.endpoint,
            p256dh=data.keys.p256dh,
            auth=data.keys.auth,
            user_agent=(user_agent or "")[:400] or None,
        )
        await self.db.commit()

    async def unsubscribe(self, endpoint: str) -> None:
        await self.repo.delete_by_endpoint(endpoint)
        await self.db.commit()

    async def _dispatch(
        self, subs: list[PushSubscription], payload: str
    ) -> None:
        if not subs:
            return
        infos = [
            {
                "endpoint": s.endpoint,
                "keys": {"p256dh": s.p256dh, "auth": s.auth},
            }
            for s in subs
        ]
        results = await asyncio.gather(
            *(asyncio.to_thread(_send_one, info, payload) for info in infos)
        )
        dead = [
            s.endpoint
            for s, r in zip(subs, results, strict=True)
            if r == "dead"
        ]
        if dead:
            await self.repo.delete_endpoints(dead)
            await self.db.commit()

    @staticmethod
    def _payload(
        title: str, body: str, url: str | None, tag: str | None
    ) -> str:
        return json.dumps(
            {"title": title, "body": body, "url": url or "/", "tag": tag}
        )

    async def send_to_user(
        self,
        user_id: uuid.UUID,
        *,
        title: str,
        body: str,
        url: str | None = None,
        tag: str | None = None,
    ) -> None:
        if not push_enabled():
            return
        subs = await self.repo.list_for_user(user_id)
        await self._dispatch(subs, self._payload(title, body, url, tag))

    async def send_to_users(
        self,
        user_ids: Sequence[uuid.UUID],
        *,
        title: str,
        body: str,
        url: str | None = None,
        tag: str | None = None,
    ) -> None:
        if not push_enabled() or not user_ids:
            return
        subs = await self.repo.list_for_users(list(user_ids))
        await self._dispatch(subs, self._payload(title, body, url, tag))
