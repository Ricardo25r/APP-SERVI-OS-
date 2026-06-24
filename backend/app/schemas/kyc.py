"""Schemas da feature ``kyc`` (validação do profissional)."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel

__all__ = [
    "KycStatusOut",
    "KycReviewIn",
    "KycPendingItem",
    "KycPendingList",
]


class KycStatusOut(BaseModel):
    """Status do KYC do próprio usuário."""

    status: str  # none | pending | approved | rejected
    submitted_at: datetime | None = None
    reviewed_at: datetime | None = None
    reject_reason: str | None = None
    has_document: bool = False
    has_selfie: bool = False


class KycReviewIn(BaseModel):
    """Corpo de ``PATCH /kyc/admin/{user_id}`` (aprovar/recusar)."""

    approve: bool
    reason: str | None = None


class KycPendingItem(BaseModel):
    user_id: uuid.UUID
    name: str
    submitted_at: datetime | None = None


class KycPendingList(BaseModel):
    items: list[KycPendingItem]
    total: int
