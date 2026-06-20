"""Modelo ``error_logs`` (Fase 12 — monitoramento/observabilidade).

Persiste cada exceção **não tratada** (HTTP 500) capturada pelo handler global,
com o ``traceback`` completo (arquivo:linha) para diagnóstico. Append-only; o
traceback é visível **apenas** no painel admin (nunca é devolvido ao cliente).
"""

from __future__ import annotations

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

__all__ = ["ErrorLog"]


class ErrorLog(UUIDPKMixin, CreatedAtMixin, Base):
    """Registro de um erro (exceção não tratada) da API."""

    __tablename__ = "error_logs"

    error_type: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    traceback: Mapped[str | None] = mapped_column(Text, nullable=True)
    path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    method: Mapped[str | None] = mapped_column(String(10), nullable=True)
    status_code: Mapped[int] = mapped_column(
        Integer, nullable=False, default=500
    )
    request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<ErrorLog {self.error_type!s} {self.path!s}>"
