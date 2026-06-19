"""Enums Python centralizados dos modelos (dono: backbone).

Todos os enums são ``str, Enum`` (valores em inglês, snake_case) conforme o
schema canônico (§1.1 do contrato). Cada enum mapeia para um tipo ``ENUM``
nativo do Postgres via ``Enum(<PyEnum>, name="<enum_name>")`` nos models.

Os modelos importam os enums daqui (fonte única — §3.8). Os arquivos de model
e o ``app.models.__init__`` os reexportam por conveniência, de modo que tanto
``from app.models import UserRole`` quanto ``from app.models.user import UserRole``
funcionam.
"""

from __future__ import annotations

import enum


class UserRole(str, enum.Enum):
    """Papel do usuário (RBAC base). Postgres enum ``user_role``."""

    customer = "customer"
    professional = "professional"
    admin = "admin"


class UserStatus(str, enum.Enum):
    """Estado da conta do usuário. Postgres enum ``user_status``."""

    active = "active"
    suspended = "suspended"
    blocked = "blocked"


class AvailabilityStatus(str, enum.Enum):
    """Disponibilidade do profissional. Postgres enum ``availability_status``."""

    available = "available"
    busy = "busy"
    unavailable = "unavailable"


class CategoryTier(str, enum.Enum):
    """Faixa de custo da categoria. Postgres enum ``category_tier``.

    Mapeia para custo base do lead: ``simple → 1``, ``medium → 3``,
    ``premium → 5`` (§5.1).
    """

    simple = "simple"
    medium = "medium"
    premium = "premium"


class LeadType(str, enum.Enum):
    """Tipo de contratação do lead. Postgres enum ``lead_type``."""

    one_time = "one_time"
    temporary = "temporary"
    permanent = "permanent"


class LeadUrgency(str, enum.Enum):
    """Urgência do lead. Postgres enum ``lead_urgency``."""

    immediate = "immediate"
    today = "today"
    this_week = "this_week"
    flexible = "flexible"


class LeadStatus(str, enum.Enum):
    """Estado do lead. Postgres enum ``lead_status``."""

    open = "open"
    purchased = "purchased"
    closed = "closed"
    cancelled = "cancelled"


class CreditTransactionType(str, enum.Enum):
    """Tipo de movimentação de crédito. Postgres enum ``credit_transaction_type``.

    Convenção de sinal de ``amount`` (§2.9): entradas (``purchase``, ``bonus``,
    ``refund``, ``adjustment``) positivas; ``spend`` negativo. ``adjustment``
    pode ser negativo.
    """

    purchase = "purchase"
    bonus = "bonus"
    refund = "refund"
    spend = "spend"
    adjustment = "adjustment"


__all__ = [
    "UserRole",
    "UserStatus",
    "AvailabilityStatus",
    "CategoryTier",
    "LeadType",
    "LeadUrgency",
    "LeadStatus",
    "CreditTransactionType",
]
