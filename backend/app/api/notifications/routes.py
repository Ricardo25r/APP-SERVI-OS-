"""Rotas da feature ``notifications`` (Fase 14) — ``router = APIRouter()``.

Prefixo ``/notifications`` (sob ``/api/v1``). Todas exigem autenticação; cada
operação é escopada ao próprio usuário (anti-IDOR).

- ``GET  /notifications``               → lista (paginada) + total de não lidas.
- ``GET  /notifications/unread-count``  → contador para o sino.
- ``POST /notifications/{id}/read``     → marca uma como lida.
- ``POST /notifications/read-all``      → marca todas como lidas.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import Response

from app.core.deps import get_current_user
from app.database.session import get_db
from app.models import User
from app.schemas.notifications import (
    NotificationListResponse,
    NotificationPrefsOut,
    NotificationPrefsUpdate,
    UnreadCountOut,
)
from app.services.notifications import NotificationService

router = APIRouter()


@router.get("", response_model=NotificationListResponse, summary="Listar notificações")
async def list_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    unread: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
) -> NotificationListResponse:
    """Notificações do usuário autenticado (paginado)."""
    service = NotificationService(db)
    items, total, unread_count = await service.list_for_user(
        current_user, unread_only=unread, page=page, page_size=page_size
    )
    return NotificationListResponse(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        unread=unread_count,
    )


@router.get(
    "/unread-count",
    response_model=UnreadCountOut,
    summary="Contador de notificações não lidas",
)
async def unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UnreadCountOut:
    """Quantidade de não lidas (para o badge do sino)."""
    service = NotificationService(db)
    return UnreadCountOut(count=await service.unread_count(current_user))


@router.get(
    "/preferences",
    response_model=NotificationPrefsOut,
    summary="Minhas preferências de push",
)
async def get_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationPrefsOut:
    """Preferências de push do usuário (padrão: tudo ligado)."""
    return await NotificationService(db).get_preferences(current_user)


@router.put(
    "/preferences",
    response_model=NotificationPrefsOut,
    summary="Atualizar preferências de push",
)
async def update_preferences(
    payload: NotificationPrefsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationPrefsOut:
    """Liga/desliga categorias de push (conversa, pedidos, novidades)."""
    return await NotificationService(db).update_preferences(
        current_user, payload
    )


@router.post(
    "/{notification_id}/read",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Marcar notificação como lida",
)
async def mark_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Marca uma notificação do próprio usuário como lida."""
    service = NotificationService(db)
    await service.mark_read(current_user, notification_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/read-all", summary="Marcar todas como lidas")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Marca todas as notificações não lidas do usuário como lidas."""
    service = NotificationService(db)
    updated = await service.mark_all_read(current_user)
    return {"updated": updated}
