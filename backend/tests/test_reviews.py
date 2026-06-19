"""Testes async da feature ``reviews`` (Fase 7 — Avaliações + Reputação).

Cobre (conforme a tarefa):
- fluxo completo: customer cria lead, professional compra, **ambos avaliam**
  (1 vez cada) e a reputação atualiza (profissional ``rating``/``total_reviews``;
  contratante ``reputation_score``);
- 2ª avaliação do **mesmo** lead pelo **mesmo** autor → ``409`` (UNIQUE);
- avaliar lead sem participação → ``403``;
- auto-avaliação impossível (o alvo é sempre o *outro* lado);
- ``score`` fora de 1–5 → ``422`` (validação Pydantic).

Estratégia (self-contained, espelha ``test_credits_purchases.py``):
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
    CustomerProfile,
    Lead,
    LeadPurchase,
    LeadStatus,
    LeadType,
    LeadUrgency,
    ProfessionalCategory,
    ProfessionalProfile,
    Review,
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
) -> tuple[User, ProfessionalProfile]:
    user = await _make_user(
        session, role=UserRole.professional, email=email, name=name
    )
    profile = ProfessionalProfile(user_id=user.id, city=city, state=state)
    session.add(profile)
    await session.flush()
    for cid in category_ids:
        session.add(
            ProfessionalCategory(professional_id=profile.id, category_id=cid)
        )
    await session.flush()
    return user, profile


async def _make_customer(
    session: AsyncSession,
    *,
    email: str,
    name: str = "Cliente",
    phone: str | None = None,
) -> User:
    # Telefone único por customer (o índice unique de phone é plano no SQLite).
    user = await _make_user(
        session, role=UserRole.customer, email=email, name=name,
        phone=phone or f"+55{uuid.uuid4().int % 10**11:011d}",
    )
    session.add(CustomerProfile(user_id=user.id, city="Ariquemes", state="RO"))
    await session.flush()
    return user


async def _make_customer_without_profile(
    session: AsyncSession,
    *,
    email: str,
    name: str = "Cliente sem perfil",
    phone: str | None = None,
) -> User:
    """Contratante SEM ``customer_profile`` (leads.customer_id → users.id direto).

    Reproduz o cenário do BUG 2: um contratante pode criar leads e receber
    avaliações sem nunca ter criado o ``customer_profile``.
    """
    return await _make_user(
        session, role=UserRole.customer, email=email, name=name,
        phone=phone or f"+55{uuid.uuid4().int % 10**11:011d}",
    )


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
    """Simula a compra (Fase 5): marca o lead ``purchased`` + cria a compra."""
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
# Cenário comum: customer + lead + professional + compra
# --------------------------------------------------------------------------- #
async def _seed_purchased_scenario(
    session: AsyncSession,
    *,
    cust_email: str,
    pro_email: str,
    cat_slug: str,
) -> tuple[User, User]:
    """Cria customer, categoria, professional, lead e a compra. Devolve
    ``(customer_user, professional_user)``."""
    customer = await _make_customer(session, email=cust_email)
    cat = await _make_category(session, slug=cat_slug)
    pro_user, profile = await _make_professional(
        session, email=pro_email, city="Ariquemes", state="RO",
        category_ids=[cat.id],
    )
    lead = await _make_lead(session, customer=customer, category=cat)
    await _make_purchase(session, lead=lead, profile=profile)
    return customer, pro_user


# --------------------------------------------------------------------------- #
# Fluxo completo: ambos avaliam e a reputação atualiza
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_mutual_reviews_update_reputation(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Customer e professional avaliam (1x cada); reputação dos dois atualiza."""
    async with session_maker() as s:
        customer, pro_user = await _seed_purchased_scenario(
            s, cust_email="c@t.com", pro_email="p@t.com", cat_slug="encanador"
        )
        lead_id = (
            await s.execute(select(Lead.id).where(Lead.customer_id == customer.id))
        ).scalar_one()
        customer_id, pro_id = customer.id, pro_user.id
        await s.commit()

    # Contratante avalia o profissional (5★).
    r1 = await client.post(
        "/api/v1/reviews/",
        headers=_auth(customer),
        json={"lead_id": str(lead_id), "score": 5, "comment": "Excelente!"},
    )
    assert r1.status_code == 201, r1.text
    body1 = r1.json()
    assert body1["author_id"] == str(customer_id)
    assert body1["target_id"] == str(pro_id)  # target derivado no backend
    assert body1["score"] == 5

    # Profissional avalia o contratante (4★).
    r2 = await client.post(
        "/api/v1/reviews/",
        headers=_auth(pro_user),
        json={"lead_id": str(lead_id), "score": 4},
    )
    assert r2.status_code == 201, r2.text
    body2 = r2.json()
    assert body2["author_id"] == str(pro_id)
    assert body2["target_id"] == str(customer_id)

    # Reputação do profissional: rating = 5.00, total_reviews = 1.
    async with session_maker() as s:
        prof = (
            await s.execute(
                select(ProfessionalProfile).where(
                    ProfessionalProfile.user_id == pro_id
                )
            )
        ).scalar_one()
        assert float(prof.rating) == 5.0
        assert prof.total_reviews == 1

        # Reputação do contratante: média 4.00 gravada na coluna Numeric(3,2).
        cust = (
            await s.execute(
                select(CustomerProfile).where(
                    CustomerProfile.user_id == customer_id
                )
            )
        ).scalar_one()
        assert float(cust.reputation_score) == 4.0

    # Avaliações recebidas (público) — profissional tem 1 review (5★).
    received = await client.get(f"/api/v1/reviews/{pro_id}")
    assert received.status_code == 200, received.text
    data = received.json()
    assert data["total"] == 1
    assert data["items"][0]["score"] == 5

    # Não há mais pendências para nenhum dos dois (cada um já avaliou).
    pend_c = await client.get("/api/v1/reviews/me/pending", headers=_auth(customer))
    assert pend_c.status_code == 200
    assert pend_c.json()["total"] == 0
    pend_p = await client.get("/api/v1/reviews/me/pending", headers=_auth(pro_user))
    assert pend_p.status_code == 200
    assert pend_p.json()["total"] == 0


