"""Schemas Pydantic v2 da feature ``chat`` (Fase 8).

Contrato: ``docs/11-chat-engine`` (regras) + §MESSAGES/§CONVERSATIONS do doc 04.
Campo de conteúdo da mensagem = ``message`` (nome oficial — §10.4 do chat-engine).

Visões de saída:
- :class:`ConversationOut` — a conversa do ponto de vista do usuário autenticado:
  inclui a **contraparte** (o outro participante), um **resumo do lead** e a
  **última mensagem** (para a lista). ``unread_count`` ajuda o cliente no polling.
- :class:`MessageOut` — uma mensagem (com ``read_at``).
- :class:`MessageCreate` — corpo do envio (apenas ``message``; mass-assignment
  seguro — ``sender_id``/``conversation_id``/``created_at`` são do servidor).

Paginação: envelope ``{items, page, page_size, total}`` (convenção §4 das fases).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ConversationStatus

__all__ = [
    "MessageCreate",
    "MessageOut",
    "MessageListResponse",
    "ConversationParticipant",
    "ConversationLeadSummary",
    "ConversationOut",
    "ConversationListResponse",
]


# --------------------------------------------------------------------------- #
# Entrada
# --------------------------------------------------------------------------- #
class MessageCreate(BaseModel):
    """Corpo de ``POST /chat/conversations/{id}/messages``.

    Só o texto ``message`` vem do cliente (mass-assignment seguro). Validação
    básica de tamanho (§3.9 — moderação MVP); filtro avançado é deferido.
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    message: str = Field(min_length=1, max_length=5000)


# --------------------------------------------------------------------------- #
# Resumos embutidos
# --------------------------------------------------------------------------- #
class ConversationParticipant(BaseModel):
    """Resumo público de um participante (a contraparte do usuário autenticado)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class ConversationLeadSummary(BaseModel):
    """Resumo do lead que originou a conversa."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    status: str


# --------------------------------------------------------------------------- #
# Saída
# --------------------------------------------------------------------------- #
class MessageOut(BaseModel):
    """Mensagem de uma conversa (campo de conteúdo: ``message``)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_id: uuid.UUID
    message: str
    media_url: str | None = None
    read_at: datetime | None = None
    created_at: datetime


class ConversationOut(BaseModel):
    """Conversa na perspectiva do usuário autenticado.

    ``counterpart`` é o outro participante; ``lead`` é o resumo da oportunidade;
    ``last_message`` é a mensagem mais recente (``None`` se ainda não há
    mensagens); ``unread_count`` é a contagem de mensagens não lidas enviadas
    pela contraparte.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    lead_id: uuid.UUID
    customer_id: uuid.UUID
    professional_id: uuid.UUID
    status: ConversationStatus
    created_at: datetime
    updated_at: datetime
    last_message_at: datetime | None = None

    # Campos compostos montados no service.
    counterpart: ConversationParticipant | None = None
    lead: ConversationLeadSummary | None = None
    last_message: MessageOut | None = None
    unread_count: int = 0


class ConversationListResponse(BaseModel):
    """Envelope paginado de conversas (``{items, page, page_size, total}``)."""

    items: list[ConversationOut]
    page: int
    page_size: int
    total: int


class MessageListResponse(BaseModel):
    """Envelope paginado de mensagens (``{items, page, page_size, total}``)."""

    items: list[MessageOut]
    page: int
    page_size: int
    total: int
