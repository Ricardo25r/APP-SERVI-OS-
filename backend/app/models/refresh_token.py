"""Modelo ``refresh_tokens`` (Fase 2 — feature ``auth``).

Rotação/revogação de refresh JWT. Sem soft delete (usa ``revoked_at``).
Append-mostly (sem ``updated_at``). Ver §2.2 do contrato.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.user import User

__all__ = ["RefreshToken"]


class RefreshToken(UUIDPKMixin, CreatedAtMixin, Base):
    """Refresh token persistido (hash SHA-256; nunca o token cru)."""

    __tablename__ = "refresh_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True, index=True
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped[User] = relationship("User", back_populates="refresh_tokens")

    __table_args__ = (
        # Listar tokens ativos de um usuário.
        Index("ix_refresh_tokens_user_revoked", "user_id", "revoked_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<RefreshToken id={self.id!s} user_id={self.user_id!s}>"
