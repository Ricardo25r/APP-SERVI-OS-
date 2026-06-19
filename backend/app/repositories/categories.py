"""Repositório da feature ``categories`` (Fase 3).

Camada de acesso a dados (queries SQLAlchemy async), **sem regra de negócio**
(§3.4). Recebe a ``AsyncSession`` por parâmetro e **não** faz ``commit`` — usa
``add``/``flush`` e deixa o commit para o service (§3.4).

``categories`` não tem soft delete (usa a flag ``active`` — §2.5), portanto as
consultas filtram por ``active`` apenas quando solicitado, não por ``deleted_at``.
"""

from __future__ import annotations

import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Category

__all__ = ["CategoryRepository"]


class CategoryRepository:
    """Acesso a dados de :class:`~app.models.Category`."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list(
        self,
        *,
        only_active: bool = True,
        query: str | None = None,
    ) -> list[Category]:
        """Lista categorias ordenadas por ``name``.

        - ``only_active=True`` (default público) retorna apenas ``active=True``.
        - ``query`` filtra por ``name``/``slug`` (case-insensitive, contém).
        """
        stmt = select(Category)
        if only_active:
            stmt = stmt.where(Category.active.is_(True))
        if query:
            like = f"%{query.strip()}%"
            stmt = stmt.where(
                or_(Category.name.ilike(like), Category.slug.ilike(like))
            )
        stmt = stmt.order_by(Category.name.asc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_id(self, category_id: uuid.UUID) -> Category | None:
        """Retorna a categoria pelo ``id`` ou ``None``."""
        result = await self.db.execute(
            select(Category).where(Category.id == category_id)
        )
        return result.scalar_one_or_none()

    async def get_by_slug(self, slug: str) -> Category | None:
        """Retorna a categoria pelo ``slug`` (unique) ou ``None``."""
        result = await self.db.execute(
            select(Category).where(Category.slug == slug)
        )
        return result.scalar_one_or_none()

    async def get_by_name(self, name: str) -> Category | None:
        """Retorna a categoria pelo ``name`` exato ou ``None``."""
        result = await self.db.execute(
            select(Category).where(Category.name == name)
        )
        return result.scalar_one_or_none()

    async def add(self, category: Category) -> Category:
        """Adiciona uma nova categoria à sessão e faz ``flush`` (sem commit)."""
        self.db.add(category)
        await self.db.flush()
        return category

    async def flush(self) -> None:
        """Sincroniza alterações pendentes com o banco (sem commit)."""
        await self.db.flush()
