"""Rotas da feature ``support`` (Fase 15) — ``router = APIRouter()``.

Prefixo ``/support`` (sob ``/api/v1``).

- ``POST /support/tickets``     → abrir chamado (autenticado).
- ``GET  /support/tickets/me``  → meus chamados (autenticado).
- ``GET  /support/tickets``     → todos os chamados (admin).
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_roles
from app.core.ratelimit import rate_limit
from app.database.session import get_db
from app.models import User, UserRole
from app.schemas.support import (
    SupportTicketAdminListResponse,
    SupportTicketAdminOut,
    SupportTicketCreate,
    SupportTicketListResponse,
    SupportTicketOut,
    SupportTicketStatusUpdate,
)
from app.services.support import SupportService

router = APIRouter()


@router.post(
    "/tickets",
    response_model=SupportTicketOut,
    status_code=status.HTTP_201_CREATED,
    summary="Abrir chamado de suporte",
    dependencies=[Depends(rate_limit("support", limit=5, window_seconds=60))],
)
async def create_ticket(
    payload: SupportTicketCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SupportTicketOut:
    """Registra um chamado do usuário autenticado e notifica o suporte."""
    return await SupportService(db).create_ticket(current_user, payload)


@router.get(
    "/tickets/me",
    response_model=SupportTicketListResponse,
    summary="Meus chamados",
)
async def my_tickets(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SupportTicketListResponse:
    """Chamados abertos pelo usuário autenticado."""
    items, total = await SupportService(db).list_mine(current_user)
    return SupportTicketListResponse(items=items, total=total)


@router.get(
    "/tickets",
    response_model=SupportTicketAdminListResponse,
    summary="Todos os chamados (admin)",
)
async def all_tickets(
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
) -> SupportTicketAdminListResponse:
    """Lista todos os chamados (somente admin), com dados do autor."""
    items, total = await SupportService(db).list_all(page=page, page_size=page_size)
    return SupportTicketAdminListResponse(items=items, total=total)


@router.patch(
    "/tickets/{ticket_id}",
    response_model=SupportTicketAdminOut,
    summary="Atualizar status do chamado (admin)",
)
async def update_ticket_status(
    ticket_id: uuid.UUID,
    payload: SupportTicketStatusUpdate,
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> SupportTicketAdminOut:
    """Marca um chamado como resolvido (closed) ou reabre (open)."""
    return await SupportService(db).set_status(ticket_id, payload.status)
