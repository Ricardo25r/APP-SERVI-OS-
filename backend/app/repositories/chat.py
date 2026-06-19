"""Repositório da feature ``chat`` (Fase 8).

Camada de acesso a dados (queries SQLAlchemy async), **sem regra de negócio**
(§3.4). Recebe a ``AsyncSession`` por parâmetro e **não** faz ``commit`` — usa
``add``/``flush`` e deixa o commit para o service.

Cobre as :class:`Conversation` (1:1 por lead) e suas :class:`Message`. A
abertura automática (``get_or_create_for_lead`` no service) é orquestrada pelo
service de compra (``services/lead_purchases``) na mesma transação.
"""

from __future__ import annotations

import uuid

from sqlalchemy import Select, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Conversation, Message

__all__ = ["ChatRepository"]


class ChatRepository:
    """Acesso a dados de :class:`Conversation` e :class:`Message`."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------ #
    # Escrita
    # ------------------------------------------------------------------ #
    def add_conversation(self, conversation: Conversation) -> Conversation:
        """Adiciona a conversa à sessão (sem commit — o chamador commita)."""
        self.db.add(conversation)
        return conversation

    def add_message(self, message: Message) -> Message:
        """Adiciona a mensagem à sessão (sem commit — o chamador commita)."""
        self.db.add(message)
        return message

    async def flush(self) -> None:
        await self.db.flush()

    # ------------------------------------------------------------------ #
    # Leitura de conversas
    # ------------------------------------------------------------------ #
    async def get_by_lead(self, lead_id: uuid.UUID) -> Conversation | None:
        """Conversa de um lead (UNIQUE lead_id), ou ``None``.

        Usado pelo ``get_or_create_for_lead`` (idempotência da abertura
        automática) — sem eager-load (o chamador é a compra).
        """
        result = await self.db.execute(
            select(Conversation).where(Conversation.lead_id == lead_id)
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, conversation_id: uuid.UUID) -> Conversation | None:
        """Conversa por id com ``lead``, ``customer`` e ``professional`` (eager)."""
        stmt = (
            select(Conversation)
            .where(Conversation.id == conversation_id)
            .options(
                selectinload(Conversation.lead),
                selectinload(Conversation.customer),
                selectinload(Conversation.professional),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    def _participant_stmt(self, user_id: uuid.UUID) -> Select:
        """Base: conversas em que o usuário é customer **ou** professional."""
        return select(Conversation).where(
            or_(
                Conversation.customer_id == user_id,
                Conversation.professional_id == user_id,
            )
        )

    async def list_for_user(
        self, user_id: uuid.UUID, *, limit: int = 20, offset: int = 0
    ) -> tuple[list[Conversation], int]:
        """Conversas do usuário (participante), mais ativas primeiro, + total.

        Ordena por ``last_message_at`` desc (NULLs por último via ``created_at``)
        para a lista de conversas refletir a atividade recente.
        """
        base = self._participant_stmt(user_id)
        total = await self._count(base)
        stmt = (
            base.options(
                selectinload(Conversation.lead),
                selectinload(Conversation.customer),
                selectinload(Conversation.professional),
            )
            .order_by(
                func.coalesce(
                    Conversation.last_message_at, Conversation.created_at
                ).desc()
            )
            .limit(limit)
            .offset(offset)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    # ------------------------------------------------------------------ #
    # Leitura de mensagens
    # ------------------------------------------------------------------ #
    async def list_messages(
        self, conversation_id: uuid.UUID, *, limit: int = 50, offset: int = 0
    ) -> tuple[list[Message], int]:
        """Mensagens da conversa em ordem cronológica (ascendente) + total."""
        base = select(Message).where(Message.conversation_id == conversation_id)
        total = await self._count(base)
        stmt = (
            base.order_by(Message.created_at.asc(), Message.id.asc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    async def last_message(self, conversation_id: uuid.UUID) -> Message | None:
        """Mensagem mais recente da conversa (para a lista), ou ``None``."""
        stmt = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.desc(), Message.id.desc())
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def count_unread_for_user(
        self, conversation_id: uuid.UUID, user_id: uuid.UUID
    ) -> int:
        """Mensagens não lidas (``read_at IS NULL``) enviadas pela contraparte."""
        stmt = (
            select(func.count())
            .select_from(Message)
            .where(
                Message.conversation_id == conversation_id,
                Message.sender_id != user_id,
                Message.read_at.is_(None),
            )
        )
        result = await self.db.execute(stmt)
        return int(result.scalar_one())

    async def mark_incoming_read(
        self, conversation_id: uuid.UUID, reader_id: uuid.UUID, now
    ) -> int:
        """Marca como lidas as mensagens recebidas (não enviadas pelo leitor).

        Atualiza ``read_at`` (apenas onde ainda ``NULL``) e devolve quantas linhas
        foram marcadas. Não faz commit (o service commita).
        """
        stmt = (
            update(Message)
            .where(
                Message.conversation_id == conversation_id,
                Message.sender_id != reader_id,
                Message.read_at.is_(None),
            )
            .values(read_at=now)
        )
        result = await self.db.execute(stmt)
        return int(result.rowcount or 0)

    # ------------------------------------------------------------------ #
    # Suporte
    # ------------------------------------------------------------------ #
    async def _count(self, base_stmt: Select) -> int:
        count_stmt = select(func.count()).select_from(base_stmt.subquery())
        result = await self.db.execute(count_stmt)
        return int(result.scalar_one())
