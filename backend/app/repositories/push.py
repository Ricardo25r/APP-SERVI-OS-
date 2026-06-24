"""Repositório da feature ``push`` (Web Push). Sem regra de negócio; sem commit."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PushSubscription

__all__ = ["PushRepository"]


class PushRepository:
    """Acesso a dados das inscrições Web Push."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def upsert(
        self,
        *,
        user_id: uuid.UUID,
        endpoint: str,
        p256dh: str,
        auth: str,
        user_agent: str | None,
    ) -> PushSubscription:
        """Cria ou atualiza a inscrição (chave: ``endpoint`` único)."""
        existing = (
            await self.db.execute(
                select(PushSubscription).where(
                    PushSubscription.endpoint == endpoint
                )
            )
        ).scalar_one_or_none()
        if existing is not None:
            existing.user_id = user_id
            existing.p256dh = p256dh
            existing.auth = auth
            existing.user_agent = user_agent
            return existing
        sub = PushSubscription(
            user_id=user_id,
            endpoint=endpoint,
            p256dh=p256dh,
            auth=auth,
            user_agent=user_agent,
        )
        self.db.add(sub)
        return sub

    async def delete_by_endpoint(self, endpoint: str) -> None:
        await self.db.execute(
            delete(PushSubscription).where(
                PushSubscription.endpoint == endpoint
            )
        )

    async def delete_endpoints(self, endpoints: Sequence[str]) -> None:
        if not endpoints:
            return
        await self.db.execute(
            delete(PushSubscription).where(
                PushSubscription.endpoint.in_(list(endpoints))
            )
        )

    async def list_for_user(
        self, user_id: uuid.UUID
    ) -> list[PushSubscription]:
        rows = await self.db.execute(
            select(PushSubscription).where(
                PushSubscription.user_id == user_id
            )
        )
        return list(rows.scalars().all())

    async def list_for_users(
        self, user_ids: Sequence[uuid.UUID]
    ) -> list[PushSubscription]:
        if not user_ids:
            return []
        rows = await self.db.execute(
            select(PushSubscription).where(
                PushSubscription.user_id.in_(list(user_ids))
            )
        )
        return list(rows.scalars().all())
