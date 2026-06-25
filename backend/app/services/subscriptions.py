"""Serviço da assinatura (plano PRO) — #56.

- ``SubscriptionSettings`` singleton, editável no admin (liga/desliga + valores).
- Ciclo de vida via **Mercado Pago preapproval** (assinatura recorrente).
- Entitlement: o flag denormalizado ``professional_profiles.premium`` é a verdade
  que os benefícios leem (topo da lista, selo); este serviço o mantém em sincronia.
- Webhook recorrente: cada cobrança (``authorized_payment`` processed) concede os
  créditos do ciclo — idempotente por ``last_payment_id``.

**Gate:** nada acontece para o profissional enquanto ``enabled`` for False — o
endpoint de assinar recusa (422) e o front esconde a tela. O admin sempre edita.
"""

from __future__ import annotations

import logging
import re
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings as app_settings
from app.core.exceptions import (
    ConflictError,
    DomainValidationError,
)
from app.models import (
    ProfessionalProfile,
    Subscription,
    SubscriptionSettings,
    User,
)
from app.models.enums import CreditTransactionType
from app.schemas.subscriptions import (
    SubscriptionInfo,
    SubscriptionSettingsUpdate,
)
from app.services.credits import CreditService
from app.services.notifications import add_notification
from app.services.payments.mercadopago import MercadoPagoProvider

__all__ = ["SubscriptionService"]

logger = logging.getLogger("faztudo.subscriptions")

# ids do MP entram em path de API (GET /preapproval/{id}); só alfanum/_/-,
# nunca '/' ou '..' (anti path-traversal a partir do webhook público — #9).
_ID_RE = re.compile(r"[A-Za-z0-9_-]{1,64}")


