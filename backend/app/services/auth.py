"""Lógica de negócio da feature ``auth`` (§3.5 / §4 / §5.2).

Orquestra repositórios, aplica regras e **commita** (os repositórios só fazem
``add``/``flush``). Lança exceções de domínio (``app.core.exceptions``) que o
handler global converte em HTTP.

Regras-chave:
- Registro valida unicidade de email/phone (409), cria ``User`` com senha
  hasheada e papel recebido (``customer``/``professional``; admin nunca via
  register — barrado já no schema).
- Login valida credenciais (401), atualiza ``last_login_at``, emite par
  access+refresh (refresh persistido **hasheado** em ``refresh_tokens``).
- Refresh valida hash + expiração + não-revogado e **rotaciona** (revoga o
  antigo, emite novo par). Reuso de token revogado → revoga todos os tokens do
  usuário (defesa básica — §2.2).
- Logout revoga o refresh token apresentado.
- Password-reset: ``request`` responde sempre 200 genérico (anti-enumeração —
  §2.2); fora de produção devolve o JWT efêmero no corpo (conveniência de dev/MVP,
  sem email — §7); ``confirm`` troca a senha e revoga todos os refresh tokens.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import httpx
import jwt
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import AuthError, ConflictError
from app.core.mailer import send_email
from app.core.security import (
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.models import (
    CustomerProfile,
    ProfessionalProfile,
    User,
    UserRole,
    UserStatus,
)
from app.repositories.auth import RefreshTokenRepository, UserRepository
from app.schemas.auth import (
    AuthResponse,
    LoginIn,
    MeOut,
    PasswordResetConfirmIn,
    PasswordResetRequestIn,
    PasswordResetRequestOut,
    RefreshResponse,
    RegisterIn,
    TokenPair,
    UserOut,
)

# Validade do access token em segundos (para ``TokenPair.expires_in``).
_ACCESS_TTL_SECONDS = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60


def _aware(dt: datetime) -> datetime:
    """Garante datetime tz-aware (UTC) — Postgres devolve aware; SQLite naive."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


