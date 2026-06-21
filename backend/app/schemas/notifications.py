"""Schemas Pydantic v2 da feature ``notifications`` (Fase 14)."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

__all__ = [
    "NotificationOut",
    "NotificationListResponse",
    "UnreadCountOut",
]


class NotificationOut(BaseModel):
    """Notificação na perspectiva do dono (``read`` derivado de ``read_at``)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: str
    title: str
    body: str
    href: str | None = None
    read: bool = False
    created_at: datetime


class NotificationListResponse(BaseModel):
    """Envelope paginado + total de não lidas."""

    items: list[NotificationOut]
    page: int
    page_size: int
    total: int
    unread: int


class UnreadCountOut(BaseModel):
    """Contador de notificações não lidas (para o sino)."""

    count: int
