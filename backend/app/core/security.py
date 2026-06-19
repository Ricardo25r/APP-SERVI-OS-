"""Helpers de JWT (esqueleto).

Implementação mínima e correta usando PyJWT e as configurações do contrato.
Regras de RBAC, escopos e validação de roles virão nas próximas fases.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import jwt

from app.core.config import settings

ALGORITHM = settings.JWT_ALGORITHM


def _create_token(
    subject: str | Any,
    expires_delta: timedelta,
    token_type: str,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """Cria um JWT assinado com as claims base (`sub`, `exp`, `iat`, `type`)."""
    now = datetime.now(UTC)
    to_encode: dict[str, Any] = {
        "sub": str(subject),
        "iat": now,
        "exp": now + expires_delta,
        "type": token_type,
    }
    if extra_claims:
        to_encode.update(extra_claims)
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=ALGORITHM)


def create_access_token(
    subject: str | Any,
    expires_delta: timedelta | None = None,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """Gera um access token de curta duração."""
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return _create_token(subject, expires_delta, "access", extra_claims)


def create_refresh_token(
    subject: str | Any,
    expires_delta: timedelta | None = None,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """Gera um refresh token de longa duração."""
    if expires_delta is None:
        expires_delta = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    return _create_token(subject, expires_delta, "refresh", extra_claims)


def decode_token(token: str) -> dict[str, Any]:
    """Decodifica e valida um JWT, retornando o payload.

    Lança `jwt.PyJWTError` (ou subclasse) se o token for inválido/expirado.
    """
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
