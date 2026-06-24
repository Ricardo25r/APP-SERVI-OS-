"""Modelo ``users`` (Fase 2 — feature ``auth``).

Autenticação e identidade. Entidade crítica (soft delete). Ver §2.1 do contrato.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, Enum, Index, Integer, String, text
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
    # Nulo para contas de login social (Google/Apple) — sem senha local.
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
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
    # Chave da foto de perfil no storage (MinIO); URL presignada exposta no schema.
    avatar_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # Não-comparecimentos do cliente (ausente/recusou o código com a presença do
    # profissional comprovada por GPS) — reputação anti "furo" do contratante.
    client_no_show_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    # Login social: provedor que prova a identidade + ids estáveis do provedor.
    auth_provider: Mapped[str] = mapped_column(
        String(20), nullable=False, default="local", server_default="local"
    )
    google_sub: Mapped[str | None] = mapped_column(String(255), nullable=True)
    apple_sub: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Aceite dos Termos de Uso: quando aceitou + versão aceita. O banner reaparece
    # quando a versão vigente (settings.TERMS_VERSION) muda.
    terms_accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    terms_version: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # Data de nascimento — idade do prestador para métricas (média de idade) e
    # base para validar maioridade. Coletada no cadastro e, para quem já tinha
    # conta (ou entrou por login social), via gate no próximo acesso. Nullable.
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)

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
        # Unicidade dos ids de login social (apenas quando presentes e ativos).
        Index(
            "uq_users_google_sub_active",
            "google_sub",
            unique=True,
            postgresql_where=text(
                "google_sub IS NOT NULL AND deleted_at IS NULL"
            ),
        ),
        Index(
            "uq_users_apple_sub_active",
            "apple_sub",
            unique=True,
            postgresql_where=text(
                "apple_sub IS NOT NULL AND deleted_at IS NULL"
            ),
        ),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<User id={self.id!s} email={self.email!r} role={self.role}>"
