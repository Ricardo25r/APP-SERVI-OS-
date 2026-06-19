"""Repositório da feature ``lead_purchases`` (Fase 5).

Camada de acesso a dados (queries SQLAlchemy async), **sem regra de negócio**
(§3.4). Recebe a ``AsyncSession`` por parâmetro e **não** faz ``commit`` — usa
``add``/``flush`` e deixa o commit para o service.

``lead_purchases`` é append-only com ``lead_id`` UNIQUE (Lead Exclusivo — §2.10).
A atomicidade da compra (lock da wallet, débito, insert) é orquestrada pelo
service; aqui ficam apenas as queries.
"""

from __future__ import annotations

import uuid

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Lead, LeadPurchase

__all__ = ["LeadPurchaseRepository"]


class LeadPurchaseRepository:
    """Acesso a dados de :class:`LeadPurchase`."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------ #
    # Escrita
    # ------------------------------------------------------------------ #
    def add(self, purchase: LeadPurchase) -> LeadPurchase:
        """Adiciona a compra à sessão (sem commit — o service commita)."""
        self.db.add(purchase)
        return purchase

    async def flush(self) -> None:
        await self.db.flush()

    # ------------------------------------------------------------------ #
    # Leitura do lead a comprar (lock condicional ao dialeto)
    # ------------------------------------------------------------------ #
    async def get_open_lead_for_update(
        self, lead_id: uuid.UUID, *, for_update: bool
    ) -> Lead | None:
        """Carrega o lead ativo (não soft-deleted) por id, com relações.

        ``for_update`` aplica o lock pessimista quando o dialeto suporta
        (Postgres); em SQLite é no-op (§5.4). Eager-load de ``category``,
        ``customer`` e ``purchase`` para montar o ``LeadRead`` na resposta.
        """
        stmt: Select = select(Lead).where(
            Lead.id == lead_id, Lead.deleted_at.is_(None)
        )
        if for_update:
            # ``with_for_update`` não pode combinar com eager-load via
            # selectinload na mesma query — primeiro travamos a linha do lead,
            # depois recarregamos com relações (já travado na mesma transação).
            stmt = stmt.with_for_update()
            result = await self.db.execute(stmt)
            lead = result.scalar_one_or_none()
            if lead is None:
                return None
            return await self.get_with_relations(lead_id)

        stmt = stmt.options(
            selectinload(Lead.category),
            selectinload(Lead.customer),
            selectinload(Lead.purchase),
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_with_relations(self, lead_id: uuid.UUID) -> Lead | None:
        """Recarrega o lead com ``category``/``customer``/``purchase`` (eager)."""
        stmt = (
            select(Lead)
            .where(Lead.id == lead_id, Lead.deleted_at.is_(None))
            .options(
                selectinload(Lead.category),
                selectinload(Lead.customer),
                selectinload(Lead.purchase),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    # ------------------------------------------------------------------ #
    # Histórico / detalhe das compras do profissional
    # ------------------------------------------------------------------ #
    async def get_purchase_by_id(
        self, purchase_id: uuid.UUID
    ) -> LeadPurchase | None:
        """Compra por id, com o ``lead`` (e relações do lead) e ``professional``."""
        stmt = (
            select(LeadPurchase)
            .where(LeadPurchase.id == purchase_id)
            .options(
                selectinload(LeadPurchase.lead).selectinload(Lead.category),
                selectinload(LeadPurchase.lead).selectinload(Lead.customer),
                selectinload(LeadPurchase.lead).selectinload(Lead.purchase),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    def _owned_stmt(self, professional_id: uuid.UUID) -> Select:
        return select(LeadPurchase).where(
            LeadPurchase.professional_id == professional_id
        )

    async def list_for_professional(
        self,
        professional_id: uuid.UUID,
        *,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[LeadPurchase], int]:
        """Compras do profissional (mais recentes primeiro) + total."""
        base = self._owned_stmt(professional_id)
        total = await self._count(base)
        stmt = (
            base.options(
                selectinload(LeadPurchase.lead).selectinload(Lead.category),
                selectinload(LeadPurchase.lead).selectinload(Lead.customer),
                selectinload(LeadPurchase.lead).selectinload(Lead.purchase),
            )
            .order_by(LeadPurchase.purchased_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    # ------------------------------------------------------------------ #
    # Suporte
    # ------------------------------------------------------------------ #
    async def _count(self, base_stmt: Select) -> int:
        count_stmt = select(func.count()).select_from(base_stmt.subquery())
        result = await self.db.execute(count_stmt)
        return int(result.scalar_one())