# --------------------------------------------------------------------------- #
# Pendência aparece antes de avaliar
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_pending_lists_lead_before_review(
    client: httpx.AsyncClient, session_maker
) -> None:
    """``GET /me/pending`` lista o lead comprado que o usuário ainda não avaliou."""
    async with session_maker() as s:
        customer, pro_user = await _seed_purchased_scenario(
            s, cust_email="c2@t.com", pro_email="p2@t.com", cat_slug="eletricista"
        )
        lead_id = (
            await s.execute(select(Lead.id).where(Lead.customer_id == customer.id))
        ).scalar_one()
        pro_id = pro_user.id
        await s.commit()

    pend = await client.get("/api/v1/reviews/me/pending", headers=_auth(customer))
    assert pend.status_code == 200, pend.text
    data = pend.json()
    assert data["total"] == 1
    item = data["items"][0]
    assert item["lead_id"] == str(lead_id)
    assert item["target_id"] == str(pro_id)
    assert item["role_as"] == "customer"


# --------------------------------------------------------------------------- #
# 2ª avaliação do mesmo lead pelo mesmo autor → 409
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_duplicate_review_same_lead_conflict_409(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Mesma avaliação (mesmo autor + mesmo lead) duas vezes → 409 (UNIQUE)."""
    async with session_maker() as s:
        customer, _ = await _seed_purchased_scenario(
            s, cust_email="c3@t.com", pro_email="p3@t.com", cat_slug="pintor"
        )
        lead_id = (
            await s.execute(select(Lead.id).where(Lead.customer_id == customer.id))
        ).scalar_one()
        await s.commit()

    first = await client.post(
        "/api/v1/reviews/",
        headers=_auth(customer),
        json={"lead_id": str(lead_id), "score": 5},
    )
    assert first.status_code == 201, first.text

    second = await client.post(
        "/api/v1/reviews/",
        headers=_auth(customer),
        json={"lead_id": str(lead_id), "score": 3},
    )
    assert second.status_code == 409, second.text

    # Persistência: só uma avaliação deste autor para o lead.
    async with session_maker() as s:
        rows = (
            await s.execute(
                select(Review).where(Review.lead_id == lead_id)
            )
        ).scalars().all()
        assert len(rows) == 1
        assert rows[0].score == 5


# --------------------------------------------------------------------------- #
# Avaliar lead sem participação → 403
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_review_lead_without_participation_403(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Terceiro (não-participante) tentando avaliar o lead → 403."""
    async with session_maker() as s:
        customer, _ = await _seed_purchased_scenario(
            s, cust_email="c4@t.com", pro_email="p4@t.com", cat_slug="diarista"
        )
        lead_id = (
            await s.execute(select(Lead.id).where(Lead.customer_id == customer.id))
        ).scalar_one()
        # Outsider: outro customer, sem relação com o lead.
        outsider = await _make_customer(s, email="outsider@t.com", name="Estranho")
        await s.commit()

    resp = await client.post(
        "/api/v1/reviews/",
        headers=_auth(outsider),
        json={"lead_id": str(lead_id), "score": 5},
    )
    assert resp.status_code == 403, resp.text


# --------------------------------------------------------------------------- #
# Avaliar lead não comprado → 403 (reputation-engine: só após lead comprado)
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_review_lead_not_purchased_403(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Lead ``open`` (sem compra) não pode ser avaliado nem pelo dono → 403."""
    async with session_maker() as s:
        customer = await _make_customer(s, email="c5@t.com")
        cat = await _make_category(s, slug="montagem", tier=CategoryTier.simple)
        lead = await _make_lead(s, customer=customer, category=cat)  # sem compra
        lead_id = lead.id
        await s.commit()

    resp = await client.post(
        "/api/v1/reviews/",
        headers=_auth(customer),
        json={"lead_id": str(lead_id), "score": 5},
    )
    assert resp.status_code == 403, resp.text


# --------------------------------------------------------------------------- #
# Auto-avaliação impossível: o alvo é sempre o OUTRO lado
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_no_self_review_target_is_other_side(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Ao avaliar, ``target_id`` nunca é o próprio autor (anti auto-avaliação)."""
    async with session_maker() as s:
        customer, pro_user = await _seed_purchased_scenario(
            s, cust_email="c6@t.com", pro_email="p6@t.com", cat_slug="jardinagem"
        )
        lead_id = (
            await s.execute(select(Lead.id).where(Lead.customer_id == customer.id))
        ).scalar_one()
        customer_id, pro_id = customer.id, pro_user.id
        await s.commit()

    # Customer avalia → alvo é o profissional (não ele mesmo).
    rc = await client.post(
        "/api/v1/reviews/",
        headers=_auth(customer),
        json={"lead_id": str(lead_id), "score": 5},
    )
    assert rc.status_code == 201, rc.text
    assert rc.json()["target_id"] == str(pro_id)
    assert rc.json()["target_id"] != str(customer_id)

    # Professional avalia → alvo é o contratante (não ele mesmo).
    rp = await client.post(
        "/api/v1/reviews/",
        headers=_auth(pro_user),
        json={"lead_id": str(lead_id), "score": 5},
    )
    assert rp.status_code == 201, rp.text
    assert rp.json()["target_id"] == str(customer_id)
    assert rp.json()["target_id"] != str(pro_id)


# --------------------------------------------------------------------------- #
# Score fora de 1–5 → 422
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
@pytest.mark.parametrize("bad_score", [0, 6, -1, 10])
async def test_score_out_of_range_422(
    client: httpx.AsyncClient, session_maker, bad_score: int
) -> None:
    """``score`` fora de 1–5 é rejeitado pela validação Pydantic (422)."""
    async with session_maker() as s:
        customer, _ = await _seed_purchased_scenario(
            s, cust_email=f"c7-{bad_score}@t.com",
            pro_email=f"p7-{bad_score}@t.com", cat_slug=f"cat-{bad_score}",
        )
        lead_id = (
            await s.execute(select(Lead.id).where(Lead.customer_id == customer.id))
        ).scalar_one()
        await s.commit()

    resp = await client.post(
        "/api/v1/reviews/",
        headers=_auth(customer),
        json={"lead_id": str(lead_id), "score": bad_score},
    )
    assert resp.status_code == 422, resp.text


# --------------------------------------------------------------------------- #
# BUG 1 — perfil público do profissional expõe rating/total_reviews
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_public_professional_profile_exposes_reputation(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Após avaliação, ``GET /users/{id}/professional-profile`` retorna a
    reputação (``rating``/``total_reviews``) para a UI mostrar estrelas."""
    async with session_maker() as s:
        customer, pro_user = await _seed_purchased_scenario(
            s, cust_email="c8@t.com", pro_email="p8@t.com", cat_slug="serralheiro"
        )
        lead_id = (
            await s.execute(select(Lead.id).where(Lead.customer_id == customer.id))
        ).scalar_one()
        pro_id = pro_user.id
        await s.commit()

    # Antes de avaliar: reputação zerada (defaults).
    before = await client.get(
        f"/api/v1/users/{pro_id}/professional-profile", headers=_auth(customer)
    )
    assert before.status_code == 200, before.text
    body_before = before.json()
    assert body_before["rating"] == 0.0
    assert body_before["total_reviews"] == 0

    # Contratante avalia o profissional (5★).
    r = await client.post(
        "/api/v1/reviews/",
        headers=_auth(customer),
        json={"lead_id": str(lead_id), "score": 5},
    )
    assert r.status_code == 201, r.text

    # Depois de avaliar: perfil público expõe rating=5.0 e total_reviews=1.
    after = await client.get(
        f"/api/v1/users/{pro_id}/professional-profile", headers=_auth(customer)
    )
    assert after.status_code == 200, after.text
    body_after = after.json()
    assert body_after["rating"] == 5.0
    assert body_after["total_reviews"] == 1


# --------------------------------------------------------------------------- #
# BUG 2 — avaliar contratante SEM customer_profile cria o perfil e persiste
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_review_customer_without_profile_creates_and_persists(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Profissional avalia um contratante que NÃO tem ``customer_profile``.

    O perfil deve ser criado (get-or-create) e a ``reputation_score`` gravada
    na mesma transação da review (BUG 2)."""
    async with session_maker() as s:
        # Contratante SEM customer_profile.
        customer = await _make_customer_without_profile(s, email="c9@t.com")
        cat = await _make_category(s, slug="vidraceiro")
        pro_user, profile = await _make_professional(
            s, email="p9@t.com", city="Ariquemes", state="RO",
            category_ids=[cat.id],
        )
        lead = await _make_lead(s, customer=customer, category=cat)
        await _make_purchase(s, lead=lead, profile=profile)
        lead_id = lead.id
        customer_id = customer.id
        await s.commit()

        # Garante o pré-requisito: o contratante realmente não tem perfil.
        no_profile = (
            await s.execute(
                select(CustomerProfile).where(
                    CustomerProfile.user_id == customer_id
                )
            )
        ).scalar_one_or_none()
        assert no_profile is None

    # Profissional avalia o contratante (4★).
    r = await client.post(
        "/api/v1/reviews/",
        headers=_auth(pro_user),
        json={"lead_id": str(lead_id), "score": 4},
    )
    assert r.status_code == 201, r.text

    # O customer_profile foi criado e a reputação persistiu (média 4.00).
    async with session_maker() as s:
        created = (
            await s.execute(
                select(CustomerProfile).where(
                    CustomerProfile.user_id == customer_id
                )
            )
        ).scalar_one()
        assert float(created.reputation_score) == 4.0
        # Defaults mínimos: city/state nulos.
        assert created.city is None
        assert created.state is None
