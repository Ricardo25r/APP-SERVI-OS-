"""Testes async da feature ``gamification`` (Fase 9 — XP + Níveis + Ranking).

Cobre (conforme a tarefa):
- ``award_xp`` grava ``XpTransaction`` + atualiza ``xp``/``level`` do perfil e
  recalcula o nível pela tabela do doc 08;
- ``award_xp`` em alvo sem perfil profissional grava só a transação (auditoria);
- compra de lead concede +10 XP ao profissional (hook em ``lead_purchases``);
- avaliação 5★ concede +50 XP ao avaliado **e sobe de nível** ao cruzar o limiar
  (hook em ``reviews``); 4★ → +30; 1★ → -50; 3★ → 0 (neutro);
- ``GET /gamification/ranking`` ordena por XP desc (+ filtro cidade/estado);
- ``GET /gamification/me`` retorna XP/nível/progresso + histórico;
- ``GET /gamification/levels`` retorna a tabela de níveis.

Estratégia (self-contained, espelha ``test_reviews.py``):
- engine SQLite async em memória (``aiosqlite``); ``Base.metadata.create_all``;
- ``app.dependency_overrides[get_db]`` injeta a sessão de teste;
- usuários/categorias/perfis/leads/compras semeados via ORM;
- auth via ``create_access_token`` (claim ``type=access``).
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
    CustomerProfile,
    Lead,
    LeadPurchase,
    LeadStatus,
    LeadType,
    LeadUrgency,
    ProfessionalCategory,
    ProfessionalProfile,
    User,
    UserRole,
    UserStatus,
    XpTransaction,
)
from app.services.gamification import GamificationService, level_for_xp
from sqlalchemy import select
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
    session: AsyncSession, *, slug: str, tier: CategoryTier = CategoryTier.medium
) -> Category:
    category = Category(name=slug, slug=slug, tier=tier, active=True)
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
    name: str = "Pro",
    balance: int = 0,
    xp: int = 0,
) -> tuple[User, ProfessionalProfile]:
    user = await _make_user(
        session, role=UserRole.professional, email=email, name=name
    )
    profile = ProfessionalProfile(
        user_id=user.id, city=city, state=state, headline=f"{name} headline",
        xp=xp, level=level_for_xp(xp)[0],
    )
    session.add(profile)
    await session.flush()
    for cid in category_ids:
        session.add(
            ProfessionalCategory(professional_id=profile.id, category_id=cid)
        )
    session.add(CreditWallet(professional_id=profile.id, balance=balance))
    await session.flush()
    return user, profile


async def _make_customer(
    session: AsyncSession,
    *,
    email: str,
    name: str = "Cliente",
    phone: str | None = None,
) -> User:
    user = await _make_user(
        session, role=UserRole.customer, email=email, name=name,
        phone=phone or f"+55{uuid.uuid4().int % 10**11:011d}",
    )
    session.add(CustomerProfile(user_id=user.id, city="Ariquemes", state="RO"))
    await session.flush()
    return user


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


async def _make_purchase(
    session: AsyncSession, *, lead: Lead, profile: ProfessionalProfile
) -> LeadPurchase:
    purchase = LeadPurchase(
        lead_id=lead.id,
        professional_id=profile.id,
        credits_used=lead.credits_cost,
    )
    session.add(purchase)
    lead.status = LeadStatus.purchased
    await session.flush()
    return purchase


# --------------------------------------------------------------------------- #
# level_for_xp — tabela de níveis (doc 08)
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize(
    ("xp", "expected_level", "expected_name"),
    [
        (0, 1, "Iniciante"),
        (499, 1, "Iniciante"),
        (500, 2, "Confiável"),
        (1500, 3, "Profissional"),
        (3000, 4, "Especialista"),
        (6000, 5, "Referência Regional"),
        (12000, 6, "Elite"),
        (25000, 7, "Mestre"),
        (50000, 8, "Lenda"),
        (999999, 8, "Lenda"),
        (-100, 1, "Iniciante"),  # penalidades não quebram o nível
    ],
)
def test_level_for_xp_table(xp: int, expected_level: int, expected_name: str) -> None:
    """``level_for_xp`` mapeia XP → (nível, nome) pela tabela do doc 08."""
    level, name = level_for_xp(xp)
    assert level == expected_level
    assert name == expected_name


# --------------------------------------------------------------------------- #
# award_xp — grava XpTransaction + atualiza xp/level do profissional
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_award_xp_updates_xp_and_level(
    session_maker: async_sessionmaker[AsyncSession],
) -> None:
    """``award_xp`` soma XP, grava a transação e recalcula o nível (sem commit)."""
    async with session_maker() as s:
        cat = await _make_category(s, slug="encanador")
        _, profile = await _make_professional(
            s, email="p@t.com", city="Ariquemes", state="RO",
            category_ids=[cat.id], xp=0,
        )
        user_id = profile.user_id
        await s.commit()

    async with session_maker() as s:
        svc = GamificationService(s)
        # 0 → 600 XP cruza o limiar do nível 2 (Confiável @ 500).
        await svc.award_xp(user_id, 600, "test", "subiu para confiável")
        await s.commit()

    async with session_maker() as s:
        prof = (
            await s.execute(
                select(ProfessionalProfile).where(
                    ProfessionalProfile.user_id == user_id
                )
            )
        ).scalar_one()
        assert prof.xp == 600
        assert prof.level == 2  # Confiável

        txs = (
            await s.execute(
                select(XpTransaction).where(XpTransaction.user_id == user_id)
            )
        ).scalars().all()
        assert len(txs) == 1
        assert txs[0].amount == 600
        assert txs[0].source == "test"


@pytest.mark.asyncio
async def test_award_xp_zero_is_noop(
    session_maker: async_sessionmaker[AsyncSession],
) -> None:
    """``award_xp(amount=0)`` não grava transação nem altera o XP (score 3 neutro)."""
    async with session_maker() as s:
        cat = await _make_category(s, slug="pintor")
        _, profile = await _make_professional(
            s, email="p0@t.com", city="Ariquemes", state="RO",
            category_ids=[cat.id], xp=100,
        )
        user_id = profile.user_id
        await s.commit()

    async with session_maker() as s:
        await GamificationService(s).award_xp(user_id, 0, "review_neutral")
        await s.commit()

    async with session_maker() as s:
        prof = (
            await s.execute(
                select(ProfessionalProfile).where(
                    ProfessionalProfile.user_id == user_id
                )
            )
        ).scalar_one()
        assert prof.xp == 100
        count = (
            await s.execute(
                select(XpTransaction).where(XpTransaction.user_id == user_id)
            )
        ).scalars().all()
        assert count == []


@pytest.mark.asyncio
async def test_award_xp_customer_records_transaction_only(
    session_maker: async_sessionmaker[AsyncSession],
) -> None:
    """Alvo sem perfil profissional → grava XpTransaction (auditoria), sem agregado."""
    async with session_maker() as s:
        customer = await _make_customer(s, email="c@t.com")
        cust_id = customer.id
        await s.commit()

    async with session_maker() as s:
        tx = await GamificationService(s).award_xp(cust_id, 30, "review_positive")
        await s.commit()
        assert tx.amount == 30

    async with session_maker() as s:
        rows = (
            await s.execute(
                select(XpTransaction).where(XpTransaction.user_id == cust_id)
            )
        ).scalars().all()
        assert len(rows) == 1


# --------------------------------------------------------------------------- #
# Hook: compra de lead concede +10 XP ao profissional
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_lead_purchase_awards_10_xp(
    client: httpx.AsyncClient, session_maker
) -> None:
    """A compra de lead concede +10 XP ao profissional (source=lead_purchase)."""
    async with session_maker() as s:
        customer = await _make_customer(s, email="cust@t.com")
        cat = await _make_category(s, slug="eletricista")
        pro, profile = await _make_professional(
            s, email="pro@t.com", city="Ariquemes", state="RO",
            category_ids=[cat.id], balance=10, xp=0,
        )
        lead = await _make_lead(s, customer=customer, category=cat, credits_cost=3)
        lead_id, pro_id = lead.id, pro.id
        await s.commit()

    resp = await client.post(
        "/api/v1/lead-purchases/",
        headers=_auth(pro),
        json={"lead_id": str(lead_id)},
    )
    assert resp.status_code == 201, resp.text

    async with session_maker() as s:
        prof = (
            await s.execute(
                select(ProfessionalProfile).where(
                    ProfessionalProfile.user_id == pro_id
                )
            )
        ).scalar_one()
        assert prof.xp == 10
        tx = (
            await s.execute(
                select(XpTransaction).where(
                    XpTransaction.user_id == pro_id,
                    XpTransaction.source == "lead_purchase",
                )
            )
        ).scalars().all()
        assert len(tx) == 1
        assert tx[0].amount == 10


# --------------------------------------------------------------------------- #
# Hook: avaliação 5★ concede +50 XP e sobe de nível ao cruzar limiar
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_review_5star_awards_50_xp_and_levels_up(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Avaliação 5★ recebida → +50 XP ao profissional; cruzando 500 sobe p/ nível 2."""
    async with session_maker() as s:
        customer = await _make_customer(s, email="c5@t.com")
        cat = await _make_category(s, slug="serralheiro")
        # Profissional já com 470 XP (nível 1) → +50 = 520 cruza p/ nível 2 (500).
        pro_user, profile = await _make_professional(
            s, email="p5@t.com", city="Ariquemes", state="RO",
            category_ids=[cat.id], xp=470,
        )
        lead = await _make_lead(s, customer=customer, category=cat)
        await _make_purchase(s, lead=lead, profile=profile)
        lead_id, pro_id = lead.id, pro_user.id
        await s.commit()

    r = await client.post(
        "/api/v1/reviews/",
        headers=_auth(customer),
        json={"lead_id": str(lead_id), "score": 5, "comment": "Excelente!"},
    )
    assert r.status_code == 201, r.text

    async with session_maker() as s:
        prof = (
            await s.execute(
                select(ProfessionalProfile).where(
                    ProfessionalProfile.user_id == pro_id
                )
            )
        ).scalar_one()
        assert prof.xp == 520
        assert prof.level == 2  # cruzou o limiar 500 (Confiável)
        tx = (
            await s.execute(
                select(XpTransaction).where(
                    XpTransaction.user_id == pro_id,
                    XpTransaction.source == "review_5star",
                )
            )
        ).scalars().all()
        assert len(tx) == 1
        assert tx[0].amount == 50


