"""Modelo ``customer_profiles`` (Fase 3 — feature ``users``).

Perfil do contratante. 1:1 com ``users``. Entidade crítica (soft delete).
Ver §2.3 do contrato.
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Numeric, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.mixins import SoftDeleteMixin, TimestampMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.user import User

__all__ = ["CustomerProfile"]


class CustomerProfile(UUIDPKMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Perfil 1:1 do usuário contratante."""

    __tablename__ = "customer_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    city: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    state: Mapped[str | None] = mapped_column(String(2), nullable=True, index=True)
    reputation_score: Mapped[Decimal] = mapped_column(
        Numeric(3, 2),
        nullable=False,
        default=Decimal("0.00"),
        server_default=text("0.00"),
    )

    user: Mapped[User] = relationship("User", back_populates="customer_profile")

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<CustomerProfile id={self.id!s} user_id={self.user_id!s}>"
