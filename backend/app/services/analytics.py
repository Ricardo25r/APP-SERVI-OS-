"""Service da feature ``analytics`` — rastreio leve + agregados (sem PII)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AnalyticsEvent
from app.schemas.analytics import AnalyticsCount, AnalyticsOverview

__all__ = ["AnalyticsService"]


def _parse_ua(ua: str) -> tuple[str, str | None]:
    """(device, os) a partir do User-Agent. Heurística simples, sem libs."""
    u = (ua or "").lower()
    if "ipad" in u or "tablet" in u:
        device = "tablet"
    elif "mobile" in u or "android" in u or "iphone" in u:
        device = "mobile"
    else:
        device = "desktop"
    if "android" in u:
        os_name: str | None = "Android"
    elif "iphone" in u or "ipad" in u or "cpu os" in u:
        os_name = "iOS"
    elif "windows" in u:
        os_name = "Windows"
    elif "mac os" in u or "macintosh" in u:
        os_name = "macOS"
    elif "linux" in u:
        os_name = "Linux"
    else:
        os_name = None
    return device, os_name


class AnalyticsService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def track(
        self,
        path: str,
        role: str | None,
        region: str | None,
        user_agent: str,
    ) -> None:
        device, os_name = _parse_ua(user_agent)
        self.db.add(
            AnalyticsEvent(
                path=path[:200],
                device=device,
                os=os_name,
                region=(region or None) and region.upper()[:2],
                user_role=role,
            )
        )
        await self.db.commit()

    async def _grouped(
        self, column, since: datetime, limit: int | None
    ) -> list[AnalyticsCount]:
        stmt = (
            select(column, func.count())
            .where(AnalyticsEvent.created_at >= since, column.isnot(None))
            .group_by(column)
            .order_by(func.count().desc())
        )
        if limit:
            stmt = stmt.limit(limit)
        rows = await self.db.execute(stmt)
        return [
            AnalyticsCount(label=str(label), count=int(count))
            for label, count in rows.all()
        ]

    async def overview(self, days: int = 30) -> AnalyticsOverview:
        since = datetime.now(UTC) - timedelta(days=days)
        total = int(
            (
                await self.db.execute(
                    select(func.count())
                    .select_from(AnalyticsEvent)
                    .where(AnalyticsEvent.created_at >= since)
                )
            ).scalar_one()
        )
        return AnalyticsOverview(
            total_views=total,
            days=days,
            top_pages=await self._grouped(AnalyticsEvent.path, since, 12),
            by_device=await self._grouped(AnalyticsEvent.device, since, None),
            by_region=await self._grouped(AnalyticsEvent.region, since, 12),
            by_role=await self._grouped(AnalyticsEvent.user_role, since, None),
        )
