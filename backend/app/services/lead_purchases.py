"""Service da feature ``lead_purchases`` (Fase 5) — matching MVP + compra atômica.

Concentra a regra de negócio (§3.5): a **compra exclusiva** de um lead por um
profissional (Lead Exclusivo — §1.6 / §5.4) e a reutilização do **matching MVP**
de elegibilidade (§5.3) que já existe em ``repositories/leads.py``.

------------------------------------------------------------------------------
Atomicidade da compra (§5.4) — um único ``commit``:
------------------------------------------------------------------------------
1. Carrega o lead ``FOR UPDATE`` (lock condicional ao dialeto) e revalida
   ``status == open`` → senão ``409``.
2. Verifica elegibilidade (§5.3 itens 1–5) via ``LeadRepository`` → senão ``403``.
3. Carrega a wallet ``SELECT ... FOR UPDATE`` e checa saldo via o débito do
   :class:`CreditService` (``apply_movement`` levanta ``402`` se faltar saldo).
4. Insere a ``LeadPurchase`` (``flush``). O **``UNIQUE(lead_id)``** é a garantia
   real de exclusividade: se dois profissionais competirem, o segundo
   ``flush`` viola o unique → ``IntegrityError`` → **rollback** (sem débito
   confirmado) → ``409``.
5. Debita os créditos (``spend``, ``amount = -credits_cost``) com
   ``reference_id = purchase.id`` (rastreabilidade — §2.9).
6. Marca ``lead.status = purchased``.
7. ``commit``. Resposta libera o **contato** do customer (§5.6).

A ordem **insert-then-debit** garante a regra de ouro: um conflito de unique
**nunca** deixa crédito debitado — capturamos o ``IntegrityError`` no insert,
antes de qualquer ``commit``, e fazemos ``rollback`` da transação inteira.
"""

from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import effective_role
from app.core.exceptions import (
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
)
from app.models import (
    CreditTransactionType,
    Lead,
    LeadPurchase,
    LeadStatus,
    ProfessionalProfile,
    User,
    UserRole,
)
from app.repositories.credits import supports_for_update
from app.repositories.lead_purchases import LeadPurchaseRepository
from app.repositories.leads import LeadRepository
from app.schemas.lead_purchases import (
    LeadPurchaseRead,
    LeadPurchaseResult,
    WalletBalance,
)
from app.schemas.leads import LeadContact, LeadRead
from app.services.chat import ChatService
from app.services.credits import CreditService
from app.services.gamification import GamificationService
from app.services.lead_recycle import (
    cancel_lead_with_refund,
    reopen_lead_client_absent,
    reopen_lead_no_show,
    reopen_lead_released,
)
from app.services.leads import LeadService, _haversine_km
from app.services.notification_emails import send_lead_purchased_email
from app.services.notifications import add_notification

__all__ = ["LeadPurchaseService"]


