"""Rotas da feature ``analytics`` — ``router = APIRouter()``.

- ``POST /analytics/track``    → público, registra uma visualização (204).
- ``GET  /analytics/overview`` → admin, agregados de uso.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_roles
from app.core.ratelimit import rate_limit
from app.database.session import get_db
from app.models import User, UserRole
from app.schemas.analytics import AnalyticsOverview, AnalyticsTrackIn
from app.services.analytics import AnalyticsService

router = APIRouter()


@router.post(
    "/track",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Registrar visualização de página (sem PII)",
    dependencies=[
        Depends(rate_limit("analytics", limit=120, window_seconds=60))
    ],
)
async def track(
    payload: AnalyticsTrackIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Registra uma visualização (rota + aparelho/SO do User-Agent + papel/UF
    opcionais). Público e best-effort."""
    await AnalyticsService(db).track(
        payload.path,
        payload.role,
        payload.region,
        request.headers.get("user-agent", ""),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/overview",
    response_model=AnalyticsOverview,
    summary="Agregados de uso (páginas/aparelho/região/papel) — admin",
)
async def overview(
    days: int = Query(default=30, ge=1, le=365),
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> AnalyticsOverview:
    """Agregados dos últimos ``days`` dias (admin-only)."""
    return await AnalyticsService(db).overview(days)
