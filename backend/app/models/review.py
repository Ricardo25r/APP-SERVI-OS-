"""Modelo ``reviews`` (Fase 7 — feature ``reviews``).

Avaliação mútua ligada a um lead comprado (Lead Exclusivo). Append-only,
imutável (sem ``updated_at``/``deleted_at`` — o usuário nunca edita nem remove
avaliações; toda reputação é calculada pelo backend — ver
``docs/07-reputation-engine/reputation-engine.md`` e §REVIEWS do doc 04).

Regras de modelagem:
- ``author_id`` / ``target_id`` referenciam ``users.id`` (os dois lados da
  transação do lead). ``target_id`` é **derivado no backend** (nunca vem do
  cliente — anti-IDOR/anti-fraude — ver service).
- ``UNIQUE(author_id, lead_id)`` — uma avaliação por autor por lead ("uma
  avaliação por contratação" do doc 04). Os dois lados podem avaliar uma vez.
- ``score`` inteiro 1–5; ``comment`` opcional.
- Índices em ``target_id`` (avaliações recebidas) e ``lead_id`` (avaliações da
  contratação).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.lead import Lead
    from app.models.user import User

__all__ = ["Review"]


class Review(UUIDPKMixin, CreatedAtMixin, Base):
    """Avaliação imutável de um usuário sobre o outro lado de um lead."""

    __tablename__ = "reviews"

    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    target_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leads.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    # Resposta do avaliado à avaliação (direito de defesa — #51). Definida 1x.
    reply: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    reply_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relacionamentos (FKs ambíguas → ``foreign_keys`` explícito).
    author: Mapped[User] = relationship("User", foreign_keys=[author_id])
    target: Mapped[User] = relationship("User", foreign_keys=[target_id])
    lead: Mapped[Lead] = relationship("Lead", foreign_keys=[lead_id])

    __table_args__ = (
        # Uma avaliação por autor por lead (anti-duplicação — §REVIEWS doc 04).
        UniqueConstraint("author_id", "lead_id", name="uq_reviews_author_lead"),
        # Não permitir auto-avaliação no nível do banco (defesa em profundidade).
        CheckConstraint("author_id <> target_id", name="ck_reviews_no_self"),
        # Score válido 1–5 (validado também no schema/service).
        CheckConstraint("score >= 1 AND score <= 5", name="ck_reviews_score_range"),
        # Avaliações recebidas por um usuário (listagem pública paginada).
        Index("ix_reviews_target_created", "target_id", "created_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return (
            f"<Review id={self.id!s} author_id={self.author_id!s} "
            f"target_id={self.target_id!s} lead_id={self.lead_id!s} "
            f"score={self.score}>"
        )
