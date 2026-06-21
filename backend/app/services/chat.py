"""Service da feature ``chat`` (Fase 8).

Concentra a regra de negócio (§3.5) do chat interno entre o contratante (dono do
lead) e o profissional que comprou o lead. Regras-fonte:
``docs/11-chat-engine`` (motor de conversas) + §CONVERSATIONS/§MESSAGES do doc 04.

Responsabilidades:
- :meth:`get_or_create_for_lead` — **abertura automática** idempotente, chamada
  pela compra do lead (``services/lead_purchases``) **na mesma transação** (não
  faz commit; o chamador commita). Reusa a conversa existente (UNIQUE lead_id).
- :meth:`list_for_user` — conversas do usuário (participante), paginadas, com
  contraparte + lead + última mensagem + não-lidas.
- :meth:`get_conversation` — detalhe (valida participante → 403).
- :meth:`list_messages` — histórico paginado; **marca como lidas** as mensagens
  recebidas pelo leitor (recibo de leitura — §3.12 / extensão §4).
- :meth:`send_message` — envia mensagem (valida participante + conversa ativa +
  texto não-vazio); atualiza ``last_message_at``.

Permissões (§3.3): apenas os dois participantes (``customer_id`` /
``professional_id``) acessam e enviam. Qualquer outro usuário → 403.

Deferimentos do MVP (documentados — chat-engine §2/§3): anexos S3 (3.7),
bloqueios (3.8), moderação avançada/anti-burla (3.9), denúncias (3.10), soft
delete/retenção (3.11), mensagens de sistema tipadas (``message_type``), tempo
real via WebSocket (apêndice — aqui é **polling** REST), encerramento/arquivamento
(3.5) e tempo de resposta para reputação (3.12 — apenas o dado ``read_at`` fica
disponível). O MVP entrega texto 1:1 por polling com permissões e recibo de
leitura simples.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    DomainValidationError,
    NotFoundError,
    PermissionDeniedError,
)
from app.core.storage import presigned_get_url, upload_bytes
from app.models import (
    Conversation,
    ConversationStatus,
    Message,
    User,
)
from app.repositories.chat import ChatRepository
from app.schemas.chat import (
    ConversationLeadSummary,
    ConversationOut,
    ConversationParticipant,
    MessageOut,
)

__all__ = ["ChatService"]

# Mensagem de sistema emitida na abertura automática (§3.6 — "Contato liberado").
# MVP: simples, remetente = profissional comprador (não há ``message_type``/
# ``is_system`` no schema; tipagem de mensagens de sistema é deferida).
CONTACT_RELEASED_MESSAGE = (
    "Contato liberado: a compra do lead habilitou esta conversa. "
    "Mantenha a comunicação dentro da plataforma."
)


class ChatService:
    """Orquestra abertura automática, listagem, leitura e envio de mensagens."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = ChatRepository(db)

    # ------------------------------------------------------------------ #
    # Abertura automática (chamada pela compra do lead — sem commit)
    # ------------------------------------------------------------------ #
    async def get_or_create_for_lead(
        self,
        *,
        lead_id: uuid.UUID,
        customer_id: uuid.UUID,
        professional_id: uuid.UUID,
        seed_system_message: bool = True,
    ) -> Conversation:
        """Get-or-create idempotente da conversa de um lead (§3.2).

        - ``customer_id`` = dono do lead (``leads.customer_id`` → ``users.id``);
        - ``professional_id`` = **usuário** comprador (``professional_profiles
          .user_id`` → ``users.id``).

        Reusa a conversa se já existir (UNIQUE lead_id) — get-or-create defensivo,
        seguro para ser chamado mais de uma vez. **Não faz commit**: roda na
        mesma transação da compra (o chamador commita). Opcionalmente insere a
        mensagem de sistema "Contato liberado" (§3.6).
        """
        existing = await self.repo.get_by_lead(lead_id)
        if existing is not None:
            return existing

        conversation = Conversation(
            lead_id=lead_id,
            customer_id=customer_id,
            professional_id=professional_id,
            status=ConversationStatus.active,
        )
        self.repo.add_conversation(conversation)
        await self.repo.flush()

        if seed_system_message:
            now = datetime.now(UTC)
            system_msg = Message(
                conversation_id=conversation.id,
                sender_id=professional_id,
                message=CONTACT_RELEASED_MESSAGE,
                # ``created_at`` explícito (microssegundos) garante ordenação
                # cronológica determinística — o ``server_default`` do SQLite/PG
                # tem granularidade de segundo e poderia empatar com as primeiras
                # mensagens dos usuários.
                created_at=now,
            )
            self.repo.add_message(system_msg)
            conversation.last_message_at = now
            await self.repo.flush()

        return conversation

    # ------------------------------------------------------------------ #
    # Listagem das conversas do usuário
    # ------------------------------------------------------------------ #
    async def list_for_user(
        self, current_user: User, *, page: int = 1, page_size: int = 20
    ) -> tuple[list[ConversationOut], int]:
        """Conversas em que o usuário é participante (paginado — §4)."""
        limit = page_size
        offset = (page - 1) * page_size
        conversations, total = await self.repo.list_for_user(
            current_user.id, limit=limit, offset=offset
        )
        items = [
            await self._to_out(conv, current_user) for conv in conversations
        ]
        return items, total

    # ------------------------------------------------------------------ #
    # Detalhe (valida participante)
    # ------------------------------------------------------------------ #
    async def get_conversation(
        self, current_user: User, conversation_id: uuid.UUID
    ) -> ConversationOut:
        """Detalhe da conversa; apenas participantes (§3.3 → 404/403)."""
        conversation = await self._get_participant_conversation(
            current_user, conversation_id
        )
        return await self._to_out(conversation, current_user)

    # ------------------------------------------------------------------ #
    # Mensagens (listar + marcar lidas)
    # ------------------------------------------------------------------ #
    async def list_messages(
        self,
        current_user: User,
        conversation_id: uuid.UUID,
        *,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[MessageOut], int]:
        """Histórico paginado; marca como lidas as mensagens recebidas (§3.12).

        Marca primeiro (na própria transação, com commit) para que o recibo de
        leitura seja persistido ao abrir a conversa, depois retorna a página já
        atualizada.
        """
        conversation = await self._get_participant_conversation(
            current_user, conversation_id
        )

        marked = await self.repo.mark_incoming_read(
            conversation.id, current_user.id, datetime.now(UTC)
        )
        if marked:
            await self.db.commit()

        limit = page_size
        offset = (page - 1) * page_size
        messages, total = await self.repo.list_messages(
            conversation.id, limit=limit, offset=offset
        )
        items = [self._message_out(m) for m in messages]
        return items, total

    # ------------------------------------------------------------------ #
    # Envio de mensagem
    # ------------------------------------------------------------------ #
    async def send_message(
        self, current_user: User, conversation_id: uuid.UUID, *, message: str
    ) -> MessageOut:
        """Envia uma mensagem na conversa (§4.2 — versão MVP).

        Valida: participante (§3.3 → 403), conversa ``active`` (§3.4/§3.5 → 422
        se arquivada) e texto não-vazio (moderação básica de tamanho — §3.9).
        Persiste a mensagem e atualiza ``last_message_at``.
        """
        conversation = await self._get_participant_conversation(
            current_user, conversation_id
        )
        if conversation.status != ConversationStatus.active:
            raise DomainValidationError(
                "Conversa arquivada não aceita novas mensagens."
            )

        text = (message or "").strip()
        if not text:
            raise DomainValidationError("A mensagem não pode ser vazia.")

        now = datetime.now(UTC)
        msg = Message(
            conversation_id=conversation.id,
            sender_id=current_user.id,
            message=text,
            # ``created_at`` explícito (microssegundos) → ordenação determinística
            # do histórico (ver nota em ``get_or_create_for_lead``).
            created_at=now,
        )
        self.repo.add_message(msg)
        conversation.last_message_at = now
        await self.repo.flush()
        await self.db.commit()
        await self.db.refresh(msg)
        return self._message_out(msg)

    async def send_media_message(
        self,
        current_user: User,
        conversation_id: uuid.UUID,
        *,
        filename: str,
        content_type: str | None,
        data: bytes,
        caption: str = "",
    ) -> MessageOut:
        """Envia uma mensagem com **imagem anexada** (upload no storage).

        Mesmas regras do envio de texto (participante + conversa ativa). A legenda
        é opcional; mensagem só-imagem fica com ``message`` vazio.
        """
        conversation = await self._get_participant_conversation(
            current_user, conversation_id
        )
        if conversation.status != ConversationStatus.active:
            raise DomainValidationError(
                "Conversa arquivada não aceita novas mensagens."
            )
        ext = ""
        if "." in filename:
            ext = "." + filename.rsplit(".", 1)[1].lower()[:8]
        key = f"chat/{conversation.id}/{uuid.uuid4().hex}{ext}"
        upload_bytes(data, key, content_type)
        now = datetime.now(UTC)
        msg = Message(
            conversation_id=conversation.id,
            sender_id=current_user.id,
            message=(caption or "").strip(),
            media_key=key,
            created_at=now,
        )
        self.repo.add_message(msg)
        conversation.last_message_at = now
        await self.repo.flush()
        await self.db.commit()
        await self.db.refresh(msg)
        return self._message_out(msg)

    # ------------------------------------------------------------------ #
    # Helpers internos
    # ------------------------------------------------------------------ #
    def _message_out(self, m: Message) -> MessageOut:
        """``MessageOut`` com a URL presignada da imagem (quando houver)."""
        out = MessageOut.model_validate(m)
        if m.media_key:
            out.media_url = presigned_get_url(m.media_key)
        return out

    async def _get_participant_conversation(
        self, current_user: User, conversation_id: uuid.UUID
    ) -> Conversation:
        """Carrega a conversa garantindo que o usuário é um dos dois participantes.

        404 se não existir; 403 se o usuário não for ``customer`` nem
        ``professional`` da conversa (anti-IDOR — §3.3 / §6).
        """
        conversation = await self.repo.get_by_id(conversation_id)
        if conversation is None:
            raise NotFoundError("Conversa não encontrada.")
        if current_user.id not in (
            conversation.customer_id,
            conversation.professional_id,
        ):
            raise PermissionDeniedError("Você não participa desta conversa.")
        return conversation

    async def _to_out(
        self, conversation: Conversation, viewer: User
    ) -> ConversationOut:
        """Monta o ``ConversationOut`` na perspectiva do ``viewer``.

        A contraparte é o participante que **não** é o ``viewer``. Inclui resumo
        do lead, última mensagem e contagem de não-lidas (recebidas).
        """
        if viewer.id == conversation.customer_id:
            counterpart_user = conversation.professional
        else:
            counterpart_user = conversation.customer

        counterpart = (
            ConversationParticipant(
                id=counterpart_user.id, name=counterpart_user.name
            )
            if counterpart_user is not None
            else None
        )

        lead = conversation.lead
        lead_summary = (
            ConversationLeadSummary(
                id=lead.id, title=lead.title, status=lead.status.value
            )
            if lead is not None
            else None
        )

        last = await self.repo.last_message(conversation.id)
        last_message = self._message_out(last) if last is not None else None
        unread = await self.repo.count_unread_for_user(
            conversation.id, viewer.id
        )

        return ConversationOut(
            id=conversation.id,
            lead_id=conversation.lead_id,
            customer_id=conversation.customer_id,
            professional_id=conversation.professional_id,
            status=conversation.status,
            created_at=conversation.created_at,
            updated_at=conversation.updated_at,
            last_message_at=conversation.last_message_at,
            counterpart=counterpart,
            lead=lead_summary,
            last_message=last_message,
            unread_count=unread,
        )
