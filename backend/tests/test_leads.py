"""Testes async da feature ``leads`` (Fase 4).

Cobre (conforme a tarefa):
- customer cria lead com ``credits_cost`` correto (classificação §5.1);
- professional da mesma categoria/cidade/estado vê o lead na listagem (§5.3);
- professional de categoria diferente **não** vê;
- ownership no update/cancel (403 para outro usuário; só enquanto ``open``).

Estratégia (self-contained, sem depender de outras features/Postgres real):
- engine SQLite async em memória (``aiosqlite``); ``Base.metadata.create_all``
  monta o schema (os tipos Postgres têm fallback portável no SQLite);
- ``app.dependency_overrides[get_db]`` injeta a sessão de teste;
- usuários/categorias/perfis são semeados direto via ORM;
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
    CreditWallet,
    LeadStatus,
    LeadType,
    LeadUrgency,
    ProfessionalCategory,
    ProfessionalProfile,
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


async def _make_professional(
    session: AsyncSession,
    *,
    email: str,
    city: str,
    state: str,
    category_ids: list[uuid.UUID],
    balance: int = 100,
) -> User:
    user = await _make_user(session, role=UserRole.professional, email=email)
    profile = ProfessionalProfile(user_id=user.id, city=city, state=state)
    session.add(profile)
    await session.flush()
    session.add(CreditWallet(professional_id=profile.id, balance=balance))
    for cid in category_ids:
        session.add(
            ProfessionalCategory(professional_id=profile.id, category_id=cid)
        )
    await session.flush()
    return user


# --------------------------------------------------------------------------- #
# Testes
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_customer_creates_lead_cost_simple(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Customer cria lead em categoria ``simple`` + one_time → custo 1 (§5.1)."""
    async with session_maker() as s:
        customer = await _make_user(s, role=UserRole.customer, email="c1@t.com")
        cat = await _make_category(s, slug="diarista", tier=CategoryTier.simple)
        await s.commit()

    resp = await client.post(
        "/api/v1/leads/",
        headers=_auth(customer),
        json={
            "category_id": str(cat.id),
            "title": "Faxina apartamento",
            "description": "Limpeza completa de 2 quartos.",
            "lead_type": LeadType.one_time.value,
            "urgency": LeadUrgency.today.value,
            "city": "Ariquemes",
            "state": "RO",
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["credits_cost"] == 1
    assert body["status"] == LeadStatus.open.value
    assert body["expires_at"] is not None
    # O customer dono enxerga o próprio contato.
    assert body["contact"]["email"] == "c1@t.com"


@pytest.mark.asyncio
async def test_cost_premium_and_type_promotion(
    client: httpx.AsyncClient, session_maker
) -> None:
    """medium+permanent é promovido a 5; premium+one_time = 5; simple+temporary = 5."""
    async with session_maker() as s:
        customer = await _make_user(s, role=UserRole.customer, email="c2@t.com")
        medium = await _make_category(s, slug="eletricista", tier=CategoryTier.medium)
        premium = await _make_category(s, slug="reforma", tier=CategoryTier.premium)
        simple = await _make_category(s, slug="montagem", tier=CategoryTier.simple)
        await s.commit()

    base_payload = {
        "title": "Serviço X",
        "description": "Descrição do serviço.",
        "urgency": LeadUrgency.flexible.value,
        "city": "Ariquemes",
        "state": "RO",
    }

    # medium + permanent → max(3, 5) = 5
    r1 = await client.post(
        "/api/v1/leads/",
        headers=_auth(customer),
        json={**base_payload, "category_id": str(medium.id),
              "lead_type": LeadType.permanent.value},
    )
    assert r1.status_code == 201, r1.text
    assert r1.json()["credits_cost"] == 5

    # premium + one_time → 5
    r2 = await client.post(
        "/api/v1/leads/",
        headers=_auth(customer),
        json={**base_payload, "category_id": str(premium.id),
              "lead_type": LeadType.one_time.value},
    )
    assert r2.status_code == 201
    assert r2.json()["credits_cost"] == 5

    # simple + temporary → max(1, 5) = 5
    r3 = await client.post(
        "/api/v1/leads/",
        headers=_auth(customer),
        json={**base_payload, "category_id": str(simple.id),
              "lead_type": LeadType.temporary.value},
    )
    assert r3.status_code == 201
    assert r3.json()["credits_cost"] == 5

    # medium + one_time → 3 (sem promoção)
    r4 = await client.post(
        "/api/v1/leads/",
        headers=_auth(customer),
        json={**base_payload, "category_id": str(medium.id),
              "lead_type": LeadType.one_time.value},
    )
    assert r4.status_code == 201
    assert r4.json()["credits_cost"] == 3


@pytest.mark.asyncio
async def test_professional_same_category_city_sees_lead(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Professional da mesma categoria/cidade/estado vê o lead elegível (§5.3)."""
    async with session_maker() as s:
        customer = await _make_user(s, role=UserRole.customer, email="c3@t.com")
        cat = await _make_category(s, slug="encanador", tier=CategoryTier.medium)
        pro = await _make_professional(
            s, email="p1@t.com", city="Ariquemes", state="RO",
            category_ids=[cat.id], balance=10,
        )
        await s.commit()

    # Customer cria o lead.
    created = await client.post(
        "/api/v1/leads/",
        headers=_auth(customer),
        json={
            "category_id": str(cat.id),
            "title": "Vazamento na pia",
            "description": "Cano vazando embaixo da pia.",
            "lead_type": LeadType.one_time.value,
            "urgency": LeadUrgency.immediate.value,
            "city": "ariquemes",  # case-insensitive na elegibilidade
            "state": "ro",
        },
    )
    assert created.status_code == 201, created.text
    lead_id = created.json()["id"]

    # Professional elegível enxerga na listagem, sem contato, com flag affordable.
    listing = await client.get("/api/v1/leads/", headers=_auth(pro))
    assert listing.status_code == 200, listing.text
    data = listing.json()
    assert data["total"] == 1
    item = data["items"][0]
    assert item["id"] == lead_id
    assert item["contact"] is None  # sem contato antes de comprar
    assert item["customer"]["id"] == str(customer.id)
    assert "email" not in item["customer"]  # resumo não expõe contato
    assert item["affordable"] is True  # saldo 10 >= custo 3


@pytest.mark.asyncio
async def test_professional_different_category_does_not_see(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Professional de categoria diferente NÃO vê o lead (§5.3 item 3)."""
    async with session_maker() as s:
        customer = await _make_user(s, role=UserRole.customer, email="c4@t.com")
        cat_lead = await _make_category(s, slug="pintor", tier=CategoryTier.medium)
        cat_other = await _make_category(s, slug="jardinagem", tier=CategoryTier.simple)
        pro = await _make_professional(
            s, email="p2@t.com", city="Ariquemes", state="RO",
            category_ids=[cat_other.id],
        )
        await s.commit()

    created = await client.post(
        "/api/v1/leads/",
        headers=_auth(customer),
        json={
            "category_id": str(cat_lead.id),
            "title": "Pintar sala",
            "description": "Pintura de parede da sala.",
            "lead_type": LeadType.one_time.value,
            "urgency": LeadUrgency.this_week.value,
            "city": "Ariquemes",
            "state": "RO",
        },
    )
    assert created.status_code == 201

    listing = await client.get("/api/v1/leads/", headers=_auth(pro))
    assert listing.status_code == 200
    assert listing.json()["total"] == 0


@pytest.mark.asyncio
async def test_professional_different_city_does_not_see(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Mesma categoria mas cidade diferente NÃO vê (§5.3 item 4)."""
    async with session_maker() as s:
        customer = await _make_user(s, role=UserRole.customer, email="c5@t.com")
        cat = await _make_category(s, slug="eletricista2", tier=CategoryTier.medium)
        pro = await _make_professional(
            s, email="p3@t.com", city="Porto Velho", state="RO",
            category_ids=[cat.id],
        )
        await s.commit()

    await client.post(
        "/api/v1/leads/",
        headers=_auth(customer),
        json={
            "category_id": str(cat.id),
            "title": "Troca de tomada",
            "description": "Trocar tomada queimada.",
            "lead_type": LeadType.one_time.value,
            "urgency": LeadUrgency.today.value,
            "city": "Ariquemes",
            "state": "RO",
        },
    )
    listing = await client.get("/api/v1/leads/", headers=_auth(pro))
    assert listing.status_code == 200
    assert listing.json()["total"] == 0


@pytest.mark.asyncio
async def test_customer_lists_only_own_leads(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Customer vê apenas os próprios leads (§4)."""
    async with session_maker() as s:
        c_a = await _make_user(s, role=UserRole.customer, email="a@t.com")
        c_b = await _make_user(s, role=UserRole.customer, email="b@t.com")
        cat = await _make_category(s, slug="diarista2", tier=CategoryTier.simple)
        await s.commit()

    payload = {
        "category_id": str(cat.id),
        "title": "Faxina",
        "description": "Faxina geral.",
        "lead_type": LeadType.one_time.value,
        "urgency": LeadUrgency.flexible.value,
        "city": "Ariquemes",
        "state": "RO",
    }
    await client.post("/api/v1/leads/", headers=_auth(c_a), json=payload)
    await client.post("/api/v1/leads/", headers=_auth(c_b), json=payload)

    list_a = await client.get("/api/v1/leads/", headers=_auth(c_a))
    assert list_a.status_code == 200
    body = list_a.json()
    assert body["total"] == 1
    assert body["items"][0]["customer_id"] == str(c_a.id)


@pytest.mark.asyncio
async def test_update_ownership_and_open_status(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Só o dono edita; outro customer recebe 403 (§5.2)."""
    async with session_maker() as s:
        owner = await _make_user(s, role=UserRole.customer, email="own@t.com")
        other = await _make_user(s, role=UserRole.customer, email="oth@t.com")
        cat = await _make_category(s, slug="pintor2", tier=CategoryTier.medium)
        await s.commit()

    created = await client.post(
        "/api/v1/leads/",
        headers=_auth(owner),
        json={
            "category_id": str(cat.id),
            "title": "Pintura externa",
            "description": "Pintar muro externo.",
            "lead_type": LeadType.one_time.value,
            "urgency": LeadUrgency.this_week.value,
            "city": "Ariquemes",
            "state": "RO",
        },
    )
    lead_id = created.json()["id"]

    # Dono edita: 200.
    ok = await client.patch(
        f"/api/v1/leads/{lead_id}",
        headers=_auth(owner),
        json={"title": "Pintura externa e interna"},
    )
    assert ok.status_code == 200, ok.text
    assert ok.json()["title"] == "Pintura externa e interna"

    # Outro customer edita: 403.
    forbidden = await client.patch(
        f"/api/v1/leads/{lead_id}",
        headers=_auth(other),
        json={"title": "Hack"},
    )
    assert forbidden.status_code == 403


@pytest.mark.asyncio
async def test_cancel_ownership_and_effect(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Outro usuário não cancela (403); o dono cancela (204) e o lead some."""
    async with session_maker() as s:
        owner = await _make_user(s, role=UserRole.customer, email="own2@t.com")
        other = await _make_user(s, role=UserRole.customer, email="oth2@t.com")
        cat = await _make_category(s, slug="reforma2", tier=CategoryTier.premium)
        await s.commit()

    created = await client.post(
        "/api/v1/leads/",
        headers=_auth(owner),
        json={
            "category_id": str(cat.id),
            "title": "Reforma cozinha",
            "description": "Reforma completa da cozinha.",
            "lead_type": LeadType.one_time.value,
            "urgency": LeadUrgency.flexible.value,
            "city": "Ariquemes",
            "state": "RO",
        },
    )
    lead_id = created.json()["id"]

    # Outro customer tenta cancelar: 403.
    forbidden = await client.delete(
        f"/api/v1/leads/{lead_id}", headers=_auth(other)
    )
    assert forbidden.status_code == 403

    # Dono cancela: 204.
    cancelled = await client.delete(
        f"/api/v1/leads/{lead_id}", headers=_auth(owner)
    )
    assert cancelled.status_code == 204

    # Após cancelar (soft delete) o lead não aparece mais na listagem do dono.
    after = await client.get("/api/v1/leads/", headers=_auth(owner))
    assert after.status_code == 200
    assert after.json()["total"] == 0


@pytest.mark.asyncio
async def test_professional_cannot_create_lead(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Professional não cria lead (RBAC §5.2 → 403)."""
    async with session_maker() as s:
        cat = await _make_category(s, slug="encanador2", tier=CategoryTier.medium)
        pro = await _make_professional(
            s, email="p4@t.com", city="Ariquemes", state="RO",
            category_ids=[cat.id],
        )
        await s.commit()

    resp = await client.post(
        "/api/v1/leads/",
        headers=_auth(pro),
        json={
            "category_id": str(cat.id),
            "title": "Tentativa",
            "description": "Professional tentando criar lead.",
            "lead_type": LeadType.one_time.value,
            "urgency": LeadUrgency.today.value,
            "city": "Ariquemes",
            "state": "RO",
        },
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_create_lead_unknown_category_404(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Categoria inexistente → 404."""
    async with session_maker() as s:
        customer = await _make_user(s, role=UserRole.customer, email="c6@t.com")
        await s.commit()

    resp = await client.post(
        "/api/v1/leads/",
        headers=_auth(customer),
        json={
            "category_id": str(uuid.uuid4()),
            "title": "Sem categoria",
            "description": "Categoria que não existe.",
            "lead_type": LeadType.one_time.value,
            "urgency": LeadUrgency.today.value,
            "city": "Ariquemes",
            "state": "RO",
        },
    )
    assert resp.status_code == 404
