"""Schemas Pydantic v2 da feature ``lead_purchases`` (Fase 5).

Contrato §4 (Fase 5 — Compra de Lead) e §2.10 (modelo). A resposta da compra
inclui o ``LeadRead`` **com contato liberado** do customer (Lead Exclusivo — o
profissional comprador recebe telefone/email no payload — §5.4 / §5.6).

Reutiliza ``LeadRead``/``LeadContact`` da feature ``leads`` (não duplica). Os
aliases ``LeadPurchaseIn``/``LeadPurchaseOut`` pedidos na tarefa apontam para os
schemas canônicos do contrato.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.leads import LeadContact, LeadRead

__all__ = [
    "LeadPurchaseCreate",
    "LeadPurchaseRead",
    "LeadPurchaseResult",
    "WalletBalance",
    "LeadPurchaseListResponse",
    # Aliases pedidos pela tarefa.
    "LeadPurchaseIn",
    "LeadPurchaseOut",
]


# --------------------------------------------------------------------------- #
# Entrada
# --------------------------------------------------------------------------- #
class LeadPurchaseCreate(BaseModel):
    """Corpo de ``POST /lead-purchases`` (professional compra um lead).

    Só o ``lead_id`` vem do cliente; ``professional_id``, ``credits_used`` e o
    débito são derivados no service a partir do ``current_user`` (§5.2 — anti-IDOR).
    """

    lead_id: uuid.UUID


# --------------------------------------------------------------------------- #
# Saída
# --------------------------------------------------------------------------- #
class LeadPurchaseRead(BaseModel):
    """Compra de lead (``LeadPurchaseRead`` do contrato §4).

    Inclui o ``lead`` (detalhe completo) e o ``contact`` (telefone/email do
    customer liberado pela compra). ``contact`` só é montado para o profissional
    dono da compra (§4 / §5.6).
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    lead_id: uuid.UUID
    professional_id: uuid.UUID
    credits_used: int
    purchased_at: datetime
    created_at: datetime
    contact_deadline: datetime | None = None

    # Campos compostos montados no service.
    lead: LeadRead | None = None
    contact: LeadContact | None = None


class WalletBalance(BaseModel):
    """Saldo resumido devolvido após a compra (``{balance}`` — §4)."""

    balance: int


class LeadPurchaseResult(BaseModel):
    """Resposta de ``POST /lead-purchases`` (§4).

    ``{purchase, lead (com contato liberado), wallet: {balance}}``.
    """

    purchase: LeadPurchaseRead
    lead: LeadRead
    wallet: WalletBalance


class LeadPurchaseListResponse(BaseModel):
    """Envelope paginado (§4: ``{items, page, page_size, total}``)."""

    items: list[LeadPurchaseRead]
    page: int
    page_size: int
    total: int


# --------------------------------------------------------------------------- #
# Aliases pedidos pela tarefa
# --------------------------------------------------------------------------- #
LeadPurchaseIn = LeadPurchaseCreate
LeadPurchaseOut = LeadPurchaseRead
