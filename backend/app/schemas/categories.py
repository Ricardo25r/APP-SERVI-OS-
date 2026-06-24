"""Schemas Pydantic v2 da feature ``categories`` (Fase 3).

Contratos de entrada/saída dos endpoints ``/categories`` (§4 do contrato):

- :class:`CategoryIn`     — corpo do ``POST /categories`` (criação, admin).
- :class:`CategoryUpdate` — corpo do ``PATCH /categories/{id}`` (parcial, admin).
- :class:`CategoryOut`    — resposta (id, name, slug, tier, active).

Regras de mass-assignment (§5.2): o cliente envia apenas os campos permitidos.
``slug`` é opcional na criação — se ausente, o service o gera a partir de
``name`` (kebab-case sem acento).
"""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.core.storage import presigned_get_url
from app.models.enums import CategoryTier

__all__ = ["CategoryIn", "CategoryUpdate", "CategoryOut"]


class CategoryIn(BaseModel):
    """Corpo de criação de categoria (``POST /categories`` — admin)."""

    name: str = Field(min_length=2, max_length=80)
    slug: str | None = Field(
        default=None,
        max_length=80,
        description="Opcional; gerado a partir de 'name' se ausente (kebab-case).",
    )
    tier: CategoryTier = CategoryTier.medium
    active: bool = True
    group: str | None = Field(
        default=None,
        max_length=60,
        description="Grupo para a UI (ex.: 'Reformas e Construção').",
    )


class CategoryUpdate(BaseModel):
    """Corpo de atualização parcial (``PATCH /categories/{id}`` — admin)."""

    name: str | None = Field(default=None, min_length=2, max_length=80)
    slug: str | None = Field(default=None, max_length=80)
    tier: CategoryTier | None = None
    active: bool | None = None
    group: str | None = Field(default=None, max_length=60)


class CategoryOut(BaseModel):
    """Representação pública de uma categoria."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str
    tier: CategoryTier
    active: bool
    group: str | None = None
    # Chave interna (não exposta) + URL pública derivada da foto da categoria.
    image_key: str | None = Field(default=None, exclude=True)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def image_url(self) -> str | None:
        if not self.image_key:
            return None
        try:
            return presigned_get_url(self.image_key)
        except Exception:  # noqa: BLE001 — URL é best-effort
            return None
