"""Modelo ``user_blocks`` — um usuário bloqueia o outro.

Autodefesa básica: vítima de assédio bloqueia o outro lado, que não consegue
mais lhe enviar mensagens no chat. Exigência de segurança das app stores.
"""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

__all__ = ["UserBlock"]


class UserBlock(UUIDPKMixin, CreatedAtMixin, Base):
    """``blocker_id`` bloqueou ``blocked_id``."""

    __tablename__ = "user_blocks"

    blocker_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    blocked_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    __table_args__ = (
        UniqueConstraint("blocker_id", "blocked_id", name="uq_user_block_pair"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<UserBlock {self.blocker_id!s} -> {self.blocked_id!s}>"
