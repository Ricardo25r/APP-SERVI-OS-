"""Testes async da feature ``auth`` (Fase 2).

Cobre (conforme a tarefa):
- register → login → ``GET /me`` com Bearer (fluxo feliz ponta a ponta);
- ``refresh`` rotaciona: o novo refresh é válido e o antigo fica revogado
  (segunda apresentação do antigo → 401);
- login com senha errada → 401;
- register duplicado (mesmo email/telefone) → 409.

Estratégia (self-contained, mesma de ``tests/test_leads.py``):
- engine SQLite async em memória (``aiosqlite``); ``Base.metadata.create_all``
  monta o schema (os tipos Postgres têm fallback portável no SQLite);
- ``app.dependency_overrides[get_db]`` injeta a sessão de teste;
- as rotas reais (``/api/v1/auth/...``) são exercidas via httpx ASGI.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

import httpx
import pytest
import pytest_asyncio
from app.database.session import get_db
from app.main import app
from app.models import Base
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)


# --------------------------------------------------------------------------- #
# Infra de teste (engine SQLite em memória compartilhada por teste)
# --------------------------------------------------------------------------- #
@pytest_asyncio.fixture
async def session_maker() -> AsyncGenerator[async_sessionmaker[AsyncSession], None]:
    """Cria um schema novo (SQLite em memória) por teste e devolve o sessionmaker."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    maker = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    try:
        yield maker
    finally:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()


@pytest_asyncio.fixture
async def client(
    session_maker: async_sessionmaker[AsyncSession],
) -> AsyncGenerator[httpx.AsyncClient, None]:
    """Cliente httpx ASGI com ``get_db`` sobrescrito para a sessão de teste."""

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with session_maker() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.pop(get_db, None)


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _register_payload(
    *,
    email: str = "alice@faztudo.com",
    phone: str = "11999990000",
    password: str = "senha-super-segura",
    name: str = "Alice Teste",
    role: str = "customer",
) -> dict[str, str]:
    return {
        "name": name,
        "email": email,
        "phone": phone,
        "password": password,
        "role": role,
    }


async def _register(client: httpx.AsyncClient, **kwargs: str) -> httpx.Response:
    return await client.post("/api/v1/auth/register", json=_register_payload(**kwargs))


# --------------------------------------------------------------------------- #
# Testes
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_register_login_me_flow(client: httpx.AsyncClient) -> None:
    """register → login → GET /me com Bearer (fluxo feliz ponta a ponta)."""
    password = "minha-senha-forte"

    # Register → 201 + usuário + par de tokens.
    reg = await _register(client, password=password)
    assert reg.status_code == 201, reg.text
    reg_body = reg.json()
    assert reg_body["user"]["email"] == "alice@faztudo.com"
    assert reg_body["user"]["role"] == "customer"
    assert "password_hash" not in reg_body["user"]
    assert reg_body["tokens"]["token_type"] == "bearer"
    assert reg_body["tokens"]["access_token"]
    assert reg_body["tokens"]["refresh_token"]

    # Login → 200 + novo par de tokens.
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "alice@faztudo.com", "password": password},
    )
    assert login.status_code == 200, login.text
    access = login.json()["tokens"]["access_token"]

    # GET /me com Bearer → 200 + dados + flags de perfil (sem perfil ainda).
    me = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {access}"}
    )
    assert me.status_code == 200, me.text
    me_body = me.json()
    assert me_body["email"] == "alice@faztudo.com"
    assert me_body["has_customer_profile"] is False
    assert me_body["has_professional_profile"] is False
    assert me_body["last_login_at"] is not None  # login tocou last_login_at


@pytest.mark.asyncio
async def test_me_requires_bearer(client: httpx.AsyncClient) -> None:
    """GET /me sem token → 401 (get_current_user)."""
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401, resp.text