@pytest.mark.asyncio
async def test_review_negative_penalizes_xp(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Avaliação 1★ recebida → -50 XP ao profissional (source=review_negative)."""
    async with session_maker() as s:
        customer = await _make_customer(s, email="cn@t.com")
        cat = await _make_category(s, slug="diarista")
        pro_user, profile = await _make_professional(
            s, email="pn@t.com", city="Ariquemes", state="RO",
            category_ids=[cat.id], xp=200,
        )
        lead = await _make_lead(s, customer=customer, category=cat)
        await _make_purchase(s, lead=lead, profile=profile)
        lead_id, pro_id = lead.id, pro_user.id
        await s.commit()

    r = await client.post(
        "/api/v1/reviews/",
        headers=_auth(customer),
        json={"lead_id": str(lead_id), "score": 1},
    )
    assert r.status_code == 201, r.text

    async with session_maker() as s:
        prof = (
            await s.execute(
                select(ProfessionalProfile).where(
                    ProfessionalProfile.user_id == pro_id
                )
            )
        ).scalar_one()
        assert prof.xp == 150  # 200 - 50
        tx = (
            await s.execute(
                select(XpTransaction).where(
                    XpTransaction.source == "review_negative"
                )
            )
        ).scalars().all()
        assert len(tx) == 1
        assert tx[0].amount == -50


@pytest.mark.asyncio
async def test_review_score_3_is_neutral(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Avaliação 3★ → 0 XP (neutro): sem transação e sem alterar o XP."""
    async with session_maker() as s:
        customer = await _make_customer(s, email="c3@t.com")
        cat = await _make_category(s, slug="montagem")
        pro_user, profile = await _make_professional(
            s, email="p3@t.com", city="Ariquemes", state="RO",
            category_ids=[cat.id], xp=300,
        )
        lead = await _make_lead(s, customer=customer, category=cat)
        await _make_purchase(s, lead=lead, profile=profile)
        lead_id, pro_id = lead.id, pro_user.id
        await s.commit()

    r = await client.post(
        "/api/v1/reviews/",
        headers=_auth(customer),
        json={"lead_id": str(lead_id), "score": 3},
    )
    assert r.status_code == 201, r.text

    async with session_maker() as s:
        prof = (
            await s.execute(
                select(ProfessionalProfile).where(
                    ProfessionalProfile.user_id == pro_id
                )
            )
        ).scalar_one()
        assert prof.xp == 300  # inalterado
        rows = (
            await s.execute(
                select(XpTransaction).where(XpTransaction.user_id == pro_id)
            )
        ).scalars().all()
        assert rows == []


# --------------------------------------------------------------------------- #
# GET /gamification/me — progresso do profissional logado
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_me_returns_progress(
    client: httpx.AsyncClient, session_maker
) -> None:
    """``GET /me`` retorna XP, nível, próximo nível, XP faltante e histórico."""
    async with session_maker() as s:
        cat = await _make_category(s, slug="vidraceiro")
        pro, profile = await _make_professional(
            s, email="pme@t.com", city="Ariquemes", state="RO",
            category_ids=[cat.id], xp=0,
        )
        user_id = profile.user_id
        await s.commit()

    async with session_maker() as s:
        await GamificationService(s).award_xp(user_id, 600, "test")
        await s.commit()

    resp = await client.get("/api/v1/gamification/me", headers=_auth(pro))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["xp"] == 600
    assert body["level"] == 2
    assert body["level_name"] == "Confiável"
    assert body["next_level"] == 3
    assert body["next_level_name"] == "Profissional"
    assert body["next_level_xp"] == 1500
    assert body["xp_for_next_level"] == 900  # 1500 - 600
    assert len(body["recent_transactions"]) == 1
    assert body["recent_transactions"][0]["amount"] == 600


@pytest.mark.asyncio
async def test_me_for_customer_returns_zero(
    client: httpx.AsyncClient, session_maker
) -> None:
    """``GET /me`` para customer (sem perfil profissional) → xp=0, level=1 (200)."""
    async with session_maker() as s:
        customer = await _make_customer(s, email="cme@t.com")
        await s.commit()

    resp = await client.get("/api/v1/gamification/me", headers=_auth(customer))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["xp"] == 0
    assert body["level"] == 1
    assert body["level_name"] == "Iniciante"
    assert body["recent_transactions"] == []


@pytest.mark.asyncio
async def test_me_at_max_level_has_no_next(
    client: httpx.AsyncClient, session_maker
) -> None:
    """No topo (Lenda), ``/me`` não tem próximo nível e ``xp_for_next_level=0``."""
    async with session_maker() as s:
        cat = await _make_category(s, slug="topo")
        pro, _ = await _make_professional(
            s, email="ptop@t.com", city="Ariquemes", state="RO",
            category_ids=[cat.id], xp=60000,
        )
        await s.commit()

    resp = await client.get("/api/v1/gamification/me", headers=_auth(pro))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["level"] == 8
    assert body["level_name"] == "Lenda"
    assert body["next_level"] is None
    assert body["xp_for_next_level"] == 0


# --------------------------------------------------------------------------- #
# GET /gamification/ranking — ordena por XP desc + filtro por cidade
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_ranking_orders_by_xp_desc(
    client: httpx.AsyncClient, session_maker
) -> None:
    """``GET /ranking`` lista profissionais por XP desc; filtro por cidade."""
    async with session_maker() as s:
        cat = await _make_category(s, slug="ranking-cat")
        await _make_professional(
            s, email="low@t.com", city="Ariquemes", state="RO",
            category_ids=[cat.id], xp=100, name="Low",
        )
        await _make_professional(
            s, email="high@t.com", city="Ariquemes", state="RO",
            category_ids=[cat.id], xp=5000, name="High",
        )
        await _make_professional(
            s, email="mid@t.com", city="Ariquemes", state="RO",
            category_ids=[cat.id], xp=1000, name="Mid",
        )
        # Profissional de OUTRA cidade (não deve aparecer no filtro por cidade).
        await _make_professional(
            s, email="other@t.com", city="Porto Velho", state="RO",
            category_ids=[cat.id], xp=9999, name="Other",
        )
        await s.commit()

    # Sem filtro: 4 profissionais, Other (9999) primeiro.
    resp = await client.get("/api/v1/gamification/ranking")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 4
    names = [i["name"] for i in body["items"]]
    assert names == ["Other", "High", "Mid", "Low"]
    assert body["items"][1]["name"] == "High"
    assert body["items"][1]["xp"] == 5000
    assert body["items"][1]["level"] == 4  # Especialista @ 3000
    assert body["items"][1]["level_name"] == "Especialista"

    # Filtro por cidade Ariquemes: 3 profissionais (sem Other).
    resp_city = await client.get(
        "/api/v1/gamification/ranking", params={"city": "Ariquemes"}
    )
    assert resp_city.status_code == 200
    city_body = resp_city.json()
    assert city_body["total"] == 3
    assert [i["name"] for i in city_body["items"]] == ["High", "Mid", "Low"]

    # Limit respeitado.
    resp_limit = await client.get(
        "/api/v1/gamification/ranking", params={"limit": 2}
    )
    assert resp_limit.status_code == 200
    assert len(resp_limit.json()["items"]) == 2


# --------------------------------------------------------------------------- #
# GET /gamification/levels — tabela de referência
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_levels_table(client: httpx.AsyncClient, session_maker) -> None:
    """``GET /levels`` retorna os 8 níveis do doc 08 na ordem crescente de XP."""
    resp = await client.get("/api/v1/gamification/levels")
    assert resp.status_code == 200, resp.text
    levels = resp.json()["levels"]
    assert len(levels) == 8
    assert levels[0] == {"level": 1, "name": "Iniciante", "min_xp": 0}
    assert levels[1] == {"level": 2, "name": "Confiável", "min_xp": 500}
    assert levels[-1] == {"level": 8, "name": "Lenda", "min_xp": 50000}
