"""Repositório da feature ``admin`` (Fase 10).

Camada de acesso a dados (queries SQLAlchemy async), **sem regra de negócio**
(§3.4). Recebe a ``AsyncSession`` por parâmetro e **não** faz ``commit`` — usa
``add``/``flush`` e deixa o commit para o service.

Inclui:
- agregações eficientes para as métricas (``COUNT``/``SUM`` por ``GROUP BY``,
  evitando N+1);
- listagens paginadas com filtros (usuários, leads, pagamentos, auditoria);
- escrita append-only de ``AuditLog``.

Filtros de soft delete: as contagens/listagens administrativas de ``users``/
``leads`` **incluem** registros soft-deleted por padrão (visão de governança),
salvo onde indicado. As métricas de "usuários por papel" contam apenas ativos
(``deleted_at IS NULL``) para refletir a base viva.
"""

from __future__ import annotations

import uuid

from sqlalchemy import Select, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    AuditLog,
    Conversation,
    Lead,
    LeadPurchase,
    LeadStatus,
    PaymentOrder,
    PaymentOrderStatus,
    Review,
    User,
    UserRole,
)

__all__ = ["AdminRepository"]


class AdminRepository:
    """Acesso a dados das consultas/escritas administrativas."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------ #
    # Suporte
    # ------------------------------------------------------------------ #
    async def _count(self, base_stmt: Select) -> int:
        count_stmt = select(func.count()).select_from(base_stmt.subquery())
        result = await self.db.execute(count_stmt)
        return int(result.scalar_one())

    # ------------------------------------------------------------------ #
    # Métricas — agregações eficientes (sem N+1)
    # ------------------------------------------------------------------ #
    async def count_users_by_role(self) -> dict[UserRole, int]:
        """Contagem de usuários ativos por papel (1 query, ``GROUP BY``)."""
        stmt = (
            select(User.role, func.count())
            .where(User.deleted_at.is_(None))
            .group_by(User.role)
        )
        result = await self.db.execute(stmt)
        return {role: int(count) for role, count in result.all()}

    async def count_leads_by_status(self) -> dict[LeadStatus, int]:
        """Contagem de leads por status (1 query, ``GROUP BY``)."""
        stmt = select(Lead.status, func.count()).group_by(Lead.status)
        result = await self.db.execute(stmt)
        return {status: int(count) for status, count in result.all()}

    async def count_lead_purchases(self) -> int:
        stmt = select(func.count()).select_from(LeadPurchase)
        return int((await self.db.execute(stmt)).scalar_one())

    async def sum_credits_packages_sold(self) -> int:
        """Total de créditos vendidos (soma de ``credits`` dos pedidos ``paid``)."""
        stmt = select(func.coalesce(func.sum(PaymentOrder.credits), 0)).where(
            PaymentOrder.status == PaymentOrderStatus.paid
        )
        return int((await self.db.execute(stmt)).scalar_one())

    async def count_reviews(self) -> int:
        stmt = select(func.count()).select_from(Review)
        return int((await self.db.execute(stmt)).scalar_one())

    async def count_conversations(self) -> int:
        stmt = select(func.count()).select_from(Conversation)
        return int((await self.db.execute(stmt)).scalar_one())

    async def payment_finance_summary(self) -> tuple[int, int, int]:
        """Resumo financeiro em 1 query: ``(paid_orders, revenue_cents,
        refunded_orders)``.

        Usa ``SUM(CASE ...)`` condicional (portável Postgres/SQLite) para não
        emitir múltiplas queries (sem N+1).
        """
        is_paid = PaymentOrder.status == PaymentOrderStatus.paid
        is_refunded = PaymentOrder.status == PaymentOrderStatus.refunded

        paid_count_expr = func.coalesce(
            func.sum(case((is_paid, 1), else_=0)), 0
        )
        revenue_expr = func.coalesce(
            func.sum(case((is_paid, PaymentOrder.amount_cents), else_=0)), 0
        )
        refunded_count_expr = func.coalesce(
            func.sum(case((is_refunded, 1), else_=0)), 0
        )
        stmt = select(paid_count_expr, revenue_expr, refunded_count_expr)
        row = (await self.db.execute(stmt)).one()
        return int(row[0]), int(row[1]), int(row[2])

    # ------------------------------------------------------------------ #
    # Gestão de usuários
    # ------------------------------------------------------------------ #
    def _users_base(
        self,
        *,
        role: UserRole | None,
        status: object | None,
        search: str | None,
    ) -> Select:
        stmt: Select = select(User)
        if role is not None:
            stmt = stmt.where(User.role == role)
        if status is not None:
            stmt = stmt.where(User.status == status)
        if search:
            like = f"%{search.lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(User.name).like(like),
                    func.lower(User.email).like(like),
                )
            )
        return stmt

    async def list_users(
        self,
        *,
        role: UserRole | None = None,
        status: object | None = None,
        search: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[User], int]:
        """Usuários paginados + total (filtros papel/status/busca — §gestão)."""
        base = self._users_base(role=role, status=status, search=search)
        total = await self._count(base)
        stmt = (
            base.order_by(User.created_at.desc()).limit(limit).offset(offset)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    async def get_user(self, user_id: uuid.UUID) -> User | None:
        """Carrega um usuário por id (inclui soft-deleted — visão admin)."""
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    # ------------------------------------------------------------------ #
    # Moderação de leads
    # ------------------------------------------------------------------ #
    def _leads_base(
        self,
        *,
        status: LeadStatus | None,
        category_id: uuid.UUID | None,
        city: str | None,
    ) -> Select:
        stmt: Select = select(Lead)
        if status is not None:
            stmt = stmt.where(Lead.status == status)
        if category_id is not None:
            stmt = stmt.where(Lead.category_id == category_id)
        if city:
            stmt = stmt.where(func.lower(Lead.city) == city.lower())
        return stmt

    async def list_leads(
        self,
        *,
        status: LeadStatus | None = None,
        category_id: uuid.UUID | None = None,
        city: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Lead], int]:
        """Leads paginados + total (filtros status/categoria/cidade)."""
        base = self._leads_base(
            status=status, category_id=category_id, city=city
        )
        total = await self._count(base)
        stmt = (
            base.order_by(Lead.created_at.desc()).limit(limit).offset(offset)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    async def get_lead(self, lead_id: uuid.UUID) -> Lead | None:
        """Carrega um lead por id (inclui soft-deleted — visão admin)."""
        result = await self.db.execute(select(Lead).where(Lead.id == lead_id))
        return result.scalar_one_or_none()

    # ------------------------------------------------------------------ #
    # Financeiro
    # ------------------------------------------------------------------ #
    async def list_payments(
        self,
        *,
        status: PaymentOrderStatus | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[PaymentOrder], int]:
        """Pedidos paginados + total (filtro status — § Financeiro)."""
        base: Select = select(PaymentOrder)
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
    # Auditoria
    # ------------------------------------------------------------------ #
    def add_audit_log(self, log: AuditLog) -> AuditLog:
        """Adiciona um registro de auditoria à sessão (sem commit)."""
        self.db.add(log)
        return log

    async def flush(self) -> None:
        await self.db.flush()

    async def list_audit_logs(
        self,
        *,
        action: str | None = None,
        entity: str | None = None,
        actor_id: uuid.UUID | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[AuditLog], int]:
        """Auditoria paginada + total (filtros action/entity/actor)."""
        base: Select = select(AuditLog)
        if action is not None:
            base = base.where(AuditLog.action == action)
        if entity is not None:
            base = base.where(AuditLog.entity == entity)
        if actor_id is not None:
            base = base.where(AuditLog.actor_id == actor_id)
        total = await self._count(base)
        stmt = (
            base.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total
