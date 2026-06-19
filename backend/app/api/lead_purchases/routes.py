"""Rotas da feature ``lead_purchases`` (Fase 5) — ``router = APIRouter()`` (§3.6).

Prefixo ``/lead-purchases`` é aplicado pelo agregador (``app.api.__init__``).
Caminhos relativos. As rotas chamam o :class:`LeadPurchaseService`; exceções de
domínio viram HTTP pelo handler global registrado em ``main.py`` (§3.9).

Papéis (§4 / §5.2):
- ``POST /``     → professional (compra exclusiva — transação atômica §5.4).
- ``GET /``      → professional (histórico das próprias compras).
- ``GET /{id}``  → professional dono da compra.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_roles
from app.database.session import get_db
from app.models import User, UserRole
from app.schemas.lead_purchases import (
    LeadPurchaseCreate,
    LeadPurchaseListResponse,
    LeadPurchaseRead,
    LeadPurchaseResult,
)
from app.services.lead_purchases import LeadPurchaseService

router = APIRouter()


@router.post(
    "/",
    response_model=LeadPurchaseResult,
    status_code=status.HTTP_201_CREATED,
    summary="Comprar lead (Lead Exclusivo)",
)
async def purchase_lead(
    payload: LeadPurchaseCreate,
    current_user: User = Depends(require_roles(UserRole.professional)),
    db: AsyncSession = Depends(get_db),
) -> LeadPurchaseResult:
    """Compra atômica de um lead. Valida elegibilidade + saldo, debita (``spend``),
    cria a compra (UNIQUE lead_id) e marca o lead ``purchased`` (§5.4). Erros:
    ``402`` saldo, ``409`` já comprado, ``403`` não elegível, ``404`` inexistente."""
    service = LeadPurchaseService(db)
    return await service.purchase(current_user, payload.lead_id)


@router.get(
    "/",
    response_model=LeadPurchaseListResponse,
    summary="Histórico de compras do profissional",
)
async def list_purchases(
    current_user: User = Depends(require_roles(UserRole.professional)),
    db: AsyncSession = Depends(get_db),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> LeadPurchaseListResponse:
    """Compras do profissional autenticado (com contato liberado — §4)."""
    service = LeadPurchaseService(db)
    items, total = await service.list_for_user(
        current_user, page=page, page_size=page_size
    )
    return LeadPurchaseListResponse(
        items=items, page=page, page_size=page_size, total=total
    )


@router.get(
    "/{purchase_id}",
    response_model=LeadPurchaseRead,
    summary="Detalhe de uma compra",
)
async def get_purchase(
    purchase_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.professional)),
    db: AsyncSession = Depends(get_db),
) -> LeadPurchaseRead:
    """Detalhe da compra do profissional dono (com lead + contato — §4)."""
    service = LeadPurchaseService(db)
    return await service.get(current_user, purchase_id)
