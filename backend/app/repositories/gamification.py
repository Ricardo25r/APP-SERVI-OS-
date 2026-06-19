"""Repositório da feature ``gamification`` (Fase 9).

Camada de acesso a dados (queries SQLAlchemy async), **sem regra de negócio**
(§3.4). Recebe a ``AsyncSession`` por parâmetro e **não** faz ``commit`` — usa
``add``/``flush`` e deixa o commit para o service.

``xp_transactions`` é append-only/imutável (doc 08). O recálculo de nível e os
agregados de XP do profissional vivem no service.
"""

from __future__ import annotations

import uuid

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ProfessionalProfile, User, XpTransaction

__all__ = ["GamificationRepository"]


class GamificationRepository:
    """Acesso a dados de :class:`XpTransaction` + perfis/ranking de XP."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------ #
    # Escrita (append-only; sem commit — o service commita)
    # ------------------------------------------------------------------ #
    def add_transaction(self, tx: XpTransaction) -> XpTransaction:
        """Adiciona uma transação de XP à sessão (sem commit)."""
        self.db.add(tx)
        return tx

    async def flush(self) -> None:
        await self.db.flush()

    # ------------------------------------------------------------------ #
    # Perfil profissional do usuário (para somar XP / recalcular nível)
    # ------------------------------------------------------------------ #
    async def get_professional_profile_by_user(
        self, user_id: uuid.UUID
    ) -> ProfessionalProfile | None:
        """Perfil profissional ativo do usuário (ou ``None``)."""
        result = await self.db.execute(
            select(ProfessionalProfile).where(
                ProfessionalProfile.user_id == user_id,
                ProfessionalProfile.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    # ------------------------------------------------------------------ #
    # Histórico recente de XP de um usuário
    # ------------------------------------------------------------------ #
    async def list_recent_xp(
        self, user_id: uuid.UUID, *, limit: int = 20
    ) -> list[XpTransaction]:
        """Transações de XP do usuário (mais recentes primeiro)."""
        stmt = (
            select(XpTransaction)
            .where(XpTransaction.user_id == user_id)
            .order_by(XpTransaction.created_at.desc(), XpTransaction.id.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # ------------------------------------------------------------------ #
    # Ranking de profissionais por XP (top N, filtros opcionais)
    # ------------------------------------------------------------------ #
    async def top_professionals_by_xp(
        self,
        *,
        limit: int = 20,
        city: str | None = None,
        state: str | None = None,
    ) -> list[tuple[ProfessionalProfile, User]]:
        """Top ``limit`` profissionais por XP desc (+ o ``User`` para o nome).

        Filtros opcionais por ``city``/``state`` (Ranking Municipal/Estadual).
        Ignora perfis soft-deleted e usuários inativos/soft-deleted. Desempate
        estável por ``rating`` desc e ``id`` para um ranking determinístico."""
        stmt: Select = (
            select(ProfessionalProfile, User)
            .join(User, ProfessionalProfile.user_id == User.id)
            .where(
                ProfessionalProfile.deleted_at.is_(None),
                User.deleted_at.is_(None),
            )
        )
        if city is not None:
            stmt = stmt.where(ProfessionalProfile.city == city)
        if state is not None:
            stmt = stmt.where(ProfessionalProfile.state == state)
        stmt = stmt.order_by(
            ProfessionalProfile.xp.desc(),
            ProfessionalProfile.rating.desc(),
            ProfessionalProfile.id.asc(),
        ).limit(limit)
        result = await self.db.execute(stmt)
        return [(row[0], row[1]) for row in result.all()]
