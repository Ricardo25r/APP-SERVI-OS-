"""Rotas da feature ``reports`` (denúncias de abuso) — prefixo ``/reports``.

- ``POST /reports``               → JWT, denuncia um alvo (rate-limited).
- ``GET  /reports/admin``         → admin, fila de denúncias (filtro por status).
- ``PATCH /reports/admin/{id}``   → admin, resolve (reviewed | dismissed).
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_roles
from app.core.ratelimit import rate_limit
from app.database.session import get_db
from app.models import User, UserRole
from app.schemas.reports import (
    ReportAdminList,
    ReportCreate,
    ReportOut,
    ReportReviewIn,
)
from app.services.reports import ReportService

router = APIRouter()


@router.post(
    "/",
    response_model=ReportOut,
    status_code=status.HTTP_201_CREATED,
    summary="Denunciar abuso (perfil/pedido/mensagem/avaliação)",
    dependencies=[Depends(rate_limit("report", limit=20, window_seconds=300))],
)
async def create_report(
    payload: ReportCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportOut:
    return await ReportService(db).create(current_user, payload)


@router.get(
    "/admin",
    response_model=ReportAdminList,
    summary="Fila de denúncias (admin)",
)
async def list_reports(
    status_filter: str | None = Query(default=None, alias="status"),
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> ReportAdminList:
    return await ReportService(db).list_all(status=status_filter)


@router.patch(
    "/admin/{report_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Resolver denúncia (admin)",
)
async def review_report(
    report_id: uuid.UUID,
    payload: ReportReviewIn,
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await ReportService(db).set_status(report_id, payload.status)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
