"""Testes async das features ``credits`` e ``lead_purchases`` (Fase 5).

Cobre (conforme a tarefa):
- ``grant`` (admin) credita o saldo e gera ``CreditTransaction`` (saldo nunca
  muda sem transação — §1.7 / §2.9);
- compra debita o saldo + marca o lead ``purchased`` + libera o contato (§5.4);
- 2ª compra do **mesmo** lead → ``409`` (Lead Exclusivo, UNIQUE lead_id);
- sem saldo → ``402`` (``InsufficientCreditsError`` do contrato);
- profissional inelegível (categoria/cidade diferente) → ``403``.

Estratégia (self-contained, espelha ``test_leads.py``):
- engine SQLite async em memória (``aiosqlite``); ``Base.metadata.create_all``;
- ``app.dependency_overrides[get_db]`` injeta a sessão de teste;
- usuários/categorias/perfis semeados via ORM;
- auth via ``create_access_token`` (claim ``type=access``).

> **``SELECT FOR UPDATE`` em SQLite:** não é suportado — o repositório aplica o
> ``with_for_update()`` **condicionalmente ao dialeto** (no-op em SQLite). Aqui
> validamos a lógica funcional (a tarefa autoriza explicitamente).
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
    CreditTransaction,
    CreditTransactionType,
    CreditWallet,
    Lead,
    LeadStatus,
    LeadType,
    LeadUrgency,
    ProfessionalCategory,
    ProfessionalProfile,
    User,
    UserRole,
    UserStatus,
)
from sqlalchemy import select
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
    balance: int | None = 100,
) -> tuple[User, ProfessionalProfile]:
    """Cria usuário professional + perfil + (opcional) wallet + vínculos."""
    user = await _make_user(session, role=UserRole.professional, email=email)
    profile = ProfessionalProfile(user_id=user.id, city=city, state=state)
    session.add(profile)
    await session.flush()
    if balance is not None:
        session.add(CreditWallet(professional_id=profile.id, balance=balance))
    for cid in category_ids:
        session.add(
            ProfessionalCategory(professional_id=profile.id, category_id=cid)
        )
    await session.flush()
    return user, profile


async def _make_lead(
    session: AsyncSession,
    *,
    customer: User,
    category: Category,
    city: str = "Ariquemes",
    state: str = "RO",
    credits_cost: int = 3,
    status: LeadStatus = LeadStatus.open,
) -> Lead:
    lead = Lead(
        customer_id=customer.id,
        category_id=category.id,
        title="Serviço de teste",
        description="Descrição do serviço de teste.",
        lead_type=LeadType.one_time,
        urgency=LeadUrgency.today,
        city=city,
        state=state,
        status=status,
        credits_cost=credits_cost,
    )
    session.add(lead)
    await session.flush()
    return lead


# --------------------------------------------------------------------------- #
# Testes — credits
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_balance_creates_wallet_lazily(
    client: httpx.AsyncClient, session_maker
) -> None:
    """``GET /credits/balance`` cria a wallet lazily quando ela não existe (§4)."""
    async with session_maker() as s:
        pro, _ = await _make_professional(
            s, email="p0@t.com", city="Ariquemes", state="RO",
            category_ids=[], balance=None,  # sem wallet
        )
        await s.commit()

    resp = await client.get("/api/v1/credits/balance", headers=_auth(pro))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["balance"] == 0
    assert body["wallet_id"] is not None


@pytest.mark.asyncio
async def test_admin_grant_credits_balance_and_transaction(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Admin concede ``bonus`` → saldo sobe e gera ``CreditTransaction`` (§2.9)."""
    async with session_maker() as s:
        admin = await _make_user(s, role=UserRole.admin, email="admin@t.com")
        pro, profile = await _make_professional(
            s, email="p1@t.com", city="Ariquemes", state="RO",
            category_ids=[], balance=0,
        )
        professional_id = profile.id
        await s.commit()

    resp = await client.post(
        "/api/v1/credits/grant",
        headers=_auth(admin),
        json={
            "professional_id": str(professional_id),
            "amount": 20,
            "transaction_type": CreditTransactionType.bonus.value,
            "description": "Bônus de boas-vindas",
        },
    )
    assert resp.status_code == 201, resp.text
    tx = resp.json()
    assert tx["amount"] == 20
    assert tx["balance_before"] == 0
    assert tx["balance_after"] == 20
    assert tx["transaction_type"] == CreditTransactionType.bonus.value

    # Saldo refletido em /balance.
    bal = await client.get("/api/v1/credits/balance", headers=_auth(pro))
    assert bal.status_code == 200
    assert bal.json()["balance"] == 20

    # A transação foi persistida (saldo nunca muda sem transação — §1.7).
    async with session_maker() as s:
        rows = (
            await s.execute(select(CreditTransaction))
        ).scalars().all()
        assert len(rows) == 1
        assert rows[0].balance_after == 20