class LeadPurchaseService:
    """Orquestra a compra atômica e o histórico de compras do profissional."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = LeadPurchaseRepository(db)
        self.lead_repo = LeadRepository(db)
        self.credit_service = CreditService(db)
        # Reaproveita o montador de ``LeadRead`` da feature leads (visibilidade
        # de contato correta — §5.6), sem duplicar a lógica.
        self._lead_view = LeadService(db)

    # ------------------------------------------------------------------ #
    # Compra atômica (professional)
    # ------------------------------------------------------------------ #
    async def purchase(
        self, current_user: User, lead_id: uuid.UUID
    ) -> LeadPurchaseResult:
        """Compra exclusiva de um lead (§5.4). Transação única e atômica.

        Erros do contrato (§4): ``404`` lead inexistente / perfil ausente,
        ``409`` lead indisponível ou já comprado, ``403`` profissional não
        elegível, ``402`` saldo insuficiente.
        """
        if effective_role(current_user) != UserRole.professional:
            raise PermissionDeniedError("Apenas profissionais compram leads.")

        profile = await self.lead_repo.get_professional_profile(current_user.id)
        if profile is None:
            raise NotFoundError("Perfil profissional não encontrado.")
        if profile.no_show_count >= settings.MARKETPLACE_MAX_NO_SHOWS:
            raise PermissionDeniedError(
                "Sua conta está suspensa por excesso de não comparecimentos. "
                "Fale com o suporte."
            )

        use_lock = supports_for_update(self.db)

        try:
            # (1) Lead FOR UPDATE + revalidação de status.
            lead = await self.repo.get_open_lead_for_update(
                lead_id, for_update=use_lock
            )
            if lead is None:
                raise NotFoundError("Lead não encontrado.")
            if lead.status != LeadStatus.open:
                raise ConflictError("Lead indisponível para compra.")

            # (2) Elegibilidade (matching MVP §5.3 itens 1–5) — reutiliza a
            # query existente em repositories/leads.py.
            eligible = await self.lead_repo.is_professional_eligible(profile, lead)
            if not eligible:
                raise PermissionDeniedError(
                    "Você não é elegível para comprar este lead."
                )

            # (3) Wallet FOR UPDATE (lock condicional ao dialeto).
            wallet = await self.credit_service.get_or_create_wallet(
                profile.id, for_update=use_lock
            )

            # (4) Insere a compra ANTES de confirmar o débito. O UNIQUE(lead_id)
            # garante exclusividade: um conflito aqui aborta tudo sem debitar.
            now = datetime.now(UTC)
            purchase = LeadPurchase(
                lead_id=lead.id,
                professional_id=profile.id,
                credits_used=lead.credits_cost,
                contact_deadline=now
                + timedelta(minutes=settings.CONTACT_WINDOW_MINUTES),
                # Código de chegada (o cliente mostra, o profissional digita) +
                # prazo de segurança p/ reabrir a vaga se a chegada não vier.
                arrival_code=f"{secrets.randbelow(10000):04d}",
                no_show_deadline=now
                + timedelta(days=settings.NO_SHOW_DEADLINE_DAYS),
            )
            self.repo.add(purchase)
            try:
                await self.repo.flush()
            except IntegrityError as exc:
                # UNIQUE(lead_id) violado → outro profissional comprou primeiro.
                await self.db.rollback()
                raise ConflictError("Lead já foi comprado.") from exc

            # (5) Débito (spend) — saldo insuficiente levanta 402 aqui (antes do
            # commit; rollback no except externo desfaz a compra inserida).
            await self.credit_service.apply_movement(
                wallet,
                amount=-lead.credits_cost,
                transaction_type=CreditTransactionType.spend,
                description=f"Compra do lead {lead.id}",
                reference_id=purchase.id,
            )

            # (6) Lead → purchased.
            lead.status = LeadStatus.purchased
            await self.repo.flush()

            # (6.1) Abertura automática da conversa (Fase 8 — chat-engine §3.2).
            # A compra é o evento de "contato liberado": criamos a Conversation
            # (customer = dono do lead; professional = usuário comprador) NA MESMA
            # transação da compra. ``get_or_create_for_lead`` é idempotente
            # (UNIQUE lead_id) e **não** commita — o commit único abaixo cobre
            # compra + conversa. Falhas aqui revertem tudo (except externo), sem
            # deixar crédito debitado sem chat (e vice-versa).
            conversation = await ChatService(self.db).get_or_create_for_lead(
                lead_id=lead.id,
                customer_id=lead.customer_id,
                professional_id=current_user.id,
                # Conversa nasce vazia (sem mensagem de sistema automática).
                seed_system_message=False,
            )

            # (6.1.1) Notifica o contratante que o lead foi adquirido (mesma txn).
            add_notification(
                self.db,
                user_id=lead.customer_id,
                type="lead",
                title="Seu lead foi adquirido",
                body=(
                    f'{current_user.name} comprou seu lead "{lead.title}". '
                    "Abra a conversa para combinar o serviço."
                ),
                href=f"/conversas/conversa?id={conversation.id}",
            )

            # Dados para o e-mail best-effort ao contratante (enviado PÓS-commit;
            # buscamos aqui, na transação, o e-mail/nome do dono do lead).
            _customer = await self.db.get(User, lead.customer_id)
            email_to = _customer.email if _customer is not None else None
            email_to_name = _customer.name if _customer is not None else ""
            email_lead_title = lead.title
            email_professional_name = current_user.name
            email_conversation_href = (
                f"/conversas/conversa?id={conversation.id}"
            )

            # (6.2) Gamificação (Fase 9 — gamification-engine doc 08 §Atividades).
            # A compra de lead concede +10 XP ao profissional comprador NA MESMA
            # transação da compra (sem commit próprio — quem commita é aqui). Falhas
            # aqui revertem tudo (except externo). ``GamificationService.award_xp``
            # grava a ``XpTransaction`` e atualiza xp/level do perfil.
            await GamificationService(self.db).award_xp(
                user_id=current_user.id,
                amount=10,
                source="lead_purchase",
                description=f"Compra do lead {lead.id}",
            )

            # (7) Commit único.
            await self.db.commit()
        except ConflictError:
            raise
        except Exception:
            # Qualquer falha (402, integridade tardia, etc.) reverte tudo: nunca
            # deixa crédito debitado sem compra nem compra sem débito.
            await self.db.rollback()
            raise

        # Monta a resposta com o lead recarregado pós-commit (contato liberado —
        # §5.6). ``expunge`` o lead antigo da identity map garante que o reload
        # re-popule ``purchase`` com a compra recém-criada (em vez de reaproveitar
        # o objeto cujo ``purchase`` foi eager-carregado como None antes do insert),
        # sem disparar lazy-load fora do contexto async (que ``expire`` causaria).
        self.db.expunge(lead)
        refreshed = await self.repo.get_with_relations(lead.id)
        assert refreshed is not None
        lead_read = self._lead_view._to_read(
            refreshed, viewer=current_user, include_contact=True
        )
        contact = lead_read.contact
        purchase_read = self._to_purchase_read(
            purchase, lead_read=lead_read, contact=contact
        )

        # E-mail best-effort ao contratante (pós-commit; nunca bloqueia/levanta).
        if email_to:
            send_lead_purchased_email(
                to_email=email_to,
                to_name=email_to_name,
                professional_name=email_professional_name,
                lead_title=email_lead_title,
                conversation_href=email_conversation_href,
            )

        return LeadPurchaseResult(
            purchase=purchase_read,
            lead=lead_read,
            wallet=WalletBalance(balance=wallet.balance),
        )

    # ------------------------------------------------------------------ #
    # Histórico / detalhe
    # ------------------------------------------------------------------ #
    async def list_for_user(
        self, current_user: User, *, page: int = 1, page_size: int = 20
    ) -> tuple[list[LeadPurchaseRead], int]:
        """Compras do profissional autenticado (paginado, com contato — §4)."""
        profile = await self.lead_repo.get_professional_profile(current_user.id)
        if profile is None:
            return [], 0

        limit = page_size
        offset = (page - 1) * page_size
        purchases, total = await self.repo.list_for_professional(
            profile.id, limit=limit, offset=offset
        )
        items = [self._purchase_with_lead(p, current_user) for p in purchases]
        return items, total

    async def get(
        self, current_user: User, purchase_id: uuid.UUID
    ) -> LeadPurchaseRead:
        """Detalhe de uma compra do profissional dono (com contato — §4)."""
        profile = await self.lead_repo.get_professional_profile(current_user.id)
        if profile is None:
            raise NotFoundError("Perfil profissional não encontrado.")

        purchase = await self.repo.get_purchase_by_id(purchase_id)
        if purchase is None:
            raise NotFoundError("Compra não encontrada.")
        if purchase.professional_id != profile.id:
            raise PermissionDeniedError("Você não é o dono desta compra.")

        return self._purchase_with_lead(purchase, current_user)

    # ------------------------------------------------------------------ #
    # Confirmação de serviço (anti no-show)
    # ------------------------------------------------------------------ #
    async def confirm_arrival(
        self, current_user: User, purchase_id: uuid.UUID, code: str
    ) -> LeadPurchaseRead:
        """Profissional confirma a chegada digitando o **código** que o cliente
        mostra presencialmente. Valida posse + código. Erros: ``404`` perfil/
        compra, ``403`` não dono ou código inválido, ``409`` já confirmada."""
        profile = await self.lead_repo.get_professional_profile(current_user.id)
        if profile is None:
            raise NotFoundError("Perfil profissional não encontrado.")

        purchase = await self.repo.get_purchase_by_id(purchase_id)
        if purchase is None:
            raise NotFoundError("Compra não encontrada.")
        if purchase.professional_id != profile.id:
            raise PermissionDeniedError("Você não é o dono desta compra.")
        if purchase.arrived_at is not None:
            raise ConflictError("Chegada já confirmada.")

        expected = (purchase.arrival_code or "").strip()
        if not expected or (code or "").strip() != expected:
            raise PermissionDeniedError("Código de chegada inválido.")

        purchase.arrived_at = datetime.now(UTC)
        lead = purchase.lead
        if lead is not None:
            add_notification(
                self.db,
                user_id=lead.customer_id,
                type="lead",
                title="Profissional chegou",
                body=(
                    f"{current_user.name} confirmou a chegada para "
                    f'"{lead.title}".'
                ),
                href="/conversas",
            )
        await self.db.commit()

        refreshed = await self.repo.get_purchase_by_id(purchase_id)
        assert refreshed is not None
        return self._purchase_with_lead(refreshed, current_user)

    async def mark_no_show(
        self, current_user: User, lead_id: uuid.UUID
    ) -> None:
        """Cliente (dono do lead) marca que o profissional **não compareceu**:
        reabre a vaga, sem reembolso, +1 no_show na reputação. Erros: ``404``
        lead, ``403`` não dono, ``409`` lead fora de atendimento / já chegou."""
        lead = await self.repo.get_with_relations(lead_id)
        if lead is None:
            raise NotFoundError("Lead não encontrado.")
        if lead.customer_id != current_user.id:
            raise PermissionDeniedError("Você não é o dono deste lead.")
        if lead.status != LeadStatus.purchased or lead.purchase is None:
            raise ConflictError("Este lead não está em atendimento.")
        if lead.purchase.arrived_at is not None:
            raise ConflictError(
                "O profissional já confirmou a chegada — não é possível marcar "
                "não comparecimento."
            )

        await reopen_lead_no_show(
            self.db, purchase=lead.purchase, lead=lead, auto=False
        )
        await self.db.commit()

    async def report_client_absent(
        self,
        current_user: User,
        purchase_id: uuid.UUID,
        *,
        latitude: float,
        longitude: float,
        reason: str | None = None,
    ) -> dict[str, bool]:
        """Profissional reporta que o **cliente não estava / recusou o código**.

        Com a **presença comprovada por GPS** (distância ao local do serviço ≤
        ``PRESENCE_TOLERANCE_METERS``): reabre a vaga, **devolve o crédito** e
        marca o não-comparecimento do cliente. Sem coordenadas no lead ou fora do
        raio → ``409`` (orientar a abrir chamado no suporte). Erros: ``404``
        perfil/compra, ``403`` não-dono, ``409`` já chegou / fora do raio."""
        profile = await self.lead_repo.get_professional_profile(current_user.id)
        if profile is None:
            raise NotFoundError("Perfil profissional não encontrado.")

        purchase = await self.repo.get_purchase_by_id(purchase_id)
        if purchase is None:
            raise NotFoundError("Compra não encontrada.")
        if purchase.professional_id != profile.id:
            raise PermissionDeniedError("Você não é o dono desta compra.")
        if purchase.arrived_at is not None:
            raise ConflictError("A chegada já foi confirmada.")

        lead = purchase.lead
        if lead is None or lead.status != LeadStatus.purchased:
            raise ConflictError("Este lead não está em atendimento.")
        if lead.latitude is None or lead.longitude is None:
            raise ConflictError(
                "Este serviço não tem localização para comprovar a presença. "
                "Abra um chamado no suporte."
            )

        distance_m = (
            _haversine_km(
                float(lead.latitude), float(lead.longitude), latitude, longitude
            )
            * 1000
        )
        if distance_m > settings.PRESENCE_TOLERANCE_METERS:
            raise ConflictError(
                "Não foi possível comprovar sua presença no local "
                f"(você está a ~{int(distance_m)} m). Abra um chamado no suporte."
            )

        await reopen_lead_client_absent(self.db, purchase=purchase, lead=lead)
        await self.db.commit()
        return {"reopened": True, "refunded": True}

    async def confirm_completion(
        self, current_user: User, lead_id: uuid.UUID
    ) -> dict[str, bool]:
        """Cliente (dono do lead) confirma que o **serviço foi concluído** →
        fecha o lead (``closed``) e incentiva a avaliação mútua. Erros: ``404``
        lead, ``403`` não-dono, ``409`` lead fora de atendimento."""
        lead = await self.repo.get_with_relations(lead_id)
        if lead is None:
            raise NotFoundError("Lead não encontrado.")
        if lead.customer_id != current_user.id:
            raise PermissionDeniedError("Você não é o dono deste lead.")
        if lead.status != LeadStatus.purchased or lead.purchase is None:
            raise ConflictError("Este lead não está em atendimento.")

        lead.status = LeadStatus.closed

        prof = (
            await self.db.execute(
                select(ProfessionalProfile).where(
                    ProfessionalProfile.id == lead.purchase.professional_id
                )
            )
        ).scalar_one_or_none()
        if prof is not None:
            add_notification(
                self.db,
                user_id=prof.user_id,
                type="lead",
                title="Serviço concluído",
                body=(
                    f'O cliente confirmou a conclusão de "{lead.title}". '
                    "Avalie o cliente."
                ),
                href="/avaliacoes",
            )
        await self.db.commit()
        return {"completed": True}

    async def release_purchase(
        self, current_user: User, purchase_id: uuid.UUID
    ) -> dict[str, bool]:
        """Profissional **desiste** da compra → libera a vaga (sem reembolso, sem
        marca). Erros: ``404`` perfil/compra, ``403`` não-dono, ``409`` já chegou
        / fora de atendimento."""
        profile = await self.lead_repo.get_professional_profile(current_user.id)
        if profile is None:
            raise NotFoundError("Perfil profissional não encontrado.")
        purchase = await self.repo.get_purchase_by_id(purchase_id)
        if purchase is None:
            raise NotFoundError("Compra não encontrada.")
        if purchase.professional_id != profile.id:
            raise PermissionDeniedError("Você não é o dono desta compra.")
        if purchase.arrived_at is not None:
            raise ConflictError("A chegada já foi confirmada.")
        lead = purchase.lead
        if lead is None or lead.status != LeadStatus.purchased:
            raise ConflictError("Este lead não está em atendimento.")
        await reopen_lead_released(self.db, purchase=purchase, lead=lead)
        await self.db.commit()
        return {"released": True}

    async def cancel_purchased_lead(
        self, current_user: User, lead_id: uuid.UUID
    ) -> dict[str, bool]:
        """Cliente **cancela** o atendimento → devolve o crédito ao profissional e
        encerra (``cancelled``). Erros: ``404`` lead, ``403`` não-dono, ``409``
        fora de atendimento / já chegou."""
        lead = await self.repo.get_with_relations(lead_id)
        if lead is None:
            raise NotFoundError("Lead não encontrado.")
        if lead.customer_id != current_user.id:
            raise PermissionDeniedError("Você não é o dono deste lead.")
        if lead.status != LeadStatus.purchased or lead.purchase is None:
            raise ConflictError("Este lead não está em atendimento.")
        if lead.purchase.arrived_at is not None:
            raise ConflictError(
                "O profissional já confirmou a chegada — não é possível cancelar."
            )
        await cancel_lead_with_refund(self.db, purchase=lead.purchase, lead=lead)
        await self.db.commit()
        return {"cancelled": True, "refunded": True}

    async def schedule_visit(
        self, current_user: User, purchase_id: uuid.UUID, scheduled_at: datetime
    ) -> dict[str, str]:
        """Profissional **agenda** a data/hora do serviço → redefine o prazo de
        reabertura por não chegada (``scheduled_at`` + carência). Erros: ``404``,
        ``403``, ``409`` já chegou / fora de atendimento."""
        profile = await self.lead_repo.get_professional_profile(current_user.id)
        if profile is None:
            raise NotFoundError("Perfil profissional não encontrado.")
        purchase = await self.repo.get_purchase_by_id(purchase_id)
        if purchase is None:
            raise NotFoundError("Compra não encontrada.")
        if purchase.professional_id != profile.id:
            raise PermissionDeniedError("Você não é o dono desta compra.")
        if purchase.arrived_at is not None:
            raise ConflictError("A chegada já foi confirmada.")
        lead = purchase.lead
        if lead is None or lead.status != LeadStatus.purchased:
            raise ConflictError("Este lead não está em atendimento.")

        when = scheduled_at
        if when.tzinfo is None:
            when = when.replace(tzinfo=UTC)
        purchase.scheduled_at = when
        purchase.no_show_deadline = when + timedelta(
            hours=settings.NO_SHOW_GRACE_HOURS
        )
        add_notification(
            self.db,
            user_id=lead.customer_id,
            type="lead",
            title="Serviço agendado",
            body=f'O profissional agendou o serviço de "{lead.title}".',
            href="/leads",
        )
        await self.db.commit()
        return {"scheduled_at": when.isoformat()}

    # ------------------------------------------------------------------ #
    # Helpers internos
    # ------------------------------------------------------------------ #
    def _purchase_with_lead(
        self, purchase: LeadPurchase, viewer: User
    ) -> LeadPurchaseRead:
        """Monta ``LeadPurchaseRead`` com o lead + contato liberado (comprador)."""
        lead: Lead | None = purchase.lead
        lead_read = (
            self._lead_view._to_read(lead, viewer=viewer, include_contact=True)
            if lead is not None
            else None
        )
        contact = lead_read.contact if lead_read is not None else None
        return self._to_purchase_read(
            purchase, lead_read=lead_read, contact=contact
        )

    @staticmethod
    def _to_purchase_read(
        purchase: LeadPurchase,
        *,
        lead_read: LeadRead | None,
        contact: LeadContact | None,
    ) -> LeadPurchaseRead:
        return LeadPurchaseRead(
            id=purchase.id,
            lead_id=purchase.lead_id,
            professional_id=purchase.professional_id,
            credits_used=purchase.credits_used,
            purchased_at=purchase.purchased_at,
            created_at=purchase.created_at,
            contact_deadline=purchase.contact_deadline,
            arrived_at=purchase.arrived_at,
            lead=lead_read,
            contact=contact,
        )
