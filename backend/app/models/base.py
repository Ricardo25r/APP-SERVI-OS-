"""Reexport de conveniência da `Base` ORM e dos mixins (dono: backbone).

A ``Base`` declarativa vive em ``app.database.base`` (criada na Fase 1) e os
mixins em ``app.models.mixins``. Este módulo apenas os reexporta para que
``from app.models.base import Base, TimestampMixin, SoftDeleteMixin, UUIDPKMixin``
(padrão citado no §3.7 do contrato) continue funcionando, sem duplicar nada.
"""

from __future__ import annotations

from app.database.base import Base
from app.models.mixins import (
    CreatedAtMixin,
    SoftDeleteMixin,
    TimestampMixin,
    UUIDPKMixin,
)

__all__ = [
    "Base",
    "UUIDPKMixin",
    "TimestampMixin",
    "CreatedAtMixin",
    "SoftDeleteMixin",
]