@pytest.mark.asyncio
async def test_grant_requires_admin(
    client: httpx.AsyncClient, session_maker
) -> None:
    """``POST /credits/grant`` exige role admin (§5.2 → 403 para professional)."""
    async with session_maker() as s:
        pro, profile = await _make_professional(
            s, email="p2@t.com", city="Ariquemes", state="RO",
            category_ids=[], balance=0,
        )
        professional_id = profile.id
        await s.commit()

    resp = await client.post(
        "/api/v1/credits/grant",
        headers=_auth(pro),
        json={
            "professional_id": str(professional_id),
            "amount": 10,
            "transaction_type": CreditTransactionType.bonus.value,
        },
    )
    assert resp.status_code == 403


# --------------------------------------------------------------------------- #
# Testes — lead_purchases (compra atômica)
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_purchase_debits_marks_purchased_releases_contact(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Compra: debita saldo + lead ``purchased`` + libera contato do customer."""
    async with session_maker() as s:
        customer = await _make_user(
            s, role=UserRole.customer, email="cust@t.com",
            name="Cliente", phone="+5569999999999",
        )
        cat = await _make_category(s, slug="encanador", tier=CategoryTier.medium)
        pro, profile = await _make_professional(
            s, email="prox@t.com", city="Ariquemes", state="RO",
            category_ids=[cat.id], balance=10,
        )
        lead = await _make_lead(
            s, customer=customer, category=cat, credits_cost=3
        )
        lead_id = lead.id
        wallet_id = (
            await s.execute(
                select(CreditWallet.id).where(
                    CreditWallet.professional_id == profile.id
                )
            )
        ).scalar_one()
        await s.commit()

    resp = await client.post(
        "/api/v1/lead-purchases/",
        headers=_auth(pro),
        json={"lead_id": str(lead_id)},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()

    # Débito: 10 - 3 = 7.
    assert body["wallet"]["balance"] == 7
    assert body["purchase"]["credits_used"] == 3
    # Lead marcado como purchased.
    assert body["lead"]["status"] == LeadStatus.purchased.value
    assert body["lead"]["is_purchased"] is True
    # Contato do customer liberado no payload da compra (§5.6).
    assert body["lead"]["contact"]["email"] == "cust@t.com"
    assert body["lead"]["contact"]["phone"] == "+5569999999999"
    assert body["purchase"]["contact"]["email"] == "cust@t.com"

    # Persistência: spend gravado e saldo coerente.
    async with session_maker() as s:
        txs = (
            await s.execute(
                select(CreditTransaction).where(
                    CreditTransaction.wallet_id == wallet_id
                )
            )
        ).scalars().all()
        assert len(txs) == 1
        assert txs[0].transaction_type == CreditTransactionType.spend
        assert txs[0].amount == -3
        assert txs[0].balance_before == 10
        assert txs[0].balance_after == 7
        assert txs[0].reference_id == uuid.UUID(body["purchase"]["id"])

        wallet = (
            await s.execute(
                select(CreditWallet).where(CreditWallet.id == wallet_id)
            )
        ).scalar_one()
        assert wallet.balance == 7

    # A compra aparece no histórico do profissional, com contato.
    listing = await client.get(
        "/api/v1/lead-purchases/", headers=_auth(pro)
    )
    assert listing.status_code == 200
    data = listing.json()
    assert data["total"] == 1
    assert data["items"][0]["contact"]["email"] == "cust@t.com"

    # Histórico de créditos mostra o spend.
    history = await client.get("/api/v1/credits/history", headers=_auth(pro))
    assert history.status_code == 200
    assert history.json()["total"] == 1
    assert history.json()["items"][0]["amount"] == -3


@pytest.mark.asyncio
async def test_second_purchase_same_lead_conflict_409(
    client: httpx.AsyncClient, session_maker
) -> None:
    """2ª compra do MESMO lead → 409 (Lead Exclusivo, UNIQUE lead_id — §5.4).

    O 2º profissional não pode ser debitado: o lead já está ``purchased`` (409)
    e o saldo dele permanece intacto.
    """
    async with session_maker() as s:
        customer = await _make_user(s, role=UserRole.customer, email="cust2@t.com")
        cat = await _make_category(s, slug="eletricista", tier=CategoryTier.medium)
        pro_a, _ = await _make_professional(
            s, email="pa@t.com", city="Ariquemes", state="RO",
            category_ids=[cat.id], balance=10,
        )
        pro_b, profile_b = await _make_professional(
            s, email="pb@t.com", city="Ariquemes", state="RO",
            category_ids=[cat.id], balance=10,
        )
        lead = await _make_lead(s, customer=customer, category=cat, credits_cost=3)
        lead_id = lead.id
        profile_b_id = profile_b.id
        await s.commit()

    first = await client.post(
        "/api/v1/lead-purchases/",
        headers=_auth(pro_a),
        json={"lead_id": str(lead_id)},
    )
    assert first.status_code == 201, first.text

    second = await client.post(
        "/api/v1/lead-purchases/",
        headers=_auth(pro_b),
        json={"lead_id": str(lead_id)},
    )
    assert second.status_code == 409, second.text

    # O profissional B não foi debitado (sem crédito perdido em conflito).
    async with session_maker() as s:
        wallet_b = (
            await s.execute(
                select(CreditWallet).where(
                    CreditWallet.professional_id == profile_b_id
                )
            )
        ).scalar_one()
        assert wallet_b.balance == 10
        txs_b = (
            await s.execute(
                select(CreditTransaction).where(
                    CreditTransaction.wallet_id == wallet_b.id
                )
            )
        ).scalars().all()
        assert txs_b == []


@pytest.mark.asyncio
async def test_purchase_insufficient_balance_402(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Saldo insuficiente → 402 (InsufficientCreditsError) e nada é debitado."""
    async with session_maker() as s:
        customer = await _make_user(s, role=UserRole.customer, email="cust3@t.com")
        cat = await _make_category(s, slug="pintor", tier=CategoryTier.premium)
        pro, profile = await _make_professional(
            s, email="pc@t.com", city="Ariquemes", state="RO",
            category_ids=[cat.id], balance=2,  # custo 5 > saldo 2
        )
        lead = await _make_lead(s, customer=customer, category=cat, credits_cost=5)
        lead_id = lead.id
        profile_id = profile.id
        await s.commit()

    resp = await client.post(
        "/api/v1/lead-purchases/",
        headers=_auth(pro),
        json={"lead_id": str(lead_id)},
    )
    assert resp.status_code == 402, resp.text

    # Nada debitado; nenhuma compra criada; lead segue open.
    async with session_maker() as s:
        wallet = (
            await s.execute(
                select(CreditWallet).where(
                    CreditWallet.professional_id == profile_id
                )
            )
        ).scalar_one()
        assert wallet.balance == 2
        lead = (
            await s.execute(select(Lead).where(Lead.id == lead_id))
        ).scalar_one()
        assert lead.status == LeadStatus.open


@pytest.mark.asyncio
async def test_purchase_ineligible_professional_403(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Profissional inelegível (categoria/cidade diferente) → 403 (§5.3)."""
    async with session_maker() as s:
        customer = await _make_user(s, role=UserRole.customer, email="cust4@t.com")
        cat_lead = await _make_category(s, slug="diarista", tier=CategoryTier.simple)
        cat_other = await _make_category(
            s, slug="jardinagem", tier=CategoryTier.simple
        )
        # Categoria diferente do lead.
        pro_cat, profile_cat = await _make_professional(
            s, email="pcat@t.com", city="Ariquemes", state="RO",
            category_ids=[cat_other.id], balance=10,
        )
        # Cidade diferente do lead.
        pro_city, _ = await _make_professional(
            s, email="pcity@t.com", city="Porto Velho", state="RO",
            category_ids=[cat_lead.id], balance=10,
        )
        lead = await _make_lead(
            s, customer=customer, category=cat_lead, credits_cost=1
        )
        lead_id = lead.id
        profile_cat_id = profile_cat.id
        await s.commit()

    # Categoria diferente → 403.
    r1 = await client.post(
        "/api/v1/lead-purchases/",
        headers=_auth(pro_cat),
        json={"lead_id": str(lead_id)},
    )
    assert r1.status_code == 403, r1.text

    # Cidade diferente → 403.
    r2 = await client.post(
        "/api/v1/lead-purchases/",
        headers=_auth(pro_city),
        json={"lead_id": str(lead_id)},
    )
    assert r2.status_code == 403, r2.text

    # Nenhum débito ocorreu no profissional de categoria diferente.
    async with session_maker() as s:
        wallet = (
            await s.execute(
                select(CreditWallet).where(
                    CreditWallet.professional_id == profile_cat_id
                )
            )
        ).scalar_one()
        assert wallet.balance == 10


@pytest.mark.asyncio
async def test_purchase_unknown_lead_404(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Lead inexistente → 404 (§4)."""
    async with session_maker() as s:
        cat = await _make_category(s, slug="montagem", tier=CategoryTier.simple)
        pro, _ = await _make_professional(
            s, email="p404@t.com", city="Ariquemes", state="RO",
            category_ids=[cat.id], balance=10,
        )
        await s.commit()

    resp = await client.post(
        "/api/v1/lead-purchases/",
        headers=_auth(pro),
        json={"lead_id": str(uuid.uuid4())},
    )
    assert resp.status_code == 404
