"""Schemas da feature ``reports`` (denúncias de abuso)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

__all__ = [
    "ReportCreate",
    "ReportOut",
    "ReportAdminItem",
    "ReportAdminList",
    "ReportReviewIn",
]

ReportTargetType = Literal["user", "lead", "message", "review"]
ReportReason = Literal[
    "spam", "golpe", "conteudo", "assedio", "perfil_falso", "outro"
]


class ReportCreate(BaseModel):
    target_type: ReportTargetType
    target_id: UUID
    reason: ReportReason
    description: str | None = Field(default=None, max_length=1000)


class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    target_type: str
    target_id: UUID
    reason: str
    status: str
    created_at: datetime


class ReportAdminItem(BaseModel):
    id: UUID
    target_type: str
    target_id: UUID
    reason: str
    description: str | None = None
    status: str
    created_at: datetime
    reporter_id: UUID
    reporter_name: str
    reporter_email: str


class ReportAdminList(BaseModel):
    items: list[ReportAdminItem]
    total: int


class ReportReviewIn(BaseModel):
    status: Literal["reviewed", "dismissed"]
