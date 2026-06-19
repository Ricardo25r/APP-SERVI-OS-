"""Modelo ``users`` (Fase 2 — feature ``auth``).

Autenticação e identidade. Entidade crítica (soft delete). Ver §2.1 do contrato.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.enums import UserRole, UserStatus
from app.models.mixins import SoftDeleteMixin, TimestampMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.customer_profile import CustomerProfile
    from app.models.lead import Lead
    from app.models.professional_profile import ProfessionalProfile
    from app.models.refresh_token import RefreshToken

# Reexport para `from app.models.user import User, UserRole, UserStatus` (§3.2).
__all__ = ["User", "UserRole", "UserStatus"]


class User(UUIDPKMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Conta de usuário (customer | professional | admin)."""

    __tablename__ = "users"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(
            UserRole,
            name="user_role",
            native_enum=True,
            validate_strings=True,
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        default=UserRole.customer,
        server_default=UserRole.customer.value,
        index=True,
    )
    status: Mapped[UserStatus] = mapped_column(
        Enum(
            UserStatus,
            name="user_status",
            native_enum=True,
            validate_strings=True,
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        default=UserStatus.active,
        server_default=UserStatus.active.value,
        index=True,
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relacionamentos (§2.1).
    customer_profile: Mapped[CustomerProfile | None] = relationship(
        "CustomerProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    professional_profile: Mapped[ProfessionalProfile | None] = relationship(
        "ProfessionalProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    refresh_tokens: Mapped[list[RefreshToken]] = relationship(
        "RefreshToken",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    leads: Mapped[list[Lead]] = relationship(
        "Lead",
        back_populates="customer",
        foreign_keys="Lead.customer_id",
    )

    __table_args__ = (
        # Unicidade considerando soft delete: email reutilizável após exclusão.
        Index(
            "uq_users_email_active",
            "email",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        # Unicidade de phone apenas quando presente e ativo.
        Index(
            "uq_users_phone_active",
            "phone",
            unique=True,
            postgresql_where=text("phone IS NOT NULL AND deleted_at IS NULL"),
        ),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<User id={self.id!s} email={self.email!r} role={self.role}>"
