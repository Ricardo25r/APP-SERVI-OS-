"""Repositório da feature ``users`` (perfis — Fase 3).

Somente acesso a dados (queries SQLAlchemy async) — **sem** regra de negócio
(§3.4). Recebe a ``AsyncSession`` por parâmetro e **não** faz ``commit`` (usa
``add``/``flush``); quem commita é o service. Filtra ``deleted_at IS NULL`` nos
perfis (soft delete).

Responsável também por:
- criar a :class:`~app.models.CreditWallet` junto do perfil profissional (§2.8);
- gerenciar os vínculos N:N ``professional_categories`` (set/replace) e validar
  a existência das categorias (§2.6).
"""

from __future__ import annotations

import uuid

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    AvailabilityStatus,
    Category,
    CreditWallet,
    CustomerProfile,
    Favorite,
    ProfessionalCategory,
    ProfessionalProfile,
    User,
    UserBlock,
    UserStatus,
)

__all__ = ["UserProfileRepository"]


class UserProfileRepository:
    """Acesso a dados de perfis (customer/professional), wallet e categorias."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def flush(self) -> None:
        await self.db.flush()

    # ------------------------------------------------------------------ #
    # Customer profile
    # ------------------------------------------------------------------ #
    async def get_customer_profile(
        self, user_id: uuid.UUID
    ) -> CustomerProfile | None:
        """Perfil de contratante ativo do usuário (ou ``None``)."""
        result = await self.db.execute(
            select(CustomerProfile).where(
                CustomerProfile.user_id == user_id,
                CustomerProfile.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    def add_customer_profile(self, profile: CustomerProfile) -> CustomerProfile:
        """Adiciona o perfil de contratante à sessão (sem commit)."""
        self.db.add(profile)
        return profile

    # ------------------------------------------------------------------ #
    # Professional profile
    # ------------------------------------------------------------------ #
    async def get_professional_profile(
        self, user_id: uuid.UUID, *, with_relations: bool = True
    ) -> ProfessionalProfile | None:
        """Perfil profissional ativo do usuário (ou ``None``).

        Com ``with_relations`` carrega ``categories`` e ``wallet`` (eager) para
        montar a resposta sem lazy-load fora do contexto async.
        """
        stmt = select(ProfessionalProfile).where(
            ProfessionalProfile.user_id == user_id,
            ProfessionalProfile.deleted_at.is_(None),
        )
        if with_relations:
            stmt = stmt.options(
                selectinload(ProfessionalProfile.categories),
                selectinload(ProfessionalProfile.wallet),
            )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_professional_profile_by_id(
        self, profile_id: uuid.UUID, *, with_relations: bool = True
    ) -> ProfessionalProfile | None:
        """Perfil profissional ativo por ``id`` (ou ``None``)."""
        stmt = select(ProfessionalProfile).where(
            ProfessionalProfile.id == profile_id,
            ProfessionalProfile.deleted_at.is_(None),
        )
        if with_relations:
            stmt = stmt.options(
                selectinload(ProfessionalProfile.categories),
                selectinload(ProfessionalProfile.wallet),
            )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    def add_professional_profile(
        self, profile: ProfessionalProfile
    ) -> ProfessionalProfile:
        """Adiciona o perfil profissional à sessão (sem commit)."""
        self.db.add(profile)
        return profile

    async def search_professionals(
        self,
        *,
        category_id: uuid.UUID | None = None,
        city: str | None = None,
        state: str | None = None,
        query: str | None = None,
        limit: int = 60,
    ) -> list[tuple[ProfessionalProfile, User]]:
        """Catálogo de profissionais (busca do cliente).

        Filtra por categoria (N:N), cidade/estado e texto (nome/headline). Só
        contas ativas e perfis não excluídos. Ordena por reputação.
        """
        stmt = (
            select(ProfessionalProfile, User)
            .join(User, ProfessionalProfile.user_id == User.id)
            .where(
                ProfessionalProfile.deleted_at.is_(None),
                User.deleted_at.is_(None),
                User.status == UserStatus.active,
                # Não lista quem se marcou indisponível (#49).
                ProfessionalProfile.availability_status
                != AvailabilityStatus.unavailable,
            )
        )
        if category_id is not None:
            stmt = stmt.join(
                ProfessionalCategory,
                ProfessionalCategory.professional_id == ProfessionalProfile.id,
            ).where(ProfessionalCategory.category_id == category_id)
        if city:
            stmt = stmt.where(
                func.lower(ProfessionalProfile.city) == city.strip().lower()
            )
        if state:
            stmt = stmt.where(
                func.lower(ProfessionalProfile.state) == state.strip().lower()
            )
        if query and query.strip():
            like = f"%{query.strip()}%"
            stmt = stmt.where(
                or_(
                    User.name.ilike(like),
                    ProfessionalProfile.headline.ilike(like),
                )
            )
        stmt = stmt.order_by(
            ProfessionalProfile.verified.desc(),
            ProfessionalProfile.rating.desc(),
            ProfessionalProfile.total_reviews.desc(),
        ).limit(limit)
        return list((await self.db.execute(stmt)).all())

    # ------------------------------------------------------------------ #
    # Favoritos (profissionais salvos pelo cliente)
    # ------------------------------------------------------------------ #
    async def is_favorite(
        self, user_id: uuid.UUID, pro_user_id: uuid.UUID
    ) -> bool:
        row = (
            await self.db.execute(
                select(Favorite.id).where(
                    Favorite.user_id == user_id,
                    Favorite.professional_user_id == pro_user_id,
                )
            )
        ).first()
        return row is not None

    async def add_favorite(
        self, user_id: uuid.UUID, pro_user_id: uuid.UUID
    ) -> None:
        if not await self.is_favorite(user_id, pro_user_id):
            self.db.add(
                Favorite(user_id=user_id, professional_user_id=pro_user_id)
            )
            await self.db.flush()

    async def remove_favorite(
        self, user_id: uuid.UUID, pro_user_id: uuid.UUID
    ) -> None:
        await self.db.execute(
            delete(Favorite).where(
                Favorite.user_id == user_id,
                Favorite.professional_user_id == pro_user_id,
            )
        )

    async def list_favorites(
        self, user_id: uuid.UUID
    ) -> list[tuple[ProfessionalProfile, User]]:
        stmt = (
            select(ProfessionalProfile, User)
            .join(User, ProfessionalProfile.user_id == User.id)
            .join(Favorite, Favorite.professional_user_id == User.id)
            .where(
                Favorite.user_id == user_id,
                ProfessionalProfile.deleted_at.is_(None),
                User.deleted_at.is_(None),
            )
            .order_by(Favorite.created_at.desc())
        )
        return list((await self.db.execute(stmt)).all())

    # ------------------------------------------------------------------ #
    # Bloqueio entre usuários
    # ------------------------------------------------------------------ #
    async def add_block(
        self, blocker_id: uuid.UUID, blocked_id: uuid.UUID
    ) -> None:
        exists = (
            await self.db.execute(
                select(UserBlock.id).where(
                    UserBlock.blocker_id == blocker_id,
                    UserBlock.blocked_id == blocked_id,
                )
            )
        ).first()
        if exists is None:
            self.db.add(
                UserBlock(blocker_id=blocker_id, blocked_id=blocked_id)
            )
            await self.db.flush()

    async def remove_block(
        self, blocker_id: uuid.UUID, blocked_id: uuid.UUID
    ) -> None:
        await self.db.execute(
            delete(UserBlock).where(
                UserBlock.blocker_id == blocker_id,
                UserBlock.blocked_id == blocked_id,
            )
        )

    # ------------------------------------------------------------------ #
    # Carteira de créditos (criada junto do perfil profissional — §2.8)
    # ------------------------------------------------------------------ #
    def add_wallet_for_professional(
        self, professional_id: uuid.UUID, *, balance: int = 0
    ) -> CreditWallet:
        """Cria a carteira (saldo inicial 0) do perfil profissional (sem commit)."""
        wallet = CreditWallet(professional_id=professional_id, balance=balance)
        self.db.add(wallet)
        return wallet

    # ------------------------------------------------------------------ #
    # Categorias (N:N professional_categories)
    # ------------------------------------------------------------------ #
    async def get_existing_category_ids(
        self, category_ids: list[uuid.UUID]
    ) -> set[uuid.UUID]:
        """Subconjunto dos ``category_ids`` que existem em ``categories``.

        Usado pelo service para validar que todas as categorias informadas
        existem antes de criar os vínculos (§2.6).
        """
        if not category_ids:
            return set()
        result = await self.db.execute(
            select(Category.id).where(Category.id.in_(category_ids))
        )
        return set(result.scalars().all())

    async def list_categories(
        self, category_ids: list[uuid.UUID]
    ) -> list[Category]:
        """Carrega as categorias dos ``ids`` informados (para a resposta)."""
        if not category_ids:
            return []
        result = await self.db.execute(
            select(Category)
            .where(Category.id.in_(category_ids))
            .order_by(Category.name.asc())
        )
        return list(result.scalars().all())

    async def replace_professional_categories(
        self, professional_id: uuid.UUID, category_ids: list[uuid.UUID]
    ) -> None:
        """Substitui **todos** os vínculos do profissional pelos informados.

        Remove os vínculos atuais e insere os novos (deduplicados). Não faz
        commit (o service commita). A validação de existência das categorias é
        feita no service antes de chamar este método.
        """
        await self.db.execute(
            delete(ProfessionalCategory).where(
                ProfessionalCategory.professional_id == professional_id
            )
        )
        for cid in dict.fromkeys(category_ids):  # preserva ordem, sem duplicar
            self.db.add(
                ProfessionalCategory(
                    professional_id=professional_id, category_id=cid
                )
            )
        await self.db.flush()
