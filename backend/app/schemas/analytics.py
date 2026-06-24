"""Schemas da feature ``analytics`` (uso do app — sem PII)."""

from __future__ import annotations

from pydantic import BaseModel, Field

__all__ = [
    "AnalyticsTrackIn",
    "AnalyticsCount",
    "AnalyticsOverview",
]


class AnalyticsTrackIn(BaseModel):
    """Corpo de ``POST /analytics/track`` (visualização de página)."""

    path: str = Field(min_length=1, max_length=200)
    role: str | None = Field(default=None, max_length=20)
    region: str | None = Field(default=None, max_length=2)


class AnalyticsCount(BaseModel):
    label: str
    count: int


class AnalyticsOverview(BaseModel):
    """Agregados do painel admin (janela de ``days`` dias)."""

    total_views: int
    days: int
    top_pages: list[AnalyticsCount]
    by_device: list[AnalyticsCount]
    by_region: list[AnalyticsCount]
    by_role: list[AnalyticsCount]
