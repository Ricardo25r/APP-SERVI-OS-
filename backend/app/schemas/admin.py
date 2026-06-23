"""Schemas Pydantic v2 da feature ``admin`` (Fase 10 — Administração MVP).

Cobre métricas, gestão de usuários, moderação de leads, financeiro e auditoria.
Padrão de nomes do contrato §3.3 (``*Read``/``*Update``/envelopes paginados).

Regras de mass assignment (§6 do admin-panel-spec): os payloads de entrada
listam **apenas** os campos editáveis pela ação. ``PATCH .../status`` só aceita
``status`` (enum) + ``reason`` opcional; campos derivados nunca são aceitos.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import (
    LeadStatus,
    LeadType,
    LeadUrgency,
    PaymentOrderStatus,
    UserRole,
    UserStatus,
)

__all__ = [
    # Métricas
    "RoleCounts",
    "LeadStatusCounts",
    "FinanceSummary",
    "AdminMetrics",
    # Usuários
    "AdminUserRead",
    "AdminUserListResponse",
    "UserStatusUpdate",
    # Leads
    "AdminLeadRead",
    "AdminLeadListResponse",
    # Financeiro
    "AdminPaymentRead",
    "AdminPaymentListResponse",
    # Auditoria
    "AuditLogRead",
    "AuditLogListResponse",
]


# --------------------------------------------------------------------------- #
# Métricas (GET /admin/metrics)
# --------------------------------------------------------------------------- #
class RoleCounts(BaseModel):
    """Contagem de usuários por papel (ativos, não soft-deleted)."""

    total: int
    customer: int
    professional: int
    admin: int


class LeadStatusCounts(BaseModel):
    """Contagem de leads por status (não soft-deleted)."""

    total: int
    open: int
    purchased: int
    closed: int
    cancelled: int


class FinanceSummary(BaseModel):
    """Resumo financeiro: receita dos pedidos ``paid`` (em centavos e reais)."""

    paid_orders: int
    revenue_cents: int
    revenue_brl: float
    refunded_orders: int


class AdminMetrics(BaseModel):
    """KPIs do dashboard executivo (§8 do admin-panel-spec — MVP)."""

    users: RoleCounts
    professionals: int
    customers: int
    leads: LeadStatusCounts
    lead_purchases: int
    credit_packages_sold: int
    reviews: int
    conversations: int
    support_tickets_open: int = 0
    finance: FinanceSummary


# --------------------------------------------------------------------------- #
# Gestão de usuários
# --------------------------------------------------------------------------- #
class AdminUserRead(BaseModel):
    """Usuário (visão admin). Nunca expõe ``password_hash`` (§RN-USR-04)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: str
    phone: str | None = None
    role: UserRole
    status: UserStatus
    last_login_at: datetime | None = None
    created_at: datetime
    deleted_at: datetime | None = None


class AdminUserListResponse(BaseModel):
    """Envelope paginado de usuários (§4: ``{items, page, page_size, total}``)."""

    items: list[AdminUserRead]
    page: int
    page_size: int
    total: int


class UserStatusUpdate(BaseModel):
    """Corpo de ``PATCH /admin/users/{id}/status`` (mass-assignment safe).

    Apenas ``status`` (active | suspended | blocked) + ``reason`` opcional.
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    status: UserStatus
    reason: str | None = Field(default=None, max_length=500)


class UserRoleUpdate(BaseModel):
    """Corpo de ``PATCH /admin/users/{id}/role`` — promover/alterar o papel."""

    model_config = ConfigDict(str_strip_whitespace=True)

    role: UserRole
    reason: str | None = Field(default=None, max_length=500)


# --------------------------------------------------------------------------- #
# Moderação de leads
# --------------------------------------------------------------------------- #
class AdminLeadRead(BaseModel):
    """Lead (visão admin — moderação)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    customer_id: uuid.UUID
    category_id: uuid.UUID
    title: str
    lead_type: LeadType
    urgency: LeadUrgency
    city: str
    state: str
    neighborhood: str | None = None
    status: LeadStatus
    credits_cost: int
    expires_at: datetime | None = None
    created_at: datetime
    deleted_at: datetime | None = None


class AdminLeadListResponse(BaseModel):
    """Envelope paginado de leads (moderação)."""

    items: list[AdminLeadRead]
    page: int
    page_size: int
    total: int


# --------------------------------------------------------------------------- #
# Financeiro
# --------------------------------------------------------------------------- #
class AdminPaymentRead(BaseModel):
    """Pedido de pagamento (visão admin — financeiro)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    package_id: uuid.UUID
    provider: str
    amount_cents: int
    credits: int
    currency: str
    status: PaymentOrderStatus
    external_reference: str
    paid_at: datetime | None = None
    refunded_at: datetime | None = None
    created_at: datetime


class AdminPaymentListResponse(BaseModel):
    """Envelope paginado de pedidos + resumo de receita (§ Financeiro)."""

    items: list[AdminPaymentRead]
    page: int
    page_size: int
    total: int
    summary: FinanceSummary


# --------------------------------------------------------------------------- #
# Auditoria
# --------------------------------------------------------------------------- #
class AuditLogRead(BaseModel):
    """Registro de auditoria (somente leitura — §7.4, imutável)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    actor_id: uuid.UUID
    action: str
    entity: str
    entity_id: uuid.UUID | None = None
    meta: dict[str, Any] | None = None
    ip_address: str | None = None
    created_at: datetime


class AuditLogListResponse(BaseModel):
    """Envelope paginado da auditoria."""

    items: list[AuditLogRead]
    page: int
    page_size: int
    total: int
