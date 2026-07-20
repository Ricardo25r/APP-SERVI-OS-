"""Modelo ``contact_messages`` — mensagens do formulário público de contato.

O site institucional tem uma página ``/contato`` (pública, sem login). As
mensagens caem aqui para o time responder. Append-only (só ``created_at``).
"""

from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

__all__ = ["ContactMessage"]


class ContactMessage(UUIDPKMixin, CreatedAtMixin, Base):
    """Mensagem enviada pelo formulário público de contato/suporte."""

    __tablename__ = "contact_messages"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    subject: Mapped[str | None] = mapped_column(String(200), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<ContactMessage email={self.email!r} subject={self.subject!r}>"
