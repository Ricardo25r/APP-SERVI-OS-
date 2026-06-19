"""Modelos ``achievements`` / ``user_achievements`` (Fase 9 — feature
``gamification``).

**Estrutura preparada (deferida no MVP).** Estes modelos materializam o catálogo
de medalhas/conquistas (doc 08 — Medalhas) e a sua concessão por usuário, para
que a ``Base.metadata`` já contenha as tabelas (Alembic autogenerate criará as
migrations). **A lógica de concessão NÃO está implementada nesta fase** — ver
``app/services/gamification.py`` e as observações da Fase 9. Os campos seguem o
schema canônico (doc 04 — ACHIEVEMENTS / USER_ACHIEVEMENTS).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.user import User

__all__ = ["Achievement", "UserAchievement"]


class Achievement(UUIDPKMixin, CreatedAtMixin, Base):
    """Catálogo de conquistas permanentes (doc 08 — Medalhas).

    Estrutura preparada; sem lógica de concessão no MVP.
    """

    __tablename__ = "achievements"

    slug: Mapped[str] = mapped_column(
        String(80), nullable=False, unique=True, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    xp_reward: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<Achievement id={self.id!s} slug={self.slug!r}>"


class UserAchievement(UUIDPKMixin, Base):
    """Concessão de uma conquista a um usuário (doc 08).

    Estrutura preparada; sem lógica de concessão no MVP. ``UNIQUE(user_id,
    achievement_id)`` garante que cada conquista é concedida uma única vez.
    """

    __tablename__ = "user_achievements"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    achievement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("achievements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    earned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped[User] = relationship("User", foreign_keys=[user_id])
    achievement: Mapped[Achievement] = relationship(
        "Achievement", foreign_keys=[achievement_id]
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id", "achievement_id", name="uq_user_achievements_user_ach"
        ),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return (
            f"<UserAchievement user_id={self.user_id!s} "
            f"achievement_id={self.achievement_id!s}>"
        )
