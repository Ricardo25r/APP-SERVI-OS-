"""Modelo ``waitlist_entries`` — captura de e-mail "Avise-me no lançamento".

O site institucional (público) coleta e-mails de interessados enquanto o app
ainda não está publicado nas lojas. Append-only (só ``created_at``); a origem
(``source``) registra de qual página/faixa veio o cadastro (ex.: "home", "baixar").
"""

from __future__ import annotations

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

__all__ = ["WaitlistEntry"]


class WaitlistEntry(UUIDPKMixin, CreatedAtMixin, Base):
    """Um interessado que deixou o e-mail para ser avisado no lançamento."""

    __tablename__ = "waitlist_entries"

    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    # De onde veio o cadastro (página/faixa). Opcional, curto.
    source: Mapped[str | None] = mapped_column(String(40), nullable=True)

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<WaitlistEntry email={self.email!r} source={self.source!r}>"
