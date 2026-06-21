"""Rotas da feature ``auth`` (Fase 2) — ``router = APIRouter()`` (§3.6).

Prefixo ``/auth`` é aplicado pelo agregador (``app.api.__init__``). Caminhos
relativos. As rotas apenas **orquestram**: validam a entrada (schemas de
``app.schemas.auth``), delegam ao :class:`AuthService` e devolvem os schemas de
saída. As exceções de domínio (``app.core.exceptions``) são convertidas em HTTP
pelo handler global registrado em ``main.py`` (§3.9):

- :class:`ConflictError` → 409 (email/telefone duplicado no register).
- :class:`AuthError` → 401 (credenciais/refresh/reset inválidos).

Endpoints (§4 — Fase 2):
- ``POST /register``                 → público, 201 (usuário + par de tokens).
- ``POST /login``                    → público, 200.
- ``POST /refresh``                  → público (refresh no corpo), 200 (rotação).
- ``POST /logout``                   → JWT access, 204 (revoga o refresh).
- ``GET  /me``                       → JWT access, 200 (usuário + flags de perfis).
- ``POST /password-reset/request``   → público, 200 (resposta genérica; token
  no corpo só fora de produção — §2.2 / §7).
- ``POST /password-reset/confirm``   → público, 204 (troca senha + revoga tokens).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.ratelimit import rate_limit
from app.database.session import get_db
from app.models import User
from app.schemas.auth import (
    AuthResponse,
    LoginIn,
    LogoutIn,
    MeOut,
    PasswordResetConfirmIn,
    PasswordResetRequestIn,
    PasswordResetRequestOut,
    RefreshIn,
    RefreshResponse,
    RegisterIn,
)
from app.services.auth import AuthService

router = APIRouter()


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar usuário (customer/professional)",
    dependencies=[Depends(rate_limit("register", limit=5, window_seconds=60))],
)
async def register(
    payload: RegisterIn,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    """Cria um novo usuário e emite o primeiro par de tokens. ``admin`` nunca via
    register (barrado no schema). Email/telefone duplicado → 409 (§4)."""
    service = AuthService(db)
    return await service.register(payload)


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Autenticar por email e senha",
    dependencies=[Depends(rate_limit("login", limit=10, window_seconds=60))],
)
async def login(
    payload: LoginIn,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    """Valida credenciais, atualiza ``last_login_at`` e emite um par de tokens.
    Credenciais inválidas ou conta inativa → 401 (§4)."""
    service = AuthService(db)
    return await service.login(payload)


@router.post(
    "/refresh",
    response_model=RefreshResponse,
    summary="Rotacionar o par de tokens (refresh)",
)
async def refresh(
    payload: RefreshIn,
    db: AsyncSession = Depends(get_db),
) -> RefreshResponse:
    """Valida e rotaciona o refresh token: revoga o antigo e emite um novo par.
    Token inválido/expirado/revogado → 401 (§2.2 / §4)."""
    service = AuthService(db)
    return await service.refresh(payload.refresh_token)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Revogar o refresh token (logout)",
)
async def logout(
    payload: LogoutIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Revoga o refresh token apresentado (idempotente). Requer access válido; o
    access expira sozinho (§4)."""
    service = AuthService(db)
    await service.logout(payload.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/me",
    response_model=MeOut,
    summary="Usuário autenticado (+ flags de perfis)",
)
async def me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MeOut:
    """Retorna o usuário autenticado com ``has_customer_profile`` /
    ``has_professional_profile`` (§4)."""
    service = AuthService(db)
    return await service.get_me(current_user)


@router.post(
    "/password-reset/request",
    response_model=PasswordResetRequestOut,
    summary="Solicitar reset de senha (resposta genérica, anti-enumeração)",
    dependencies=[Depends(rate_limit("pwreset", limit=5, window_seconds=300))],
)
async def password_reset_request(
    payload: PasswordResetRequestIn,
    db: AsyncSession = Depends(get_db),
) -> PasswordResetRequestOut:
    """SEMPRE responde 200 com mensagem genérica, sem revelar se o e-mail existe
    (anti-enumeração — §2.2). Fora de produção, o ``reset_token`` vem no corpo
    (conveniência de dev/MVP); em produção nunca (irá por e-mail — §7)."""
    service = AuthService(db)
    return await service.password_reset_request(payload)


@router.post(
    "/password-reset/confirm",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Confirmar reset de senha (troca senha + revoga tokens)",
)
async def password_reset_confirm(
    payload: PasswordResetConfirmIn,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Valida o token de reset, troca a senha e revoga todos os refresh tokens do
    usuário. Token inválido/expirado → 401 (§4)."""
    service = AuthService(db)
    await service.password_reset_confirm(payload)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
