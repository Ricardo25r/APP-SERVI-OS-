"""Service de **indique e ganhe** (referral).

- ``ensure_code`` — garante o código de indicação único do usuário.
- ``resolve_referrer_id`` — acha o indicador a partir de um código (no cadastro).
- ``reward_on_first_purchase`` — credita o indicador (bônus, 1x) quando o
  indicado faz a PRIMEIRA compra de verdade (anti-fraude: exige uso real, não
  só cadastro). Best-effort: nunca quebra o fluxo de compra.
"""

from __future__ import annotations

import secrets
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import CreditTransactionType, User
from app.repositories.leads import LeadRepository
from app.services.credits import CreditService
from app.services.notifications import add_notification

__all__ = ["ReferralService"]

# Alfabeto sem caracteres ambíguos (0/O, 1/I).
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
_CODE_LEN = 8


class ReferralService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _code_taken(self, code: str) -> bool:
        result = await self.db.execute(
            select(User.id).where(User.referral_code == code)
        )
        return result.first() is not None

    async def generate_code(self) -> str:
        for _ in range(12):
            code = "".join(
                secrets.choice(_CODE_ALPHABET) for _ in range(_CODE_LEN)
            )
            if not await self._code_taken(code):
                return code
        return "R" + secrets.token_hex(5).upper()

    async def ensure_code(self, user: User) -> str:
        """Garante (criando + commit se faltar) o código de indicação do usuário."""
        if user.referral_code:
            return user.referral_code
        user.referral_code = await self.generate_code()
        await self.db.commit()
        await self.db.refresh(user)
        return user.referral_code

    async def resolve_referrer_id(self, code: str | None) -> uuid.UUID | None:
        """Id do indicador a partir do código (cadastro). None se inválido."""
        if not code:
            return None
        cleaned = code.strip().upper()
        result = await self.db.execute(
            select(User.id).where(
                User.referral_code == cleaned, User.deleted_at.is_(None)
            )
        )
        row = result.first()
        return row[0] if row else None

    async def referral_info(self, user: User) -> tuple[str, int, int]:
        """(código, total de indicados, créditos ganhos com indicações)."""
        code = await self.ensure_code(user)
        total = int(
            (
                await self.db.execute(
                    select(func.count())
                    .select_from(User)
                    .where(User.referred_by_id == user.id)
                )
            ).scalar_one()
        )
        credited = int(
            (
                await self.db.execute(
                    select(func.count())
                    .select_from(User)
                    .where(
                        User.referred_by_id == user.id,
                        User.referral_credited.is_(True),
                    )
                )
            ).scalar_one()
        )
        return code, total, credited * settings.REFERRAL_BONUS_CREDITS

    async def reward_on_first_purchase(self, buyer_id: uuid.UUID) -> None:
        """Credita o indicador (1x) na 1ª compra do indicado. Best-effort."""
        if settings.REFERRAL_BONUS_CREDITS <= 0:
            return
        buyer = await self.db.get(User, buyer_id)
        if (
            buyer is None
            or buyer.referred_by_id is None
            or buyer.referral_credited
        ):
            return
        # Marca já creditado (1x) — mesmo se o indicador não for profissional.
        buyer.referral_credited = True

        referrer_profile = await LeadRepository(
            self.db
        ).get_professional_profile(buyer.referred_by_id)
        if referrer_profile is not None:
            credit_service = CreditService(self.db)
            wallet = await credit_service.get_or_create_wallet(
                referrer_profile.id
            )
            await credit_service.apply_movement(
                wallet,
                amount=settings.REFERRAL_BONUS_CREDITS,
                transaction_type=CreditTransactionType.bonus,
                description="Bônus por indicação de um novo usuário",
                reference_id=buyer.id,
            )
            add_notification(
                self.db,
                user_id=buyer.referred_by_id,
                type="credits",
                title="Você ganhou créditos!",
                body=(
                    f"Sua indicação rendeu {settings.REFERRAL_BONUS_CREDITS} "
                    "créditos. Obrigado por divulgar o FazTudo!"
                ),
                href="/credits",
            )
        await self.db.commit()
