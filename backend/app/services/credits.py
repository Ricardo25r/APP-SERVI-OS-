"""Service da feature ``credits`` (Fase 5).

Concentra a regra de negócio (§3.5) da carteira de créditos: criação lazy da
wallet, leitura de saldo, histórico paginado e concessão de créditos pelo admin
(``grant``). Faz o ``commit`` (o repositório só faz ``add``/``flush``).

**Invariante central (§1.7 / §2.9):** o saldo **nunca** muda sem uma
``CreditTransaction`` correspondente. Toda movimentação passa por
:meth:`CreditService.apply_movement`, que:
  1. lê o saldo atual (``balance_before``);
  2. calcula ``balance_after = balance_before + amount`` (``amount`` com sinal);
  3. valida que ``balance_after >= 0`` (saldo nunca negativo — §2.8);
  4. grava a ``CreditTransaction`` (``balance_before``/``balance_after``);
  5. atualiza ``wallet.balance``.

Esse helper é reutilizado pela compra de lead (``services/lead_purchases``) para
o débito atômico (``spend``), garantindo a mesma trilha de auditoria.
"""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    InsufficientCreditsError,
    NotFoundError,
)
from app.models import (
    CreditTransaction,
    CreditTransactionType,
    CreditWallet,
    User,
)
from app.repositories.credits import CreditRepository
from app.schemas.credits import (
    CreditTransactionRead,
    GrantCredits,
    WalletRead,
)

__all__ = ["CreditService"]


class CreditService:
    """Orquestra saldo, histórico, concessão e movimentação de créditos."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = CreditRepository(db)

    # ------------------------------------------------------------------ #
    # Helper central de movimentação (débito/crédito) — §1.7 / §2.9
    # ------------------------------------------------------------------ #
    async def apply_movement(
        self,
        wallet: CreditWallet,
        *,
        amount: int,
        transaction_type: CreditTransactionType,
        description: str | None = None,
        reference_id: uuid.UUID | None = None,
    ) -> CreditTransaction:
        """Aplica uma movimentação à carteira **sempre** gravando a transação.

        ``amount`` com sinal (positivo = entrada; negativo = saída). Garante:
        - ``balance_after = balance_before + amount``;
        - ``balance_after >= 0`` (saldo nunca negativo — §2.8) senão
          :class:`InsufficientCreditsError`;
        - ``CreditTransaction`` append-only com ``balance_before``/``balance_after``.

        **Não** faz ``commit`` — o chamador (este service ou o de compra) commita,
        permitindo transações compostas atômicas (§3.4 / §5.4).
        """
        balance_before = wallet.balance
        balance_after = balance_before + amount
        if balance_after < 0:
            raise InsufficientCreditsError(
                "Saldo de créditos insuficiente para a operação."
            )

        tx = CreditTransaction(
            wallet_id=wallet.id,
            transaction_type=transaction_type,
            amount=amount,
            balance_before=balance_before,
            balance_after=balance_after,
            description=description,
            reference_id=reference_id,
        )
        self.repo.add_transaction(tx)
        wallet.balance = balance_after
        await self.repo.flush()
        return tx

    # ------------------------------------------------------------------ #
    # Wallet (criação lazy + saldo)
    # ------------------------------------------------------------------ #
    async def get_or_create_wallet(
        self, professional_id: uuid.UUID, *, for_update: bool = False
    ) -> CreditWallet:
        """Retorna a carteira do profissional, criando-a lazily se faltar (§2.8).

        ``for_update`` aplica o lock pessimista quando o dialeto suporta (Postgres);
        em SQLite é no-op. A criação lazy cobre o fallback do contrato
        (``/credits/balance`` cria a wallet se ela ainda não existir).
        """
        wallet = await self.repo.get_wallet_by_professional(
            professional_id, for_update=for_update
        )
        if wallet is not None:
            return wallet

        wallet = CreditWallet(professional_id=professional_id, balance=0)
        self.repo.add_wallet(wallet)
        await self.repo.flush()
        return wallet

    async def get_balance_for_user(self, current_user: User) -> WalletRead:
        """Saldo do profissional autenticado (cria wallet lazily — §4)."""
        profile = await self.repo.get_professional_profile_by_user(current_user.id)
        if profile is None:
            raise NotFoundError("Perfil profissional não encontrado.")
        wallet = await self.get_or_create_wallet(profile.id)
        await self.db.commit()
        return WalletRead(wallet_id=wallet.id, balance=wallet.balance)

    # ------------------------------------------------------------------ #
    # Histórico
    # ------------------------------------------------------------------ #
    async def list_history_for_user(
        self,
        current_user: User,
        *,
        transaction_type: CreditTransactionType | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[CreditTransactionRead], int]:
        """Histórico paginado da própria carteira (§4)."""
        profile = await self.repo.get_professional_profile_by_user(current_user.id)
        if profile is None:
            raise NotFoundError("Perfil profissional não encontrado.")
        wallet = await self.get_or_create_wallet(profile.id)
        await self.db.commit()

        limit = page_size
        offset = (page - 1) * page_size
        txs, total = await self.repo.list_transactions(
            wallet.id,
            transaction_type=transaction_type,
            limit=limit,
            offset=offset,
        )
        items = [CreditTransactionRead.model_validate(tx) for tx in txs]
        return items, total

    # ------------------------------------------------------------------ #
    # Grant (admin/dev — §4 / §7)
    # ------------------------------------------------------------------ #
    async def grant(self, data: GrantCredits) -> CreditTransactionRead:
        """Concede/ajusta créditos a um profissional (admin).

        ``transaction_type`` ∈ ``bonus|adjustment`` (validado no schema). Gera a
        ``CreditTransaction`` via :meth:`apply_movement` (saldo nunca muda sem
        transação). Um ``adjustment`` negativo não pode deixar o saldo negativo
        (→ 402).
        """
        profile = await self.repo.professional_exists(data.professional_id)
        if profile is None:
            raise NotFoundError("Profissional não encontrado.")

        wallet = await self.get_or_create_wallet(
            data.professional_id, for_update=True
        )
        tx = await self.apply_movement(
            wallet,
            amount=data.amount,
            transaction_type=data.transaction_type,
            description=data.description,
        )
        await self.db.commit()
        await self.db.refresh(tx)
        return CreditTransactionRead.model_validate(tx)
