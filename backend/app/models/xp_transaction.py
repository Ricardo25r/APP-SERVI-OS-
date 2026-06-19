"""Modelo ``xp_transactions`` (Fase 9 — feature ``gamification``).

Histórico imutável (append-only) de toda concessão/penalidade de XP. Sem
``updated_at``/``deleted_at`` — espelha o padrão de ``credit_transactions``
(§2.9) e o schema canônico (doc 04 — XP_TRANSACTIONS).

Regras de modelagem (gamification-engine doc 08):
- ``user_id`` referencia ``users.id`` (o XP é do usuário; para o MVP só o
  profissional acumula, mas a coluna fica genérica para futuras fases que dêem
  XP a clientes — ver Dashboard Cliente do doc 08).
- ``amount`` inteiro **com sinal** (positivo = ganho; negativo = penalidade —
  ex.: ``-50`` em avaliação negativa, doc 08 §Penalidades).
- ``source`` string curta da origem (``lead_purchase``, ``review_5star``,
  ``review_positive``, ``review_negative``, …) — trilha de auditoria/anti-abuso.
- ``description`` opcional (texto livre legível).
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.user import User

__all__ = ["XpTransaction"]


class XpTransaction(UUIDPKMixin, CreatedAtMixin, Base):
    """Registro imutável de uma concessão/penalidade de XP."""

    __tablename__ = "xp_transactions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)

    user: Mapped[User] = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        # Paginação do histórico por usuário (mais recentes primeiro).
        Index("ix_xp_transactions_user_created", "user_id", "created_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return (
            f"<XpTransaction id={self.id!s} user_id={self.user_id!s} "
            f"amount={self.amount} source={self.source!r}>"
        )
