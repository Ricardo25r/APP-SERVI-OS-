"""Reciclo de leads não contatados (worker) — base da recirculação/leilão.

Quando um profissional desbloqueia um lead e **não inicia o contato** dentro da
janela (``contact_deadline``), o lead volta ao mercado:

1. reembolsa os créditos ao profissional (``CreditTransactionType.refund``);
2. remove a conversa **vazia** e a compra (libera os ``UNIQUE(lead_id)`` de
   ``conversations`` e ``lead_purchases``);
3. reabre o lead (``status=open``) e notifica o profissional.

Só recicla quando a conversa está **vazia** (zero mensagens): se já houve
contato, o lead permanece com o comprador. Idempotente e best-effort.
"""

from __future__ import annotations

import logging
from datetime import datetime

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Conversation,
    CreditTransactionType,
    Lead,
    LeadPurchase,
    LeadStatus,
    Message,
    ProfessionalProfile,
)
from app.services.credits import CreditService
from app.services.notifications import add_notification

logger = logging.getLogger("faztudo.recycle")


async def recycle_expired_purchases(db: AsyncSession, *, now: datetime) -> int:
    """Recicla leads comprados e não contatados até o prazo. Retorna a contagem."""
    rows = (
        await db.execute(
            select(LeadPurchase, Lead)
            .join(Lead, LeadPurchase.lead_id == Lead.id)
            .where(
                Lead.status == LeadStatus.purchased,
                LeadPurchase.contact_deadline.isnot(None),
                LeadPurchase.contact_deadline < now,
            )
        )
    ).all()

    credits = CreditService(db)
    recycled = 0

    for purchase, lead in rows:
        conversation = (
            await db.execute(
                select(Conversation).where(Conversation.lead_id == lead.id)
            )
        ).scalar_one_or_none()

        if conversation is not None:
            message_count = (
                await db.execute(
                    select(func.count())
                    .select_from(Message)
                    .where(Message.conversation_id == conversation.id)
                )
            ).scalar_one()
            if message_count > 0:
                continue  # já houve contato — não recicla

        profile = (
            await db.execute(
                select(ProfessionalProfile).where(
                    ProfessionalProfile.id == purchase.professional_id
                )
            )
        ).scalar_one_or_none()

        # 1) Reembolsa os créditos ao profissional.
        wallet = await credits.get_or_create_wallet(purchase.professional_id)
        await credits.apply_movement(
            wallet,
            amount=purchase.credits_used,
            transaction_type=CreditTransactionType.refund,
            description=f"Reembolso: lead {lead.id} não contatado a tempo",
            reference_id=purchase.id,
        )

        # 2) Remove conversa vazia + compra (libera os UNIQUE de lead_id).
        if conversation is not None:
            await db.delete(conversation)
        await db.delete(purchase)

        # 3) Reabre o lead e notifica o profissional.
        lead.status = LeadStatus.open
        if profile is not None:
            add_notification(
                db,
                user_id=profile.user_id,
                type="lead",
                title="Lead devolvido ao mercado",
                body=(
                    f'Você não iniciou o contato a tempo em "{lead.title}". '
                    "Os créditos foram devolvidos."
                ),
                href="/marketplace",
            )
        recycled += 1

    if recycled:
        await db.commit()
        logger.info("Reciclados %d lead(s) não contatado(s).", recycled)
    return recycled


async def reopen_lead_no_show(
    db: AsyncSession,
    *,
    purchase: LeadPurchase,
    lead: Lead,
    auto: bool,
) -> None:
    """Reabre um lead por **não comparecimento** (anti no-show).

    Diferente do reciclo: **não** reembolsa (o profissional perde o crédito como
    punição por não comparecer) e registra ``+1`` em ``no_show_count`` na
    reputação do profissional. Remove a conversa (e suas mensagens) e a compra
    p/ liberar os ``UNIQUE(lead_id)``, reabre o lead e notifica o profissional.
    """
    profile = (
        await db.execute(
            select(ProfessionalProfile).where(
                ProfessionalProfile.id == purchase.professional_id
            )
        )
    ).scalar_one_or_none()

    conversation = (
        await db.execute(
            select(Conversation).where(Conversation.lead_id == lead.id)
        )
    ).scalar_one_or_none()
    if conversation is not None:
        # A conversa pode ter histórico (já conversaram): remove as mensagens
        # antes da conversa p/ liberar o UNIQUE(lead_id) sem violar a FK.
        await db.execute(
            delete(Message).where(Message.conversation_id == conversation.id)
        )
        await db.delete(conversation)
    await db.delete(purchase)

    lead.status = LeadStatus.open
    if profile is not None:
        profile.no_show_count = (profile.no_show_count or 0) + 1
        motivo = (
            "O prazo para confirmar a chegada expirou"
            if auto
            else "O cliente informou que você não compareceu"
        )
        add_notification(
            db,
            user_id=profile.user_id,
            type="lead",
            title="Não comparecimento registrado",
            body=(
                f'{motivo} em "{lead.title}". A vaga foi reaberta para outros '
                "profissionais e o crédito não é devolvido."
            ),
            href="/marketplace",
        )


async def reopen_no_show_purchases(db: AsyncSession, *, now: datetime) -> int:
    """Worker: reabre leads cujo prazo de confirmação de chegada expirou sem
    chegada (``arrived_at`` nulo e ``no_show_deadline < now``). Sem reembolso."""
    rows = (
        await db.execute(
            select(LeadPurchase, Lead)
            .join(Lead, LeadPurchase.lead_id == Lead.id)
            .where(
                Lead.status == LeadStatus.purchased,
                LeadPurchase.arrived_at.is_(None),
                LeadPurchase.no_show_deadline.isnot(None),
                LeadPurchase.no_show_deadline < now,
            )
        )
    ).all()

    reopened = 0
    for purchase, lead in rows:
        await reopen_lead_no_show(db, purchase=purchase, lead=lead, auto=True)
        reopened += 1

    if reopened:
        await db.commit()
        logger.info("Reabertos %d lead(s) por não comparecimento.", reopened)
    return reopened


__all__ = [
    "recycle_expired_purchases",
    "reopen_lead_no_show",
    "reopen_no_show_purchases",
]
