"""Rotas da feature ``credits`` (Fase 5) — ``router = APIRouter()`` (§3.6).

Prefixo ``/credits`` é aplicado pelo agregador (``app.api.__init__``). Caminhos
relativos. As rotas chamam o :class:`CreditService`; exceções de domínio viram
HTTP pelo handler global registrado em ``main.py`` (§3.9).

Papéis (§4 / §5.2):
- ``GET /balance``  → professional (saldo; cria wallet lazily).
- ``GET /history``  → professional (histórico da própria carteira).
- ``POST /grant``   → admin (concede/ajusta créditos — endpoint admin/dev §7).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_roles
from app.database.session import get_db
from app.models import CreditTransactionType, User, UserRole
from app.schemas.credits import (
    CreditTransactionListResponse,
    CreditTransactionRead,
    GrantCredits,
    WalletRead,
)
from app.services.credits import CreditService

router = APIRouter()


@router.get(
    "/balance",
    response_model=WalletRead,
    summary="Saldo de créditos do profissional",
)
async def get_balance(
    current_user: User = Depends(require_roles(UserRole.professional)),
    db: AsyncSession = Depends(get_db),
) -> WalletRead:
    """Retorna ``{wallet_id, balance}`` do profissional (cria wallet lazily §4)."""
    service = CreditService(db)
    return await service.get_balance_for_user(current_user)


@router.get(
    "/history",
    response_model=CreditTransactionListResponse,
    summary="Histórico de transações de crédito",
)
async def get_history(
    current_user: User = Depends(require_roles(UserRole.professional)),
    db: AsyncSession = Depends(get_db),
    transaction_type: CreditTransactionType | None = Query(
        default=None, alias="type"
    ),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> CreditTransactionListResponse:
    """Histórico paginado da própria carteira (§4: ``{items, page, page_size, total}``)."""
    service = CreditService(db)
    items, total = await service.list_history_for_user(
        current_user,
        transaction_type=transaction_type,
        page=page,
        page_size=page_size,
    )
    return CreditTransactionListResponse(
        items=items, page=page, page_size=page_size, total=total
    )


@router.post(
    "/grant",
    response_model=CreditTransactionRead,
    status_code=status.HTTP_201_CREATED,
    summary="Conceder/ajustar créditos (admin)",
)
async def grant_credits(
    payload: GrantCredits,
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> CreditTransactionRead:
    """Admin concede ``bonus`` ou ``adjustment`` (substitui pagamentos da Fase 6
    no MVP — §7). Gera a ``CreditTransaction`` correspondente (§2.9)."""
    service = CreditService(db)
    return await service.grant(payload)
