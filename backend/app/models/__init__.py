"""Pacote de modelos ORM (dono: backbone).

Reexporta TODOS os models, mixins e enums para que:
- o Alembic autogenerate enxergue toda a ``Base.metadata`` (basta importar
  ``app.models``);
- os repositórios/services importem via ``from app.models import X``.

Enums são centralizados em ``app.models.enums`` (§3.8) e reexportados aqui.
"""

from __future__ import annotations

from app.database.base import Base
from app.models.achievement import Achievement, UserAchievement
from app.models.analytics_event import AnalyticsEvent
from app.models.audit_log import AuditLog
from app.models.category import Category
from app.models.conversation import Conversation
from app.models.credit_package import CreditPackage
from app.models.credit_transaction import CreditTransaction
from app.models.credit_wallet import CreditWallet
from app.models.customer_profile import CustomerProfile
from app.models.enums import (
    AvailabilityStatus,
    CategoryTier,
    ConversationStatus,
    CreditTransactionType,
    LeadStatus,
    LeadType,
    LeadUrgency,
    PaymentOrderStatus,
    UserRole,
    UserStatus,
)
from app.models.error_log import ErrorLog
from app.models.favorite import Favorite
from app.models.lead import Lead
from app.models.lead_dispute import LeadDispute
from app.models.lead_media import LeadMedia
from app.models.lead_purchase import LeadPurchase
from app.models.message import Message
from app.models.mixins import (
    CreatedAtMixin,
    SoftDeleteMixin,
    TimestampMixin,
    UUIDPKMixin,
)
from app.models.notification import Notification
from app.models.payment_order import PaymentOrder
from app.models.payment_settings import PaymentSettings
from app.models.professional_category import ProfessionalCategory
from app.models.professional_profile import ProfessionalProfile
from app.models.push_subscription import PushSubscription
from app.models.refresh_token import RefreshToken
from app.models.report import Report
from app.models.review import Review
from app.models.saved_category_alert import SavedCategoryAlert
from app.models.sprint import (
    Sprint,
    SprintIdea,
    SprintIdeaAnexo,
    SprintIdeaComentario,
    SprintIdeaEvento,
    SprintIdeaVoto,
)
from app.models.support_ticket import SupportTicket
from app.models.support_ticket_message import SupportTicketMessage
from app.models.user import User
from app.models.user_block import UserBlock
from app.models.xp_transaction import XpTransaction

__all__ = [
    # Base + mixins
    "Base",
    "UUIDPKMixin",
    "TimestampMixin",
    "CreatedAtMixin",
    "SoftDeleteMixin",
    # Models
    "User",
    "UserBlock",
    "RefreshToken",
    "CustomerProfile",
    "ProfessionalProfile",
    "ProfessionalCategory",
    "Category",
    "ErrorLog",
    "Favorite",
    "Lead",
    "LeadDispute",
    "LeadMedia",
    "CreditWallet",
    "CreditTransaction",
    "LeadPurchase",
    "CreditPackage",
    "PaymentOrder",
    "PaymentSettings",
    "Review",
    "SavedCategoryAlert",
    "Report",
    "Conversation",
    "Message",
    "Notification",
    "PushSubscription",
    "XpTransaction",
    "Achievement",
    "UserAchievement",
    "AuditLog",
    "AnalyticsEvent",
    "SupportTicket",
    "SupportTicketMessage",
    "Sprint",
    "SprintIdea",
    "SprintIdeaAnexo",
    "SprintIdeaComentario",
    "SprintIdeaVoto",
    "SprintIdeaEvento",
    # Enums
    "UserRole",
    "UserStatus",
    "AvailabilityStatus",
    "CategoryTier",
    "LeadType",
    "LeadUrgency",
    "LeadStatus",
    "CreditTransactionType",
    "ConversationStatus",
    "PaymentOrderStatus",
]
