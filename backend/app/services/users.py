"""Service da feature ``users`` (perfis — Fase 3).

Concentra a regra de negócio (§3.5): ownership/papéis (§5.2), criação 1:1 dos
perfis (409 se já existe), criação **automática da carteira** ao criar o perfil
profissional (§2.8) e gestão das categorias do profissional (N:N, validando a
existência das categorias — §2.6). Faz o ``commit`` (o repositório só faz
``flush``).

Decisões:
- ``POST /users/me/customer-profile`` exige ``role == customer``; o profissional
  análogo exige ``role == professional`` (defesa em profundidade — a rota também
  aplica ``require_roles``).
- A carteira é criada na **mesma transação** do perfil profissional (single
  commit): o profissional sempre nasce com wallet de saldo 0.
- Categorias informadas que não existem → 422 (``DomainValidationError``).
"""

from __future__ import annotations

import contextlib
import uuid
from datetime import UTC, datetime

from sqlalchemy import delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import (
    ConflictError,
    DomainValidationError,
    NotFoundError,
)
from app.core.storage import delete_object, presigned_get_url
from app.models import (
    Category,
    CustomerProfile,
    Lead,
    ProfessionalProfile,
    User,
    UserRole,
    UserStatus,
)
from app.models.refresh_token import RefreshToken
from app.repositories.users import UserProfileRepository
from app.schemas.users import (
    CategoryRefOut,
    CustomerProfileIn,
    CustomerProfileOut,
    CustomerProfileUpdate,
    ProfessionalProfileIn,
    ProfessionalProfileOut,
    ProfessionalProfilePublicOut,
    ProfessionalProfileUpdate,
    ProfessionalSearchItem,
    ProfessionalSearchList,
)

__all__ = ["UserProfileService"]


