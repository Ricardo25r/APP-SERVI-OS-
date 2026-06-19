"""Modelo ``conversations`` (Fase 8 — feature ``chat``).

Conversa **1:1 por lead** entre o contratante (dono do lead) e o profissional que
comprou o lead — o evento de "contato liberado" da compra
(ver ``docs/11-chat-engine`` §3.1/§3.2 e §CONVERSATIONS do doc 04).

Modelagem (alinhada ao chat-engine e ao doc 04):
- ``lead_id`` **UNIQUE** — garante 1 conversa por lead no MVP (Lead Exclusivo;
  ``lead_purchases.lead_id`` também é UNIQUE). FK → ``leads.id``.
- ``customer_id`` / ``professional_id`` referenciam ``users.id`` (os dois
  participantes; o chat-engine define ambos como FK para ``users`` — o
  profissional aqui é o **usuário** comprador, derivado de
  ``professional_profiles.user_id``).
- ``status`` segue o enum oficial ``active | archived`` (§3.4). Sem novos estados.
- ``last_message_at`` — extensão (§4 do chat-engine) para ordenar a lista de
  conversas pela atividade mais recente sem varrer ``messages``.

Entidade rastreável: usa ``TimestampMixin`` (``created_at``/``updated_at``). O
soft delete/arquivamento é deferido (ver observações da Fase 8).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.enums import ConversationStatus
from app.models.mixins import TimestampMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.lead import Lead
    from app.models.message import Message
    from app.models.user import User

# Reexport para `from app.models.conversation import Conversation, ConversationStatus`.
__all__ = ["Conversation", "ConversationStatus"]


class Conversation(UUIDPKMixin, TimestampMixin, Base):
    """Conversa exclusiva (1:1) entre o customer e o professional de um lead."""

    __tablename__ = "conversations"

    lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leads.id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,  # 1 conversa por lead (§3.1 / Lead Exclusivo).
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    professional_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    status: Mapped[ConversationStatus] = mapped_column(
        Enum(
            ConversationStatus,
            name="conversation_status",
            native_enum=True,
            validate_strings=True,
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        default=ConversationStatus.active,
        server_default=ConversationStatus.active.value,
        index=True,
    )
    last_message_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relacionamentos.
    lead: Mapped[Lead] = relationship("Lead", foreign_keys=[lead_id])
    customer: Mapped[User] = relationship("User", foreign_keys=[customer_id])
    professional: Mapped[User] = relationship(
        "User", foreign_keys=[professional_id]
    )
    messages: Mapped[list[Message]] = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )

    __table_args__ = (
        # Listagem das conversas de um participante por atividade recente.
        Index(
            "ix_conversations_customer_last_message",
            "customer_id",
            "last_message_at",
        ),
        Index(
            "ix_conversations_professional_last_message",
            "professional_id",
            "last_message_at",
        ),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return (
            f"<Conversation id={self.id!s} lead_id={self.lead_id!s} "
            f"status={self.status}>"
        )
