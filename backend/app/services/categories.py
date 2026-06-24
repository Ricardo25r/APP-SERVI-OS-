"""Service da feature ``categories`` (Fase 3).

Concentra regra de negócio, validações e **commits** (§3.5):

- geração de ``slug`` a partir do ``name`` (kebab-case sem acento);
- validação de unicidade de ``name`` e ``slug``;
- CRUD com as exceções de domínio (§3.9) que o ``routes.py`` mapeia para HTTP.

``categories`` não tem soft delete; o "delete" é a desativação lógica
(``active=False`` — §2.5 / §4), preservando leads/vínculos existentes.
"""

from __future__ import annotations

import contextlib
import re
import unicodedata
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, DomainValidationError, NotFoundError
from app.core.storage import delete_object, upload_bytes
from app.models import Category
from app.repositories.categories import CategoryRepository
from app.schemas.categories import CategoryIn, CategoryUpdate

__all__ = ["CategoryService", "slugify"]

_SLUG_STRIP_RE = re.compile(r"[^a-z0-9]+")
_SLUG_TRIM_RE = re.compile(r"^-+|-+$")


def slugify(value: str) -> str:
    """Converte um texto em ``slug`` kebab-case ASCII sem acento.

    Ex.: ``"Reforma & Construção"`` → ``"reforma-construcao"``. Usado quando o
    cliente não informa ``slug`` na criação (§2.5: slug em kebab-case sem acento).
    """
    # Remove acentos (NFKD → descarta combining marks).
    normalized = unicodedata.normalize("NFKD", value)
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    lowered = ascii_only.lower().strip()
    hyphenated = _SLUG_STRIP_RE.sub("-", lowered)
    return _SLUG_TRIM_RE.sub("", hyphenated)


class CategoryService:
    """Regras de negócio do catálogo de categorias."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = CategoryRepository(db)

    async def list_categories(
        self,
        *,
        include_inactive: bool = False,
        query: str | None = None,
    ) -> list[Category]:
        """Lista categorias. ``include_inactive`` só deve vir de um admin (rota)."""
        return await self.repo.list(only_active=not include_inactive, query=query)

    async def get_category(self, category_id: uuid.UUID) -> Category:
        """Retorna a categoria ou lança :class:`NotFoundError` (404)."""
        category = await self.repo.get_by_id(category_id)
        if category is None:
            raise NotFoundError("Categoria não encontrada.")
        return category

    async def create_category(self, data: CategoryIn) -> Category:
        """Cria uma categoria validando unicidade de ``name`` e ``slug``."""
        name = data.name.strip()
        slug = (data.slug or "").strip() or slugify(name)
        if not slug:
            raise DomainValidationError(
                "Não foi possível gerar um slug válido a partir do nome."
            )

        if await self.repo.get_by_name(name) is not None:
            raise ConflictError("Já existe uma categoria com este nome.")
        if await self.repo.get_by_slug(slug) is not None:
            raise ConflictError("Já existe uma categoria com este slug.")

        category = Category(
            name=name,
            slug=slug,
            tier=data.tier,
            active=data.active,
            group=(data.group or "").strip() or None,
        )
        await self.repo.add(category)
        await self.db.commit()
        await self.db.refresh(category)
        return category

    async def update_category(
        self, category_id: uuid.UUID, data: CategoryUpdate
    ) -> Category:
        """Atualiza parcialmente; revalida unicidade quando ``name``/``slug`` mudam."""
        category = await self.get_category(category_id)
        fields = data.model_dump(exclude_unset=True)

        if "name" in fields and fields["name"] is not None:
            new_name = fields["name"].strip()
            if new_name != category.name:
                existing = await self.repo.get_by_name(new_name)
                if existing is not None and existing.id != category.id:
                    raise ConflictError("Já existe uma categoria com este nome.")
            category.name = new_name

        if "slug" in fields and fields["slug"] is not None:
            new_slug = fields["slug"].strip()
            if not new_slug:
                raise DomainValidationError("Slug não pode ser vazio.")
            if new_slug != category.slug:
                existing = await self.repo.get_by_slug(new_slug)
                if existing is not None and existing.id != category.id:
                    raise ConflictError("Já existe uma categoria com este slug.")
            category.slug = new_slug

        if "tier" in fields and fields["tier"] is not None:
            category.tier = fields["tier"]

        if "active" in fields and fields["active"] is not None:
            category.active = fields["active"]

        if "group" in fields:
            g = fields["group"]
            category.group = (g.strip() or None) if isinstance(g, str) else None

        await self.repo.flush()
        await self.db.commit()
        await self.db.refresh(category)
        return category

    async def set_image(
        self,
        category_id: uuid.UUID,
        data: bytes,
        *,
        content_type: str,
        ext: str,
    ) -> Category:
        """Define a foto da categoria (upload no storage público)."""
        category = await self.get_category(category_id)
        old_key = category.image_key
        key = f"categories/{category.id}/{uuid.uuid4().hex}{ext}"
        upload_bytes(data, key, content_type=content_type)
        category.image_key = key
        await self.repo.flush()
        await self.db.commit()
        await self.db.refresh(category)
        # Remove a foto anterior do bucket (evita objeto órfão). Best-effort.
        if old_key and old_key != key:
            with contextlib.suppress(Exception):
                delete_object(old_key)
        return category

    async def deactivate_category(self, category_id: uuid.UUID) -> None:
        """Desativa a categoria (soft delete via ``active=False`` — §4).

        Sem hard delete: preserva leads/vínculos que a referenciam.
        """
        category = await self.get_category(category_id)
        category.active = False
        await self.repo.flush()
        await self.db.commit()
