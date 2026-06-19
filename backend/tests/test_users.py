"""Testes async da feature ``users`` (perfis — Fase 3).

Cobre (conforme a tarefa):
- criar customer-profile (role customer) + 409 ao repetir + 403 para professional;
- criar professional-profile (role professional) **+ wallet criada (saldo 0)**;
- ownership (só altera o próprio perfil) e RBAC (403 papel errado);
- setar/obter categorias do profissional (N:N) + 422 categoria inexistente;
- perfil público (``GET /users/{user_id}/professional-profile``);
- 404 para perfil inexistente.

Estratégia idêntica a ``test_leads.py`` (self-contained, sem Postgres real):
- engine SQLite async em memória (``aiosqlite``); ``Base.metadata.create_all``;
- ``app.dependency_overrides[get_db]`` injeta a sessão de teste;
- usuários/categorias semeados via ORM;
- autenticação via ``create_access_token`` (claim ``type=access``).
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
    AvailabilityStatus,
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
# Infra de teste (engine SQLite em memória por teste)
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
    phone: str | None = None,
) -> User:
    user = User(
        name=name,
        email=email,
        phone=phone,
        password_hash="x",
        role=role,
        status=UserStatus.active,
    )
    session.add(user)
    await session.flush()
    return user


async def _make_category(
    session: AsyncSession, *, slug: str, tier: CategoryTier, name: str | None = None
) -> Category:
    category = Category(name=name or slug, slug=slug, tier=tier, active=True)
    session.add(category)
    await session.flush()
    return category


# --------------------------------------------------------------------------- #
# Customer profile
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_customer_creates_profile(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Customer cria o perfil de contratante (201) e o lê de volta (200)."""
    async with session_maker() as s:
        customer = await _make_user(s, role=UserRole.customer, email="c1@t.com")
        await s.commit()

    resp = await client.post(
        "/api/v1/users/me/customer-profile",
        headers=_auth(customer),
        json={"city": "Ariquemes", "state": "ro"},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["city"] == "Ariquemes"
    assert body["state"] == "RO"  # normalizado para maiúsculas
    assert body["user_id"] == str(customer.id)

    got = await client.get(
        "/api/v1/users/me/customer-profile", headers=_auth(customer)
    )
    assert got.status_code == 200
    assert got.json()["id"] == body["id"]


@pytest.mark.asyncio
async def test_customer_profile_duplicate_409(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Criar o customer-profile duas vezes → 409."""
    async with session_maker() as s:
        customer = await _make_user(s, role=UserRole.customer, email="c2@t.com")
        await s.commit()

    payload = {"city": "Ariquemes", "state": "RO"}
    first = await client.post(
        "/api/v1/users/me/customer-profile",
        headers=_auth(customer),
        json=payload,
    )
    assert first.status_code == 201, first.text
    dup = await client.post(
        "/api/v1/users/me/customer-profile",
        headers=_auth(customer),
        json=payload,
    )
    assert dup.status_code == 409


@pytest.mark.asyncio
async def test_professional_cannot_create_customer_profile_403(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Professional tentando criar customer-profile → 403 (papel errado)."""
    async with session_maker() as s:
        pro = await _make_user(s, role=UserRole.professional, email="p0@t.com")
        await s.commit()

    resp = await client.post(
        "/api/v1/users/me/customer-profile",
        headers=_auth(pro),
        json={"city": "Ariquemes", "state": "RO"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_customer_profile_not_found_404(
    client: httpx.AsyncClient, session_maker
) -> None:
    """GET sem perfil criado → 404."""
    async with session_maker() as s:
        customer = await _make_user(s, role=UserRole.customer, email="c3@t.com")
        await s.commit()

    resp = await client.get(
        "/api/v1/users/me/customer-profile", headers=_auth(customer)
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_customer_profile_update(
    client: httpx.AsyncClient, session_maker
) -> None:
    """PATCH atualiza apenas o próprio perfil."""
    async with session_maker() as s:
        customer = await _make_user(s, role=UserRole.customer, email="c4@t.com")
        await s.commit()

    await client.post(
        "/api/v1/users/me/customer-profile",
        headers=_auth(customer),
        json={"city": "Ariquemes", "state": "RO"},
    )
    patched = await client.patch(
        "/api/v1/users/me/customer-profile",
        headers=_auth(customer),
        json={"city": "Porto Velho"},
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["city"] == "Porto Velho"
    assert patched.json()["state"] == "RO"  # inalterado


# --------------------------------------------------------------------------- #
# Professional profile + wallet
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_professional_creates_profile_and_wallet(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Professional cria o perfil → wallet criada automaticamente (saldo 0)."""
    async with session_maker() as s:
        pro = await _make_user(s, role=UserRole.professional, email="p1@t.com")
        cat = await _make_category(s, slug="eletricista", tier=CategoryTier.medium)
        await s.commit()

    resp = await client.post(
        "/api/v1/users/me/professional-profile",
        headers=_auth(pro),
        json={
            "headline": "Eletricista experiente",
            "bio": "10 anos de experiência.",
            "city": "Ariquemes",
            "state": "ro",
            "service_radius_km": 25,
            "availability_status": AvailabilityStatus.available.value,
            "category_ids": [str(cat.id)],
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["user_id"] == str(pro.id)
    assert body["state"] == "RO"
    assert body["service_radius_km"] == 25
    # Wallet criada com saldo 0 (exibido ao dono).
    assert body["balance"] == 0
    # Categoria vinculada na criação.
    assert len(body["categories"]) == 1
    assert body["categories"][0]["id"] == str(cat.id)

    # Confirma a carteira diretamente no banco.
    from app.models import CreditWallet, ProfessionalProfile
    from sqlalchemy import select

    async with session_maker() as s:
        profile = (
            await s.execute(
                select(ProfessionalProfile).where(
                    ProfessionalProfile.user_id == pro.id
                )
            )
        ).scalar_one()
        wallet = (
            await s.execute(
                select(CreditWallet).where(
                    CreditWallet.professional_id == profile.id
                )
            )
        ).scalar_one()
        assert wallet.balance == 0


@pytest.mark.asyncio
async def test_professional_profile_duplicate_409(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Criar o professional-profile duas vezes → 409 (não duplica wallet)."""
    async with session_maker() as s:
        pro = await _make_user(s, role=UserRole.professional, email="p2@t.com")
        await s.commit()

    payload = {"city": "Ariquemes", "state": "RO"}
    first = await client.post(
        "/api/v1/users/me/professional-profile",
        headers=_auth(pro),
        json=payload,
    )
    assert first.status_code == 201, first.text
    dup = await client.post(
        "/api/v1/users/me/professional-profile",
        headers=_auth(pro),
        json=payload,
    )
    assert dup.status_code == 409


@pytest.mark.asyncio
async def test_customer_cannot_create_professional_profile_403(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Customer tentando criar professional-profile → 403 (papel errado)."""
    async with session_maker() as s:
        customer = await _make_user(s, role=UserRole.customer, email="c5@t.com")
        await s.commit()

    resp = await client.post(
        "/api/v1/users/me/professional-profile",
        headers=_auth(customer),
        json={"city": "Ariquemes", "state": "RO"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_professional_profile_update_and_get(
    client: httpx.AsyncClient, session_maker
) -> None:
    """PATCH atualiza o próprio perfil; GET retorna o estado atualizado."""
    async with session_maker() as s:
        pro = await _make_user(s, role=UserRole.professional, email="p3@t.com")
        await s.commit()

    await client.post(
        "/api/v1/users/me/professional-profile",
        headers=_auth(pro),
        json={"city": "Ariquemes", "state": "RO"},
    )
    patched = await client.patch(
        "/api/v1/users/me/professional-profile",
        headers=_auth(pro),
        json={
            "headline": "Novo headline",
            "availability_status": AvailabilityStatus.busy.value,
        },
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["headline"] == "Novo headline"
    assert patched.json()["availability_status"] == AvailabilityStatus.busy.value

    got = await client.get(
        "/api/v1/users/me/professional-profile", headers=_auth(pro)
    )
    assert got.status_code == 200
    assert got.json()["availability_status"] == AvailabilityStatus.busy.value


@pytest.mark.asyncio
async def test_professional_profile_not_found_404(
    client: httpx.AsyncClient, session_maker
) -> None:
    """GET sem perfil profissional criado → 404."""
    async with session_maker() as s:
        pro = await _make_user(s, role=UserRole.professional, email="p4@t.com")
        await s.commit()

    resp = await client.get(
        "/api/v1/users/me/professional-profile", headers=_auth(pro)
    )
    assert resp.status_code == 404


# --------------------------------------------------------------------------- #
# Categorias do profissional (N:N)
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_set_and_get_professional_categories(
    client: httpx.AsyncClient, session_maker
) -> None:
    """PUT substitui o conjunto de categorias; GET as retorna."""
    async with session_maker() as s:
        pro = await _make_user(s, role=UserRole.professional, email="p5@t.com")
        cat_a = await _make_category(s, slug="encanador", tier=CategoryTier.medium)
        cat_b = await _make_category(s, slug="pintor", tier=CategoryTier.medium)
        cat_c = await _make_category(s, slug="diarista", tier=CategoryTier.simple)
        await s.commit()

    await client.post(
        "/api/v1/users/me/professional-profile",
        headers=_auth(pro),
        json={"city": "Ariquemes", "state": "RO"},
    )

    # Define A + B.
    put1 = await client.put(
        "/api/v1/users/me/professional-profile/categories",
        headers=_auth(pro),
        json={"category_ids": [str(cat_a.id), str(cat_b.id)]},
    )
    assert put1.status_code == 200, put1.text
    ids = {c["id"] for c in put1.json()["categories"]}
    assert ids == {str(cat_a.id), str(cat_b.id)}

    # Substitui por C apenas (replace, não append).
    put2 = await client.put(
        "/api/v1/users/me/professional-profile/categories",
        headers=_auth(pro),
        json={"category_ids": [str(cat_c.id)]},
    )
    assert put2.status_code == 200
    ids2 = {c["id"] for c in put2.json()["categories"]}
    assert ids2 == {str(cat_c.id)}

    # GET reflete o conjunto atual.
    got = await client.get(
        "/api/v1/users/me/professional-profile/categories",
        headers=_auth(pro),
    )
    assert got.status_code == 200
    got_ids = {c["id"] for c in got.json()["categories"]}
    assert got_ids == {str(cat_c.id)}


@pytest.mark.asyncio
async def test_set_categories_unknown_category_422(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Categoria inexistente no PUT → 422 (validação de domínio)."""
    async with session_maker() as s:
        pro = await _make_user(s, role=UserRole.professional, email="p6@t.com")
        await s.commit()

    await client.post(
        "/api/v1/users/me/professional-profile",
        headers=_auth(pro),
        json={"city": "Ariquemes", "state": "RO"},
    )
    resp = await client.put(
        "/api/v1/users/me/professional-profile/categories",
        headers=_auth(pro),
        json={"category_ids": [str(uuid.uuid4())]},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_professional_profile_unknown_category_422(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Categoria inexistente já na criação → 422 (e perfil não é criado)."""
    async with session_maker() as s:
        pro = await _make_user(s, role=UserRole.professional, email="p7@t.com")
        await s.commit()

    resp = await client.post(
        "/api/v1/users/me/professional-profile",
        headers=_auth(pro),
        json={
            "city": "Ariquemes",
            "state": "RO",
            "category_ids": [str(uuid.uuid4())],
        },
    )
    assert resp.status_code == 422
    # Perfil não foi criado (transação revertida antes de qualquer escrita).
    got = await client.get(
        "/api/v1/users/me/professional-profile", headers=_auth(pro)
    )
    assert got.status_code == 404


# --------------------------------------------------------------------------- #
# Perfil público
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_public_professional_profile(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Outro usuário lê o perfil público do profissional (sem dados sensíveis)."""
    async with session_maker() as s:
        pro = await _make_user(s, role=UserRole.professional, email="p8@t.com")
        viewer = await _make_user(s, role=UserRole.customer, email="v@t.com")
        cat = await _make_category(s, slug="jardinagem", tier=CategoryTier.simple)
        await s.commit()

    create = await client.post(
        "/api/v1/users/me/professional-profile",
        headers=_auth(pro),
        json={
            "headline": "Jardineiro",
            "city": "Ariquemes",
            "state": "RO",
            "category_ids": [str(cat.id)],
        },
    )
    assert create.status_code == 201, create.text

    # Outro usuário (customer) consulta o perfil público.
    resp = await client.get(
        f"/api/v1/users/{pro.id}/professional-profile",
        headers=_auth(viewer),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["user_id"] == str(pro.id)
    assert body["headline"] == "Jardineiro"
    assert len(body["categories"]) == 1
    assert body["categories"][0]["id"] == str(cat.id)
    # Perfil público NÃO expõe saldo da carteira.
    assert "balance" not in body


@pytest.mark.asyncio
async def test_public_professional_profile_not_found_404(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Perfil público de usuário sem perfil profissional → 404."""
    async with session_maker() as s:
        viewer = await _make_user(s, role=UserRole.customer, email="v2@t.com")
        await s.commit()

    resp = await client.get(
        f"/api/v1/users/{uuid.uuid4()}/professional-profile",
        headers=_auth(viewer),
    )
    assert resp.status_code == 404
