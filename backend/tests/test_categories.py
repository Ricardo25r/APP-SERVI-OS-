"""Testes async da feature ``categories`` (Fase 3).

Cobre (conforme a tarefa):
- ``GET /categories`` público lista apenas categorias ativas (default);
- ``POST /categories`` sem ser admin → 403 (RBAC §5.2);
- ``POST /categories`` como admin → cria (201).

Cobertura extra leve (mesma infra): detalhe, geração de slug, filtro de
inativas/``q``, e ``DELETE`` (desativação lógica) por admin.

Estratégia (self-contained, espelha ``tests/test_leads.py``):
- engine SQLite async em memória (``aiosqlite``); ``Base.metadata.create_all``
  monta o schema (os tipos Postgres têm fallback portável no SQLite);
- ``app.dependency_overrides[get_db]`` injeta a sessão de teste;
- usuários/categorias são semeados direto via ORM;
- a autenticação usa ``create_access_token`` (claim ``type=access``) — o mesmo
  fluxo de ``get_current_user`` do backbone.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator

import httpx
import pytest
import pytest_asyncio
from app.core.security import create_access_token
from app.database.session import get_db
from app.main import app
from app.models import (
    Base,
    Category,
    CategoryTier,
    User,
    UserRole,
    UserStatus,
)
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)


# --------------------------------------------------------------------------- #
# Infra de teste (engine SQLite em memória, schema novo por teste)
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


def _auth(user: User) -> dict[str, str]:
    """Header Authorization com um access token válido para o usuário."""
    token = create_access_token(str(user.id), extra_claims={"role": user.role.value})
    return {"Authorization": f"Bearer {token}"}


# --------------------------------------------------------------------------- #
# Seed helpers
# --------------------------------------------------------------------------- #
async def _make_user(
    session: AsyncSession,
    *,
    role: UserRole,
    email: str,
    name: str = "Test",
) -> User:
    user = User(
        name=name,
        email=email,
        password_hash="x",
        role=role,
        status=UserStatus.active,
    )
    session.add(user)
    await session.flush()
    return user


async def _make_category(
    session: AsyncSession,
    *,
    slug: str,
    tier: CategoryTier = CategoryTier.medium,
    name: str | None = None,
    active: bool = True,
) -> Category:
    category = Category(name=name or slug, slug=slug, tier=tier, active=active)
    session.add(category)
    await session.flush()
    return category


# --------------------------------------------------------------------------- #
# Testes
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_list_public_returns_only_active(
    client: httpx.AsyncClient, session_maker
) -> None:
    """``GET /categories`` é público e por padrão lista apenas as ativas (§4)."""
    async with session_maker() as s:
        await _make_category(s, slug="eletricista", tier=CategoryTier.medium)
        await _make_category(s, slug="diarista", tier=CategoryTier.simple)
        await _make_category(s, slug="antiga", tier=CategoryTier.simple, active=False)
        await s.commit()

    # Sem header de autenticação: endpoint público.
    resp = await client.get("/api/v1/categories/")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert isinstance(body, list)
    slugs = {item["slug"] for item in body}
    assert slugs == {"eletricista", "diarista"}  # inativa fora
    # Ordenação por name (asc) e shape do CategoryOut.
    assert [item["name"] for item in body] == sorted(item["name"] for item in body)
    assert set(body[0].keys()) == {
        "id",
        "name",
        "slug",
        "tier",
        "active",
        "group",
    }


@pytest.mark.asyncio
async def test_list_include_inactive_and_query_filter(
    client: httpx.AsyncClient, session_maker
) -> None:
    """``?active=false`` inclui inativas; ``?q=`` filtra por name/slug."""
    async with session_maker() as s:
        await _make_category(s, slug="encanador", tier=CategoryTier.medium)
        await _make_category(s, slug="antiga", tier=CategoryTier.simple, active=False)
        await s.commit()

    all_resp = await client.get("/api/v1/categories/?active=false")
    assert all_resp.status_code == 200
    assert {c["slug"] for c in all_resp.json()} == {"encanador", "antiga"}

    q_resp = await client.get("/api/v1/categories/?q=encan")
    assert q_resp.status_code == 200
    q_body = q_resp.json()
    assert len(q_body) == 1
    assert q_body[0]["slug"] == "encanador"


@pytest.mark.asyncio
async def test_get_detail_public_and_404(
    client: httpx.AsyncClient, session_maker
) -> None:
    """``GET /categories/{id}`` é público; id inexistente → 404."""
    async with session_maker() as s:
        cat = await _make_category(s, slug="pintor", tier=CategoryTier.medium)
        await s.commit()
        cat_id = str(cat.id)

    ok = await client.get(f"/api/v1/categories/{cat_id}")
    assert ok.status_code == 200, ok.text
    assert ok.json()["slug"] == "pintor"

    missing = await client.get(f"/api/v1/categories/{uuid.uuid4()}")
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_post_without_admin_is_forbidden(
    client: httpx.AsyncClient, session_maker
) -> None:
    """``POST /categories`` exige admin: customer/professional → 403 (§5.2)."""
    async with session_maker() as s:
        customer = await _make_user(s, role=UserRole.customer, email="cust@t.com")
        professional = await _make_user(
            s, role=UserRole.professional, email="pro@t.com"
        )
        await s.commit()

    payload = {"name": "Jardinagem", "tier": CategoryTier.simple.value}

    # Sem token: não autenticado → 401.
    anon = await client.post("/api/v1/categories/", json=payload)
    assert anon.status_code == 401, anon.text

    # Customer: 403.
    cust = await client.post(
        "/api/v1/categories/", headers=_auth(customer), json=payload
    )
    assert cust.status_code == 403, cust.text

    # Professional: 403.
    pro = await client.post(
        "/api/v1/categories/", headers=_auth(professional), json=payload
    )
    assert pro.status_code == 403, pro.text

    # Nada foi criado.
    listing = await client.get("/api/v1/categories/?active=false")
    assert listing.json() == []


@pytest.mark.asyncio
async def test_admin_creates_category(
    client: httpx.AsyncClient, session_maker
) -> None:
    """``POST /categories`` como admin cria a categoria (201) e gera slug."""
    async with session_maker() as s:
        admin = await _make_user(s, role=UserRole.admin, email="admin@t.com")
        await s.commit()

    resp = await client.post(
        "/api/v1/categories/",
        headers=_auth(admin),
        json={"name": "Reforma & Construção", "tier": CategoryTier.premium.value},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["name"] == "Reforma & Construção"
    assert body["slug"] == "reforma-construcao"  # gerado (kebab-case sem acento)
    assert body["tier"] == CategoryTier.premium.value
    assert body["active"] is True
    assert uuid.UUID(body["id"])  # id válido

    # Aparece na listagem pública.
    listing = await client.get("/api/v1/categories/")
    assert {c["slug"] for c in listing.json()} == {"reforma-construcao"}


@pytest.mark.asyncio
async def test_admin_updates_and_deactivates_category(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Admin atualiza (PATCH) e desativa (DELETE → active=False, sem hard delete)."""
    async with session_maker() as s:
        admin = await _make_user(s, role=UserRole.admin, email="admin2@t.com")
        cat = await _make_category(s, slug="babá", tier=CategoryTier.medium)
        await s.commit()
        cat_id = str(cat.id)

    # PATCH (admin): troca tier.
    patched = await client.patch(
        f"/api/v1/categories/{cat_id}",
        headers=_auth(admin),
        json={"tier": CategoryTier.premium.value},
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["tier"] == CategoryTier.premium.value

    # DELETE (admin): desativa (204).
    deleted = await client.delete(
        f"/api/v1/categories/{cat_id}", headers=_auth(admin)
    )
    assert deleted.status_code == 204

    # Some da listagem pública (default só ativas)...
    public = await client.get("/api/v1/categories/")
    assert public.json() == []
    # ...mas continua existindo (sem hard delete) com active=False.
    with_inactive = await client.get("/api/v1/categories/?active=false")
    rows = with_inactive.json()
    assert len(rows) == 1
    assert rows[0]["active"] is False
