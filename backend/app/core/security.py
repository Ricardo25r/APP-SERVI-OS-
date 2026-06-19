"""Helpers de segurança: JWT + hashing de senha/refresh token (dono: backbone).

- JWT (PyJWT): access/refresh/password-reset tokens e ``decode_token``.
- Senhas: ``passlib`` (bcrypt) — ``hash_password`` / ``verify_password``.
- Refresh tokens: ``hash_refresh_token`` (SHA-256 hex) para persistir em
  ``refresh_tokens.token_hash`` (nunca armazenar o token cru — §2.2 / §3.11).
"""

from __future__ import annotations

import hashlib
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from passlib.context import CryptContext

from app.core.config import settings

ALGORITHM = settings.JWT_ALGORITHM

# Janela de validade do token de reset de senha (MVP — §7).
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES = 30

# Contexto de hashing de senha (bcrypt) — conforme §3.11 do contrato.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# bcrypt limita a senha a 72 bytes; truncamos de forma determinística.
_BCRYPT_MAX_BYTES = 72


def _prepare_secret(plain: str) -> bytes:
    """Codifica e trunca a senha em 72 bytes (limite do bcrypt)."""
    return plain.encode("utf-8")[:_BCRYPT_MAX_BYTES]


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
        # ``jti`` (nonce único por emissão): garante que dois tokens emitidos no
        # mesmo segundo para o mesmo sujeito sejam distintos. Sem ele, ``iat``/``exp``
        # têm precisão de segundo e refresh tokens emitidos em sequência (ex.:
        # register seguido de login) colidiriam no UNIQUE ``refresh_tokens.token_hash``.
        "jti": uuid.uuid4().hex,
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


def create_password_reset_token(
    subject: str | Any,
    expires_delta: timedelta | None = None,
) -> str:
    """Gera um JWT efêmero de reset de senha (claim ``type=password_reset``).

    MVP: o token é retornado na resposta de ``/auth/password-reset/request``
    (sem envio de email — §7). O confirm valida ``type == password_reset``.
    """
    if expires_delta is None:
        expires_delta = timedelta(minutes=PASSWORD_RESET_TOKEN_EXPIRE_MINUTES)
    return _create_token(subject, expires_delta, "password_reset")


def decode_token(token: str) -> dict[str, Any]:
    """Decodifica e valida um JWT, retornando o payload.

    Lança `jwt.PyJWTError` (ou subclasse) se o token for inválido/expirado.
    """
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])


def hash_password(plain: str) -> str:
    """Gera o hash bcrypt de uma senha em texto puro.

    Usa o ``CryptContext`` do passlib (§3.11). Há fallback para a lib ``bcrypt``
    diretamente caso o backend interno do passlib seja incompatível com a versão
    instalada do ``bcrypt`` (auto-teste do passlib 1.7.x quebra com bcrypt >= 4.1);
    os hashes ``$2b$`` são intercambiáveis entre ambos.
    """
    secret = _prepare_secret(plain)
    try:
        return pwd_context.hash(secret)
    except (ValueError, AttributeError):
        import bcrypt

        return bcrypt.hashpw(secret, bcrypt.gensalt()).decode("ascii")


def verify_password(plain: str, hashed: str) -> bool:
    """Verifica uma senha em texto puro contra o hash bcrypt armazenado."""
    secret = _prepare_secret(plain)
    try:
        return pwd_context.verify(secret, hashed)
    except (ValueError, AttributeError):
        import bcrypt

        try:
            return bcrypt.checkpw(secret, hashed.encode("utf-8"))
        except ValueError:
            return False


def hash_refresh_token(raw_token: str) -> str:
    """Retorna o SHA-256 hex de um refresh token (p/ ``refresh_tokens.token_hash``).

    Nunca armazenar o refresh token cru no banco — apenas este digest (§2.2).
    """
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
