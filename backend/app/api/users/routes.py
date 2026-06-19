"""Rotas da feature ``users`` (perfis — Fase 3) — ``router = APIRouter()`` (§3.6).

Prefixo ``/users`` é aplicado pelo agregador (``app.api.__init__``). Caminhos
relativos. As rotas chamam o :class:`UserProfileService`; exceções de domínio
viram HTTP no handler global (§3.9).

Endpoints (§4 — Fase 3, feature ``users``):
- ``POST/GET/PATCH /me/customer-profile``        → customer.
- ``POST/GET/PATCH /me/professional-profile``    → professional (POST cria wallet).
- ``PUT/GET /me/professional-profile/categories``→ professional.
- ``GET /{user_id}/professional-profile``        → qualquer (perfil público).
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_roles
from app.database.session import get_db
from app.models import User, UserRole
from app.schemas.users import (
    CategoriesOut,
    CustomerProfileIn,
    CustomerProfileOut,
    CustomerProfileUpdate,
    ProfessionalProfileIn,
    ProfessionalProfileOut,
    ProfessionalProfilePublicOut,
    ProfessionalProfileUpdate,
    SetCategoriesIn,
)
from app.services.users import UserProfileService

router = APIRouter()


# --------------------------------------------------------------------------- #
# Customer profile
# --------------------------------------------------------------------------- #
@router.post(
    "/me/customer-profile",
    response_model=CustomerProfileOut,
    status_code=status.HTTP_201_CREATED,
    summary="Criar perfil de contratante",
)
async def create_customer_profile(
    payload: CustomerProfileIn,
    current_user: User = Depends(require_roles(UserRole.customer)),
    db: AsyncSession = Depends(get_db),
) -> CustomerProfileOut:
    """Cria o perfil 1:1 do contratante (409 se já existe)."""
    service = UserProfileService(db)
    return await service.create_customer_profile(current_user, payload)


@router.get(
    "/me/customer-profile",
    response_model=CustomerProfileOut,
    summary="Obter o próprio perfil de contratante",
)
async def get_customer_profile(
    current_user: User = Depends(require_roles(UserRole.customer)),
    db: AsyncSession = Depends(get_db),
) -> CustomerProfileOut:
    service = UserProfileService(db)
    return await service.get_customer_profile(current_user)


@router.patch(
    "/me/customer-profile",
    response_model=CustomerProfileOut,
    summary="Atualizar o próprio perfil de contratante",
)
async def update_customer_profile(
    payload: CustomerProfileUpdate,
    current_user: User = Depends(require_roles(UserRole.customer)),
    db: AsyncSession = Depends(get_db),
) -> CustomerProfileOut:
    service = UserProfileService(db)
    return await service.update_customer_profile(current_user, payload)


# --------------------------------------------------------------------------- #
# Professional profile
# --------------------------------------------------------------------------- #
@router.post(
    "/me/professional-profile",
    response_model=ProfessionalProfileOut,
    status_code=status.HTTP_201_CREATED,
    summary="Criar perfil profissional (+ carteira automática)",
)
async def create_professional_profile(
    payload: ProfessionalProfileIn,
    current_user: User = Depends(require_roles(UserRole.professional)),
    db: AsyncSession = Depends(get_db),
) -> ProfessionalProfileOut:
    """Cria o perfil 1:1 do profissional, a carteira de créditos (saldo 0) e os
    vínculos de categoria informados (409 se já existe; 422 se categoria
    inexistente)."""
    service = UserProfileService(db)
    return await service.create_professional_profile(current_user, payload)


@router.get(
    "/me/professional-profile",
    response_model=ProfessionalProfileOut,
    summary="Obter o próprio perfil profissional",
)
async def get_professional_profile(
    current_user: User = Depends(require_roles(UserRole.professional)),
    db: AsyncSession = Depends(get_db),
) -> ProfessionalProfileOut:
    service = UserProfileService(db)
    return await service.get_professional_profile(current_user)


@router.patch(
    "/me/professional-profile",
    response_model=ProfessionalProfileOut,
    summary="Atualizar o próprio perfil profissional",
)
async def update_professional_profile(
    payload: ProfessionalProfileUpdate,
    current_user: User = Depends(require_roles(UserRole.professional)),
    db: AsyncSession = Depends(get_db),
) -> ProfessionalProfileOut:
    service = UserProfileService(db)
    return await service.update_professional_profile(current_user, payload)


# --------------------------------------------------------------------------- #
# Categorias do profissional (N:N)
# --------------------------------------------------------------------------- #
@router.put(
    "/me/professional-profile/categories",
    response_model=CategoriesOut,
    summary="Definir (substituir) as categorias do profissional",
)
async def set_professional_categories(
    payload: SetCategoriesIn,
    current_user: User = Depends(require_roles(UserRole.professional)),
    db: AsyncSession = Depends(get_db),
) -> CategoriesOut:
    """Substitui o conjunto de categorias vinculadas (422 se alguma não existe)."""
    service = UserProfileService(db)
    categories = await service.set_professional_categories(
        current_user, payload.category_ids
    )
    return CategoriesOut(categories=categories)


@router.get(
    "/me/professional-profile/categories",
    response_model=CategoriesOut,
    summary="Listar as categorias do profissional",
)
async def get_professional_categories(
    current_user: User = Depends(require_roles(UserRole.professional)),
    db: AsyncSession = Depends(get_db),
) -> CategoriesOut:
    service = UserProfileService(db)
    categories = await service.get_professional_categories(current_user)
    return CategoriesOut(categories=categories)


# --------------------------------------------------------------------------- #
# Perfil público
# --------------------------------------------------------------------------- #
@router.get(
    "/{user_id}/professional-profile",
    response_model=ProfessionalProfilePublicOut,
    summary="Perfil público de um profissional",
)
async def get_public_professional_profile(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProfessionalProfilePublicOut:
    """Leitura pública (qualquer usuário autenticado) do perfil de um
    profissional; sem dados sensíveis."""
    service = UserProfileService(db)
    return await service.get_public_professional_profile(user_id)
