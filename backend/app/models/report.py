"""Modelo ``reports`` — denúncias de abuso.

Exigência das app stores (Apple/Google: conteúdo gerado por usuário precisa de
canal de denúncia) + segurança do marketplace presencial. Uma denúncia feita por
um usuário contra um alvo: perfil (user), pedido (lead), mensagem (message) ou
avaliação (review). Revisão manual pelo admin.
"""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

__all__ = ["Report"]


class Report(UUIDPKMixin, CreatedAtMixin, Base):
    """Denúncia de abuso feita por um usuário."""

    __tablename__ = "reports"

    reporter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Tipo do alvo: user | lead | message | review.
    target_type: Mapped[str] = mapped_column(String(20), nullable=False)
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    # Categoria do motivo: spam | golpe | conteudo | assedio | perfil_falso | outro.
    reason: Mapped[str] = mapped_column(String(40), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # open | reviewed | dismissed.
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="open", server_default="open"
    )

    __table_args__ = (
        Index("ix_reports_status_created", "status", "created_at"),
        Index("ix_reports_target", "target_type", "target_id"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<Report {self.target_type}:{self.target_id!s} reason={self.reason}>"
