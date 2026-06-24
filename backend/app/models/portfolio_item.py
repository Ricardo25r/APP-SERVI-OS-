"""Modelo ``portfolio_items`` — galeria de trabalhos do profissional (#58).

Cada item é uma foto de trabalho do profissional (chave no bucket público de
mídia), com legenda opcional. Exibida no perfil público para o cliente avaliar a
qualidade antes de contratar.
"""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

__all__ = ["PortfolioItem"]


class PortfolioItem(UUIDPKMixin, CreatedAtMixin, Base):
    """Uma foto de trabalho na galeria de um profissional."""

    __tablename__ = "portfolio_items"

    professional_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("professional_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    image_key: Mapped[str] = mapped_column(String(400), nullable=False)
    caption: Mapped[str | None] = mapped_column(String(200), nullable=True)
    sort_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return (
            f"<PortfolioItem professional_id={self.professional_id!s} "
            f"key={self.image_key!r}>"
        )