class UserProfileService:
    """Orquestra perfis (customer/professional), wallet e categorias."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = UserProfileRepository(db)

    # ================================================================== #
    # Exclusão de conta (LGPD Art. 18 / exigência das app stores)
    # ================================================================== #
    async def delete_account(self, user: User) -> None:
        """Exclui a conta do usuário autenticado.

        Soft-delete + **anonimização** dos dados pessoais (direito de
        eliminação da LGPD), preservando integridade referencial: leads,
        avaliações e compras permanecem com o autor anonimizado. Revoga as
        sessões e invalida os tokens vivos (token_version). Conta de admin não
        é excluível por aqui (evita travar o sistema sem dono).
        """
        if user.role == UserRole.admin:
            raise ConflictError(
                "Conta de administrador não pode ser excluída por aqui."
            )
        now = datetime.now(UTC)

        # Revoga sessões (refresh) + invalida access tokens vivos.
        await self.db.execute(
            delete(RefreshToken).where(RefreshToken.user_id == user.id)
        )
        user.token_version = (user.token_version or 0) + 1

        # Apaga mídias pessoais do storage (best-effort): avatar (bucket público)
        # e documento/selfie do KYC (bucket privado).
        if user.avatar_key:
            with contextlib.suppress(Exception):
                delete_object(user.avatar_key)
        for key in (user.kyc_document_key, user.kyc_selfie_key):
            if key:
                with contextlib.suppress(Exception):
                    delete_object(key, bucket=settings.S3_KYC_BUCKET)

        # Soft-delete dos perfis (somem de busca/ranking/matching) e cancela os
        # pedidos abertos (ninguém compra lead de conta excluída). Via UPDATE
        # para não disparar lazy-load de relacionamento em contexto async.
        await self.db.execute(
            update(CustomerProfile)
            .where(
                CustomerProfile.user_id == user.id,
                CustomerProfile.deleted_at.is_(None),
            )
            .values(deleted_at=now)
        )
        await self.db.execute(
            update(ProfessionalProfile)
            .where(
                ProfessionalProfile.user_id == user.id,
                ProfessionalProfile.deleted_at.is_(None),
            )
            .values(deleted_at=now)
        )
        await self.db.execute(
            update(Lead)
            .where(Lead.customer_id == user.id, Lead.deleted_at.is_(None))
            .values(deleted_at=now)
        )

        # Anonimiza PII, mantendo a linha para integridade referencial.
        user.name = "Conta excluída"
        user.email = f"deleted-{user.id}@faztudo.invalid"
        user.phone = None
        user.password_hash = None
        user.document = None
        user.gender = None
        user.birth_date = None
        user.google_sub = None
        user.apple_sub = None
        user.avatar_key = None
        user.kyc_document_key = None
        user.kyc_selfie_key = None
        user.kyc_status = "none"
        user.kyc_reject_reason = None
        user.status = UserStatus.blocked
        user.deleted_at = now
        await self.db.commit()

    # ================================================================== #
    # Busca de profissionais (catálogo do cliente)
    # ================================================================== #
    async def search_professionals(
        self,
        *,
        category_id: uuid.UUID | None = None,
        city: str | None = None,
        state: str | None = None,
        query: str | None = None,
    ) -> ProfessionalSearchList:
        """Catálogo de profissionais para o cliente (busca + reputação)."""
        rows = await self.repo.search_professionals(
            category_id=category_id, city=city, state=state, query=query
        )
        items = [self._search_item(profile, user) for profile, user in rows]
        return ProfessionalSearchList(items=items, total=len(items))

    def _search_item(
        self, profile: ProfessionalProfile, user: User
    ) -> ProfessionalSearchItem:
        avatar = None
        if user.avatar_key:
            with contextlib.suppress(Exception):
                avatar = presigned_get_url(user.avatar_key)
        return ProfessionalSearchItem(
            user_id=user.id,
            name=user.name,
            avatar_url=avatar,
            headline=profile.headline,
            city=profile.city,
            state=profile.state,
            rating=profile.rating,
            total_reviews=profile.total_reviews,
            verified=(user.kyc_status == "approved"),
        )

    # ================================================================== #
    # Favoritos (profissionais salvos pelo cliente)
    # ================================================================== #
    async def add_favorite(self, user: User, pro_user_id: uuid.UUID) -> None:
        await self.repo.add_favorite(user.id, pro_user_id)
        await self.db.commit()

    async def remove_favorite(
        self, user: User, pro_user_id: uuid.UUID
    ) -> None:
        await self.repo.remove_favorite(user.id, pro_user_id)
        await self.db.commit()

    async def list_favorites(self, user: User) -> ProfessionalSearchList:
        rows = await self.repo.list_favorites(user.id)
        items = [self._search_item(profile, u) for profile, u in rows]
        return ProfessionalSearchList(items=items, total=len(items))

    # ================================================================== #
    # Bloqueio entre usuários
    # ================================================================== #
    async def block_user(self, user: User, target_id: uuid.UUID) -> None:
        if target_id == user.id:
            raise ConflictError("Não é possível bloquear a si mesmo.")
        await self.repo.add_block(user.id, target_id)
        await self.db.commit()

    async def unblock_user(self, user: User, target_id: uuid.UUID) -> None:
        await self.repo.remove_block(user.id, target_id)
        await self.db.commit()

    # ================================================================== #
    # Customer profile
    # ================================================================== #
    async def create_customer_profile(
        self, current_user: User, data: CustomerProfileIn
    ) -> CustomerProfileOut:
        """Cria o perfil de contratante (1:1; 409 se já existe).

        Papel duplo: qualquer usuário pode criar o perfil de contratante (é o
        que "ativa" a conta de contratante para quem é profissional).
        """
        existing = await self.repo.get_customer_profile(current_user.id)
        if existing is not None:
            raise ConflictError("Perfil de contratante já existe.")

        profile = CustomerProfile(
            user_id=current_user.id, city=data.city, state=data.state
        )
        self.repo.add_customer_profile(profile)
        await self.repo.flush()
        await self.db.commit()
        return CustomerProfileOut.model_validate(profile)

    async def get_customer_profile(
        self, current_user: User
    ) -> CustomerProfileOut:
        """Retorna o perfil de contratante do usuário (404 se não existe)."""
        profile = await self.repo.get_customer_profile(current_user.id)
        if profile is None:
            raise NotFoundError("Perfil de contratante não encontrado.")
        return CustomerProfileOut.model_validate(profile)

    async def update_customer_profile(
        self, current_user: User, data: CustomerProfileUpdate
    ) -> CustomerProfileOut:
        """Atualiza campos do perfil de contratante (apenas o próprio)."""
        profile = await self.repo.get_customer_profile(current_user.id)
        if profile is None:
            raise NotFoundError("Perfil de contratante não encontrado.")

        payload = data.model_dump(exclude_unset=True)
        if "city" in payload and payload["city"] is not None:
            profile.city = payload["city"]
        if "state" in payload and payload["state"] is not None:
            profile.state = payload["state"]

        await self.repo.flush()
        await self.db.commit()
        return CustomerProfileOut.model_validate(profile)

    # ================================================================== #
    # Professional profile
    # ================================================================== #
    async def create_professional_profile(
        self, current_user: User, data: ProfessionalProfileIn
    ) -> ProfessionalProfileOut:
        """Cria o perfil profissional (1:1) **+ a carteira automática** (§2.8).

        Tudo na mesma transação (single commit): perfil, wallet (saldo 0) e os
        vínculos de categoria informados (validando que existem).

        Papel duplo: qualquer usuário pode criar o perfil profissional (é o que
        "ativa" a conta de profissional para quem é contratante).
        """
        existing = await self.repo.get_professional_profile(
            current_user.id, with_relations=False
        )
        if existing is not None:
            raise ConflictError("Perfil profissional já existe.")

        # Valida categorias (se houver) antes de qualquer escrita.
        await self._validate_categories_exist(data.category_ids)

        profile = ProfessionalProfile(
            user_id=current_user.id,
            headline=data.headline,
            bio=data.bio,
            city=data.city,
            state=data.state,
            service_radius_km=data.service_radius_km,
            latitude=data.latitude,
            longitude=data.longitude,
            availability_status=data.availability_status,
        )
        self.repo.add_professional_profile(profile)
        await self.repo.flush()  # garante profile.id para wallet/categorias

        # Carteira automática — §2.8. Saldo inicial = bônus de boas-vindas
        # (FREE_SIGNUP_CREDITS; 0 = desligado). Útil no beta sem pagamento.
        self.repo.add_wallet_for_professional(
            profile.id, balance=settings.FREE_SIGNUP_CREDITS
        )

        if data.category_ids:
            await self.repo.replace_professional_categories(
                profile.id, data.category_ids
            )

        await self.repo.flush()
        await self.db.commit()

        return await self._build_professional_out(current_user.id)

    async def get_professional_profile(
        self, current_user: User
    ) -> ProfessionalProfileOut:
        """Retorna o perfil profissional do usuário (404 se não existe)."""
        profile = await self.repo.get_professional_profile(current_user.id)
        if profile is None:
            raise NotFoundError("Perfil profissional não encontrado.")
        return self._to_professional_out(profile)

    async def update_professional_profile(
        self, current_user: User, data: ProfessionalProfileUpdate
    ) -> ProfessionalProfileOut:
        """Atualiza campos do perfil profissional (apenas o próprio)."""
        profile = await self.repo.get_professional_profile(current_user.id)
        if profile is None:
            raise NotFoundError("Perfil profissional não encontrado.")

        payload = data.model_dump(exclude_unset=True)
        if "headline" in payload:
            profile.headline = payload["headline"]
        if "bio" in payload:
            profile.bio = payload["bio"]
        if "city" in payload and payload["city"] is not None:
            profile.city = payload["city"]
        if "state" in payload and payload["state"] is not None:
            profile.state = payload["state"]
        if (
            "service_radius_km" in payload
            and payload["service_radius_km"] is not None
        ):
            profile.service_radius_km = payload["service_radius_km"]
        if "latitude" in payload:
            profile.latitude = payload["latitude"]
        if "longitude" in payload:
            profile.longitude = payload["longitude"]
        if (
            "availability_status" in payload
            and payload["availability_status"] is not None
        ):
            profile.availability_status = payload["availability_status"]

        await self.repo.flush()
        await self.db.commit()
        return await self._build_professional_out(current_user.id)

    async def get_public_professional_profile(
        self, user_id: uuid.UUID, *, viewer_id: uuid.UUID | None = None
    ) -> ProfessionalProfilePublicOut:
        """Perfil público de um profissional (sem dados sensíveis)."""
        profile = await self.repo.get_professional_profile(user_id)
        if profile is None:
            raise NotFoundError("Perfil profissional não encontrado.")
        user = await self.db.get(User, user_id)
        avatar = None
        if user is not None and user.avatar_key:
            with contextlib.suppress(Exception):
                avatar = presigned_get_url(user.avatar_key)
        is_fav = (
            await self.repo.is_favorite(viewer_id, user_id)
            if viewer_id is not None
            else False
        )
        return ProfessionalProfilePublicOut(
            id=profile.id,
            user_id=profile.user_id,
            headline=profile.headline,
            bio=profile.bio,
            city=profile.city,
            state=profile.state,
            service_radius_km=profile.service_radius_km,
            availability_status=profile.availability_status,
            rating=float(profile.rating),
            total_reviews=profile.total_reviews,
            name=user.name if user is not None else None,
            avatar_url=avatar,
            verified=bool(user is not None and user.kyc_status == "approved"),
            is_favorited=is_fav,
            categories=self._categories_out(profile.categories),
        )

    # ================================================================== #
    # Categorias do profissional (N:N)
    # ================================================================== #
    async def set_professional_categories(
        self, current_user: User, category_ids: list[uuid.UUID]
    ) -> list[CategoryRefOut]:
        """Substitui o conjunto de categorias do profissional (§2.6).

        Valida que todas as categorias existem (senão 422). Lista vazia remove
        todos os vínculos.
        """
        profile = await self.repo.get_professional_profile(
            current_user.id, with_relations=False
        )
        if profile is None:
            raise NotFoundError("Perfil profissional não encontrado.")

        await self._validate_categories_exist(category_ids)
        await self.repo.replace_professional_categories(profile.id, category_ids)
        await self.db.commit()

        categories = await self.repo.list_categories(
            list(dict.fromkeys(category_ids))
        )
        return self._categories_out(categories)

    async def get_professional_categories(
        self, current_user: User
    ) -> list[CategoryRefOut]:
        """Retorna as categorias vinculadas ao profissional."""
        profile = await self.repo.get_professional_profile(current_user.id)
        if profile is None:
            raise NotFoundError("Perfil profissional não encontrado.")
        return self._categories_out(profile.categories)

    # ================================================================== #
    # Helpers internos
    # ================================================================== #
    async def _validate_categories_exist(
        self, category_ids: list[uuid.UUID]
    ) -> None:
        """Garante que todos os ``category_ids`` existem (senão 422)."""
        if not category_ids:
            return
        unique_ids = list(dict.fromkeys(category_ids))
        existing = await self.repo.get_existing_category_ids(unique_ids)
        missing = [cid for cid in unique_ids if cid not in existing]
        if missing:
            raise DomainValidationError(
                "Uma ou mais categorias informadas não existem: "
                + ", ".join(str(cid) for cid in missing)
            )

    async def _build_professional_out(
        self, user_id: uuid.UUID
    ) -> ProfessionalProfileOut:
        """Recarrega o perfil com relações e monta a resposta do dono."""
        profile = await self.repo.get_professional_profile(user_id)
        assert profile is not None  # acabou de ser criado/atualizado
        return self._to_professional_out(profile)

    def _to_professional_out(
        self, profile: ProfessionalProfile
    ) -> ProfessionalProfileOut:
        """Monta o ``ProfessionalProfileOut`` (visão do dono, com saldo)."""
        balance = profile.wallet.balance if profile.wallet is not None else 0
        return ProfessionalProfileOut(
            id=profile.id,
            user_id=profile.user_id,
            headline=profile.headline,
            bio=profile.bio,
            city=profile.city,
            state=profile.state,
            service_radius_km=profile.service_radius_km,
            latitude=(
                float(profile.latitude) if profile.latitude is not None else None
            ),
            longitude=(
                float(profile.longitude)
                if profile.longitude is not None
                else None
            ),
            availability_status=profile.availability_status,
            rating=float(profile.rating),
            total_reviews=profile.total_reviews,
            categories=self._categories_out(profile.categories),
            balance=balance,
        )

    @staticmethod
    def _categories_out(categories: list[Category]) -> list[CategoryRefOut]:
        """Converte categorias ORM em ``CategoryRefOut`` ordenadas por nome."""
        ordered = sorted(categories, key=lambda c: c.name.lower())
        return [CategoryRefOut.model_validate(c) for c in ordered]