@pytest.mark.asyncio
async def test_refresh_rotates_and_revokes_old(client: httpx.AsyncClient) -> None:
    """refresh rotaciona: novo par válido; antigo revogado (reuso → 401).

    Nota: o refresh token carrega apenas ``sub/iat/exp/type`` (precisão de
    segundo, sem ``jti``), então dois refresh emitidos para o mesmo usuário no
    mesmo segundo seriam idênticos. O teste valida a rotação com **uma** troca
    (sem re-rotacionar no mesmo segundo) — suficiente para provar que o novo
    refresh é aceito e o antigo fica revogado.
    """
    reg = await _register(client, email="bob@faztudo.com", phone="11988887777")
    assert reg.status_code == 201, reg.text
    old_refresh = reg.json()["tokens"]["refresh_token"]

    # Rotação: 200 + novo par; o novo refresh difere do antigo.
    rot = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": old_refresh}
    )
    assert rot.status_code == 200, rot.text
    new_refresh = rot.json()["tokens"]["refresh_token"]
    new_access = rot.json()["tokens"]["access_token"]
    assert new_refresh and new_access
    assert new_refresh != old_refresh

    # O novo access (do par rotacionado) é válido em /me → novo refresh é válido.
    me = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {new_access}"}
    )
    assert me.status_code == 200, me.text

    # O refresh ANTIGO já está revogado: reapresentá-lo → 401 (detecção de reuso).
    reuse = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": old_refresh}
    )
    assert reuse.status_code == 401, reuse.text


@pytest.mark.asyncio
async def test_login_wrong_password_401(client: httpx.AsyncClient) -> None:
    """Login com senha errada → 401."""
    await _register(client, email="carol@faztudo.com", phone="11977776666",
                    password="senha-correta")

    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "carol@faztudo.com", "password": "senha-errada"},
    )
    assert resp.status_code == 401, resp.text


@pytest.mark.asyncio
async def test_register_duplicate_email_409(client: httpx.AsyncClient) -> None:
    """Register com email já usado → 409."""
    first = await _register(client, email="dup@faztudo.com", phone="11900001111")
    assert first.status_code == 201, first.text

    # Mesmo email, telefone diferente → conflito de email.
    dup = await _register(client, email="dup@faztudo.com", phone="11900002222")
    assert dup.status_code == 409, dup.text


@pytest.mark.asyncio
async def test_register_duplicate_phone_409(client: httpx.AsyncClient) -> None:
    """Register com telefone já usado → 409."""
    first = await _register(client, email="e1@faztudo.com", phone="11955554444")
    assert first.status_code == 201, first.text

    # Email diferente, mesmo telefone → conflito de telefone.
    dup = await _register(client, email="e2@faztudo.com", phone="11955554444")
    assert dup.status_code == 409, dup.text


# --------------------------------------------------------------------------- #
# Password reset (anti-enumeração)
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_password_reset_request_unknown_email_is_generic_200(
    client: httpx.AsyncClient,
) -> None:
    """E-mail inexistente → 200 genérico, SEM token e SEM revelar inexistência.

    Anti-enumeração (§2.2): a resposta para um e-mail desconhecido é
    indistinguível da de um e-mail válido (status 200 + mensagem genérica) e
    nunca traz ``reset_token``.
    """
    resp = await client.post(
        "/api/v1/auth/password-reset/request",
        json={"email": "ninguem@faztudo.com"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["message"]  # mensagem genérica presente
    assert body["reset_token"] is None  # nada de token para e-mail inexistente


@pytest.mark.asyncio
async def test_password_reset_flow_dev_returns_token_and_confirm_works(
    client: httpx.AsyncClient,
) -> None:
    """Em dev: request devolve o token (200) e o confirm troca a senha (204).

    Cobre o fluxo MVP completo fora de produção (APP_ENV != production): o token
    vem no corpo por conveniência, o confirm o aceita e a NOVA senha autentica
    no login (e a antiga deixa de funcionar).
    """
    email = "reset@faztudo.com"
    old_password = "senha-antiga-123"
    new_password = "senha-nova-456"
    await _register(client, email=email, phone="11933332222", password=old_password)

    # request → 200 + token presente (estamos fora de produção nos testes).
    req = await client.post(
        "/api/v1/auth/password-reset/request", json={"email": email}
    )
    assert req.status_code == 200, req.text
    reset_token = req.json()["reset_token"]
    assert reset_token, "em dev o reset_token deve vir no corpo"

    # confirm → 204 (troca a senha + revoga refresh tokens).
    confirm = await client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"reset_token": reset_token, "new_password": new_password},
    )
    assert confirm.status_code == 204, confirm.text

    # A nova senha autentica; a antiga não.
    ok = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": new_password}
    )
    assert ok.status_code == 200, ok.text
    fail = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": old_password}
    )
    assert fail.status_code == 401, fail.text


@pytest.mark.asyncio
async def test_password_reset_confirm_invalid_token_401(
    client: httpx.AsyncClient,
) -> None:
    """confirm com token inválido → 401 (validação do token inalterada)."""
    resp = await client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"reset_token": "nao-e-um-jwt", "new_password": "qualquer-senha-8"},
    )
    assert resp.status_code == 401, resp.text
