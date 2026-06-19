"""Repositório da feature ``credits`` (Fase 5).

Camada de acesso a dados (queries SQLAlchemy async), **sem regra de negócio**
(§3.4). Recebe a ``AsyncSession`` por parâmetro e **não** faz ``commit`` — usa
``add``/``flush`` e deixa o commit para o service.

A carteira (``credit_wallets``) é 1:1 com ``professional_profiles`` e não tem
soft delete (§2.8). O histórico (``credit_transactions``) é append-only (§2.9).

> **Nota sobre ``SELECT ... FOR UPDATE`` (§5.4):** o bloqueio pessimista da
> carteira é aplicado **condicionalmente ao dialeto** — só Postgres suporta
> ``FOR UPDATE``. Em SQLite (testes) o ``with_for_update()`` é um no-op, então
> validamos apenas a lógica funcional (a tarefa autoriza isso explicitamente).
"""

from __future__ import annotations

import uuid

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    CreditTransaction,
    CreditTransactionType,
    CreditWallet,
    ProfessionalProfile,
)

__all__ = ["CreditRepository", "supports_for_update"]


def supports_for_update(db: AsyncSession) -> bool:
    """True se o dialeto da conexão suporta ``SELECT ... FOR UPDATE``.

    Postgres suporta; SQLite (testes) não — neste caso aplicar o lock seria um
    no-op (ou erro), então o omitimos. Centraliza a decisão para os dois repos
    (credits e lead_purchases).
    """
    return db.bind.dialect.name in {"postgresql", "mysql", "mariadb", "oracle"}


class CreditRepository:
    """Acesso a dados de :class:`CreditWallet` e :class:`CreditTransaction`."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------ #
    # Wallet
    # ------------------------------------------------------------------ #
    async def get_wallet_by_professional(
        self, professional_id: uuid.UUID, *, for_update: bool = False
    ) -> CreditWallet | None:
        """Retorna a carteira do profissional (ou ``None``).

        ``for_update`` aplica ``SELECT ... FOR UPDATE`` apenas em dialetos que o
        suportam (Postgres) — em SQLite o lock é omitido (§5.4 / nota do módulo).
        """
        stmt: Select = select(CreditWallet).where(
            CreditWallet.professional_id == professional_id
        )
        if for_update and supports_for_update(self.db):
            stmt = stmt.with_for_update()
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_wallet_by_id(self, wallet_id: uuid.UUID) -> CreditWallet | None:
        """Retorna a carteira por id (ou ``None``)."""
        result = await self.db.execute(
            select(CreditWallet).where(CreditWallet.id == wallet_id)
        )
        return result.scalar_one_or_none()

    def add_wallet(self, wallet: CreditWallet) -> CreditWallet:
        """Adiciona uma carteira à sessão (sem commit — o service commita)."""
        self.db.add(wallet)
        return wallet

    async def professional_exists(
        self, professional_id: uuid.UUID
    ) -> ProfessionalProfile | None:
        """Retorna o perfil profissional ativo por id (ou ``None``)."""
        result = await self.db.execute(
            select(ProfessionalProfile).where(
                ProfessionalProfile.id == professional_id,
                ProfessionalProfile.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def get_professional_profile_by_user(
        self, user_id: uuid.UUID
    ) -> ProfessionalProfile | None:
        """Carrega o perfil profissional ativo do usuário (ou ``None``)."""
        result = await self.db.execute(
            select(ProfessionalProfile).where(
                ProfessionalProfile.user_id == user_id,
                ProfessionalProfile.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    # ------------------------------------------------------------------ #
    # Transactions
    # ------------------------------------------------------------------ #
    def add_transaction(self, tx: CreditTransaction) -> CreditTransaction:
        """Adiciona uma transação à sessão (append-only; sem commit)."""
        self.db.add(tx)
        return tx

    def _history_stmt(
        self,
        wallet_id: uuid.UUID,
        *,
        transaction_type: CreditTransactionType | None,
    ) -> Select:
        stmt: Select = select(CreditTransaction).where(
            CreditTransaction.wallet_id == wallet_id
        )
        if transaction_type is not None:
            stmt = stmt.where(
                CreditTransaction.transaction_type == transaction_type
            )
        return stmt

    async def list_transactions(
        self,
        wallet_id: uuid.UUID,
        *,
        transaction_type: CreditTransactionType | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[CreditTransaction], int]:
        """Histórico paginado da carteira (mais recentes primeiro) + total."""
        base = self._history_stmt(wallet_id, transaction_type=transaction_type)
        total = await self._count(base)
        stmt = (
            base.order_by(CreditTransaction.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    # ------------------------------------------------------------------ #
    # Suporte
    # ------------------------------------------------------------------ #
    async def flush(self) -> None:
        await self.db.flush()

    async def _count(self, base_stmt: Select) -> int:
        count_stmt = select(func.count()).select_from(base_stmt.subquery())
        result = await self.db.execute(count_stmt)
        return int(result.scalar_one())
