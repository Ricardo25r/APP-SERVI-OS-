"""Rotas da feature ``gamification`` (Fase 9) — ``router = APIRouter()`` (§3.6).

Prefixo ``/gamification`` é aplicado pelo agregador (``app.api.__init__``).
Caminhos relativos. As rotas chamam o :class:`GamificationService`; exceções de
domínio viram HTTP pelo handler global registrado em ``main.py`` (§3.9).

Endpoints (MVP — doc 08):
- ``GET /me``      → XP/nível/progresso + histórico recente do usuário logado.
- ``GET /ranking`` → top N profissionais por XP (filtros opcionais cidade/estado).
- ``GET /levels``  → tabela de níveis de referência (pública).

Ordem das rotas: as estáticas (``/me``, ``/ranking``, ``/levels``) não colidem
entre si (sem path params), então a ordem é apenas de leitura.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.database.session import get_db
from app.models import User
from app.schemas.gamification import (
    AchievementsResponse,
    LevelsResponse,
    MyGamificationOut,
    MyRankOut,
    RankingResponse,
)
from app.services.achievements import AchievementService
from app.services.gamification import GamificationService

router = APIRouter()


@router.get(
    "/achievements",
    response_model=AchievementsResponse,
    summary="Minhas conquistas (catálogo + status)",
)
async def my_achievements(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AchievementsResponse:
    """Catálogo de conquistas com o status do usuário (concede recém-ganhas)."""
    items = await AchievementService(db).evaluate_and_list(current_user)
    return AchievementsResponse(
        items=items,
        earned_count=sum(1 for i in items if i.earned),
        total=len(items),
    )


@router.get(
    "/me",
    response_model=MyGamificationOut,
    summary="Meu XP, nível e progresso (usuário autenticado)",
)
async def my_gamification(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MyGamificationOut:
    """XP total, nível atual (nome + número), XP para o próximo nível e histórico
    recente de XP do usuário logado. Para profissionais espelha
    ``professional_profiles``; para customers retorna ``xp=0`` (coerente — 200)."""
    service = GamificationService(db)
    return await service.my_summary(current_user)


@router.get(
    "/ranking",
    response_model=RankingResponse,
    summary="Ranking de profissionais por XP (top N)",
)
async def ranking(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=100),
    city: str | None = Query(default=None, max_length=120),
    state: str | None = Query(default=None, max_length=2),
) -> RankingResponse:
    """Top ``limit`` profissionais por XP desc, com nome, headline, XP, nível e
    rating. Filtros opcionais por cidade/estado (Ranking Municipal/Estadual —
    doc 08). Público (não exige autenticação)."""
    service = GamificationService(db)
    return await service.ranking(limit=limit, city=city, state=state)


@router.get(
    "/ranking/me",
    response_model=MyRankOut,
    summary="Minha posição no ranking (usuário autenticado)",
)
async def my_rank(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MyRankOut:
    """Posição do usuário logado no ranking de profissionais por XP."""
    service = GamificationService(db)
    return await service.my_rank(current_user)


@router.get(
    "/levels",
    response_model=LevelsResponse,
    summary="Tabela de níveis (referência)",
)
async def levels() -> LevelsResponse:
    """Tabela de níveis do gamification-engine (doc 08 — Sistema de Níveis)."""
    return LevelsResponse(levels=GamificationService.levels())
