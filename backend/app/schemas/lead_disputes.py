"""Schemas da feature ``lead_disputes`` (disputa/reembolso de lead)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

__all__ = [
    "DisputeCreate",
    "DisputeOut",
    "DisputeAdminItem",
    "DisputeAdminList",
    "DisputeResolveIn",
]

DisputeReason = Literal[
    "telefone_invalido", "sem_resposta", "pedido_falso", "duplicado", "outro"
]


class DisputeCreate(BaseModel):
    purchase_id: UUID
    reason: DisputeReason
    description: str | None = Field(default=None, max_length=1000)


class DisputeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    purchase_id: UUID
    reason: str
    status: str
    created_at: datetime


class DisputeAdminItem(BaseModel):
    id: UUID
    purchase_id: UUID
    lead_id: UUID
    reason: str
    description: str | None = None
    status: str
    created_at: datetime
    professional_user_id: UUID
    professional_name: str
    lead_title: str | None = None
    credits_used: int


class DisputeAdminList(BaseModel):
    items: list[DisputeAdminItem]
    total: int


class DisputeResolveIn(BaseModel):
    action: Literal["refund", "reject"]
