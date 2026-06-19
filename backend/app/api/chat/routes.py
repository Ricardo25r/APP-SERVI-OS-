"""Rotas da feature ``chat`` (Fase 8) — ``router = APIRouter()`` (§3.6).

Prefixo ``/chat`` é aplicado pelo agregador (``app.api.__init__``). Caminhos
relativos. As rotas chamam o :class:`ChatService`; as exceções de domínio são
convertidas em HTTP pelo handler global registrado em ``main.py`` (§3.9).

Endpoints (MVP por **polling** — sem WebSocket):
- ``GET  /conversations``               → lista as conversas do usuário.
- ``GET  /conversations/{id}``          → detalhe (valida participante).
- ``GET  /conversations/{id}/messages`` → histórico paginado (marca lidas).
- ``POST /conversations/{id}/messages`` → envia mensagem.

Permissões (§3.3): apenas os dois participantes (customer/professional) acessam.
A conversa é aberta **automaticamente** na compra do lead — não há endpoint de
criação manual.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.database.session import get_db
from app.models import User
from app.schemas.chat import (
    ConversationListResponse,
    ConversationOut,
    MessageCreate,
    MessageListResponse,
    MessageOut,
)
from app.services.chat import ChatService

router = APIRouter()


@router.get(
    "/conversations",
    response_model=ConversationListResponse,
    summary="Listar conversas do usuário",
)
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> ConversationListResponse:
    """Conversas em que o usuário autenticado é participante (paginado — §4)."""
    service = ChatService(db)
    items, total = await service.list_for_user(
        current_user, page=page, page_size=page_size
    )
    return ConversationListResponse(
        items=items, page=page, page_size=page_size, total=total
    )


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationOut,
    summary="Detalhe de uma conversa",
)
async def get_conversation(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConversationOut:
    """Detalhe da conversa. Apenas participantes (§3.3 → 403); 404 se inexistente."""
    service = ChatService(db)
    return await service.get_conversation(current_user, conversation_id)


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=MessageListResponse,
    summary="Histórico de mensagens (marca recebidas como lidas)",
)
async def list_messages(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
) -> MessageListResponse:
    """Mensagens em ordem cronológica; marca como lidas as recebidas (§3.12)."""
    service = ChatService(db)
    items, total = await service.list_messages(
        current_user, conversation_id, page=page, page_size=page_size
    )
    return MessageListResponse(
        items=items, page=page, page_size=page_size, total=total
    )


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageOut,
    status_code=status.HTTP_201_CREATED,
    summary="Enviar mensagem",
)
async def send_message(
    conversation_id: uuid.UUID,
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageOut:
    """Envia uma mensagem. Valida participante (403), conversa ativa (422) e
    texto não-vazio (§3.3 / §3.9)."""
    service = ChatService(db)
    return await service.send_message(
        current_user, conversation_id, message=payload.message
    )
