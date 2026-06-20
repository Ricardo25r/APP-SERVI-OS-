"""Modelo ``professional_profiles`` (Fase 3 — feature ``users``).

Perfil do profissional. 1:1 com ``users``. Entidade crítica (soft delete).
Colunas de reputação/gamificação existem (defaults) mas não são manipuladas
nas Fases 2–5. Ver §2.4 do contrato.
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, Numeric, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.enums import AvailabilityStatus
from app.models.mixins import SoftDeleteMixin, TimestampMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.category import Category
    from app.models.credit_wallet import CreditWallet
    from app.models.lead_purchase import LeadPurchase
    from app.models.professional_category import ProfessionalCategory
    from app.models.user import User

# Reexport para `from app.models.professional_profile import ... AvailabilityStatus`.
__all__ = ["ProfessionalProfile", "AvailabilityStatus"]


class ProfessionalProfile(UUIDPKMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Perfil 1:1 do usuário profissional."""

    __tablename__ = "professional_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    headline: Mapped[str | None] = mapped_column(String(160), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    state: Mapped[str | None] = mapped_column(String(2), nullable=True, index=True)
    service_radius_km: Mapped[int] = mapped_column(
        Integer, nullable=False, default=10, server_default=text("10")
    )
    # Coordenadas do profissional (geolocalização) — usadas para calcular a
    # distância até o serviço do lead. Opcionais.
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)

    # Campos de reputação/gamificação — defaults apenas nestas fases (§2.4).
    verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    premium: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    rating: Mapped[Decimal] = mapped_column(
        Numeric(3, 2),
        nullable=False,
        default=Decimal("0.00"),
        server_default=text("0.00"),
    )
    total_reviews: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    xp: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    level: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default=text("1")
    )
    availability_status: Mapped[AvailabilityStatus] = mapped_column(
        Enum(
            AvailabilityStatus,
            name="availability_status",
            native_enum=True,
            validate_strings=True,
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        default=AvailabilityStatus.available,
        server_default=AvailabilityStatus.available.value,
        index=True,
    )

    # Relacionamentos (§2.4).
    user: Mapped[User] = relationship("User", back_populates="professional_profile")
    wallet: Mapped[CreditWallet | None] = relationship(
        "CreditWallet",
        back_populates="professional",
        uselist=False,
        cascade="all, delete-orphan",
    )
    professional_categories: Mapped[list[ProfessionalCategory]] = relationship(
        "ProfessionalCategory",
        back_populates="professional",
        cascade="all, delete-orphan",
    )
    categories: Mapped[list[Category]] = relationship(
        "Category",
        secondary="professional_categories",
        back_populates="professionals",
        viewonly=True,
    )
    purchases: Mapped[list[LeadPurchase]] = relationship(
        "LeadPurchase",
        back_populates="professional",
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<ProfessionalProfile id={self.id!s} user_id={self.user_id!s}>"
