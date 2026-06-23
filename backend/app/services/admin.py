"""Service da feature ``admin`` (Fase 10 — Administração MVP).

Concentra a regra de negócio (§3.5): montagem das métricas, gestão de status de
usuários (com proteção contra auto-bloqueio + auditoria obrigatória), moderação
de leads, resumo financeiro e leitura da auditoria. Faz o ``commit`` (o
repositório só faz ``add``/``flush``).

RBAC (§RN-ADM-05 / §1.2 do contrato): todas as rotas exigem ``role == admin``
(papel único no MVP; sub-papéis ``super_admin``/``moderator``/``finance``/
``support`` ficam para V2 — ver observações). A defesa em profundidade aqui
revalida invariantes (ex.: admin não bloqueia a si mesmo).

Auditoria (§7 + decisão ``audit_logs``×``admin_actions``): toda ação que altera
estado grava um :class:`AuditLog` na MESMA transação, com ``meta`` carregando o
rastro de negócio (``reason``, valores antigos/novos).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    DomainValidationError,
    NotFoundError,
)
from app.models import (
    AuditLog,
    LeadPurchase,
    LeadStatus,
    PaymentOrderStatus,
    User,
    UserRole,
    UserStatus,
)
from app.repositories.admin import AdminRepository
from app.repositories.auth import RefreshTokenRepository
from app.schemas.admin import (
    AdminLeadRead,
    AdminMetrics,
    AdminPaymentRead,
    AdminUserRead,
    AuditLogRead,
    FinanceSummary,
    LeadStatusCounts,
    RoleCounts,
    UserStatusUpdate,
)
from app.services.lead_recycle import cancel_lead_with_refund

__all__ = ["AdminService", "AuditAction"]


class AuditAction:
    """Catálogo de ações administrativas (``admin_actions.action`` — §7.3)."""

    user_suspend = "user_suspend"
    user_unsuspend = "user_unsuspend"
    user_block = "user_block"
    user_unblock = "user_unblock"
    user_status_change = "user_status_change"
    lead_cancel = "lead_cancel"


class AdminService:
    """Orquestra as operações administrativas do MVP da Fase 10."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = AdminRepository(db)
        self.tokens = RefreshTokenRepository(db)

    # ------------------------------------------------------------------ #
    # Métricas (GET /admin/metrics)
    # ------------------------------------------------------------------ #
    async def metrics(self) -> AdminMetrics:
        """Monta os KPIs com agregações eficientes (sem N+1 — §8)."""
        by_role = await self.repo.count_users_by_role()
        customer = by_role.get(UserRole.customer, 0)
        professional = by_role.get(UserRole.professional, 0)
        admin = by_role.get(UserRole.admin, 0)

        by_status = await self.repo.count_leads_by_status()
        leads_open = by_status.get(LeadStatus.open, 0)
        leads_purchased = by_status.get(LeadStatus.purchased, 0)
        leads_closed = by_status.get(LeadStatus.closed, 0)
        leads_cancelled = by_status.get(LeadStatus.cancelled, 0)

        (
            paid_orders,
            revenue_cents,
            refunded_orders,
        ) = await self.repo.payment_finance_summary()

        return AdminMetrics(
            users=RoleCounts(
                total=customer + professional + admin,
                customer=customer,
                professional=professional,
                admin=admin,
            ),
            professionals=professional,
            customers=customer,
            leads=LeadStatusCounts(
                total=(
                    leads_open
                    + leads_purchased
                    + leads_closed
                    + leads_cancelled
                ),
                open=leads_open,
                purchased=leads_purchased,
                closed=leads_closed,
                cancelled=leads_cancelled,
            ),
            lead_purchases=await self.repo.count_lead_purchases(),
            credit_packages_sold=await self.repo.sum_credits_packages_sold(),
            reviews=await self.repo.count_reviews(),
            conversations=await self.repo.count_conversations(),
            finance=FinanceSummary(
                paid_orders=paid_orders,
                revenue_cents=revenue_cents,
                revenue_brl=round(revenue_cents / 100, 2),
                refunded_orders=refunded_orders,
            ),
        )

    # ------------------------------------------------------------------ #
    # Gestão de usuários
    # ------------------------------------------------------------------ #
    async def list_users(
        self,
        *,
        role: UserRole | None = None,
        status: UserStatus | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[AdminUserRead], int]:
        """Usuários paginados (filtros papel/status/busca)."""
        users, total = await self.repo.list_users(
            role=role,
            status=status,
            search=search,
            limit=page_size,
            offset=(page - 1) * page_size,
        )
        return [AdminUserRead.model_validate(u) for u in users], total

    async def get_user(self, user_id: uuid.UUID) -> AdminUserRead:
        """Detalhe de um usuário (404 se inexistente)."""
        user = await self.repo.get_user(user_id)
        if user is None:
            raise NotFoundError("Usuário não encontrado.")
        return AdminUserRead.model_validate(user)

    async def update_user_status(
        self,
        admin: User,
        user_id: uuid.UUID,
        data: UserStatusUpdate,
    ) -> AdminUserRead:
        """Muda ``users.status`` (active|suspended|blocked) + grava auditoria.

        Regras (§RN-USR / §5 do admin-panel-spec):
        - ``404`` se o usuário não existir;
        - admin **não** pode mudar o próprio status (auto-ação proibida → ``422``);
        - mudar para o mesmo status é no-op idempotente (sem erro);
        - ao mudar para ``blocked``/``suspended``, todos os refresh tokens do
          usuário são revogados na MESMA transação (encerra sessões ativas);
        - toda mudança grava um :class:`AuditLog` na MESMA transação.
        """
        if user_id == admin.id:
            raise DomainValidationError(
                "Você não pode alterar o status da própria conta."
            )

        target = await self.repo.get_user(user_id)
        if target is None:
            raise NotFoundError("Usuário não encontrado.")

        old_status = target.status
        new_status = data.status

        if old_status != new_status:
            target.status = new_status
            self._record_audit(
                admin,
                action=self._status_action(old_status, new_status),
                entity="users",
                entity_id=target.id,
                meta={
                    "reason": data.reason,
                    "old_status": old_status.value,
                    "new_status": new_status.value,
                },
            )
            # Bloqueio/suspensão encerra as sessões ativas: revoga todos os
            # refresh tokens do usuário (mesma transação que a mudança de status).
            if new_status in (UserStatus.blocked, UserStatus.suspended):
                await self.tokens.revoke_all_for_user(
                    target.id, datetime.now(UTC)
                )
            await self.repo.flush()
            await self.db.commit()
            await self.db.refresh(target)

        return AdminUserRead.model_validate(target)

    @staticmethod
    def _status_action(old: UserStatus, new: UserStatus) -> str:
        """Mapeia a transição para a ação do catálogo (§7.3)."""
        if new == UserStatus.blocked:
            return AuditAction.user_block
        if new == UserStatus.suspended:
            return AuditAction.user_suspend
        if new == UserStatus.active:
            if old == UserStatus.blocked:
                return AuditAction.user_unblock
            if old == UserStatus.suspended:
                return AuditAction.user_unsuspend
        return AuditAction.user_status_change

    # ------------------------------------------------------------------ #
    # Moderação de leads
    # ------------------------------------------------------------------ #
    async def list_leads(
        self,
        *,
        status: LeadStatus | None = None,
        category_id: uuid.UUID | None = None,
        city: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[AdminLeadRead], int]:
        """Leads paginados (filtros status/categoria/cidade)."""
        leads, total = await self.repo.list_leads(
            status=status,
            category_id=category_id,
            city=city,
            limit=page_size,
            offset=(page - 1) * page_size,
        )
        return [AdminLeadRead.model_validate(lead) for lead in leads], total

    async def cancel_lead(
        self,
        admin: User,
        lead_id: uuid.UUID,
        *,
        reason: str | None = None,
    ) -> AdminLeadRead:
        """Cancela um lead pelo admin (``status=cancelled`` + soft delete) + auditoria.

        Erros: ``404`` inexistente; ``422`` lead já cancelado. (Estorno de
        créditos quando há compra é responsabilidade do ``POST
        /payments/orders/{id}/refund`` existente — referenciado, não duplicado.)
        """
        lead = await self.repo.get_lead(lead_id)
        if lead is None:
            raise NotFoundError("Lead não encontrado.")
        if lead.status == LeadStatus.cancelled:
            raise DomainValidationError("O lead já está cancelado.")

        old_status = lead.status
        # Lead falso/comprado: devolve o crédito ao profissional (reembolsa +
        # remove compra/conversa + notifica o pro). Para leads não comprados,
        # apenas marca cancelado.
        if old_status == LeadStatus.purchased:
            purchase = (
                await self.db.execute(
                    select(LeadPurchase).where(LeadPurchase.lead_id == lead.id)
                )
            ).scalar_one_or_none()
            if purchase is not None:
                await cancel_lead_with_refund(
                    self.db, purchase=purchase, lead=lead
                )
        lead.status = LeadStatus.cancelled
        lead.deleted_at = datetime.now(UTC)
        self._record_audit(
            admin,
            action=AuditAction.lead_cancel,
            entity="leads",
            entity_id=lead.id,
            meta={"reason": reason, "old_status": old_status.value},
        )
        await self.repo.flush()
        await self.db.commit()
        await self.db.refresh(lead)
        return AdminLeadRead.model_validate(lead)

    # ------------------------------------------------------------------ #
    # Financeiro
    # ------------------------------------------------------------------ #
    async def list_payments(
        self,
        *,
        status: PaymentOrderStatus | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[AdminPaymentRead], int, FinanceSummary]:
        """Pedidos paginados + resumo de receita (§ Financeiro)."""
        orders, total = await self.repo.list_payments(
            status=status,
            limit=page_size,
            offset=(page - 1) * page_size,
        )
        (
            paid_orders,
            revenue_cents,
            refunded_orders,
        ) = await self.repo.payment_finance_summary()
        summary = FinanceSummary(
            paid_orders=paid_orders,
            revenue_cents=revenue_cents,
            revenue_brl=round(revenue_cents / 100, 2),
            refunded_orders=refunded_orders,
        )
        items = [AdminPaymentRead.model_validate(o) for o in orders]
        return items, total, summary

    # ------------------------------------------------------------------ #
    # Auditoria
    # ------------------------------------------------------------------ #
    async def list_audit_logs(
        self,
        *,
        action: str | None = None,
        entity: str | None = None,
        actor_id: uuid.UUID | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[AuditLogRead], int]:
        """Auditoria paginada (somente leitura — §7.4)."""
        logs, total = await self.repo.list_audit_logs(
            action=action,
            entity=entity,
            actor_id=actor_id,
            limit=page_size,
            offset=(page - 1) * page_size,
        )
        return [AuditLogRead.model_validate(log) for log in logs], total

    # ------------------------------------------------------------------ #
    # Helpers internos
    # ------------------------------------------------------------------ #
    def _record_audit(
        self,
        admin: User,
        *,
        action: str,
        entity: str,
        entity_id: uuid.UUID | None,
        meta: dict[str, Any] | None = None,
    ) -> AuditLog:
        """Adiciona um :class:`AuditLog` à sessão (commit fica com o chamador)."""
        log = AuditLog(
            actor_id=admin.id,
            action=action,
            entity=entity,
            entity_id=entity_id,
            meta=meta,
        )
        return self.repo.add_audit_log(log)
