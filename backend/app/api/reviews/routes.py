"""Rotas da feature ``reviews`` (Fase 7) — ``router = APIRouter()`` (§3.6).

Prefixo ``/reviews`` é aplicado pelo agregador (``app.api.__init__``). Caminhos
relativos. As rotas chamam o :class:`ReviewService`; as exceções de domínio são
convertidas em HTTP pelo handler global registrado em ``main.py`` (§3.9).

Endpoints:
- ``POST /``            → cria avaliação (author = current_user; target derivado).
- ``GET /me/pending``   → leads que o current_user ainda pode avaliar.
- ``GET /{user_id}``    → avaliações RECEBIDAS por um usuário (público, paginado).

Ordem das rotas: ``/me/pending`` é declarada **antes** de ``/{user_id}`` para não
ser capturada pelo path param.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.database.session import get_db
from app.models import User
from app.schemas.reviews import (
    PendingReviewsResponse,
    ReviewCreate,
    ReviewListResponse,
    ReviewOut,
)
from app.services.reviews import ReviewService

router = APIRouter()


@router.post(
    "/",
    response_model=ReviewOut,
    status_code=status.HTTP_201_CREATED,
    summary="Criar avaliação (author = usuário autenticado)",
)
async def create_review(
    payload: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReviewOut:
    """Cria a avaliação mútua ligada a um lead comprado. O ``target_id`` é
    derivado no backend (o outro lado da transação). Atualiza a reputação do
    alvo na mesma transação. Erros: ``404`` lead inexistente, ``403`` não
    participou/lead sem compra, ``409`` já avaliou este lead."""
    service = ReviewService(db)
    return await service.create(current_user, payload)


@router.get(
    "/me/pending",
    response_model=PendingReviewsResponse,
    summary="Leads que o usuário ainda pode avaliar",
)
async def list_pending_reviews(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PendingReviewsResponse:
    """Leads comprados em que o ``current_user`` participa (como contratante ou
    profissional) e que ele ainda não avaliou."""
    service = ReviewService(db)
    items = await service.list_pending(current_user)
    return PendingReviewsResponse(items=items, total=len(items))


@router.get(
    "/{user_id}",
    response_model=ReviewListResponse,
    summary="Avaliações recebidas por um usuário (público)",
)
async def list_received_reviews(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> ReviewListResponse:
    """Avaliações RECEBIDAS por ``user_id`` (paginado, público — §4:
    ``{items, page, page_size, total}``)."""
    service = ReviewService(db)
    items, total = await service.list_received(
        user_id, page=page, page_size=page_size
    )
    return ReviewListResponse(
        items=items, page=page, page_size=page_size, total=total
    )
