"""Repositório da feature ``reviews`` (Fase 7).

Camada de acesso a dados (queries SQLAlchemy async), **sem regra de negócio**
(§3.4). Recebe a ``AsyncSession`` por parâmetro e **não** faz ``commit`` — usa
``add``/``flush`` e deixa o commit para o service.

``reviews`` é append-only/imutável (§REVIEWS doc 04 + reputation-engine).
Inclui os agregados (média/contagem de scores recebidos) usados pelo service
para recalcular a reputação de forma atômica ao criar a avaliação.
"""

from __future__ import annotations

import uuid

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    CustomerProfile,
    Lead,
    LeadPurchase,
    ProfessionalProfile,
    Review,
)

__all__ = ["ReviewRepository"]


class ReviewRepository:
    """Acesso a dados de :class:`Review` + agregados de reputação."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------ #
    # Escrita
    # ------------------------------------------------------------------ #
    def add(self, review: Review) -> Review:
        """Adiciona a avaliação à sessão (sem commit — o service commita)."""
        self.db.add(review)
        return review

    async def flush(self) -> None:
        await self.db.flush()

    # ------------------------------------------------------------------ #
    # Lead + compra (para derivar os dois lados da transação)
    # ------------------------------------------------------------------ #
    async def get_lead_with_purchase(self, lead_id: uuid.UUID) -> Lead | None:
        """Carrega o lead (não soft-deleted) com a ``purchase`` e o ``customer``.

        A ``purchase`` traz o ``professional`` (e seu ``user``) — assim o service
        deriva os dois lados (contratante = ``lead.customer``; profissional =
        ``purchase.professional.user``) sem lazy-load fora do contexto async.
        """
        stmt: Select = (
            select(Lead)
            .where(Lead.id == lead_id, Lead.deleted_at.is_(None))
            .options(
                selectinload(Lead.customer),
                selectinload(Lead.purchase)
                .selectinload(LeadPurchase.professional)
                .selectinload(ProfessionalProfile.user),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    # ------------------------------------------------------------------ #
    # Existência (anti-duplicação UNIQUE(author_id, lead_id))
    # ------------------------------------------------------------------ #
    async def exists_for_author_lead(
        self, author_id: uuid.UUID, lead_id: uuid.UUID
    ) -> bool:
        """True se o autor já avaliou este lead (uma avaliação por contratação)."""
        stmt = select(
            select(Review.id)
            .where(Review.author_id == author_id, Review.lead_id == lead_id)
            .exists()
        )
        result = await self.db.execute(stmt)
        return bool(result.scalar())

    # ------------------------------------------------------------------ #
    # Avaliações RECEBIDAS por um usuário (público, paginado)
    # ------------------------------------------------------------------ #
    async def list_received(
        self, target_id: uuid.UUID, *, limit: int = 20, offset: int = 0
    ) -> tuple[list[Review], int]:
        """Avaliações recebidas por ``target_id`` (mais recentes) + total."""
        base: Select = select(Review).where(Review.target_id == target_id)
        total = await self._count(base)
        stmt = base.order_by(Review.created_at.desc()).limit(limit).offset(offset)
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    # ------------------------------------------------------------------ #
    # Agregados de reputação (média/contagem dos scores recebidos)
    # ------------------------------------------------------------------ #
    async def aggregates_for_target(
        self, target_id: uuid.UUID
    ) -> tuple[float, int]:
        """Retorna ``(média, contagem)`` dos scores recebidos por ``target_id``.

        Lê o estado **já gravado** (o service chama após o ``flush`` da nova
        avaliação), de modo que a média inclua a avaliação recém-criada.
        """
        stmt = select(
            func.avg(Review.score),
            func.count(Review.id),
        ).where(Review.target_id == target_id)
        result = await self.db.execute(stmt)
        avg, count = result.one()
        return (float(avg) if avg is not None else 0.0, int(count or 0))

    # ------------------------------------------------------------------ #
    # Perfis-alvo (para atualizar a reputação na mesma transação)
    # ------------------------------------------------------------------ #
    async def get_professional_profile_by_user(
        self, user_id: uuid.UUID
    ) -> ProfessionalProfile | None:
        """Perfil profissional ativo do usuário (para gravar ``rating``)."""
        result = await self.db.execute(
            select(ProfessionalProfile).where(
                ProfessionalProfile.user_id == user_id,
                ProfessionalProfile.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def get_customer_profile_by_user(
        self, user_id: uuid.UUID
    ) -> CustomerProfile | None:
        """Perfil customer ativo do usuário (para gravar ``reputation_score``)."""
        result = await self.db.execute(
            select(CustomerProfile).where(
                CustomerProfile.user_id == user_id,
                CustomerProfile.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def get_or_create_customer_profile_by_user(
        self, user_id: uuid.UUID
    ) -> CustomerProfile:
        """Perfil customer ativo do usuário, **criando-o** se não existir.

        Um contratante pode receber avaliações sem ter criado o
        ``customer_profile`` (leads.customer_id → users.id direto). Para que a
        ``reputation_score`` persista, criamos o perfil com defaults mínimos:
        ``city``/``state`` ficam ``None`` (ambos são ``nullable`` no modelo
        :class:`~app.models.customer_profile.CustomerProfile`) e o
        ``reputation_score`` usa o default da coluna (0.00) até ser sobrescrito
        pelo service. Sem commit (o service commita na mesma transação).
        """
        profile = await self.get_customer_profile_by_user(user_id)
        if profile is not None:
            return profile
        profile = CustomerProfile(user_id=user_id, city=None, state=None)
        self.db.add(profile)
        await self.db.flush()
        return profile

    # ------------------------------------------------------------------ #
    # Pendências: leads comprados em que o usuário participa e ainda não avaliou
    # ------------------------------------------------------------------ #
    async def list_purchased_leads_for_customer(
        self, customer_id: uuid.UUID
    ) -> list[Lead]:
        """Leads do contratante já comprados (com a ``purchase`` + profissional)."""
        stmt = (
            select(Lead)
            .join(LeadPurchase, LeadPurchase.lead_id == Lead.id)
            .where(Lead.customer_id == customer_id, Lead.deleted_at.is_(None))
            .options(
                selectinload(Lead.customer),
                selectinload(Lead.purchase)
                .selectinload(LeadPurchase.professional)
                .selectinload(ProfessionalProfile.user),
            )
            .order_by(Lead.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def list_purchased_leads_for_professional(
        self, professional_id: uuid.UUID
    ) -> list[Lead]:
        """Leads comprados por este profissional (com ``customer`` + profissional)."""
        stmt = (
            select(Lead)
            .join(LeadPurchase, LeadPurchase.lead_id == Lead.id)
            .where(
                LeadPurchase.professional_id == professional_id,
                Lead.deleted_at.is_(None),
            )
            .options(
                selectinload(Lead.customer),
                selectinload(Lead.purchase)
                .selectinload(LeadPurchase.professional)
                .selectinload(ProfessionalProfile.user),
            )
            .order_by(Lead.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def reviewed_lead_ids_for_author(
        self, author_id: uuid.UUID
    ) -> set[uuid.UUID]:
        """Conjunto de ``lead_id`` que o autor já avaliou (para filtrar pendências)."""
        result = await self.db.execute(
            select(Review.lead_id).where(Review.author_id == author_id)
        )
        return {row for row in result.scalars().all()}

    # ------------------------------------------------------------------ #
    # Suporte
    # ------------------------------------------------------------------ #
    async def _count(self, base_stmt: Select) -> int:
        count_stmt = select(func.count()).select_from(base_stmt.subquery())
        result = await self.db.execute(count_stmt)
        return int(result.scalar_one())
