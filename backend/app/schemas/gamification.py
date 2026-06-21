"""Schemas Pydantic v2 da feature ``gamification`` (Fase 9 — XP + Níveis + Ranking).

MVP do gamification-engine (doc 08): expõe o XP acumulado, o nível atual (nome +
número), o progresso para o próximo nível, o histórico recente de XP, o ranking
de profissionais e a tabela de níveis de referência.

Convenções de nome do contrato (§3.3): ``<Entidade>Out`` + DTOs específicos.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

__all__ = [
    "XpTransactionOut",
    "LevelInfo",
    "MyGamificationOut",
    "RankingItem",
    "RankingResponse",
    "LevelsResponse",
]


# --------------------------------------------------------------------------- #
# Histórico de XP
# --------------------------------------------------------------------------- #
class XpTransactionOut(BaseModel):
    """Registro do histórico de XP (append-only, imutável — doc 08)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    amount: int
    source: str
    description: str | None = None
    created_at: datetime


# --------------------------------------------------------------------------- #
# Níveis (referência)
# --------------------------------------------------------------------------- #
class LevelInfo(BaseModel):
    """Um nível da tabela do gamification-engine (doc 08 — Sistema de Níveis)."""

    level: int
    name: str
    min_xp: int


class LevelsResponse(BaseModel):
    """Envelope da tabela de níveis (referência pública)."""

    levels: list[LevelInfo]


# --------------------------------------------------------------------------- #
# /me — progresso do profissional logado
# --------------------------------------------------------------------------- #
class MyGamificationOut(BaseModel):
    """Resumo de gamificação do usuário autenticado (dashboard — doc 08).

    Para um profissional: ``xp``/``level`` espelham
    ``professional_profiles``. Para um customer (sem perfil profissional no MVP):
    ``xp=0``, ``level=1`` e histórico vazio (resposta coerente, 200).

    ``xp_for_next_level`` é o XP que falta para cruzar o próximo limiar (``0`` se
    já está no nível máximo — Lenda).
    """

    xp: int
    level: int
    level_name: str
    next_level: int | None = None
    next_level_name: str | None = None
    next_level_xp: int | None = None
    xp_for_next_level: int
    # XP mínimo do nível atual (piso da faixa) — para a barra refletir o
    # progresso DENTRO do nível, não a partir do zero absoluto.
    level_min_xp: int = 0
    recent_transactions: list[XpTransactionOut]


# --------------------------------------------------------------------------- #
# Ranking
# --------------------------------------------------------------------------- #
class RankingItem(BaseModel):
    """Uma posição do ranking de profissionais (top N por XP — doc 08)."""

    professional_id: uuid.UUID
    user_id: uuid.UUID
    name: str
    headline: str | None = None
    city: str | None = None
    state: str | None = None
    xp: int
    level: int
    level_name: str
    rating: float


class RankingResponse(BaseModel):
    """Envelope do ranking (top N + filtros aplicados)."""

    items: list[RankingItem]
    total: int
