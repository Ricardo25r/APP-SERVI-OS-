"""Modelo ``favorites`` — profissionais salvos pelo cliente.

Gancho de retenção: o cliente salva um bom profissional e recontrata depois.
"""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

__all__ = ["Favorite"]


class Favorite(UUIDPKMixin, CreatedAtMixin, Base):
    """Profissional favoritado por um usuário (cliente)."""

    __tablename__ = "favorites"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    professional_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id", "professional_user_id", name="uq_favorite_user_pro"
        ),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<Favorite user={self.user_id!s} pro={self.professional_user_id!s}>"
