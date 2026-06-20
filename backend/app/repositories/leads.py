"""Repositório de acesso a dados da feature ``leads`` (Fase 4).

Somente queries SQLAlchemy async — **sem** regra de negócio (§3.4). Recebe a
``AsyncSession`` por parâmetro e **não** faz ``commit`` (faz ``add``/``flush``);
quem commita é o service. Sempre filtra ``deleted_at IS NULL`` (soft delete).

Inclui a query de **elegibilidade** (matching MVP §5.3) consumida pela listagem
do profissional e, futuramente, pela compra (Fase 5).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import selectinload

from app.models import (
    Category,
    Lead,
    LeadStatus,
    ProfessionalCategory,
    ProfessionalProfile,
    User,
)

__all__ = ["LeadRepository"]


class LeadRepository:
    """Acesso a dados de ``leads`` (CRUD + matching de elegibilidade)."""

    def __init__(self, db) -> None:
        self.db = db

    # ------------------------------------------------------------------ #
    # Escrita
    # ------------------------------------------------------------------ #
    def add(self, lead: Lead) -> Lead:
        """Adiciona o lead à sessão (sem commit — o service commita)."""
        self.db.add(lead)
        return lead

    async def flush(self) -> None:
        await self.db.flush()

    # ------------------------------------------------------------------ #
    # Leitura por id
    # ------------------------------------------------------------------ #
    async def get_by_id(
        self, lead_id: uuid.UUID, *, with_relations: bool = True
    ) -> Lead | None:
        """Retorna o lead ativo (não soft-deleted) por id, ou ``None``.

        Quando ``with_relations`` carrega ``category``, ``customer`` e ``purchase``
        (eager) para montar o ``LeadRead`` sem lazy-load fora do contexto async.
        """
        stmt: Select = select(Lead).where(
            Lead.id == lead_id, Lead.deleted_at.is_(None)
        )
        if with_relations:
            stmt = stmt.options(
                selectinload(Lead.category),
                selectinload(Lead.customer),
                selectinload(Lead.purchase),
                selectinload(Lead.media),
            )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    # ------------------------------------------------------------------ #
    # Listagem do customer (os próprios leads)
    # ------------------------------------------------------------------ #
    def _base_owned_stmt(
        self,
        customer_id: uuid.UUID,
        *,
        status: LeadStatus | None,
        category_id: uuid.UUID | None,
        city: str | None,
        state: str | None,
    ) -> Select:
        stmt: Select = select(Lead).where(
            Lead.customer_id == customer_id,
            Lead.deleted_at.is_(None),
        )
        if status is not None:
            stmt = stmt.where(Lead.status == status)
        if category_id is not None:
            stmt = stmt.where(Lead.category_id == category_id)
        if city:
            stmt = stmt.where(func.lower(Lead.city) == city.lower())
        if state:
            stmt = stmt.where(func.lower(Lead.state) == state.lower())
        return stmt

    async def list_owned(
        self,
        customer_id: uuid.UUID,
        *,
        status: LeadStatus | None = None,
        category_id: uuid.UUID | None = None,
        city: str | None = None,
        state: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Lead], int]:
        """Leads do próprio customer (paginado) + total para a paginação."""
        base = self._base_owned_stmt(
            customer_id,
            status=status,
            category_id=category_id,
            city=city,
            state=state,
        )
        total = await self._count(base)
        stmt = (
            base.options(
                selectinload(Lead.category),
                selectinload(Lead.customer),
                selectinload(Lead.purchase),
                selectinload(Lead.media),
            )
            .order_by(Lead.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    # ------------------------------------------------------------------ #
    # Listagem do profissional (leads elegíveis — matching MVP §5.3)
    # ------------------------------------------------------------------ #
    def _eligible_stmt(
        self,
        profile: ProfessionalProfile,
        *,
        category_id: uuid.UUID | None,
        city: str | None,
        state: str | None,
    ) -> Select:
        """Monta o filtro de elegibilidade do matching MVP (§5.3 itens 1–5).

        Itens:
          1/2. profissional ``active`` + perfil não soft-deleted → garantido pelo
               chamador (recebe o ``ProfessionalProfile`` do usuário ativo logado).
          3.   mesma categoria do perfil (vínculo em ``professional_categories``).
          4.   mesma cidade/estado do perfil (igualdade case-insensitive).
          5.   lead ``open``, não expirado, não soft-deleted.

        Saldo (item 6) **não** filtra na listagem — só na compra; a flag
        ``affordable`` é calculada no service.
        """
        now = datetime.now(UTC)

        # IDs das categorias vinculadas ao profissional (subquery).
        prof_categories = (
            select(ProfessionalCategory.category_id)
            .where(ProfessionalCategory.professional_id == profile.id)
            .scalar_subquery()
        )

        stmt: Select = (
            select(Lead)
            .join(Category, Category.id == Lead.category_id)
            .join(User, User.id == Lead.customer_id)
            .where(
                Lead.deleted_at.is_(None),
                Lead.status == LeadStatus.open,
                or_(Lead.expires_at.is_(None), Lead.expires_at > now),
                Lead.category_id.in_(prof_categories),
                func.lower(Lead.city) == (profile.city or "").lower(),
                func.lower(Lead.state) == (profile.state or "").lower(),
            )
        )

        # Filtros opcionais adicionais do query string (refinam a elegibilidade).
        if category_id is not None:
            stmt = stmt.where(Lead.category_id == category_id)
        if city:
            stmt = stmt.where(func.lower(Lead.city) == city.lower())
        if state:
            stmt = stmt.where(func.lower(Lead.state) == state.lower())
        return stmt

    async def list_eligible_for_professional(
        self,
        profile: ProfessionalProfile,
        *,
        category_id: uuid.UUID | None = None,
        city: str | None = None,
        state: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Lead], int]:
        """Leads elegíveis para o profissional (matching MVP) + total.

        Se o perfil não tem ``city``/``state`` definidos, nenhum lead é elegível
        (a igualdade exata de cidade/estado é obrigatória — §5.3 item 4).
        """
        if not profile.city or not profile.state:
            return [], 0

        base = self._eligible_stmt(
            profile, category_id=category_id, city=city, state=state
        )
        total = await self._count(base)
        stmt = (
            base.options(
                selectinload(Lead.category),
                selectinload(Lead.customer),
                selectinload(Lead.purchase),
                selectinload(Lead.media),
            )
            .order_by(Lead.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    async def is_professional_eligible(
        self, profile: ProfessionalProfile, lead: Lead
    ) -> bool:
        """Reavalia a elegibilidade (§5.3) de um profissional para **um** lead.

        Útil para o detalhe (``GET /leads/{id}``) e para a Fase 5 (compra)
        revalidar antes de liberar contato/debitar créditos.
        """
        if not profile.city or not profile.state:
            return False
        stmt = self._eligible_stmt(
            profile, category_id=None, city=None, state=None
        ).where(Lead.id == lead.id)
        result = await self.db.execute(select(stmt.exists()))
        return bool(result.scalar())

    # ------------------------------------------------------------------ #
    # Suporte
    # ------------------------------------------------------------------ #
    async def get_professional_profile(
        self, user_id: uuid.UUID
    ) -> ProfessionalProfile | None:
        """Carrega o perfil profissional ativo do usuário (ou ``None``).

        Eager-load de ``wallet`` para que o service possa ler o saldo (flag
        ``affordable``) sem lazy-load fora do contexto async.
        """
        stmt = (
            select(ProfessionalProfile)
            .where(
                ProfessionalProfile.user_id == user_id,
                ProfessionalProfile.deleted_at.is_(None),
            )
            .options(selectinload(ProfessionalProfile.wallet))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def category_exists(self, category_id: uuid.UUID) -> Category | None:
        """Retorna a categoria (qualquer estado) por id, ou ``None``.

        O service decide se exige ``active`` — aqui apenas resolvemos o registro.
        """
        result = await self.db.execute(
            select(Category).where(Category.id == category_id)
        )
        return result.scalar_one_or_none()

    async def professional_has_purchased(
        self, lead: Lead, professional_id: uuid.UUID
    ) -> bool:
        """True se este profissional é o comprador deste lead (libera contato)."""
        purchase = lead.purchase
        if purchase is None:
            return False
        return purchase.professional_id == professional_id

    async def _count(self, base_stmt: Select) -> int:
        """Conta linhas de um ``select(Lead)`` reaproveitando seus filtros."""
        count_stmt = select(func.count()).select_from(base_stmt.subquery())
        result = await self.db.execute(count_stmt)
        return int(result.scalar_one())