class AuthService:
    """Casos de uso de autenticação."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.users = UserRepository(db)
        self.tokens = RefreshTokenRepository(db)

    # ------------------------------------------------------------------ tokens
    def _issue_token_pair_payload(self, user: User) -> tuple[str, str]:
        """Cria (access, refresh) crus para o usuário (claim ``role`` no access)."""
        access = create_access_token(user.id, extra_claims={"role": user.role.value})
        refresh = create_refresh_token(user.id)
        return access, refresh

    async def _persist_refresh(self, user_id: uuid.UUID, raw_refresh: str) -> None:
        """Persiste o hash do refresh token com sua expiração (sem commit)."""
        payload = decode_token(raw_refresh)
        expires_at = datetime.fromtimestamp(int(payload["exp"]), tz=UTC)
        await self.tokens.create(
            user_id=user_id,
            token_hash=hash_refresh_token(raw_refresh),
            expires_at=expires_at,
        )

    async def _issue_and_store(self, user: User) -> TokenPair:
        """Emite par access+refresh e persiste o refresh hasheado."""
        access, refresh = self._issue_token_pair_payload(user)
        await self._persist_refresh(user.id, refresh)
        return TokenPair(
            access_token=access,
            refresh_token=refresh,
            token_type="bearer",
            expires_in=_ACCESS_TTL_SECONDS,
        )

    # ---------------------------------------------------------------- register
    async def register(self, data: RegisterIn) -> AuthResponse:
        """Cadastra um novo usuário e emite o primeiro par de tokens."""
        email = data.email.lower()

        if await self.users.email_exists(email):
            raise ConflictError("Email já está em uso.")
        if await self.users.phone_exists(data.phone):
            raise ConflictError("Telefone já está em uso.")

        user = User(
            name=data.name,
            email=email,
            phone=data.phone,
            password_hash=hash_password(data.password),
            role=data.role,
            status=UserStatus.active,
        )

        try:
            await self.users.create(user)
            tokens = await self._issue_and_store(user)
            await self.db.commit()
        except IntegrityError as exc:  # corrida no unique parcial de email/phone
            await self.db.rollback()
            raise ConflictError("Email ou telefone já está em uso.") from exc

        await self.db.refresh(user)
        return AuthResponse(user=UserOut.model_validate(user), tokens=tokens)

    # ------------------------------------------------------------------- login
    async def login(self, data: LoginIn) -> AuthResponse:
        """Autentica por email+senha e emite um novo par de tokens."""
        user = await self.users.get_by_email(data.email)
        # Mesma resposta (401) para email inexistente ou senha errada.
        if user is None or not verify_password(data.password, user.password_hash):
            raise AuthError("Credenciais inválidas.")
        if user.status != UserStatus.active:
            raise AuthError("Conta inativa.")

        await self.users.touch_last_login(user, datetime.now(UTC))
        tokens = await self._issue_and_store(user)
        await self.db.commit()
        await self.db.refresh(user)
        return AuthResponse(user=UserOut.model_validate(user), tokens=tokens)

    # ----------------------------------------------------------- login social
    _GOOGLE_TOKENINFO = "https://oauth2.googleapis.com/tokeninfo"

    async def login_with_google(self, id_token: str) -> AuthResponse:
        """Login/cadastro com **Google**: valida o ID token, vincula por
        ``google_sub`` (fallback e-mail) ou cria a conta, e emite o par de tokens
        próprio (mesmo shape do login por senha)."""
        claims = await self._verify_google_id_token(id_token)
        google_sub = str(claims["sub"])
        email = (claims.get("email") or "").lower()
        if not email:
            raise AuthError("O Google não forneceu um e-mail.")
        name = (claims.get("name") or email.split("@")[0] or "Usuário").strip()

        user = await self._get_by_google_sub(google_sub)
        if user is None:
            existing = await self.users.get_by_email(email)
            if existing is not None:
                existing.google_sub = google_sub  # vincula à conta existente
                user = existing

        try:
            if user is None:
                user = User(
                    name=name,
                    email=email,
                    phone=None,
                    password_hash=None,
                    role=UserRole.customer,
                    status=UserStatus.active,
                    auth_provider="google",
                    google_sub=google_sub,
                )
                await self.users.create(user)
            if user.status != UserStatus.active:
                raise AuthError("Conta inativa.")
            await self.users.touch_last_login(user, datetime.now(UTC))
            tokens = await self._issue_and_store(user)
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            raise ConflictError("Conta já existe para este e-mail.") from exc

        await self.db.refresh(user)
        return AuthResponse(user=UserOut.model_validate(user), tokens=tokens)

    async def _get_by_google_sub(self, google_sub: str) -> User | None:
        result = await self.db.execute(
            select(User).where(
                User.google_sub == google_sub, User.deleted_at.is_(None)
            )
        )
        return result.scalar_one_or_none()

    async def _verify_google_id_token(self, id_token: str) -> dict:
        """Valida o ID token do Google via ``tokeninfo`` (assinatura + audiência
        + emissor + e-mail verificado)."""
        allowed = {
            a
            for a in (
                settings.GOOGLE_WEB_CLIENT_ID,
                settings.GOOGLE_IOS_CLIENT_ID,
            )
            if a
        }
        if not allowed:
            raise AuthError("Login com Google não está configurado.")
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    self._GOOGLE_TOKENINFO, params={"id_token": id_token}
                )
        except httpx.HTTPError as exc:
            raise AuthError("Falha ao validar o login do Google.") from exc
        if resp.status_code != 200:
            raise AuthError("Token do Google inválido ou expirado.")
        claims = resp.json()
        if claims.get("aud") not in allowed:
            raise AuthError("Token do Google não é deste aplicativo.")
        if claims.get("iss") not in (
            "accounts.google.com",
            "https://accounts.google.com",
        ):
            raise AuthError("Emissor do token do Google inválido.")
        if str(claims.get("email_verified")).lower() != "true":
            raise AuthError("E-mail do Google não verificado.")
        return claims

    # ----------------------------------------------------------------- refresh
    async def refresh(self, raw_refresh: str) -> RefreshResponse:
        """Valida e **rotaciona** o refresh token (revoga o antigo, emite novo)."""
        try:
            payload = decode_token(raw_refresh)
        except jwt.PyJWTError as exc:
            raise AuthError("Refresh token inválido ou expirado.") from exc

        if payload.get("type") != "refresh":
            raise AuthError("Tipo de token inválido.")

        token_hash = hash_refresh_token(raw_refresh)
        record = await self.tokens.get_by_hash(token_hash)
        if record is None:
            raise AuthError("Refresh token desconhecido.")

        now = datetime.now(UTC)

        # Detecção de reuso: token já revogado reapresentado → revoga todos.
        if record.revoked_at is not None:
            await self.tokens.revoke_all_for_user(record.user_id, now)
            await self.db.commit()
            raise AuthError("Refresh token revogado (possível reuso).")

        if _aware(record.expires_at) <= now:
            raise AuthError("Refresh token expirado.")

        user = await self.users.get_by_id(record.user_id)
        if user is None or user.status != UserStatus.active:
            raise AuthError("Usuário inválido para refresh.")

        # Rotação: revoga o antigo e emite um novo par.
        await self.tokens.revoke(record, now)
        tokens = await self._issue_and_store(user)
        await self.db.commit()
        return RefreshResponse(tokens=tokens)

    # ------------------------------------------------------------------ logout
    async def logout(self, raw_refresh: str) -> None:
        """Revoga o refresh token apresentado (idempotente; o access expira só)."""
        token_hash = hash_refresh_token(raw_refresh)
        record = await self.tokens.get_by_hash(token_hash)
        if record is not None:
            await self.tokens.revoke(record, datetime.now(UTC))
            await self.db.commit()

    # --------------------------------------------------------------------- me
    async def get_me(self, user: User) -> MeOut:
        """Monta o ``MeOut`` do usuário autenticado com flags de perfis."""
        has_customer = await self._profile_exists(CustomerProfile, user.id)
        has_professional = await self._profile_exists(ProfessionalProfile, user.id)
        base = UserOut.model_validate(user).model_dump()
        return MeOut(
            **base,
            has_customer_profile=has_customer,
            has_professional_profile=has_professional,
        )

    async def _profile_exists(self, model, user_id: uuid.UUID) -> bool:
        """Existe perfil (não soft-deleted) deste tipo para o usuário?"""
        result = await self.db.execute(
            select(model.id).where(
                model.user_id == user_id, model.deleted_at.is_(None)
            )
        )
        return result.first() is not None

    # ----------------------------------------------------------- password reset
    async def password_reset_request(
        self, data: PasswordResetRequestIn
    ) -> PasswordResetRequestOut:
        """Solicita reset de senha sem revelar se o email existe (anti-enumeração).

        SEMPRE responde de forma genérica (resposta uniforme — §2.2): nunca
        lança 404, independentemente de o usuário existir. Isso impede que um
        atacante enumere e-mails cadastrados pela resposta da API.

        E-mail: quando o usuário existe, envia o link de redefinição por e-mail
        (best-effort, via SMTP configurado). Por conveniência de dev/MVP, o
        ``reset_token`` também é incluído no corpo apenas quando
        ``settings.APP_ENV != "production"``. Em produção o token NUNCA é
        retornado — só chega pelo e-mail.
        """
        reset_token: str | None = None
        user = await self.users.get_by_email(data.email)
        if user is not None:
            token = create_password_reset_token(user.id)
            self._send_reset_email(user, token)
            if settings.APP_ENV != "production":
                reset_token = token
        return PasswordResetRequestOut(reset_token=reset_token)

    @staticmethod
    def _send_reset_email(user: User, token: str) -> None:
        """Envia o e-mail de redefinição com o link (best-effort, não bloqueia)."""
        base = settings.FRONTEND_URL.rstrip("/")
        link = f"{base}/recuperar-senha?token={token}"
        body = (
            f"Olá, {user.name}.\n\n"
            "Recebemos um pedido para redefinir a senha da sua conta no "
            "FazTudo.\n"
            "Para criar uma nova senha, acesse o link abaixo (válido por 30 "
            "minutos):\n\n"
            f"{link}\n\n"
            "Se você não fez esse pedido, ignore este e-mail — sua senha "
            "continua a mesma.\n"
        )
        send_email(user.email, "[FazTudo] Redefinição de senha", body)

    async def password_reset_confirm(self, data: PasswordResetConfirmIn) -> None:
        """Valida o token de reset, troca a senha e revoga todos os refresh."""
        try:
            payload = decode_token(data.reset_token)
        except jwt.PyJWTError as exc:
            raise AuthError("Token de reset inválido ou expirado.") from exc

        if payload.get("type") != "password_reset":
            raise AuthError("Tipo de token inválido.")

        subject = payload.get("sub")
        try:
            user_id = uuid.UUID(str(subject))
        except (ValueError, TypeError) as exc:
            raise AuthError("Token de reset inválido.") from exc

        user = await self.users.get_by_id(user_id)
        if user is None:
            raise AuthError("Usuário não encontrado.")

        user.password_hash = hash_password(data.new_password)
        await self.db.flush()
        # Invalida sessões existentes após troca de senha.
        await self.tokens.revoke_all_for_user(user.id, datetime.now(UTC))
        await self.db.commit()


__all__ = ["AuthService"]
