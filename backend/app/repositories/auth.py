"""Repositório de acesso a dados da feature ``auth`` (§3.4).

Somente queries SQLAlchemy async sobre ``User`` e ``RefreshToken`` — sem regra
de negócio e **sem ``commit``** (o service commita, para permitir transações
compostas). Padrão: ``add`` + ``flush``; o service confirma.

Consultas de ``User`` filtram ``deleted_at IS NULL`` (soft delete), salvo onde
indicado.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import RefreshToken, User


class UserRepository:
    """Acesso a dados de ``users``."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        """Retorna o usuário ativo (não soft-deleted) pelo id."""
        result = await self.db.execute(
            select(User).where(User.id == user_id, User.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        """Retorna o usuário ativo pelo email (case-insensitive: já lowercased)."""
        result = await self.db.execute(
            select(User).where(
                User.email == email.lower(), User.deleted_at.is_(None)
            )
        )
        return result.scalar_one_or_none()

    async def email_exists(self, email: str) -> bool:
        """Indica se há usuário ativo com este email."""
        result = await self.db.execute(
            select(User.id).where(
                User.email == email.lower(), User.deleted_at.is_(None)
            )
        )
        return result.first() is not None

    async def phone_exists(self, phone: str) -> bool:
        """Indica se há usuário ativo com este telefone."""
        result = await self.db.execute(
            select(User.id).where(User.phone == phone, User.deleted_at.is_(None))
        )
        return result.first() is not None

    async def create(self, user: User) -> User:
        """Adiciona um novo usuário à sessão e faz flush (sem commit)."""
        self.db.add(user)
        await self.db.flush()
        return user

    async def touch_last_login(self, user: User, when: datetime) -> None:
        """Atualiza ``last_login_at`` do usuário (sem commit)."""
        user.last_login_at = when
        await self.db.flush()


class RefreshTokenRepository:
    """Acesso a dados de ``refresh_tokens``."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(
        self,
        *,
        user_id: uuid.UUID,
        token_hash: str,
        expires_at: datetime,
    ) -> RefreshToken:
        """Cria um registro de refresh token (hash) e faz flush (sem commit)."""
        token = RefreshToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        self.db.add(token)
        await self.db.flush()
        return token

    async def get_by_hash(self, token_hash: str) -> RefreshToken | None:
        """Retorna o registro de refresh token pelo hash (ou ``None``)."""
        result = await self.db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        return result.scalar_one_or_none()

    async def revoke(self, token: RefreshToken, when: datetime) -> None:
        """Marca um refresh token como revogado (idempotente)."""
        if token.revoked_at is None:
            token.revoked_at = when
            await self.db.flush()

    async def revoke_all_for_user(self, user_id: uuid.UUID, when: datetime) -> None:
        """Revoga todos os refresh tokens ativos do usuário (defesa de reuso)."""
        await self.db.execute(
            update(RefreshToken)
            .where(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked_at.is_(None),
            )
            .values(revoked_at=when)
        )
        await self.db.flush()


__all__ = ["UserRepository", "RefreshTokenRepository"]
