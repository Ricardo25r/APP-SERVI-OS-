"""Service da feature ``saved_alerts`` (alerta/busca salva de categoria — #60).

O contratante segue uma categoria (+ cidade opcional). A notificação de "novo
profissional verificado" é disparada pelo :class:`KycService` ao aprovar um KYC
(reaproveita ``add_notification``). Aqui ficam só o CRUD dos alertas.
"""

from __future__ import annotations

import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models import Category, SavedCategoryAlert, User
from app.schemas.saved_alerts import SavedAlertCreate, SavedAlertOut

__all__ = ["SavedAlertService"]


class SavedAlertService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    def _to_out(
        self, alert: SavedCategoryAlert, category: Category
    ) -> SavedAlertOut:
        return SavedAlertOut(
            id=alert.id,
            category_id=alert.category_id,
            category_name=category.name,
            category_slug=category.slug,
            city=alert.city,
            created_at=alert.created_at,
        )

    async def create(
        self, user: User, data: SavedAlertCreate
    ) -> SavedAlertOut:
        category = await self.db.get(Category, data.category_id)
        if category is None:
            raise NotFoundError("Categoria não encontrada.")
        city = (data.city or "").strip() or None

        stmt = select(SavedCategoryAlert).where(
            SavedCategoryAlert.user_id == user.id,
            SavedCategoryAlert.category_id == data.category_id,
        )
        stmt = (
            stmt.where(SavedCategoryAlert.city.is_(None))
            if city is None
            else stmt.where(SavedCategoryAlert.city == city)
        )
        existing = (await self.db.execute(stmt)).scalar_one_or_none()
        if existing is not None:
            return self._to_out(existing, category)

        alert = SavedCategoryAlert(
            user_id=user.id, category_id=data.category_id, city=city
        )
        self.db.add(alert)
        await self.db.commit()
        await self.db.refresh(alert)
        return self._to_out(alert, category)

    async def list(self, user: User) -> list[SavedAlertOut]:
        rows = (
            await self.db.execute(
                select(SavedCategoryAlert, Category)
                .join(Category, Category.id == SavedCategoryAlert.category_id)
                .where(SavedCategoryAlert.user_id == user.id)
                .order_by(SavedCategoryAlert.created_at.desc())
            )
        ).all()
        return [self._to_out(alert, category) for alert, category in rows]

    async def delete(self, user: User, alert_id: uuid.UUID) -> None:
        await self.db.execute(
            delete(SavedCategoryAlert).where(
                SavedCategoryAlert.id == alert_id,
                SavedCategoryAlert.user_id == user.id,
            )
        )
        await self.db.commit()
