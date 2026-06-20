"""Modelo ``leads`` (Fase 4 — feature ``leads``).

Oportunidade publicada pelo contratante. Entidade crítica (soft delete).
``customer_id`` referencia ``users.id`` (autor autenticado, role customer).
Ver §2.7 do contrato.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.enums import LeadStatus, LeadType, LeadUrgency
from app.models.mixins import SoftDeleteMixin, TimestampMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.category import Category
    from app.models.lead_media import LeadMedia
    from app.models.lead_purchase import LeadPurchase
    from app.models.user import User

# Reexport para `from app.models.lead import Lead, LeadType, LeadUrgency, LeadStatus`.
__all__ = ["Lead", "LeadType", "LeadUrgency", "LeadStatus"]


class Lead(UUIDPKMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Lead (oportunidade) publicado por um customer."""

    __tablename__ = "leads"

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(140), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    lead_type: Mapped[LeadType] = mapped_column(
        Enum(
            LeadType,
            name="lead_type",
            native_enum=True,
            validate_strings=True,
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
    )
    urgency: Mapped[LeadUrgency] = mapped_column(
        Enum(
            LeadUrgency,
            name="lead_urgency",
            native_enum=True,
            validate_strings=True,
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
    )
    city: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    state: Mapped[str] = mapped_column(String(2), nullable=False, index=True)
    neighborhood: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # Faixa de orçamento (valor controlado no schema) + coordenadas do serviço
    # (preenchidas pela geolocalização do contratante; usadas para mapa/distância).
    budget_range: Mapped[str | None] = mapped_column(String(20), nullable=True)
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
    status: Mapped[LeadStatus] = mapped_column(
        Enum(
            LeadStatus,
            name="lead_status",
            native_enum=True,
            validate_strings=True,
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        default=LeadStatus.open,
        server_default=LeadStatus.open.value,
        index=True,
    )
    credits_cost: Mapped[int] = mapped_column(Integer, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relacionamentos (§2.7).
    customer: Mapped[User] = relationship(
        "User", back_populates="leads", foreign_keys=[customer_id]
    )
    category: Mapped[Category] = relationship("Category", back_populates="leads")
    purchase: Mapped[LeadPurchase | None] = relationship(
        "LeadPurchase",
        back_populates="lead",
        uselist=False,
    )
    media: Mapped[list[LeadMedia]] = relationship(
        "LeadMedia",
        back_populates="lead",
        cascade="all, delete-orphan",
        order_by="LeadMedia.position",
    )

    __table_args__ = (
        # Composto para matching/listagem de elegíveis (§5.3).
        Index(
            "ix_leads_status_category_city_state",
            "status",
            "category_id",
            "city",
            "state",
        ),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<Lead id={self.id!s} title={self.title!r} status={self.status}>"
