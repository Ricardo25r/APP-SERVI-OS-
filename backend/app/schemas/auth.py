"""Schemas Pydantic v2 da feature ``auth`` (Fase 2).

DTOs de request/response dos endpoints ``/auth`` (§4 do contrato). Nenhum
schema expõe ``password_hash`` ou ``token_hash`` (§3.3). A validação acontece
sempre no backend — o cliente nunca é confiável (§5.2).
"""

from __future__ import annotations

import re
import uuid
from datetime import date, datetime

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

# Limites de idade plausíveis (maioridade obrigatória; teto sanidade).
_MIN_AGE = 18
_MAX_AGE = 110


def _validate_birth_date(value: date) -> date:
    """Valida data de nascimento: não-futura, idade entre 18 e 110 anos."""
    today = date.today()
    if value > today:
        raise ValueError("Data de nascimento não pode ser no futuro.")
    age = (
        today.year
        - value.year
        - ((today.month, today.day) < (value.month, value.day))
    )
    if age < _MIN_AGE:
        raise ValueError("É necessário ter pelo menos 18 anos.")
    if age > _MAX_AGE:
        raise ValueError("Data de nascimento inválida.")
    return value


# Gênero: conjunto fechado (opcional). Documento: CPF (11) ou CNPJ (14).
_ALLOWED_GENDERS = {"masculino", "feminino", "outro", "nao_informado"}


def _digits(value: str) -> str:
    return re.sub(r"\D", "", value)


def _valid_cpf(cpf: str) -> bool:
    if len(cpf) != 11 or cpf == cpf[0] * 11:
        return False
    for size in (9, 10):
        total = sum(int(cpf[i]) * (size + 1 - i) for i in range(size))
        check = (total * 10) % 11 % 10
        if check != int(cpf[size]):
            return False
    return True


def _valid_cnpj(cnpj: str) -> bool:
    if len(cnpj) != 14 or cnpj == cnpj[0] * 14:
        return False
    w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    for weights, size in ((w1, 12), (w2, 13)):
        total = sum(int(cnpj[i]) * weights[i] for i in range(size))
        check = 11 - (total % 11)
        check = 0 if check >= 10 else check
        if check != int(cnpj[size]):
            return False
    return True


def _validate_document(value: str | None) -> str | None:
    """Limpa e valida CPF (11 dígitos) ou CNPJ (14) por dígito verificador."""
    if not value:
        return None
    digits = _digits(value)
    if not digits:
        return None
    if len(digits) == 11 and _valid_cpf(digits):
        return digits
    if len(digits) == 14 and _valid_cnpj(digits):
        return digits
    raise ValueError("CPF ou CNPJ inválido.")


def _validate_gender(value: str | None) -> str | None:
    if not value:
        return None
    v = value.strip().lower()
    if v not in _ALLOWED_GENDERS:
        raise ValueError("Gênero inválido.")
    return v


class RegisterIn(BaseModel):
    """Corpo de ``POST /auth/register``."""

    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=8, max_length=20)
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = UserRole.customer
    # Opcional no schema (login social não informa); o frontend exige para
    # profissional. Validada (maioridade) quando presente.
    birth_date: date | None = None
    gender: str | None = None
    document: str | None = None
    # Código de indicação de quem indicou (indique e ganhe). Opcional.
    referral_code: str | None = None

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

    @field_validator("birth_date")
    @classmethod
    def _check_birth_date(cls, value: date | None) -> date | None:
        return _validate_birth_date(value) if value is not None else value

    @field_validator("gender")
    @classmethod
    def _check_gender(cls, value: str | None) -> str | None:
        return _validate_gender(value)

    @field_validator("document")
    @classmethod
    def _check_document(cls, value: str | None) -> str | None:
        return _validate_document(value)


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


class BirthDateIn(BaseModel):
    """Corpo de ``POST /auth/birth-date`` — data de nascimento do usuário."""

    birth_date: date

    @field_validator("birth_date")
    @classmethod
    def _check(cls, value: date) -> date:
        return _validate_birth_date(value)


class SwitchRoleIn(BaseModel):
    """Corpo de ``POST /auth/switch-role`` — papel ativo desejado (papel duplo)."""

    active_role: UserRole


class ReferralInfoOut(BaseModel):
    """``GET /users/me/referral`` — indique e ganhe."""

    code: str
    total_referrals: int
    credits_earned: int


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
    # Data de nascimento (+ `age` derivada). None até o usuário preencher.
    birth_date: date | None = None
    # Papel ATIVO da sessão (papel duplo). Espelha o claim do token; pode diferir
    # de `role` (papel-base do banco). None quando não há sessão.
    active_role: UserRole | None = None
    gender: str | None = None
    document: str | None = None

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

    @computed_field  # type: ignore[prop-decorator]
    @property
    def age(self) -> int | None:
        """Idade em anos derivada de ``birth_date`` (None se não informada)."""
        if self.birth_date is None:
            return None
        today = date.today()
        return (
            today.year
            - self.birth_date.year
            - (
                (today.month, today.day)
                < (self.birth_date.month, self.birth_date.day)
            )
        )


class MeOut(UserOut):
    """``GET /auth/me`` — usuário + flags de perfis + papéis disponíveis."""

    has_customer_profile: bool = False
    has_professional_profile: bool = False
    # Papéis que o usuário pode assumir (papel duplo). Mais de 1 → seletor/troca.
    available_roles: list[UserRole] = []


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
