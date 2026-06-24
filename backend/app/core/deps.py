"""Dependências de autenticação e RBAC (dono: backbone).

- :func:`get_current_user` — extrai o Bearer token, decodifica (``type=access``),
  carrega o ``User`` ativo do banco. Lança :class:`AuthError` (401) se o token
  for inválido/ausente/expirado ou o usuário não existir/estiver inativo.
- :func:`require_roles` — factory de dependency que exige
  ``current_user.role ∈ roles``, senão :class:`PermissionDeniedError` (403).

As exceções de domínio são convertidas em HTTP pelo handler global (§3.9).
"""

from __future__ import annotations

import uuid

import jwt
from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthError, PermissionDeniedError
from app.core.security import claim_version, decode_token
from app.database.session import get_db
from app.models import User, UserRole, UserStatus


def _active_role_from_claim(user: User, claim: object) -> UserRole:
    """Resolve o papel ATIVO da sessão a partir do claim ``active_role`` do token.

    Papel duplo: o claim é escolhido no login/switch (já validado lá), então
    confiamos nele aqui. Fallback = o papel do banco. ``admin`` só se o usuário
    for realmente admin (nunca alcançável via troca contratante↔profissional).
    """
    if isinstance(claim, str):
        try:
            role = UserRole(claim)
        except ValueError:
            return user.role
        if role in (UserRole.customer, UserRole.professional):
            return role
        if role == UserRole.admin and user.role == UserRole.admin:
            return role
    return user.role


def effective_role(user: User) -> UserRole:
    """Papel efetivo da requisição: o ativo da sessão (se houver) ou o do banco."""
    return getattr(user, "active_role", None) or user.role


def _extract_bearer_token(authorization: str | None) -> str:
    """Extrai o token do header ``Authorization: Bearer <token>``."""
    if not authorization:
        raise AuthError("Credenciais não fornecidas.")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise AuthError("Esquema de autorização inválido.")
    return token


async def get_current_user(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Valida o access token e retorna o ``User`` ativo correspondente."""
    token = _extract_bearer_token(authorization)

    try:
        payload = decode_token(token)
    except jwt.PyJWTError as exc:  # token inválido/expirado/assinatura
        raise AuthError("Token inválido ou expirado.") from exc

    if payload.get("type") != "access":
        raise AuthError("Tipo de token inválido.")

    subject = payload.get("sub")
    if not subject:
        raise AuthError("Token sem sujeito.")

    try:
        user_id = uuid.UUID(str(subject))
    except (ValueError, TypeError) as exc:
        raise AuthError("Identificador de usuário inválido.") from exc

    result = await db.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise AuthError("Usuário não encontrado.")
    if user.status != UserStatus.active:
        raise AuthError("Conta inativa.")

    # Revogação por versão (laudo V3): tokens emitidos antes de um bloqueio/
    # suspensão ou troca de senha carregam um ``ver`` defasado → rejeitados.
    # Tokens antigos (pré-deploy) não têm ``ver`` → tratados como 0 (compatível).
    if claim_version(payload) != (user.token_version or 0):
        raise AuthError("Sessão expirada. Faça login novamente.")

    # Papel ativo da sessão (papel duplo) — atributo transiente, não persistido.
    user.active_role = _active_role_from_claim(user, payload.get("active_role"))
    return user


def require_roles(*roles: UserRole):
    """Factory de dependency: exige que ``current_user.role`` esteja em ``roles``.

    Uso: ``Depends(require_roles(UserRole.admin))``. Retorna o próprio
    ``current_user`` em caso de sucesso; senão 403.
    """
    allowed = set(roles)

    async def _dep(current_user: User = Depends(get_current_user)) -> User:
        if effective_role(current_user) not in allowed:
            raise PermissionDeniedError(
                "Você não tem permissão para acessar este recurso."
            )
        return current_user

    return _dep


__all__ = ["get_current_user", "require_roles", "effective_role"]
