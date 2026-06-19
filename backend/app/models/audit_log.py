"""Modelo ``audit_logs`` (Fase 10 — feature ``admin``).

Trilha de auditoria **imutável** (append-only) de toda ação administrativa que
altera estado (mudança de status de usuário, cancelamento de lead pelo admin,
etc.). Ver ``docs/09-admin-panel/admin-panel-spec.md`` §7 e §AUDIT_LOGS do doc 04.

Decisão sobre ``audit_logs`` × ``admin_actions`` (documentada na tarefa):
o doc 04 lista DUAS tabelas — ``audit_logs`` (rastro técnico: ``user_id``,
``action``, ``entity``, ``entity_id``, ``ip_address``, ``user_agent``) e
``admin_actions`` (rastro de negócio: ``admin_id``, ``action``, ``target_entity``,
``target_id``, ``reason``). No MVP da Fase 10 **um único modelo ``AuditLog``
representa ambos**: ``actor_id`` é o admin (``admin_id``), ``action`` o catálogo de
ações, ``entity``/``entity_id`` o alvo (``target_entity``/``target_id``) e o campo
``meta`` (JSON) carrega o rastro de negócio — incluindo ``reason``. Isso evita
duplicação no MVP; a separação em duas tabelas dedicadas fica como evolução
(V2). Imutável: sem ``updated_at``/``deleted_at`` (registros de auditoria nunca
sofrem soft delete — §7.4).

Tipo de ``meta``: ``JSON`` portável (``JSONB`` no Postgres via variante; ``JSON``
no SQLite dos testes) — sem migration nesta tarefa.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.database.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.user import User

__all__ = ["AuditLog"]

# JSON portável: JSONB nativo no Postgres, JSON genérico nos demais (SQLite).
_JSONType = JSON().with_variant(JSONB(), "postgresql")


class AuditLog(UUIDPKMixin, CreatedAtMixin, Base):
    """Registro imutável de uma ação administrativa (audit_logs + admin_actions)."""

    __tablename__ = "audit_logs"

    # Admin que executou a ação (= admin_id de admin_actions). FK → users.id.
    actor_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    # Ação do catálogo (ex.: user_block, user_suspend, lead_cancel) — §7.3.
    action: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    # Entidade alvo (= target_entity de admin_actions): users, leads, ...
    entity: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    # Id do alvo (= target_id). Nullable para ações sem alvo específico.
    entity_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), nullable=True, index=True
    )
    # Rastro de negócio livre (inclui reason, valores antigos/novos, etc.).
    meta: Mapped[dict[str, Any] | None] = mapped_column(_JSONType, nullable=True)
    # Rastro técnico opcional (origem da requisição) — §7.1.
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)

    # Relacionamento (FK explícita — só leitura/relatório).
    actor: Mapped[User] = relationship("User", foreign_keys=[actor_id])

    __table_args__ = (
        # Listagem paginada da auditoria por data (mais recentes primeiro).
        Index("ix_audit_logs_created", "created_at"),
        # Filtro por ator + data.
        Index("ix_audit_logs_actor_created", "actor_id", "created_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return (
            f"<AuditLog id={self.id!s} actor_id={self.actor_id!s} "
            f"action={self.action!r} entity={self.entity!r}>"
        )
