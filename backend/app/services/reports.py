"""Service da feature ``reports`` (denúncias de abuso).

Registra denúncias e notifica os admins in-app. Revisão manual pelo admin
(open → reviewed/dismissed). Infra reaproveitada por disputa de lead e moderação.
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models import Report, User, UserRole
from app.schemas.reports import (
    ReportAdminItem,
    ReportAdminList,
    ReportCreate,
    ReportOut,
)
from app.services.notifications import add_notification

__all__ = ["ReportService"]

_TARGET_LABEL = {
    "user": "perfil",
    "lead": "pedido",
    "message": "mensagem",
    "review": "avaliação",
}


class ReportService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, user: User, data: ReportCreate) -> ReportOut:
        """Registra a denúncia e notifica os admins (mesma transação)."""
        report = Report(
            reporter_id=user.id,
            target_type=data.target_type,
            target_id=data.target_id,
            reason=data.reason,
            description=(data.description or None),
        )
        self.db.add(report)

        admins = (
            (
                await self.db.execute(
                    select(User).where(
                        User.role == UserRole.admin,
                        User.deleted_at.is_(None),
                    )
                )
            )
            .scalars()
            .all()
        )
        label = _TARGET_LABEL.get(data.target_type, "item")
        for admin in admins:
            add_notification(
                self.db,
                user_id=admin.id,
                type="report",
                title="Nova denúncia",
                body=f"{user.name} denunciou um(a) {label} ({data.reason}).",
                href="/admin/denuncias",
            )

        await self.db.commit()
        await self.db.refresh(report)
        return ReportOut.model_validate(report)

    async def list_all(
        self, *, status: str | None = None, page: int = 1, page_size: int = 50
    ) -> ReportAdminList:
        stmt = select(Report, User).join(User, Report.reporter_id == User.id)
        count_stmt = select(func.count()).select_from(Report)
        if status:
            stmt = stmt.where(Report.status == status)
            count_stmt = count_stmt.where(Report.status == status)
        total = (await self.db.execute(count_stmt)).scalar_one()
        rows = (
            await self.db.execute(
                stmt.order_by(Report.created_at.desc())
                .limit(page_size)
                .offset((page - 1) * page_size)
            )
        ).all()
        items = [
            ReportAdminItem(
                id=r.id,
                target_type=r.target_type,
                target_id=r.target_id,
                reason=r.reason,
                description=r.description,
                status=r.status,
                created_at=r.created_at,
                reporter_id=r.reporter_id,
                reporter_name=u.name,
                reporter_email=u.email,
            )
            for r, u in rows
        ]
        return ReportAdminList(items=items, total=int(total))

    async def set_status(self, report_id: uuid.UUID, status: str) -> None:
        report = await self.db.get(Report, report_id)
        if report is None:
            raise NotFoundError("Denúncia não encontrada.")
        report.status = status
        await self.db.commit()
