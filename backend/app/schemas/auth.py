"""Schemas Pydantic v2 da feature ``auth`` (Fase 2).

DTOs de request/response dos endpoints ``/auth`` (§4 do contrato). Nenhum
schema expõe ``password_hash`` ou ``token_hash`` (§3.3). A validação acontece
sempre no backend — o cliente nunca é confiável (§5.2).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import UserRole, UserStatus

# Papéis permitidos no auto-cadastro (admin NUNCA via /register — §4).
_REGISTERABLE_ROLES = {UserRole.customer, UserRole.professional}


class RegisterIn(BaseModel):
    """Corpo de ``POST /auth/register``."""

    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=8, max_length=20)
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = UserRole.customer

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Nome deve ter ao menos 2 caracteres.")
        return value

    @field_validator("phone")
    @classmethod
    def _normalize_phone(cls, value: str) -> str:
        cleaned = "".join(ch for ch in value if ch.isdigit() or ch == "+")
        if len(cleaned) < 8:
            raise ValueError("Telefone inválido.")
        return cleaned

    @field_validator("role")
    @classmethod
    def _role_allowed(cls, value: UserRole) -> UserRole:
        if value not in _REGISTERABLE_ROLES:
            raise ValueError("Papel inválido para cadastro (use customer ou professional).")
        return value


class LoginIn(BaseModel):
    """Corpo de ``POST /auth/login``."""

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RefreshIn(BaseModel):
    """Corpo de ``POST /auth/refresh``."""

    refresh_token: str = Field(min_length=1)


class LogoutIn(BaseModel):
    """Corpo de ``POST /auth/logout``."""

    refresh_token: str = Field(min_length=1)


class PasswordResetRequestIn(BaseModel):
    """Corpo de ``POST /auth/password-reset/request``."""

    email: EmailStr


class PasswordResetConfirmIn(BaseModel):
    """Corpo de ``POST /auth/password-reset/confirm``."""

    reset_token: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)


class TokenPair(BaseModel):
    """Par de tokens emitido no register/login/refresh."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # validade do access token em segundos


class UserOut(BaseModel):
    """Representação pública de um usuário (sem ``password_hash``)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: EmailStr
    phone: str | None
    role: UserRole
    status: UserStatus
    last_login_at: datetime | None
    created_at: datetime


class MeOut(UserOut):
    """``GET /auth/me`` — usuário + flags de existência de perfis."""

    has_customer_profile: bool = False
    has_professional_profile: bool = False


class AuthResponse(BaseModel):
    """Resposta de ``register``/``login``: usuário + par de tokens."""

    user: UserOut
    tokens: TokenPair


class RefreshResponse(BaseModel):
    """Resposta de ``refresh``: apenas o novo par de tokens."""

    tokens: TokenPair


class PasswordResetRequestOut(BaseModel):
    """Resposta do request de reset (MVP: token devolvido no corpo — §7)."""

    reset_token: str


__all__ = [
    "RegisterIn",
    "LoginIn",
    "RefreshIn",
    "LogoutIn",
    "PasswordResetRequestIn",
    "PasswordResetConfirmIn",
    "TokenPair",
    "UserOut",
    "MeOut",
    "AuthResponse",
    "RefreshResponse",
    "PasswordResetRequestOut",
]
