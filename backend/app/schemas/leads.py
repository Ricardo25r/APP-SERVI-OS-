"""Schemas Pydantic v2 da feature ``leads`` (Fase 4).

Contrato §4 (Fase 4 — Leads) e §5 (regras de negócio). Padrão de nomes do
contrato §3.3: ``<Entidade>Create``/``Update``/``Read``. O contrato chama a
resposta de ``LeadRead``; mantemos esse nome canônico e expomos os aliases
``LeadCreateIn``/``LeadUpdateIn``/``LeadOut`` pedidos na tarefa.

Regra de exposição de contato (§4, nota de ``LeadRead`` / §5.6): o telefone/email
do customer (``LeadContact``) **só** aparece para o customer dono do lead ou para
o profissional que **comprou** o lead. Na listagem do marketplace e no detalhe de
profissional não-comprador, ``contact`` vem ``None`` e o resumo do customer
(``CustomerSummary``) **não** inclui telefone/email.

Fase 11 (extras do lead): ``budget_range`` (faixa de orçamento), ``latitude``/
``longitude`` (coordenadas do serviço, p/ mapa + distância) e ``media`` (fotos).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import CategoryTier, LeadStatus, LeadType, LeadUrgency

# Faixas de orçamento (valores controlados; o frontend mapeia para rótulos R$).
BudgetRange = Literal["ate_100", "100_300", "300_500", "500_1000", "acima_1000"]

# Aliases pedidos pela tarefa (apontam para os schemas canônicos do contrato).
__all__ = [
    "LeadCreateIn",
    "LeadUpdateIn",
    "LeadOut",
    "LeadCreate",
    "LeadUpdate",
    "LeadRead",
    "LeadContact",
    "CategorySummary",
    "CustomerSummary",
    "LeadMediaOut",
    "LeadListResponse",
]


# --------------------------------------------------------------------------- #
# Entrada
# --------------------------------------------------------------------------- #
class LeadCreate(BaseModel):
    """Corpo de ``POST /leads`` (customer cria oportunidade).

    Mass-assignment seguro (§5.2): ``credits_cost``, ``status``, ``expires_at`` e
    ``customer_id`` **nunca** vêm do cliente — são calculados/derivados no service.
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    category_id: uuid.UUID
    title: str = Field(min_length=3, max_length=140)
    description: str = Field(min_length=1)
    lead_type: LeadType
    urgency: LeadUrgency
    city: str = Field(min_length=1, max_length=120)
    state: str = Field(min_length=2, max_length=2)
    neighborhood: str | None = Field(default=None, max_length=120)
    budget_range: BudgetRange | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


class LeadUpdate(BaseModel):
    """Corpo de ``PATCH /leads/{id}`` (só o dono, só enquanto ``open``).

    **Não** permite trocar ``category_id``/``lead_type`` (mudariam o
    ``credits_cost``, que é imutável — §4 / §5.1). Todos os campos são opcionais.
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    title: str | None = Field(default=None, min_length=3, max_length=140)
    description: str | None = Field(default=None, min_length=1)
    urgency: LeadUrgency | None = None
    neighborhood: str | None = Field(default=None, max_length=120)
    budget_range: BudgetRange | None = None


# --------------------------------------------------------------------------- #
# Resumos / contato
# --------------------------------------------------------------------------- #
class CategorySummary(BaseModel):
    """Resumo da categoria embutido no lead."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    tier: CategoryTier


class CustomerSummary(BaseModel):
    """Resumo público do customer (autor do lead) — **sem** dados de contato.

    É seguro expor a qualquer leitor (inclusive profissional não-comprador).
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class LeadContact(BaseModel):
    """Dados de contato do customer — liberados **apenas** após a compra.

    Para o customer dono também são exibidos (são os próprios dados). Nunca
    incluir em payloads de marketplace para profissional não-comprador.
    """

    model_config = ConfigDict(from_attributes=True)

    name: str
    email: str
    phone: str | None = None


class LeadMediaOut(BaseModel):
    """Foto do lead — URL presignada (GET) acessível pelo navegador."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    url: str
    position: int


# --------------------------------------------------------------------------- #
# Saída
# --------------------------------------------------------------------------- #
class LeadRead(BaseModel):
    """Resposta canônica do lead (``LeadRead`` do contrato §4).

    ``contact`` só é preenchido para o customer dono ou o profissional comprador
    (montado no service — não vem direto do ORM). ``affordable`` é a flag de
    saldo da listagem do profissional (§5.3 item 6); ``None`` quando não se aplica
    (ex.: visão do próprio customer). ``distance_km`` só é montado para o
    profissional quando ele e o lead têm coordenadas.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    customer_id: uuid.UUID
    category_id: uuid.UUID
    title: str
    description: str
    lead_type: LeadType
    urgency: LeadUrgency
    city: str
    state: str
    neighborhood: str | None
    budget_range: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    status: LeadStatus
    credits_cost: int
    expires_at: datetime | None
    created_at: datetime
    updated_at: datetime

    # Campos compostos montados no service.
    category: CategorySummary | None = None
    customer: CustomerSummary | None = None
    is_purchased: bool = False
    contact: LeadContact | None = None
    affordable: bool | None = None
    media: list[LeadMediaOut] = []
    distance_km: float | None = None
    # Confirmação de serviço (anti no-show). ``arrival_code`` só vai para o
    # customer dono enquanto a chegada não foi confirmada (ele mostra ao
    # profissional). ``arrived`` indica chegada confirmada via código.
    arrival_code: str | None = None
    arrived: bool = False
    # Id da compra ativa (para o profissional comprador confirmar a chegada).
    purchase_id: uuid.UUID | None = None


class LeadListResponse(BaseModel):
    """Envelope paginado (§4: ``{items, page, page_size, total}``)."""

    items: list[LeadRead]
    page: int
    page_size: int
    total: int


# --------------------------------------------------------------------------- #
# Aliases pedidos pela tarefa
# --------------------------------------------------------------------------- #
LeadCreateIn = LeadCreate
LeadUpdateIn = LeadUpdate
LeadOut = LeadRead
