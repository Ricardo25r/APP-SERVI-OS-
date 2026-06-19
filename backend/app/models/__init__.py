"""Pacote de modelos ORM (dono: backbone).

Reexporta TODOS os models, mixins e enums para que:
- o Alembic autogenerate enxergue toda a ``Base.metadata`` (basta importar
  ``app.models``);
- os repositórios/services importem via ``from app.models import X``.

Enums são centralizados em ``app.models.enums`` (§3.8) e reexportados aqui.
"""

from __future__ import annotations

from app.database.base import Base
from app.models.category import Category
from app.models.credit_package import CreditPackage
from app.models.credit_transaction import CreditTransaction
from app.models.credit_wallet import CreditWallet
from app.models.customer_profile import CustomerProfile
from app.models.enums import (
    AvailabilityStatus,
    CategoryTier,
    CreditTransactionType,
    LeadStatus,
    LeadType,
    LeadUrgency,
    PaymentOrderStatus,
    UserRole,
    UserStatus,
)
from app.models.lead import Lead
from app.models.lead_purchase import LeadPurchase
from app.models.mixins import (
    CreatedAtMixin,
    SoftDeleteMixin,
    TimestampMixin,
    UUIDPKMixin,
)
from app.models.payment_order import PaymentOrder
from app.models.professional_category import ProfessionalCategory
from app.models.professional_profile import ProfessionalProfile
from app.models.refresh_token import RefreshToken
from app.models.user import User

__all__ = [
    # Base + mixins
    "Base",
    "UUIDPKMixin",
    "TimestampMixin",
    "CreatedAtMixin",
    "SoftDeleteMixin",
    # Models
    "User",
    "RefreshToken",
    "CustomerProfile",
    "ProfessionalProfile",
    "ProfessionalCategory",
    "Category",
    "Lead",
    "CreditWallet",
    "CreditTransaction",
    "LeadPurchase",
    "CreditPackage",
    "PaymentOrder",
    # Enums
    "UserRole",
    "UserStatus",
    "AvailabilityStatus",
    "CategoryTier",
    "LeadType",
    "LeadUrgency",
    "LeadStatus",
    "CreditTransactionType",
    "PaymentOrderStatus",
]
