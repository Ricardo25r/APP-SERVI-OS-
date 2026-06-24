"""Service da feature ``lead_disputes`` — disputa/reembolso de lead sem GPS.

O profissional contesta um lead comprado (telefone inválido, sem resposta,
pedido falso). O admin reembolsa (devolve o crédito à carteira + marca o cliente
com ``client_no_show_count``) ou recusa. Notifica os dois lados.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
)
from app.models import (
    CreditTransactionType,
    Lead,
    LeadDispute,
    LeadPurchase,
    ProfessionalProfile,
    User,
    UserRole,
)
from app.schemas.lead_disputes import (
    DisputeAdminItem,
    DisputeAdminList,
    DisputeCreate,
    DisputeOut,
)
from app.services.credits import CreditService
from app.services.notifications import add_notification

__all__ = ["LeadDisputeService"]

_REASON_LABEL = {
    "telefone_invalido": "telefone inválido",
    "sem_resposta": "cliente não responde",
    "pedido_falso": "pedido falso",
    "duplicado": "duplicado",
    "outro": "outro",
}


class LeadDisputeService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, user: User, data: DisputeCreate) -> DisputeOut:
        purchase = await self.db.get(LeadPurchase, data.purchase_id)
        if purchase is None:
            raise NotFoundError("Compra não encontrada.")
        profile = await self.db.get(
            ProfessionalProfile, purchase.professional_id
        )
        if profile is None or profile.user_id != user.id:
            raise PermissionDeniedError("Você não comprou este pedido.")
        existing = (
            await self.db.execute(
                select(LeadDispute.id).where(
                    LeadDispute.purchase_id == purchase.id
                )
            )
        ).first()
        if existing is not None:
            raise ConflictError("Você já abriu uma disputa para este pedido.")

        dispute = LeadDispute(
            purchase_id=purchase.id,
            professional_user_id=user.id,
            lead_id=purchase.lead_id,
            reason=data.reason,
            description=(data.description or None),
        )
        self.db.add(dispute)

        admins = (
            (
                await self.db.execute(
                    select(User).where(
                        User.role == UserRole.admin,
                        User.deleted_at.is_(None),
                    )
                )
            )
            .scalars()
            .all()
        )
        label = _REASON_LABEL.get(data.reason, data.reason)
        for admin in admins:
            add_notification(
                self.db,
                user_id=admin.id,
                type="dispute",
                title="Nova disputa de pedido",
                body=f"{user.name} contestou um pedido ({label}).",
                href="/admin/disputas",
            )

        await self.db.commit()
        await self.db.refresh(dispute)
        return DisputeOut.model_validate(dispute)

    async def list_all(
        self, *, status: str | None = None
    ) -> DisputeAdminList:
        stmt = (
            select(LeadDispute, User, Lead, LeadPurchase)
            .join(User, LeadDispute.professional_user_id == User.id)
            .join(Lead, LeadDispute.lead_id == Lead.id)
            .join(LeadPurchase, LeadDispute.purchase_id == LeadPurchase.id)
        )
        count_stmt = select(func.count()).select_from(LeadDispute)
        if status:
            stmt = stmt.where(LeadDispute.status == status)
            count_stmt = count_stmt.where(LeadDispute.status == status)
        total = (await self.db.execute(count_stmt)).scalar_one()
        rows = (
            await self.db.execute(
                stmt.order_by(LeadDispute.created_at.desc()).limit(100)
            )
        ).all()
        items = [
            DisputeAdminItem(
                id=d.id,
                purchase_id=d.purchase_id,
                lead_id=d.lead_id,
                reason=d.reason,
                description=d.description,
                status=d.status,
                created_at=d.created_at,
                professional_user_id=d.professional_user_id,
                professional_name=u.name,
                lead_title=lead.title,
                credits_used=p.credits_used,
            )
            for d, u, lead, p in rows
        ]
        return DisputeAdminList(items=items, total=int(total))

    async def resolve(self, dispute_id: uuid.UUID, action: str) -> None:
        dispute = await self.db.get(LeadDispute, dispute_id)
        if dispute is None:
            raise NotFoundError("Disputa não encontrada.")
        if dispute.status != "open":
            raise PermissionDeniedError("Disputa já resolvida.")

        if action == "refund":
            purchase = await self.db.get(LeadPurchase, dispute.purchase_id)
            if purchase is not None:
                credits = CreditService(self.db)
                wallet = await credits.get_or_create_wallet(
                    purchase.professional_id
                )
                await credits.apply_movement(
                    wallet,
                    amount=purchase.credits_used,
                    transaction_type=CreditTransactionType.refund,
                    description=f"Reembolso (disputa): lead {dispute.lead_id}",
                    reference_id=purchase.id,
                )
                # Anti-abuso: marca o cliente (contador de não-comparecimento).
                lead = await self.db.get(Lead, dispute.lead_id)
                if lead is not None:
                    customer = await self.db.get(User, lead.customer_id)
                    if customer is not None:
                        customer.client_no_show_count = (
                            customer.client_no_show_count or 0
                        ) + 1
            dispute.status = "refunded"
            title = "Reembolso aprovado"
            body = "Sua disputa foi aceita e o crédito voltou para a carteira."
        else:
            dispute.status = "rejected"
            title = "Disputa recusada"
            body = "Sua disputa foi analisada e não foi aceita desta vez."

        dispute.resolved_at = datetime.now(UTC)
        add_notification(
            self.db,
            user_id=dispute.professional_user_id,
            type="dispute",
            title=title,
            body=body,
            href="/purchases",
        )
        await self.db.commit()
