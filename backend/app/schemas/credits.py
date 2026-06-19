"""Schemas Pydantic v2 da feature ``credits`` (Fase 5).

Contrato §4 (Fase 5 — Créditos) e §2.8/§2.9 (modelo). Padrão de nomes do
contrato §3.3; os aliases ``WalletOut``/``CreditTransactionOut``/``GrantCreditsIn``
pedidos na tarefa apontam para os schemas canônicos.

Regras de exposição (§5.2): ``balance``, ``balance_before``/``balance_after`` e
``professional_id`` **nunca** vêm do cliente — são derivados no service. O cliente
só envia ``GrantCreditsIn`` (admin) com ``professional_id``, ``amount`` e
``transaction_type`` (restrito a ``bonus|adjustment``).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import CreditTransactionType

__all__ = [
    "WalletRead",
    "CreditTransactionRead",
    "GrantCredits",
    "CreditTransactionListResponse",
    # Aliases pedidos pela tarefa.
    "WalletOut",
    "CreditTransactionOut",
    "GrantCreditsIn",
]


# --------------------------------------------------------------------------- #
# Saída
# --------------------------------------------------------------------------- #
class WalletRead(BaseModel):
    """Resposta de ``GET /credits/balance`` — ``{wallet_id, balance}`` (§4)."""

    model_config = ConfigDict(from_attributes=True)

    wallet_id: uuid.UUID
    balance: int


class CreditTransactionRead(BaseModel):
    """Registro do histórico (``CreditTransactionRead`` do contrato §4).

    Append-only e imutável (§2.9): expõe ``amount`` (com sinal), ``balance_before``
    e ``balance_after`` para auditoria.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    transaction_type: CreditTransactionType
    amount: int
    balance_before: int
    balance_after: int
    description: str | None = None
    reference_id: uuid.UUID | None = None
    created_at: datetime


class CreditTransactionListResponse(BaseModel):
    """Envelope paginado (§4: ``{items, page, page_size, total}``)."""

    items: list[CreditTransactionRead]
    page: int
    page_size: int
    total: int


# --------------------------------------------------------------------------- #
# Entrada
# --------------------------------------------------------------------------- #
class GrantCredits(BaseModel):
    """Corpo de ``POST /credits/grant`` (admin/dev — §4 / §7).

    ``transaction_type`` é restrito a ``bonus|adjustment`` (§4). O ``amount`` só
    pode ser negativo em ``adjustment`` (correção para baixo — §2.9). Mass
    assignment seguro: o ``balance`` resultante é sempre derivado no service.
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    professional_id: uuid.UUID
    amount: int = Field(description="Positivo para entrada; negativo só em adjustment.")
    transaction_type: CreditTransactionType
    description: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def _validate_grant(self) -> GrantCredits:
        """Restringe ``transaction_type`` a ``bonus|adjustment`` e a regra de sinal."""
        allowed = {CreditTransactionType.bonus, CreditTransactionType.adjustment}
        if self.transaction_type not in allowed:
            raise ValueError(
                "transaction_type deve ser 'bonus' ou 'adjustment'."
            )
        if self.amount == 0:
            raise ValueError("amount não pode ser zero.")
        if self.amount < 0 and self.transaction_type != CreditTransactionType.adjustment:
            raise ValueError("amount negativo só é permitido em 'adjustment'.")
        return self


# --------------------------------------------------------------------------- #
# Aliases pedidos pela tarefa
# --------------------------------------------------------------------------- #
WalletOut = WalletRead
CreditTransactionOut = CreditTransactionRead
GrantCreditsIn = GrantCredits
