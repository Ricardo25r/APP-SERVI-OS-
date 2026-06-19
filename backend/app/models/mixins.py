"""Mixins compartilhados pelos modelos ORM (dono: backbone).

Define os mixins reutilizáveis citados no contrato (§3.7):

- :class:`UUIDPKMixin`  — PK `id` UUID gerada pela aplicação (`uuid4`).
- :class:`TimestampMixin` — `created_at` / `updated_at` (`timestamptz`).
- :class:`SoftDeleteMixin` — `deleted_at` (`timestamptz` NULL) para soft delete.

Os modelos herdam de ``Base`` (de ``app.database.base``) + os mixins necessários.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column


class UUIDPKMixin:
    """Chave primária `id` do tipo UUID, gerada pela aplicação."""

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )


class TimestampMixin:
    """Colunas de auditoria temporal `created_at` e `updated_at`."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class CreatedAtMixin:
    """Apenas `created_at` — para tabelas append-only (sem `updated_at`)."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class SoftDeleteMixin:
    """Coluna `deleted_at` para soft delete (NULL = registro ativo)."""

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
