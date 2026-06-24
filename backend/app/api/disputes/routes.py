"""Rotas da feature ``lead_disputes`` — prefixo ``/disputes``.

- ``POST /disputes``               → profissional contesta um pedido comprado.
- ``GET  /disputes/admin``         → admin, fila de disputas (filtro por status).
- ``PATCH /disputes/admin/{id}``   → admin, resolve (refund | reject).
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_roles
from app.core.ratelimit import rate_limit
from app.database.session import get_db
from app.models import User, UserRole
from app.schemas.lead_disputes import (
    DisputeAdminList,
    DisputeCreate,
    DisputeOut,
    DisputeResolveIn,
)
from app.services.lead_disputes import LeadDisputeService

router = APIRouter()


@router.post(
    "/",
    response_model=DisputeOut,
    status_code=status.HTTP_201_CREATED,
    summary="Abrir disputa de um pedido comprado (profissional)",
    dependencies=[Depends(rate_limit("dispute", limit=10, window_seconds=300))],
)
async def create_dispute(
    payload: DisputeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DisputeOut:
    return await LeadDisputeService(db).create(current_user, payload)


@router.get(
    "/admin",
    response_model=DisputeAdminList,
    summary="Fila de disputas (admin)",
)
async def list_disputes(
    status_filter: str | None = Query(default=None, alias="status"),
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> DisputeAdminList:
    return await LeadDisputeService(db).list_all(status=status_filter)


@router.patch(
    "/admin/{dispute_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Resolver disputa: reembolsar ou recusar (admin)",
)
async def resolve_dispute(
    dispute_id: uuid.UUID,
    payload: DisputeResolveIn,
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await LeadDisputeService(db).resolve(dispute_id, payload.action)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
