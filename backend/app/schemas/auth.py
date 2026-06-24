"""Schemas Pydantic v2 da feature ``auth`` (Fase 2).

DTOs de request/response dos endpoints ``/auth`` (§4 do contrato). Nenhum
schema expõe ``password_hash`` ou ``token_hash`` (§3.3). A validação acontece
sempre no backend — o cliente nunca é confiável (§5.2).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    computed_field,
    field_validator,
)

from app.core.config import settings
from app.core.storage import presigned_get_url
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


class GoogleAuthIn(BaseModel):
    """Corpo de ``POST /auth/google`` — o **ID token** do Google (GIS web ou
    plugin nativo). O backend valida assinatura/audiência e emite o JWT próprio."""

    id_token: str = Field(min_length=10)
    role: str | None = Field(
        default=None,
        description="Papel p/ contas NOVAS: 'customer' | 'professional'. "
        "Ignorado se a conta já existe.",
    )


class AppleAuthIn(BaseModel):
    """Corpo de ``POST /auth/apple`` — o **ID token** do Sign in with Apple. O
    ``name`` só é enviado pela Apple na 1ª autorização (opcional)."""

    id_token: str = Field(min_length=10)
    name: str | None = Field(default=None, max_length=120)
    role: str | None = Field(
        default=None,
        description="Papel p/ contas NOVAS: 'customer' | 'professional'. "
        "Ignorado se a conta já existe.",
    )


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
    # Chave interna da foto (não exposta); a URL presignada vem em avatar_url.
    avatar_key: str | None = Field(default=None, exclude=True)
    # Versão dos termos que o usuário aceitou (+ flag `terms_accepted` derivada).
    terms_version: str | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def avatar_url(self) -> str | None:
        if not self.avatar_key:
            return None
        try:
            return presigned_get_url(self.avatar_key)
        except Exception:  # noqa: BLE001 - URL é best-effort
            return None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def terms_accepted(self) -> bool:
        """True se o usuário já aceitou a versão VIGENTE dos Termos de Uso."""
        return self.terms_version == settings.TERMS_VERSION


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
    """Resposta do request de reset (anti-enumeração — §2.2).

    ``message`` é sempre genérica (não revela se o e-mail existe). ``reset_token``
    é uma conveniência de dev/MVP: vem preenchido apenas fora de produção e
    quando o usuário existe; em produção é sempre ``None`` (o token irá por
    e-mail quando o notification-engine existir — §7).
    """

    message: str = "Se o e-mail existir, enviaremos instruções para redefinir a senha."
    reset_token: str | None = None


__all__ = [
    "RegisterIn",
    "LoginIn",
    "GoogleAuthIn",
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
