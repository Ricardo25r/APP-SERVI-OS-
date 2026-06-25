"""Configuração de alertas — e-mails extra que recebem notificação de erro.

Singleton get-or-create (mesmo padrão de ``PaymentSettings``). Permite ao admin
gerenciar pela UI quem da equipe recebe alerta de erro, sem editar o ``.env``.
O e-mail do dono (env ``ALERT_EMAIL_TO``) é sempre incluído além destes.
"""

from __future__ import annotations

from sqlalchemy import Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin

__all__ = ["AlertSettings"]


class AlertSettings(UUIDPKMixin, TimestampMixin, Base):
    """E-mails (separados por vírgula) que também recebem alerta de erro."""

    __tablename__ = "alert_settings"

    error_emails: Mapped[str] = mapped_column(
        Text, nullable=False, server_default="", default=""
    )
