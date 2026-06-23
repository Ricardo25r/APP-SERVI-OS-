"""Modelo ``categories`` (Fase 3 — feature ``categories``).

Catálogo de categorias de serviço. Sem soft delete (usa ``active``).
Ver §2.5 do contrato.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.enums import CategoryTier
from app.models.mixins import TimestampMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.lead import Lead
    from app.models.professional_category import ProfessionalCategory
    from app.models.professional_profile import ProfessionalProfile

# Reexport para `from app.models.category import Category, CategoryTier` (§3.2).
__all__ = ["Category", "CategoryTier"]


class Category(UUIDPKMixin, TimestampMixin, Base):
    """Categoria de serviço (define o custo base do lead via ``tier``)."""

    __tablename__ = "categories"

    name: Mapped[str] = mapped_column(String(80), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(80), nullable=False, unique=True, index=True
    )
    tier: Mapped[CategoryTier] = mapped_column(
        Enum(
            CategoryTier,
            name="category_tier",
            native_enum=True,
            validate_strings=True,
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        default=CategoryTier.medium,
        server_default=CategoryTier.medium.value,
    )
    active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
        index=True,
    )
    # Agrupamento p/ a UI (ex.: "Reformas e Construção"). Coluna ``category_group``
    # (evita a palavra reservada ``group``); ``None`` cai no grupo "Outros".
    group: Mapped[str | None] = mapped_column(
        "category_group", String(60), nullable=True, index=True
    )

    # Relacionamentos (§2.5).
    professional_categories: Mapped[list[ProfessionalCategory]] = relationship(
        "ProfessionalCategory",
        back_populates="category",
        cascade="all, delete-orphan",
    )
    professionals: Mapped[list[ProfessionalProfile]] = relationship(
        "ProfessionalProfile",
        secondary="professional_categories",
        back_populates="categories",
        viewonly=True,
    )
    leads: Mapped[list[Lead]] = relationship(
        "Lead",
        back_populates="category",
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<Category id={self.id!s} slug={self.slug!r} tier={self.tier}>"
