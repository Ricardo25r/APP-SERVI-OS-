"""Modelo ``professional_categories`` (Fase 3 — feature ``users``).

Tabela de junção N:N entre profissionais e categorias. Append/delete simples
(sem ``updated_at``/``deleted_at``). Ver §2.6 do contrato.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.category import Category
    from app.models.professional_profile import ProfessionalProfile

__all__ = ["ProfessionalCategory"]


class ProfessionalCategory(UUIDPKMixin, CreatedAtMixin, Base):
    """Vínculo (profissional, categoria) — sem duplicação."""

    __tablename__ = "professional_categories"

    professional_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("professional_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    professional: Mapped[ProfessionalProfile] = relationship(
        "ProfessionalProfile", back_populates="professional_categories"
    )
    category: Mapped[Category] = relationship(
        "Category", back_populates="professional_categories"
    )

    __table_args__ = (
        UniqueConstraint(
            "professional_id",
            "category_id",
            name="uq_professional_categories_pair",
        ),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return (
            f"<ProfessionalCategory professional_id={self.professional_id!s} "
            f"category_id={self.category_id!s}>"
        )
