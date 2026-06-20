"""Modelo ``lead_media`` — fotos/mídia anexadas a um lead.

Cada registro aponta para um objeto no bucket do MinIO (``object_key``). A URL
pública é montada no schema de saída a partir da config de storage. ``position``
ordena a galeria. Append-only com soft delete via cascade do lead.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.lead import Lead

__all__ = ["LeadMedia"]


class LeadMedia(UUIDPKMixin, CreatedAtMixin, Base):
    """Foto/mídia de um lead (objeto no storage S3/MinIO)."""

    __tablename__ = "lead_media"

    lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    object_key: Mapped[str] = mapped_column(String(512), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    lead: Mapped[Lead] = relationship("Lead", back_populates="media")

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<LeadMedia id={self.id!s} lead_id={self.lead_id!s}>"
