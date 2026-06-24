"""Rotas da feature ``saved_alerts`` (#60) — prefixo ``/saved-alerts``.

O contratante salva categorias de interesse (+ cidade opcional) e recebe
notificação quando um novo profissional é verificado naquela categoria/cidade
(gatilho no :class:`KycService`). Aqui: criar/listar/remover.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.database.session import get_db
from app.models import User
from app.schemas.saved_alerts import (
    SavedAlertCreate,
    SavedAlertList,
    SavedAlertOut,
)
from app.services.saved_alerts import SavedAlertService

router = APIRouter()


@router.post(
    "/",
    response_model=SavedAlertOut,
    status_code=status.HTTP_201_CREATED,
    summary="Salvar alerta de categoria",
)
async def create_alert(
    payload: SavedAlertCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SavedAlertOut:
    return await SavedAlertService(db).create(current_user, payload)


@router.get(
    "/",
    response_model=SavedAlertList,
    summary="Meus alertas/buscas salvas",
)
async def list_alerts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SavedAlertList:
    items = await SavedAlertService(db).list(current_user)
    return SavedAlertList(items=items, total=len(items))


@router.delete(
    "/{alert_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Remover um alerta salvo",
)
async def delete_alert(
    alert_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await SavedAlertService(db).delete(current_user, alert_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
