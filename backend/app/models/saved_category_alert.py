"""Modelo ``saved_category_alerts`` — alerta/busca salva de categoria (#60).

O contratante "segue" uma categoria (opcionalmente numa cidade). Quando um novo
profissional fica **verificado/disponível** naquela categoria+cidade, o
contratante recebe uma notificação (reaproveita o sistema de notificações das
fases 18–20). Também serve de atalho de busca salva no painel do cliente.
"""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

__all__ = ["SavedCategoryAlert"]


class SavedCategoryAlert(UUIDPKMixin, CreatedAtMixin, Base):
    """Um contratante (``user_id``) segue uma ``category_id`` (+ cidade opc.)."""

    __tablename__ = "saved_category_alerts"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Cidade opcional (igual ao perfil/lead — string livre vinda da lista IBGE).
    city: Mapped[str | None] = mapped_column(String(120), nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "category_id",
            "city",
            name="uq_saved_alert_user_category_city",
        ),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return (
            f"<SavedCategoryAlert user={self.user_id!s} "
            f"category={self.category_id!s} city={self.city!r}>"
        )