class SubscriptionService:
    """Configuração, ciclo de vida e webhook da assinatura."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------ #
    # Configuração (singleton get-or-create)
    # ------------------------------------------------------------------ #
    async def get_settings(self) -> SubscriptionSettings:
        row = (
            await self.db.execute(select(SubscriptionSettings).limit(1))
        ).scalar_one_or_none()
        if row is None:
            row = SubscriptionSettings()
            self.db.add(row)
            await self.db.flush()
            await self.db.commit()
        return row

    async def update_settings(
        self, data: SubscriptionSettingsUpdate
    ) -> SubscriptionSettings:
        row = await self.get_settings()
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(row, field, value)
        await self.db.commit()
        await self.db.refresh(row)
        return row

    # ------------------------------------------------------------------ #
    # Visão do profissional
    # ------------------------------------------------------------------ #
    async def get_info(self, user: User) -> SubscriptionInfo:
        s = await self.get_settings()
        sub = await self._get_sub(user.id)
        is_pro = await self._is_premium(user.id)
        return SubscriptionInfo(
            enabled=s.enabled,
            plan_name=s.plan_name,
            price_cents=s.price_cents,
            included_credits=s.included_credits,
            discount_pct=s.discount_pct,
            trial_days=s.trial_days,
            trial_credits=s.trial_credits,
            is_pro=is_pro,
            status=sub.status if sub else None,
            current_period_end=sub.current_period_end if sub else None,
        )

    async def subscribe(self, user: User) -> str:
        """Cria a assinatura no MP e devolve o link de checkout (init_point)."""
        s = await self.get_settings()
        if not s.enabled:
            raise DomainValidationError(
                "Assinatura indisponível no momento."
            )
        if not app_settings.PAYMENTS_ENABLED:
            raise DomainValidationError("Pagamento indisponível no momento.")
        if await self._is_premium(user.id):
            raise ConflictError("Você já tem uma assinatura ativa.")

        base = app_settings.FRONTEND_URL.rstrip("/")
        preapproval_id, init_point = await MercadoPagoProvider().create_subscription(
            external_reference=f"sub_{user.id}",
            reason=f"{s.plan_name} — assinatura mensal",
            amount_cents=s.price_cents,
            currency="BRL",
            payer_email=user.email,
            back_url=f"{base}/credits?assinatura=sucesso",
            free_trial_days=s.trial_days,
        )

        sub = await self._get_sub(user.id)
        if sub is None:
            sub = Subscription(user_id=user.id)
            self.db.add(sub)
        sub.status = "pending"
        sub.provider = "mercadopago"
        sub.provider_sub_id = preapproval_id
        sub.canceled_at = None
        await self.db.commit()
        return init_point

    async def cancel(self, user: User) -> None:
        sub = await self._get_sub(user.id)
        if sub is None or sub.status in ("canceled", "expired"):
            return
        if sub.provider_sub_id:
            try:
                await MercadoPagoProvider().cancel_subscription(
                    sub.provider_sub_id
                )
            except Exception:  # noqa: BLE001 - cancela localmente mesmo assim
                logger.exception("Falha ao cancelar preapproval no MP")
        sub.status = "canceled"
        sub.canceled_at = datetime.now(UTC)
        await self._set_premium(user.id, False)
        await self.db.commit()

    async def cancel_on_account_deletion(self, user_id: uuid.UUID) -> None:
        """Cancela a recorrência ao excluir a conta. Marca cancelado localmente
        (sem commit — o ``delete_account`` commita) mesmo se o MP falhar, e loga
        em nível de alerta para reconciliação (não cobrar quem saiu)."""
        sub = await self._get_sub(user_id)
        if sub is None:
            return
        if sub.provider_sub_id:
            try:
                await MercadoPagoProvider().cancel_subscription(
                    sub.provider_sub_id
                )
            except Exception:  # noqa: BLE001
                logger.error(
                    "ALERTA: preapproval %s pode ter ficado ATIVA no MP após a "
                    "exclusão da conta %s — reconciliar manualmente.",
                    sub.provider_sub_id,
                    user_id,
                )
        sub.status = "canceled"
        sub.canceled_at = datetime.now(UTC)

    # ------------------------------------------------------------------ #
    # Webhook (chamado pelo endpoint /payments/webhook ao ver tópico de assinatura)
    # ------------------------------------------------------------------ #
    async def handle_webhook(self, payload: dict) -> None:
        topic = payload.get("type") or payload.get("topic")
        data = payload.get("data")
        data_id = data.get("id") if isinstance(data, dict) else None
        if not data_id:
            data_id = payload.get("id")
        if not data_id:
            return
        data_id = str(data_id)
        if not _ID_RE.fullmatch(data_id):
            return  # id malformado — não usar no path da API do MP
        mp = MercadoPagoProvider()
        if topic in ("subscription_preapproval", "preapproval"):
            await self._apply_preapproval(mp.fetch_preapproval(str(data_id)))
        elif topic in (
            "subscription_authorized_payment",
            "authorized_payment",
        ):
            await self._apply_authorized_payment(
                str(data_id), mp.fetch_authorized_payment(str(data_id))
            )

    async def _apply_preapproval(self, info: dict) -> None:
        preapproval_id = str(info.get("id") or "")
        mp_status = info.get("status")  # authorized|paused|cancelled|pending
        s = await self.get_settings()  # garante a linha antes de mutar a assinatura
        sub = await self._get_sub_by_provider(preapproval_id)
        if sub is None:
            return
        if mp_status == "authorized":
            if sub.status not in ("active", "past_due"):
                sub.status = "active"
            await self._set_premium(sub.user_id, True)
            # Créditos de cortesia do trial: concede ao INICIAR o teste (1x).
            if not sub.trial_granted and s.trial_credits > 0:
                await self._grant_credits(
                    sub.user_id,
                    s.trial_credits,
                    f"Cortesia do {s.plan_name}",
                    sub.id,
                )
                sub.trial_granted = True
        elif mp_status == "paused":
            # Cobrança recorrente falhou: rebaixa e TIRA o benefício na hora
            # (sem PRO sem pagar — não há job de carência por tempo).
            sub.status = "past_due"
            await self._set_premium(sub.user_id, False)
        elif mp_status == "cancelled":
            sub.status = "canceled"
            sub.canceled_at = datetime.now(UTC)
            await self._set_premium(sub.user_id, False)
        await self.db.commit()

    async def _apply_authorized_payment(
        self, payment_id: str, info: dict
    ) -> None:
        if info.get("status") != "processed":
            return
        preapproval_id = str(info.get("preapproval_id") or "")
        if not preapproval_id:
            return
        # Garante a linha de settings ANTES de travar a assinatura — o commit do
        # get-or-create não pode soltar o lock FOR UPDATE no meio do crédito.
        s = await self.get_settings()
        # Lock da linha → serializa webhooks concorrentes do mesmo ciclo.
        sub = (
            await self.db.execute(
                select(Subscription)
                .where(Subscription.provider_sub_id == preapproval_id)
                .with_for_update()
            )
        ).scalar_one_or_none()
        if sub is None or sub.last_payment_id == payment_id:
            return  # idempotente: este ciclo já foi creditado
        # Não ressuscita assinatura já cancelada por uma cobrança atrasada do MP.
        if sub.status in ("canceled", "expired"):
            sub.last_payment_id = payment_id
            await self.db.commit()
            return

        now = datetime.now(UTC)
        await self._grant_credits(
            sub.user_id, s.included_credits, f"Créditos do {s.plan_name}", sub.id
        )
        sub.last_payment_id = payment_id
        sub.status = "active"
        sub.current_period_end = now + timedelta(days=31)
        sub.grace_until = None
        await self._set_premium(sub.user_id, True)

        add_notification(
            self.db,
            user_id=sub.user_id,
            type="subscription",
            title="Plano PRO ativo",
            body=f"Você recebeu {s.included_credits} créditos do {s.plan_name}.",
            href="/credits",
        )
        await self.db.commit()

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #
    async def _grant_credits(
        self,
        user_id: uuid.UUID,
        amount: int,
        description: str,
        ref_id: uuid.UUID,
    ) -> None:
        if amount <= 0:
            return
        profile = (
            await self.db.execute(
                select(ProfessionalProfile).where(
                    ProfessionalProfile.user_id == user_id
                )
            )
        ).scalar_one_or_none()
        if profile is None:
            return
        credits = CreditService(self.db)
        wallet = await credits.get_or_create_wallet(profile.id, for_update=True)
        await credits.apply_movement(
            wallet,
            amount=amount,
            transaction_type=CreditTransactionType.bonus,
            description=description,
            reference_id=ref_id,
        )

    async def _set_premium(self, user_id: uuid.UUID, value: bool) -> None:
        await self.db.execute(
            update(ProfessionalProfile)
            .where(ProfessionalProfile.user_id == user_id)
            .values(premium=value)
        )

    async def _is_premium(self, user_id: uuid.UUID) -> bool:
        return bool(
            (
                await self.db.execute(
                    select(ProfessionalProfile.premium).where(
                        ProfessionalProfile.user_id == user_id
                    )
                )
            ).scalar_one_or_none()
        )

    async def _get_sub(self, user_id: uuid.UUID) -> Subscription | None:
        return (
            await self.db.execute(
                select(Subscription).where(Subscription.user_id == user_id)
            )
        ).scalar_one_or_none()

    async def _get_sub_by_provider(
        self, preapproval_id: str
    ) -> Subscription | None:
        return (
            await self.db.execute(
                select(Subscription).where(
                    Subscription.provider_sub_id == preapproval_id
                )
            )
        ).scalar_one_or_none()
