"""Schemas da feature ``saved_alerts`` (alerta/busca salva de categoria — #60)."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

__all__ = ["SavedAlertCreate", "SavedAlertOut", "SavedAlertList"]


class SavedAlertCreate(BaseModel):
    """Corpo de ``POST /saved-alerts`` (user = ``current_user``)."""

    model_config = ConfigDict(str_strip_whitespace=True)

    category_id: uuid.UUID
    city: str | None = None


class SavedAlertOut(BaseModel):
    """Um alerta salvo, com o nome/slug da categoria para exibição/link."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    category_id: uuid.UUID
    category_name: str
    category_slug: str | None = None
    city: str | None
    created_at: datetime


class SavedAlertList(BaseModel):
    items: list[SavedAlertOut]
    total: int
