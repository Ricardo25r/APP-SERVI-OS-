"""Modelo ``analytics_events`` — analytics de uso (LGPD-friendly).

Evento de visualização de página, **sem PII**: só a rota, o tipo de aparelho, o
SO, a região (UF, quando conhecida) e o papel do usuário. Sem IP, sem id de
usuário. Usado para os agregados do painel admin (páginas mais acessadas, por
aparelho, por região).
"""

from __future__ import annotations

from sqlalchemy import Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

__all__ = ["AnalyticsEvent"]


class AnalyticsEvent(UUIDPKMixin, CreatedAtMixin, Base):
    """Visualização de página (agregável; sem dados pessoais)."""

    __tablename__ = "analytics_events"

    path: Mapped[str] = mapped_column(String(200), nullable=False)
    device: Mapped[str] = mapped_column(String(20), nullable=False)
    os: Mapped[str | None] = mapped_column(String(20), nullable=True)
    region: Mapped[str | None] = mapped_column(String(2), nullable=True)
    user_role: Mapped[str | None] = mapped_column(String(20), nullable=True)

    __table_args__ = (
        Index("ix_analytics_events_created", "created_at"),
        Index("ix_analytics_events_path", "path"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<AnalyticsEvent path={self.path!r} device={self.device!r}>"
