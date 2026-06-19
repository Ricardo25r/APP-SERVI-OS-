"""Repositório da feature ``payments`` (Fase 6).

Camada de acesso a dados (queries SQLAlchemy async), **sem regra de negócio**
(§3.4). Recebe a ``AsyncSession`` por parâmetro e **não** faz ``commit`` — usa
``add``/``flush`` e deixa o commit para o service.

``credit_packages`` usa ``active`` (sem soft delete — §2.2). ``payment_orders``
nunca é apagado (§2.3); a idempotência do webhook usa o ``external_reference``
UNIQUE + lock pessimista condicional ao dialeto (``supports_for_update`` —
reutilizado de ``repositories.credits``, §2.4 / §5.3).
"""

from __future__ import annotations

import uuid

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    CreditPackage,
    PaymentOrder,
    PaymentOrderStatus,
    ProfessionalProfile,
)
from app.repositories.credits import supports_for_update

__all__ = ["PaymentRepository", "supports_for_update"]


class PaymentRepository:
    """Acesso a dados de :class:`CreditPackage` e :class:`PaymentOrder`."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------ #
    # Pacotes (catálogo)
    # ------------------------------------------------------------------ #
    async def list_packages(
        self, *, active_only: bool = True
    ) -> list[CreditPackage]:
        """Lista os pacotes (default só ativos — §4 #1). Ordena por preço."""
        stmt: Select = select(CreditPackage)
        if active_only:
            stmt = stmt.where(CreditPackage.active.is_(True))
        stmt = stmt.order_by(CreditPackage.price_cents.asc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_package(self, package_id: uuid.UUID) -> CreditPackage | None:
        """Retorna o pacote por id (ou ``None``)."""
        result = await self.db.execute(
            select(CreditPackage).where(CreditPackage.id == package_id)
        )
        return result.scalar_one_or_none()

    # ------------------------------------------------------------------ #
    # Pedidos (escrita)
    # ------------------------------------------------------------------ #
    def add_order(self, order: PaymentOrder) -> PaymentOrder:
        """Adiciona um pedido à sessão (sem commit — o service commita)."""
        self.db.add(order)
        return order

    async def flush(self) -> None:
        await self.db.flush()

    # ------------------------------------------------------------------ #
    # Pedidos (leitura)
    # ------------------------------------------------------------------ #
    async def get_order(self, order_id: uuid.UUID) -> PaymentOrder | None:
        """Retorna o pedido por id (ou ``None``)."""
        result = await self.db.execute(
            select(PaymentOrder).where(PaymentOrder.id == order_id)
        )
        return result.scalar_one_or_none()

    async def get_order_for_update(
        self, order_id: uuid.UUID, *, for_update: bool
    ) -> PaymentOrder | None:
        """Carrega o pedido por id, com lock pessimista condicional ao dialeto.

        ``for_update`` aplica ``SELECT ... FOR UPDATE`` apenas em dialetos que o
        suportam (Postgres); em SQLite (testes) é no-op (§2.4 / §5.3).
        """
        stmt: Select = select(PaymentOrder).where(PaymentOrder.id == order_id)
        if for_update and supports_for_update(self.db):
            stmt = stmt.with_for_update()
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_order_by_external_reference(
        self, external_reference: str, *, for_update: bool
    ) -> PaymentOrder | None:
        """Localiza o pedido pela ``external_reference`` UNIQUE (correlação §2.4).

        ``for_update`` aplica o lock pessimista condicional ao dialeto.
        """
        stmt: Select = select(PaymentOrder).where(
            PaymentOrder.external_reference == external_reference
        )
        if for_update and supports_for_update(self.db):
            stmt = stmt.with_for_update()
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    def _owned_stmt(self, user_id: uuid.UUID) -> Select:
        return select(PaymentOrder).where(PaymentOrder.user_id == user_id)

    async def list_orders_for_user(
        self,
        user_id: uuid.UUID,
        *,
        status: PaymentOrderStatus | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[PaymentOrder], int]:
        """Pedidos do usuário (mais recentes primeiro) + total (§4 #3)."""
        base = self._owned_stmt(user_id)
        if status is not None:
            base = base.where(PaymentOrder.status == status)
        total = await self._count(base)
        stmt = (
            base.order_by(PaymentOrder.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    # ------------------------------------------------------------------ #
    # Wallet do dono do pedido (para o crédito/estorno)
    # ------------------------------------------------------------------ #
    async def get_professional_profile_by_user(
        self, user_id: uuid.UUID
    ) -> ProfessionalProfile | None:
        """Carrega o perfil profissional ativo do usuário (ou ``None``)."""
        result = await self.db.execute(
            select(ProfessionalProfile).where(
                ProfessionalProfile.user_id == user_id,
                ProfessionalProfile.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    # ------------------------------------------------------------------ #
    # Suporte
    # ------------------------------------------------------------------ #
    async def _count(self, base_stmt: Select) -> int:
        count_stmt = select(func.count()).select_from(base_stmt.subquery())
        result = await self.db.execute(count_stmt)
        return int(result.scalar_one())
