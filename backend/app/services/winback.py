"""Re-engajamento / win-back (#53).

Varre usuários **inativos** (``last_login_at`` antigo) que ainda aceitam
marketing e têm push inscrito, e manda um push de "sentimos sua falta" — com
cooldown dedicado (Redis) para não incomodar. Best-effort: nunca derruba o app.
Respeita as preferências e o throttle de marketing do :class:`PushService`.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import NotificationPreference, PushSubscription, User
from app.services.push import PushService, push_enabled

__all__ = ["send_winback_batch"]

logger = logging.getLogger("app.services.winback")


async def _winback_cooldown_filter(
    user_ids: list[uuid.UUID],
) -> list[uuid.UUID]:
    """1 win-back por usuário por ``WINBACK_COOLDOWN_DAYS`` (Redis; fail-open)."""
    try:
        from app.core.ratelimit import _redis

        client = _redis()
        ttl = settings.WINBACK_COOLDOWN_DAYS * 86400
        allowed: list[uuid.UUID] = []
        for uid in user_ids:
            ok = await client.set(f"winback:{uid}", "1", ex=ttl, nx=True)
            if ok:
                allowed.append(uid)
        return allowed
    except Exception:  # noqa: BLE001 - fail-open se o Redis cair
        return user_ids


async def send_winback_batch(db: AsyncSession, *, now: datetime) -> int:
    """Envia win-back ao lote de inativos elegíveis. Retorna quantos receberam."""
    if not settings.WINBACK_ENABLED or not push_enabled():
        return 0

    cutoff = now - timedelta(days=settings.WINBACK_INACTIVE_DAYS)
    stmt = (
        select(User.id)
        .join(PushSubscription, PushSubscription.user_id == User.id)
        .outerjoin(
            NotificationPreference,
            NotificationPreference.user_id == User.id,
        )
        .where(
            User.deleted_at.is_(None),
            User.last_login_at.isnot(None),
            User.last_login_at < cutoff,
            or_(
                NotificationPreference.id.is_(None),
                NotificationPreference.allow_marketing.is_(True),
            ),
        )
        .distinct()
        .limit(settings.WINBACK_BATCH_LIMIT)
    )
    user_ids = list((await db.execute(stmt)).scalars().all())
    if not user_ids:
        return 0

    eligible = await _winback_cooldown_filter(user_ids)
    if not eligible:
        return 0

    await PushService(db).send_to_users(
        eligible,
        title="Sentimos sua falta no FazTudo",
        body="Tem profissional novo perto de você. Volte e dê uma olhada!",
        url="/profissionais",
        tag="winback",
    )
    return len(eligible)
