"""Schemas Pydantic v2 da feature ``users`` (perfis — Fase 3).

Contrato §4 (Fase 3 — Perfis) e §5.2 (ownership/mass-assignment). Padrão de
nomes do contrato §3.3 (``<Entidade>Create``/``Update``/``Read``); a tarefa pede
os aliases ``...In``/``...Out``, que apontam para os schemas canônicos.

Regras de mass-assignment (§5.2): campos como ``reputation_score``, ``rating``,
``xp``, ``level``, ``verified``, ``premium`` e ``balance`` **nunca** vêm do
cliente — não estão nos schemas de entrada. O perfil é sempre do
``current_user`` (``/users/me/...``); o ``user_id`` nunca vem do corpo (IDOR).
"""

from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import AvailabilityStatus, CategoryTier

__all__ = [
    # Customer
    "CustomerProfileIn",
    "CustomerProfileUpdate",
    "CustomerProfileOut",
    # Professional
    "ProfessionalProfileIn",
    "ProfessionalProfileUpdate",
    "ProfessionalProfileOut",
    "ProfessionalProfilePublicOut",
    # Categorias
    "CategoryRefOut",
    "SetCategoriesIn",
    "CategoriesOut",
]


def _normalize_state(value: str | None) -> str | None:
    """UF em 2 letras maiúsculas (None permanece None)."""
    if value is None:
        return None
    return value.strip().upper()


# --------------------------------------------------------------------------- #
# Customer profile
# --------------------------------------------------------------------------- #
class CustomerProfileIn(BaseModel):
    """Corpo de ``POST /users/me/customer-profile``.

    ``reputation_score`` do contrato é ignorado (gerenciado em fases futuras —
    §2.4) e por isso **não** é exposto aqui (mass-assignment seguro).
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    city: str = Field(min_length=1, max_length=120)
    state: str = Field(min_length=2, max_length=2)

    @field_validator("state")
    @classmethod
    def _upper_state(cls, v: str) -> str:
        return v.upper()


class CustomerProfileUpdate(BaseModel):
    """Corpo de ``PATCH /users/me/customer-profile`` (parcial)."""

    model_config = ConfigDict(str_strip_whitespace=True)

    city: str | None = Field(default=None, min_length=1, max_length=120)
    state: str | None = Field(default=None, min_length=2, max_length=2)

    @field_validator("state")
    @classmethod
    def _upper_state(cls, v: str | None) -> str | None:
        return _normalize_state(v)


class CustomerProfileOut(BaseModel):
    """Resposta do perfil de contratante."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    city: str | None
    state: str | None


# --------------------------------------------------------------------------- #
# Categorias (referência embutida no perfil profissional)
# --------------------------------------------------------------------------- #
class CategoryRefOut(BaseModel):
    """Resumo de categoria vinculada ao profissional."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    tier: CategoryTier


class SetCategoriesIn(BaseModel):
    """Corpo de ``PUT /users/me/professional-profile/categories``.

    Substitui o conjunto de vínculos do profissional pelas categorias
    informadas. Lista pode ser vazia (remove todos os vínculos).
    """

    category_ids: list[uuid.UUID] = Field(default_factory=list)


class CategoriesOut(BaseModel):
    """Envelope ``{categories: [...]}`` (§4)."""

    categories: list[CategoryRefOut]


# --------------------------------------------------------------------------- #
# Professional profile
# --------------------------------------------------------------------------- #
class ProfessionalProfileIn(BaseModel):
    """Corpo de ``POST /users/me/professional-profile``.

    Cria o perfil 1:1 **+ a carteira de créditos automática** (§2.8). Pode
    vincular categorias de início via ``category_ids``. Campos de
    reputação/gamificação não são aceitos (§5.2).
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    headline: str | None = Field(default=None, max_length=160)
    bio: str | None = None
    city: str = Field(min_length=1, max_length=120)
    state: str = Field(min_length=2, max_length=2)
    service_radius_km: int = Field(default=10, ge=0, le=1000)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    availability_status: AvailabilityStatus = AvailabilityStatus.available
    category_ids: list[uuid.UUID] = Field(default_factory=list)

    @field_validator("state")
    @classmethod
    def _upper_state(cls, v: str) -> str:
        return v.upper()


class ProfessionalProfileUpdate(BaseModel):
    """Corpo de ``PATCH /users/me/professional-profile`` (parcial).

    Não altera categorias (use ``PUT .../categories``) nem campos protegidos.
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    headline: str | None = Field(default=None, max_length=160)
    bio: str | None = None
    city: str | None = Field(default=None, min_length=1, max_length=120)
    state: str | None = Field(default=None, min_length=2, max_length=2)
    service_radius_km: int | None = Field(default=None, ge=0, le=1000)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    availability_status: AvailabilityStatus | None = None

    @field_validator("state")
    @classmethod
    def _upper_state(cls, v: str | None) -> str | None:
        return _normalize_state(v)


class ProfessionalProfileOut(BaseModel):
    """Resposta do perfil profissional (visão do próprio dono).

    Inclui ``categories[]`` e o ``balance`` da carteira (visível ao dono).
    A reputação (``rating``/``total_reviews``) é exposta também ao dono (Fase 7).
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    headline: str | None
    bio: str | None
    city: str | None
    state: str | None
    service_radius_km: int
    latitude: float | None = None
    longitude: float | None = None
    availability_status: AvailabilityStatus

    # Reputação (Fase 7) — populada a partir de professional_profiles.
    rating: float = Field(default=0.0, ge=0, le=5)
    total_reviews: int = Field(default=0, ge=0)

    # Campos compostos montados no service.
    categories: list[CategoryRefOut] = Field(default_factory=list)
    balance: int = 0


class ProfessionalProfilePublicOut(BaseModel):
    """Perfil público do profissional (``GET /users/{user_id}/professional-profile``).

    Sem dados sensíveis (não expõe saldo da carteira nem dados do usuário).
    Expõe a reputação (``rating``/``total_reviews``) para a UI mostrar estrelas
    (Fase 7).
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    headline: str | None
    bio: str | None
    city: str | None
    state: str | None
    service_radius_km: int
    availability_status: AvailabilityStatus

    # Reputação (Fase 7) — populada a partir de professional_profiles.
    rating: float = Field(default=0.0, ge=0, le=5)
    total_reviews: int = Field(default=0, ge=0)

    # Dados do usuário (montados no service) para a tela de perfil público.
    name: str | None = None
    avatar_url: str | None = None
    verified: bool = False
    is_favorited: bool = False

    categories: list[CategoryRefOut] = Field(default_factory=list)


class FavoriteIn(BaseModel):
    professional_user_id: uuid.UUID


class ProfessionalSearchItem(BaseModel):
    """Item do catálogo de profissionais (busca pelo cliente)."""

    user_id: uuid.UUID
    name: str
    avatar_url: str | None = None
    headline: str | None = None
    city: str | None = None
    state: str | None = None
    rating: float = Field(default=0.0, ge=0, le=5)
    total_reviews: int = Field(default=0, ge=0)
    verified: bool = False


class ProfessionalSearchList(BaseModel):
    items: list[ProfessionalSearchItem]
    total: int
