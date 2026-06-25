"""Schemas da assinatura (plano PRO) — #56."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

__all__ = [
    "SubscriptionSettingsRead",
    "SubscriptionSettingsUpdate",
    "SubscriptionInfo",
    "SubscriptionStartOut",
]


class SubscriptionSettingsRead(BaseModel):
    """Configuração do plano (admin)."""

    model_config = ConfigDict(from_attributes=True)

    enabled: bool = False
    plan_name: str = "FazTudo PRO"
    price_cents: int = 0
    included_credits: int = 0
    discount_pct: int = 0
    trial_days: int = 0
    trial_credits: int = 0


class SubscriptionSettingsUpdate(BaseModel):
    """Edição da configuração do plano (admin) — tudo opcional."""

    enabled: bool | None = None
    plan_name: str | None = Field(default=None, max_length=80)
    price_cents: int | None = Field(default=None, ge=0)
    included_credits: int | None = Field(default=None, ge=0)
    discount_pct: int | None = Field(default=None, ge=0, le=100)
    trial_days: int | None = Field(default=None, ge=0)
    trial_credits: int | None = Field(default=None, ge=0)


class SubscriptionInfo(BaseModel):
    """O que o profissional vê: o plano (se habilitado) + status da sua assinatura."""

    enabled: bool
    plan_name: str
    price_cents: int
    included_credits: int
    discount_pct: int
    trial_days: int
    trial_credits: int
    # status do próprio usuário
    is_pro: bool = False
    status: str | None = None
    current_period_end: datetime | None = None


class SubscriptionStartOut(BaseModel):
    """Resposta de ``POST /subscription/subscribe`` — link de checkout do MP."""

    checkout_url: str
