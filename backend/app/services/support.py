"""Service da feature ``support`` (Fase 15 — Central de Suporte).

Registra chamados (tickets) e notifica o dono do sistema por e-mail (reusa a
infra de alertas — Fase 12). Gestão/resposta pelo admin é uma evolução; aqui o
admin pode listar todos os chamados e o usuário vê os seus.
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.alerts import notify_support_ticket
from app.core.exceptions import NotFoundError
from app.models import SupportTicket, User, UserRole
from app.schemas.support import (
    SupportTicketAdminOut,
    SupportTicketCreate,
    SupportTicketOut,
)
from app.services.notifications import add_notification

__all__ = ["SupportService"]


class SupportService:
    """Criação e listagem de chamados de suporte."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_ticket(
        self, user: User, data: SupportTicketCreate
    ) -> SupportTicketOut:
        """Registra um chamado e dispara o e-mail ao dono (best-effort)."""
        ticket = SupportTicket(
            user_id=user.id,
            subject=data.subject.strip(),
            message=data.message.strip(),
        )
        self.db.add(ticket)

        # Notifica os admins in-app sobre o novo chamado (mesma transação).
        admins = (
            await self.db.execute(
                select(User).where(
                    User.role == UserRole.admin,
                    User.deleted_at.is_(None),
                )
            )
        ).scalars().all()
        for admin in admins:
            add_notification(
                self.db,
                user_id=admin.id,
                type="support",
                title="Novo chamado de suporte",
                body=f"{user.name}: {data.subject.strip()}",
                href="/admin/chamados",
            )

        await self.db.commit()
        await self.db.refresh(ticket)

        # E-mail ao dono do sistema (fora da transação; nunca quebra o request).
        notify_support_ticket(
            subject=ticket.subject,
            message=ticket.message,
            user_name=user.name,
            user_email=user.email,
            ticket_id=str(ticket.id),
        )
        return SupportTicketOut.model_validate(ticket)

    async def list_mine(
        self, user: User
    ) -> tuple[list[SupportTicketOut], int]:
        """Chamados do próprio usuário (mais recentes primeiro)."""
        rows = (
            await self.db.execute(
                select(SupportTicket)
                .where(SupportTicket.user_id == user.id)
                .order_by(SupportTicket.created_at.desc())
            )
        ).scalars().all()
        items = [SupportTicketOut.model_validate(t) for t in rows]
        return items, len(items)

    async def list_all(
        self, *, page: int = 1, page_size: int = 50
    ) -> tuple[list[SupportTicketAdminOut], int]:
        """Todos os chamados (admin), com dados do autor (paginado)."""
        total = (
            await self.db.execute(
                select(func.count()).select_from(SupportTicket)
            )
        ).scalar_one()
        rows = (
            await self.db.execute(
                select(SupportTicket, User)
                .join(User, SupportTicket.user_id == User.id)
                .order_by(SupportTicket.created_at.desc())
                .limit(page_size)
                .offset((page - 1) * page_size)
            )
        ).all()
        items = [
            SupportTicketAdminOut(
                id=t.id,
                subject=t.subject,
                message=t.message,
                status=t.status,
                created_at=t.created_at,
                user_id=t.user_id,
                user_name=u.name,
                user_email=u.email,
            )
            for t, u in rows
        ]
        return items, int(total)

    async def set_status(
        self, ticket_id: uuid.UUID, status: str
    ) -> SupportTicketAdminOut:
        """Atualiza o status de um chamado (admin) e devolve com dados do autor."""
        row = (
            await self.db.execute(
                select(SupportTicket, User)
                .join(User, SupportTicket.user_id == User.id)
                .where(SupportTicket.id == ticket_id)
            )
        ).first()
        if row is None:
            raise NotFoundError("Chamado não encontrado.")
        ticket, user = row
        ticket.status = status
        await self.db.commit()
        await self.db.refresh(ticket)
        return SupportTicketAdminOut(
            id=ticket.id,
            subject=ticket.subject,
            message=ticket.message,
            status=ticket.status,
            created_at=ticket.created_at,
            user_id=ticket.user_id,
            user_name=user.name,
            user_email=user.email,
        )
