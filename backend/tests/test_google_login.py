"""Testes do login com Google (``AuthService.login_with_google``) com o
``tokeninfo`` do Google mockado (sem rede)."""

from __future__ import annotations

from collections.abc import AsyncGenerator

import httpx
import pytest
import pytest_asyncio
from app.core.config import settings
from app.core.exceptions import AuthError
from app.models import Base, User
from app.services.auth import AuthService
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)


@pytest_asyncio.fixture
async def session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False
    )
    async with maker() as s:
        yield s
    await engine.dispose()


def _fake_tokeninfo(claims: dict):
    async def fake_get(self, url, **kwargs):  # noqa: ANN001
        return httpx.Response(200, json=claims, request=httpx.Request("GET", url))

    return fake_get


@pytest.mark.asyncio
async def test_google_login_creates_then_relogins(session, monkeypatch) -> None:
    monkeypatch.setattr(settings, "GOOGLE_WEB_CLIENT_ID", "test-client")
    monkeypatch.setattr(settings, "GOOGLE_IOS_CLIENT_ID", "")
    claims = {
        "aud": "test-client",
        "iss": "accounts.google.com",
        "sub": "g-123",
        "email": "x@gmail.com",
        "email_verified": "true",
        "name": "Fulano",
    }
    monkeypatch.setattr(httpx.AsyncClient, "get", _fake_tokeninfo(claims))

    resp = await AuthService(session).login_with_google("tok")
    assert resp.user.email == "x@gmail.com"
    assert resp.tokens.access_token

    # 2º login com o mesmo google_sub → mesmo usuário (sem duplicar).
    resp2 = await AuthService(session).login_with_google("tok")
    assert resp2.user.id == resp.user.id
    total = (
        await session.execute(select(func.count()).select_from(User))
    ).scalar_one()
    assert total == 1


@pytest.mark.asyncio
async def test_google_login_rejects_wrong_audience(session, monkeypatch) -> None:
    monkeypatch.setattr(settings, "GOOGLE_WEB_CLIENT_ID", "test-client")
    monkeypatch.setattr(settings, "GOOGLE_IOS_CLIENT_ID", "")
    claims = {
        "aud": "OUTRO-APP",
        "iss": "accounts.google.com",
        "sub": "g-9",
        "email": "y@gmail.com",
        "email_verified": "true",
    }
    monkeypatch.setattr(httpx.AsyncClient, "get", _fake_tokeninfo(claims))
    with pytest.raises(AuthError):
        await AuthService(session).login_with_google("tok")


@pytest.mark.asyncio
async def test_google_login_not_configured(session, monkeypatch) -> None:
    monkeypatch.setattr(settings, "GOOGLE_WEB_CLIENT_ID", "")
    monkeypatch.setattr(settings, "GOOGLE_IOS_CLIENT_ID", "")
    with pytest.raises(AuthError):
        await AuthService(session).login_with_google("tok")
