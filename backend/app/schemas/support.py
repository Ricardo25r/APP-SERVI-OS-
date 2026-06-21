"""Schemas Pydantic v2 da feature ``support`` (Fase 15 — chamados)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

__all__ = [
    "SupportTicketCreate",
    "SupportTicketOut",
    "SupportTicketListResponse",
    "SupportTicketAdminOut",
    "SupportTicketAdminListResponse",
    "SupportTicketStatusUpdate",
]


class SupportTicketCreate(BaseModel):
    """Payload para abrir um chamado."""

    subject: str = Field(min_length=3, max_length=160)
    message: str = Field(min_length=10, max_length=4000)


class SupportTicketStatusUpdate(BaseModel):
    """Atualização de status pelo admin (aberto/resolvido)."""

    status: Literal["open", "closed"]


class SupportTicketOut(BaseModel):
    """Chamado na perspectiva do autor."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    subject: str
    message: str
    status: str
    created_at: datetime


class SupportTicketListResponse(BaseModel):
    items: list[SupportTicketOut]
    total: int


class SupportTicketAdminOut(SupportTicketOut):
    """Chamado com dados do autor (visão admin)."""

    user_id: uuid.UUID
    user_name: str | None = None
    user_email: str | None = None


class SupportTicketAdminListResponse(BaseModel):
    items: list[SupportTicketAdminOut]
    total: int
