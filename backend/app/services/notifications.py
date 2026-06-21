"""Service da feature ``notifications`` (Fase 14 — engine MVP).

- :func:`add_notification` — cria uma notificação **na sessão dada, sem commit**.
  É chamada pelos serviços de evento (chat, compra de lead, avaliação) dentro da
  **mesma transação** do evento — o chamador commita.
- :class:`NotificationService` — leitura/baixa para a API (listar, contar não
  lidas, marcar lida, marcar todas). Sempre escopado ao ``user_id`` do dono
  (anti-IDOR — ninguém lê/baixa notificação de outro).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Notification, User
from app.schemas.notifications import NotificationOut

__all__ = ["NotificationService", "add_notification"]


def add_notification(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    type: str,
    title: str,
    body: str = "",
    href: str | None = None,
) -> Notification:
    """Adiciona uma notificação à sessão (sem commit — o chamador commita)."""
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        body=body or "",
        href=href,
    )
    session.add(notification)
    return notification


def _to_out(n: Notification) -> NotificationOut:
    return NotificationOut(
        id=n.id,
        type=n.type,
        title=n.title,
        body=n.body,
        href=n.href,
        read=n.read_at is not None,
        created_at=n.created_at,
    )


class NotificationService:
    """Leitura/baixa de notificações do usuário autenticado."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_for_user(
        self,
        user: User,
        *,
        unread_only: bool = False,
        page: int = 1,
        page_size: int = 30,
    ) -> tuple[list[NotificationOut], int, int]:
        """Notificações do usuário (paginado) + total + total de não lidas."""
        base = select(Notification).where(Notification.user_id == user.id)
        if unread_only:
            base = base.where(Notification.read_at.is_(None))

        total = (
            await self.db.execute(
                select(func.count()).select_from(base.subquery())
            )
        ).scalar_one()
        unread = await self.unread_count(user)

        rows = (
            await self.db.execute(
                base.order_by(Notification.created_at.desc())
                .limit(page_size)
                .offset((page - 1) * page_size)
            )
        ).scalars().all()
        return [_to_out(n) for n in rows], int(total), unread

    async def unread_count(self, user: User) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(Notification)
            .where(
                Notification.user_id == user.id,
                Notification.read_at.is_(None),
            )
        )
        return int(result.scalar_one())

    async def mark_read(self, user: User, notification_id: uuid.UUID) -> None:
        await self.db.execute(
            update(Notification)
            .where(
                Notification.id == notification_id,
                Notification.user_id == user.id,
                Notification.read_at.is_(None),
            )
            .values(read_at=datetime.now(UTC))
        )
        await self.db.commit()

    async def mark_all_read(self, user: User) -> int:
        result = await self.db.execute(
            update(Notification)
            .where(
                Notification.user_id == user.id,
                Notification.read_at.is_(None),
            )
            .values(read_at=datetime.now(UTC))
        )
        await self.db.commit()
        return result.rowcount or 0
