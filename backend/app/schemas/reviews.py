"""Schemas Pydantic v2 da feature ``reviews`` (Fase 7 — Avaliações + Reputação).

Avaliação mútua ligada a um lead comprado. Anti-IDOR/anti-fraude (§5.2 do
contrato + reputation-engine): o cliente envia **apenas** ``lead_id``, ``score``
e ``comment``; o ``target_id`` (o outro lado da transação) é **derivado no
backend** e nunca vem do payload.

Convenções de nome do contrato (§3.3): ``<Entidade>Create``/``Read`` + DTOs
específicos (``ReviewListResponse``, ``ReputationSummary``).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

__all__ = [
    "ReviewCreate",
    "ReviewReplyIn",
    "ReviewOut",
    "ReviewListResponse",
    "ReputationSummary",
    "PendingReviewItem",
    "PendingReviewsResponse",
    "ReviewHighlight",
    "ReviewHighlightsResponse",
]


# --------------------------------------------------------------------------- #
# Entrada
# --------------------------------------------------------------------------- #
class ReviewCreate(BaseModel):
    """Corpo de ``POST /reviews`` (author = ``current_user``).

    O ``target_id`` **não** vem do cliente — é derivado no service (o outro lado
    da transação do lead). ``score`` é validado 1–5 aqui (422 do FastAPI quando
    fora da faixa).
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    lead_id: uuid.UUID
    score: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)


class ReviewReplyIn(BaseModel):
    """Resposta do avaliado a uma avaliação recebida (#51)."""

    model_config = ConfigDict(str_strip_whitespace=True)

    reply: str = Field(min_length=1, max_length=1000)


# --------------------------------------------------------------------------- #
# Saída
# --------------------------------------------------------------------------- #
class ReviewOut(BaseModel):
    """Avaliação (resposta canônica). Imutável — sem ``updated_at``."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    author_id: uuid.UUID
    target_id: uuid.UUID
    lead_id: uuid.UUID
    score: int
    comment: str | None
    reply: str | None = None
    reply_at: datetime | None = None
    created_at: datetime


class ReviewListResponse(BaseModel):
    """Envelope paginado (§4: ``{items, page, page_size, total}``)."""

    items: list[ReviewOut]
    page: int
    page_size: int
    total: int


class ReputationSummary(BaseModel):
    """Resumo de reputação de um usuário (agregados recebidos).

    ``average_score`` é a média das avaliações recebidas (0–5, 2 casas).
    ``total_reviews`` é a contagem. ``reputation_score`` é a escala 0–1000 do
    reputation-engine (mapeamento MVP: ``round(average * 200)``); para
    profissionais espelha ``professional_profiles.rating``/``total_reviews``.
    """

    user_id: uuid.UUID
    average_score: float
    total_reviews: int
    reputation_score: int


# --------------------------------------------------------------------------- #
# Pendências (leads que o usuário ainda pode avaliar)
# --------------------------------------------------------------------------- #
class PendingReviewItem(BaseModel):
    """Um lead que o ``current_user`` ainda pode avaliar e quem é o alvo."""

    lead_id: uuid.UUID
    lead_title: str
    target_id: uuid.UUID
    target_name: str
    role_as: str  # "customer" ou "professional" — papel do current_user no lead


class PendingReviewsResponse(BaseModel):
    """Envelope das pendências de avaliação do ``current_user``."""

    items: list[PendingReviewItem]
    total: int


# --------------------------------------------------------------------------- #
# Depoimentos em destaque (avaliações positivas públicas — "indique e ganhe"
# / tela de pacotes). Mostra os dois lados (contratantes e profissionais).
# --------------------------------------------------------------------------- #
class ReviewHighlight(BaseModel):
    """Um depoimento em destaque (avaliação 4–5★ com comentário)."""

    author_name: str
    author_avatar_url: str | None = None
    author_role: str
    score: int
    comment: str
    created_at: datetime


class ReviewHighlightsResponse(BaseModel):
    items: list[ReviewHighlight]
