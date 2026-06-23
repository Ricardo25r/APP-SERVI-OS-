"""Service de orquestração da feature ``payments`` (Fase 6 — §3.1 / §5).

``PaymentService`` concentra a regra de negócio: catálogo, criação de pedido
(``pending`` + ``provider.create_charge``), processamento idempotente do webhook
(credita no ``paid`` na **mesma transação** da transição de status) e o estorno
admin (``refund``). Faz o ``commit`` (o repositório só faz ``add``/``flush``).

==============================================================================
Idempotência + atomicidade (§2.4 / §5.2 / §5.3) — DINHEIRO:
==============================================================================
- **Crédito SÓ no ``paid``**, via ``CreditService.apply_movement(
  transaction_type=purchase, reference_id=order.id)``, **dentro do mesmo
  ``commit``** da transição ``pending → paid``. Falhou algo → rollback total
  (nem credita, nem marca pago).
- **Lock pessimista** condicional ao dialeto (``FOR UPDATE`` no pedido e na
  wallet; no-op em SQLite — a unicidade + checagem de status garantem a
  reentrância nos testes).
- **Reentrância segura:** o pedido é carregado por ``external_reference``
  (UNIQUE) sob lock; se já está ``paid`` (ou ``provider_event_id`` setado) →
  **no-op** (não credita 2×). O ``UNIQUE(provider_event_id)`` cobre a corrida
  concorrente: a 2ª gravação viola o unique → ``IntegrityError`` → tratado como
  duplicado (no-op). **Garantia:** um pedido ``paid`` ⇒ exatamente uma
  ``CreditTransaction(type=purchase, reference_id=order.id)``.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import (
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
)
from app.models import (
    CreditTransactionType,
    PaymentOrder,
    PaymentOrderStatus,
    User,
)
from app.repositories.credits import supports_for_update
from app.repositories.payments import PaymentRepository
from app.schemas.payments import CreditPackageRead, PaymentOrderRead
from app.services.credits import CreditService
from app.services.payments.base import ProviderEvent
from app.services.payments.dev import sign_payload
from app.services.payments.exceptions import ProviderError
from app.services.payments.factory import get_payment_provider

__all__ = ["PaymentService"]


class PaymentService:
    """Orquestra catálogo, pedidos, webhook idempotente e refund."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = PaymentRepository(db)
        self.credit_service = CreditService(db)
        self.provider = get_payment_provider()

    # ------------------------------------------------------------------ #
    # Catálogo
    # ------------------------------------------------------------------ #
    async def list_packages(
        self, *, active_only: bool = True
    ) -> list[CreditPackageRead]:
        """Lista os pacotes (default só ativos — §4 #1)."""
        packages = await self.repo.list_packages(active_only=active_only)
        return [CreditPackageRead.model_validate(p) for p in packages]

    # ------------------------------------------------------------------ #
    # Criação do pedido (professional) — §4 #2 / §5.1
    # ------------------------------------------------------------------ #
    async def create_order(
        self, current_user: User, package_id: uuid.UUID
    ) -> PaymentOrderRead:
        """Cria um pedido ``pending`` e gera a cobrança no provedor.

        Fluxo (§4 #2): valida pacote ativo → cria ``payment_orders``
        (snapshot ``amount_cents``/``credits``/``currency``, ``provider`` de
        settings) → ``flush`` (gera ``id``) → ``provider.create_charge(order)``
        → grava ``external_reference``/``pix_code``/``checkout_url`` → ``commit``.
        **Não credita nada.**
        """
        package = await self.repo.get_package(package_id)
        if package is None:
            raise NotFoundError("Pacote de créditos não encontrado.")
        if not package.active:
            raise ProviderError("Pacote de créditos inativo.")

        order = PaymentOrder(
            user_id=current_user.id,
            package_id=package.id,
            provider=settings.PAYMENT_PROVIDER,
            amount_cents=package.price_cents,
            credits=package.credits,
            currency=package.currency,
            status=PaymentOrderStatus.pending,
            # Placeholder único garantindo o NOT NULL antes do create_charge; é
            # sobrescrito pelo external_reference do provedor logo abaixo (o
            # provider determinístico do dev usa o próprio id do pedido).
            external_reference=f"pending_{uuid.uuid4().hex}",
        )
        self.repo.add_order(order)
        await self.repo.flush()  # gera order.id para o provider.

        try:
            charge = await self.provider.create_charge(order)
        except Exception:
            await self.db.rollback()
            raise

        order.external_reference = charge.external_reference
        order.pix_code = charge.pix_code
        order.checkout_url = charge.checkout_url
        await self.repo.flush()
        await self.db.commit()
        await self.db.refresh(order)
        return PaymentOrderRead.model_validate(order)

    # ------------------------------------------------------------------ #
    # Listagem / detalhe (professional dono) — §4 #3 / #4
    # ------------------------------------------------------------------ #
    async def list_orders_for_user(
        self,
        current_user: User,
        *,
        status: PaymentOrderStatus | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[PaymentOrderRead], int]:
        """Pedidos do usuário autenticado (paginado — §4 #3)."""
        limit = page_size
        offset = (page - 1) * page_size
        orders, total = await self.repo.list_orders_for_user(
            current_user.id, status=status, limit=limit, offset=offset
        )
        items = [PaymentOrderRead.model_validate(o) for o in orders]
        return items, total

    async def get_order_for_user(
        self, current_user: User, order_id: uuid.UUID
    ) -> PaymentOrderRead:
        """Detalhe de um pedido do dono (§4 #4 — 404 inexistente, 403 não-dono)."""
        order = await self.repo.get_order(order_id)
        if order is None:
            raise NotFoundError("Pedido não encontrado.")
        if order.user_id != current_user.id:
            raise PermissionDeniedError("Você não é o dono deste pedido.")
        return PaymentOrderRead.model_validate(order)

    # ------------------------------------------------------------------ #
    # Webhook — processamento idempotente e atômico (§5.2 / §5.3)
    # ------------------------------------------------------------------ #
    async def handle_event(self, event: ProviderEvent) -> PaymentOrderRead:
        """Processa um :class:`ProviderEvent` (do webhook real ou do dev/confirm).

        Transação ÚNICA (§5.1): localiza o pedido por ``external_reference``
        (UNIQUE) sob lock → idempotência por status/``provider_event_id`` →
        credita (``purchase``) no ``paid`` na mesma transação → ``commit``.

        Sempre devolve o pedido (atualizado ou no-op). ``404`` se a
        ``external_reference`` for desconhecida.
        """
        use_lock = supports_for_update(self.db)

        try:
            order = await self.repo.get_order_by_external_reference(
                event.external_reference, for_update=use_lock
            )
            if order is None:
                raise NotFoundError("Pedido (external_reference) não encontrado.")

            # (3) Idempotência: já processado → no-op (não credita de novo).
            if (
                order.status == PaymentOrderStatus.paid
                or order.provider_event_id is not None
            ):
                await self.db.commit()
                return PaymentOrderRead.model_validate(order)

            if event.status == PaymentOrderStatus.paid:
                await self._apply_paid(order, event)
            elif event.status == PaymentOrderStatus.failed:
                order.status = PaymentOrderStatus.failed
                order.provider_event_id = event.provider_event_id
                order.failed_reason = "Pagamento reportado como falho pelo provedor."
            elif event.status == PaymentOrderStatus.refunded:
                # Estorno via webhook do provedor (normalmente é o endpoint admin).
                # Só faz sentido sobre um pedido já pago; aqui (pending) tratamos
                # como falha/cancelamento sem creditar.
                order.status = PaymentOrderStatus.cancelled
                order.provider_event_id = event.provider_event_id
                order.failed_reason = "Evento de refund sobre pedido não pago."
            else:  # pragma: no cover - parse_event nunca emite outros status.
                raise ProviderError("Status de evento não suportado.")

            await self.repo.flush()
            await self.db.commit()
        except IntegrityError:
            # Corrida concorrente: UNIQUE(provider_event_id) violado → o evento
            # já foi processado por outra requisição. Trata como duplicado (no-op).
            await self.db.rollback()
            order = await self.repo.get_order_by_external_reference(
                event.external_reference, for_update=False
            )
            if order is None:  # pragma: no cover - defensivo
                raise NotFoundError(
                    "Pedido (external_reference) não encontrado."
                ) from None
            return PaymentOrderRead.model_validate(order)
        except Exception:
            await self.db.rollback()
            raise

        await self.db.refresh(order)
        return PaymentOrderRead.model_validate(order)

    async def _apply_paid(self, order: PaymentOrder, event: ProviderEvent) -> None:
        """Credita a carteira (``purchase``) e marca o pedido ``paid`` (§5.1.4).

        Tudo na transação do chamador (``handle_event``) → atomicidade (§5.2).
        """
        profile = await self.repo.get_professional_profile_by_user(order.user_id)
        if profile is None:
            # Comprador sem perfil profissional não tem carteira para creditar.
            raise ProviderError(
                "Perfil profissional do comprador não encontrado."
            )

        use_lock = supports_for_update(self.db)
        wallet = await self.credit_service.get_or_create_wallet(
            profile.id, for_update=use_lock
        )
        tx = await self.credit_service.apply_movement(
            wallet,
            amount=order.credits,
            transaction_type=CreditTransactionType.purchase,
            description=f"Compra de créditos (pedido {order.id})",
            reference_id=order.id,
        )

        order.status = PaymentOrderStatus.paid
        order.paid_at = datetime.now(UTC)
        order.provider_event_id = event.provider_event_id
        order.credit_transaction_id = tx.id

    # ------------------------------------------------------------------ #
    # Dev confirm — assina internamente e usa o MESMO handler (§4 #6 / §3.3)
    # ------------------------------------------------------------------ #
    async def dev_confirm(
        self, current_user: User, order_id: uuid.UUID, *, event: str
    ) -> PaymentOrderRead:
        """Simula o webhook para um pedido (dev-only — §4 #6).

        Monta o payload ``{external_reference, event_id, type}``, **assina com o
        ``PAYMENT_WEBHOOK_SECRET``** e passa pela MESMA verificação +
        ``handle_event`` do webhook real (paridade de comportamento — §3.3).
        Autorização: dono do pedido ou admin; ``409`` se já não-``pending``.
        """
        order = await self.repo.get_order(order_id)
        if order is None:
            raise NotFoundError("Pedido não encontrado.")

        from app.models import UserRole

        is_owner = order.user_id == current_user.id
        is_admin = current_user.role == UserRole.admin
        if not (is_owner or is_admin):
            raise PermissionDeniedError("Você não pode confirmar este pedido.")
        if order.status != PaymentOrderStatus.pending:
            raise ConflictError("Pedido não está pendente.")

        payload = {
            "external_reference": order.external_reference,
            "event_id": f"dev_evt_{uuid.uuid4().hex}",
            "type": f"payment.{event}",
        }
        body, headers = sign_payload(payload)
        verified = self.provider.verify_webhook(headers, body)
        provider_event = self.provider.parse_event(verified)
        return await self.handle_event(provider_event)

    # ------------------------------------------------------------------ #
    # Confirmação manual (admin) — Pix manual, sem gateway
    # ------------------------------------------------------------------ #
    async def admin_confirm_order(self, order_id: uuid.UUID) -> PaymentOrderRead:
        """Admin confirma manualmente um pedido (Pix manual) → credita a carteira
        e marca ``paid``. Erros: ``404`` inexistente, ``409`` não pendente."""
        order = await self.repo.get_order(order_id)
        if order is None:
            raise NotFoundError("Pedido não encontrado.")
        if order.status != PaymentOrderStatus.pending:
            raise ConflictError("Pedido não está pendente.")

        event = ProviderEvent(
            external_reference=order.external_reference or f"manual_{order.id}",
            status=PaymentOrderStatus.paid,
            provider_event_id=f"manual_{uuid.uuid4().hex}",
            raw=None,
        )
        await self._apply_paid(order, event)
        await self.repo.flush()
        await self.db.commit()
        await self.db.refresh(order)
        return PaymentOrderRead.model_validate(order)

    # ------------------------------------------------------------------ #
    # Refund (admin) — §4 #7 / §5.4
    # ------------------------------------------------------------------ #
    async def refund(
        self, order_id: uuid.UUID, *, reason: str | None = None
    ) -> PaymentOrderRead:
        """Estorna um pedido ``paid`` devolvendo os créditos (admin — §5.4).

        Transação única: ``apply_movement(type=refund, amount=+order.credits)``
        + ``order.status=refunded`` + ``order.refunded_at=now``. Sempre em
        créditos, nunca em dinheiro. ``409`` se o pedido não está ``paid``.
        """
        use_lock = supports_for_update(self.db)
        try:
            order = await self.repo.get_order_for_update(
                order_id, for_update=use_lock
            )
            if order is None:
                raise NotFoundError("Pedido não encontrado.")
            if order.status != PaymentOrderStatus.paid:
                raise ConflictError("Apenas pedidos pagos podem ser estornados.")

            profile = await self.repo.get_professional_profile_by_user(
                order.user_id
            )
            if profile is None:
                raise NotFoundError(
                    "Perfil profissional do comprador não encontrado."
                )

            wallet = await self.credit_service.get_or_create_wallet(
                profile.id, for_update=use_lock
            )
            await self.credit_service.apply_movement(
                wallet,
                amount=order.credits,
                transaction_type=CreditTransactionType.refund,
                description=f"Estorno do pedido {order.id}"
                + (f" — {reason}" if reason else ""),
                reference_id=order.id,
            )

            order.status = PaymentOrderStatus.refunded
            order.refunded_at = datetime.now(UTC)
            if reason:
                order.failed_reason = reason
            # TODO auditoria quando audit_logs existir: registrar a ação admin de
            # refund (user_id/action/entity=payment_order/entity_id/ip/user_agent).

            await self.repo.flush()
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            raise

        await self.db.refresh(order)
        return PaymentOrderRead.model_validate(order)
