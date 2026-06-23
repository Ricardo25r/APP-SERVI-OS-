"""Testes da **confirmação de serviço** (anti no-show) — código de chegada,
"não compareceu" do cliente e o worker de reabertura automática.

Regras (decididas com o dono):
- a compra gera um ``arrival_code`` (4 dígitos) visível **só para o cliente
  dono** do lead (ele mostra ao profissional ao recebê-lo);
- o **profissional** confirma a chegada digitando o código (``403`` se errado,
  ``409`` se já confirmada);
- o **cliente** pode marcar "não compareceu" → reabre a vaga (``open``), **sem
  reembolso** e ``+1`` em ``no_show_count`` na reputação; ``409`` se já chegou;
- o **worker** ``reopen_no_show_purchases`` reabre sozinho quando o prazo de
  chegada (``no_show_deadline``) expira sem chegada confirmada.

Infra self-contained (espelha ``test_credits_purchases.py``): SQLite async em
memória + ``get_db`` sobrescrito + seeds via ORM.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta

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
)
from app.services.lead_recycle import reopen_no_show_purchases
from sqlalchemy import select
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)


# --------------------------------------------------------------------------- #
# Infra de teste
# --------------------------------------------------------------------------- #
@pytest_asyncio.fixture
async def session_maker() -> AsyncGenerator[async_sessionmaker[AsyncSession], None]:
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
    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with session_maker() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.pop(get_db, None)


def _auth(user: User) -> dict[str, str]:
    token = create_access_token(str(user.id), extra_claims={"role": user.role.value})
    return {"Authorization": f"Bearer {token}"}


# --------------------------------------------------------------------------- #
# Seeds
# --------------------------------------------------------------------------- #
async def _make_user(
    session: AsyncSession, *, role: UserRole, email: str, name: str = "Test"
) -> User:
    user = User(
        name=name, email=email, password_hash="x", role=role, status=UserStatus.active
    )
    session.add(user)
    await session.flush()
    return user


async def _make_category(session: AsyncSession, *, slug: str) -> Category:
    category = Category(name=slug, slug=slug, tier=CategoryTier.medium, active=True)
    session.add(category)
    await session.flush()
    return category


async def _make_professional(
    session: AsyncSession, *, email: str, category_id: uuid.UUID, balance: int = 10
) -> tuple[User, ProfessionalProfile]:
    user = await _make_user(session, role=UserRole.professional, email=email)
    profile = ProfessionalProfile(user_id=user.id, city="Ariquemes", state="RO")
    session.add(profile)
    await session.flush()
    session.add(CreditWallet(professional_id=profile.id, balance=balance))
    session.add(
        ProfessionalCategory(professional_id=profile.id, category_id=category_id)
    )
    await session.flush()
    return user, profile


async def _make_lead(
    session: AsyncSession,
    *,
    customer: User,
    category: Category,
    cost: int = 3,
    lat: float | None = None,
    lng: float | None = None,
) -> Lead:
    lead = Lead(
        customer_id=customer.id,
        category_id=category.id,
        title="Serviço de teste",
        description="Descrição do serviço de teste.",
        lead_type=LeadType.one_time,
        urgency=LeadUrgency.today,
        city="Ariquemes",
        state="RO",
        status=LeadStatus.open,
        credits_cost=cost,
        latitude=lat,
        longitude=lng,
    )
    session.add(lead)
    await session.flush()
    return lead


# Coordenadas do lead semeado (Ariquemes/RO) — usadas na prova de presença.
_LEAD_LAT, _LEAD_LNG = -9.91, -63.03


async def _seed(session_maker) -> dict:
    """Cliente + profissional + lead aberto. Devolve os ids/usuários."""
    async with session_maker() as s:
        customer = await _make_user(
            s, role=UserRole.customer, email="cli@t.com", name="Cliente"
        )
        cat = await _make_category(s, slug="encanador")
        pro, profile = await _make_professional(s, email="pro@t.com", category_id=cat.id)
        lead = await _make_lead(
            s, customer=customer, category=cat, cost=3, lat=_LEAD_LAT, lng=_LEAD_LNG
        )
        out = {
            "customer": customer,
            "pro": pro,
            "profile_id": profile.id,
            "lead_id": lead.id,
        }
        await s.commit()
    return out


async def _purchase(client: httpx.AsyncClient, pro: User, lead_id: uuid.UUID) -> dict:
    resp = await client.post(
        "/api/v1/lead-purchases/", headers=_auth(pro), json={"lead_id": str(lead_id)}
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# --------------------------------------------------------------------------- #
# Testes
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_arrival_code_visible_only_to_owner(
    client: httpx.AsyncClient, session_maker
) -> None:
    """A compra gera um código de 4 dígitos visível só para o cliente dono."""
    ctx = await _seed(session_maker)
    body = await _purchase(client, ctx["pro"], ctx["lead_id"])
    purchase_id = body["purchase"]["id"]

    # Cliente dono vê o código de chegada no detalhe do lead.
    owner = await client.get(
        f"/api/v1/leads/{ctx['lead_id']}", headers=_auth(ctx["customer"])
    )
    assert owner.status_code == 200, owner.text
    code = owner.json()["arrival_code"]
    assert code is not None and len(code) == 4 and code.isdigit()
    assert owner.json()["arrived"] is False

    # Profissional (no detalhe da compra) NÃO recebe o código (é do cliente).
    pro_view = await client.get(
        f"/api/v1/lead-purchases/{purchase_id}", headers=_auth(ctx["pro"])
    )
    assert pro_view.status_code == 200
    assert pro_view.json()["lead"]["arrival_code"] is None


@pytest.mark.asyncio
async def test_confirm_arrival_wrong_then_right_then_conflict(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Código errado → 403; certo → confirma; repetido → 409."""
    ctx = await _seed(session_maker)
    body = await _purchase(client, ctx["pro"], ctx["lead_id"])
    purchase_id = body["purchase"]["id"]

    owner = await client.get(
        f"/api/v1/leads/{ctx['lead_id']}", headers=_auth(ctx["customer"])
    )
    code = owner.json()["arrival_code"]

    base = f"/api/v1/lead-purchases/{purchase_id}/confirmar-chegada"
    wrong = "0000" if code != "0000" else "1111"
    r_wrong = await client.post(base, headers=_auth(ctx["pro"]), json={"code": wrong})
    assert r_wrong.status_code == 403, r_wrong.text

    r_ok = await client.post(base, headers=_auth(ctx["pro"]), json={"code": code})
    assert r_ok.status_code == 200, r_ok.text
    assert r_ok.json()["arrived_at"] is not None

    r_again = await client.post(base, headers=_auth(ctx["pro"]), json={"code": code})
    assert r_again.status_code == 409, r_again.text

    # Após confirmada, o código some para o cliente e ``arrived`` fica True.
    owner2 = await client.get(
        f"/api/v1/leads/{ctx['lead_id']}", headers=_auth(ctx["customer"])
    )
    assert owner2.json()["arrived"] is True
    assert owner2.json()["arrival_code"] is None


@pytest.mark.asyncio
async def test_no_show_reopens_without_refund_and_marks_reputation(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Cliente marca não comparecimento → lead reabre, sem reembolso, +1 no_show."""
    ctx = await _seed(session_maker)
    await _purchase(client, ctx["pro"], ctx["lead_id"])

    resp = await client.post(
        f"/api/v1/lead-purchases/lead/{ctx['lead_id']}/nao-compareceu",
        headers=_auth(ctx["customer"]),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["reopened"] is True

    async with session_maker() as s:
        lead = (
            await s.execute(select(Lead).where(Lead.id == ctx["lead_id"]))
        ).scalar_one()
        assert lead.status == LeadStatus.open  # reaberto

        purchases = (await s.execute(select(LeadPurchase))).scalars().all()
        assert purchases == []  # compra removida (libera o UNIQUE)

        wallet = (
            await s.execute(
                select(CreditWallet).where(
                    CreditWallet.professional_id == ctx["profile_id"]
                )
            )
        ).scalar_one()
        assert wallet.balance == 7  # SEM reembolso (10 - 3 = 7)

        profile = (
            await s.execute(
                select(ProfessionalProfile).where(
                    ProfessionalProfile.id == ctx["profile_id"]
                )
            )
        ).scalar_one()
        assert profile.no_show_count == 1


@pytest.mark.asyncio
async def test_no_show_after_arrival_conflicts(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Depois da chegada confirmada, o cliente não pode marcar não comparecimento."""
    ctx = await _seed(session_maker)
    body = await _purchase(client, ctx["pro"], ctx["lead_id"])
    purchase_id = body["purchase"]["id"]

    owner = await client.get(
        f"/api/v1/leads/{ctx['lead_id']}", headers=_auth(ctx["customer"])
    )
    code = owner.json()["arrival_code"]
    confirm = await client.post(
        f"/api/v1/lead-purchases/{purchase_id}/confirmar-chegada",
        headers=_auth(ctx["pro"]),
        json={"code": code},
    )
    assert confirm.status_code == 200

    resp = await client.post(
        f"/api/v1/lead-purchases/lead/{ctx['lead_id']}/nao-compareceu",
        headers=_auth(ctx["customer"]),
    )
    assert resp.status_code == 409, resp.text


@pytest.mark.asyncio
async def test_worker_auto_reopens_expired_no_show(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Worker reabre sozinho quando o prazo de chegada expira sem chegada."""
    ctx = await _seed(session_maker)
    await _purchase(client, ctx["pro"], ctx["lead_id"])

    # Força o prazo de chegada no passado (compra não confirmada).
    async with session_maker() as s:
        purchase = (await s.execute(select(LeadPurchase))).scalar_one()
        purchase.no_show_deadline = datetime.now(UTC) - timedelta(minutes=1)
        await s.commit()

    async with session_maker() as s:
        reopened = await reopen_no_show_purchases(s, now=datetime.now(UTC))
        assert reopened == 1

    async with session_maker() as s:
        lead = (
            await s.execute(select(Lead).where(Lead.id == ctx["lead_id"]))
        ).scalar_one()
        assert lead.status == LeadStatus.open
        assert (await s.execute(select(LeadPurchase))).scalars().all() == []
        wallet = (
            await s.execute(
                select(CreditWallet).where(
                    CreditWallet.professional_id == ctx["profile_id"]
                )
            )
        ).scalar_one()
        assert wallet.balance == 7  # sem reembolso
        profile = (
            await s.execute(
                select(ProfessionalProfile).where(
                    ProfessionalProfile.id == ctx["profile_id"]
                )
            )
        ).scalar_one()
        assert profile.no_show_count == 1


@pytest.mark.asyncio
async def test_client_absent_with_presence_refunds_and_reopens(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Profissional comprova presença (GPS no local) → reembolsa + reabre + marca o cliente."""
    ctx = await _seed(session_maker)
    body = await _purchase(client, ctx["pro"], ctx["lead_id"])
    purchase_id = body["purchase"]["id"]

    resp = await client.post(
        f"/api/v1/lead-purchases/{purchase_id}/cliente-ausente",
        headers=_auth(ctx["pro"]),
        json={"latitude": _LEAD_LAT, "longitude": _LEAD_LNG, "reason": "absent"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["refunded"] is True

    async with session_maker() as s:
        lead = (
            await s.execute(select(Lead).where(Lead.id == ctx["lead_id"]))
        ).scalar_one()
        assert lead.status == LeadStatus.open
        assert (await s.execute(select(LeadPurchase))).scalars().all() == []
        wallet = (
            await s.execute(
                select(CreditWallet).where(
                    CreditWallet.professional_id == ctx["profile_id"]
                )
            )
        ).scalar_one()
        assert wallet.balance == 10  # reembolsado (7 + 3)
        customer = (
            await s.execute(select(User).where(User.id == ctx["customer"].id))
        ).scalar_one()
        assert customer.client_no_show_count == 1


@pytest.mark.asyncio
async def test_client_absent_far_away_is_blocked(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Longe do local (GPS não bate) → 409 e nada de reembolso/reabertura."""
    ctx = await _seed(session_maker)
    body = await _purchase(client, ctx["pro"], ctx["lead_id"])
    purchase_id = body["purchase"]["id"]

    resp = await client.post(
        f"/api/v1/lead-purchases/{purchase_id}/cliente-ausente",
        headers=_auth(ctx["pro"]),
        json={"latitude": -23.55, "longitude": -46.63},  # São Paulo (longe)
    )
    assert resp.status_code == 409, resp.text

    async with session_maker() as s:
        wallet = (
            await s.execute(
                select(CreditWallet).where(
                    CreditWallet.professional_id == ctx["profile_id"]
                )
            )
        ).scalar_one()
        assert wallet.balance == 7  # NÃO reembolsado
        lead = (
            await s.execute(select(Lead).where(Lead.id == ctx["lead_id"]))
        ).scalar_one()
        assert lead.status == LeadStatus.purchased  # segue com o profissional


@pytest.mark.asyncio
async def test_confirm_completion_closes_lead(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Cliente confirma a conclusão → lead encerrado (closed)."""
    ctx = await _seed(session_maker)
    await _purchase(client, ctx["pro"], ctx["lead_id"])

    resp = await client.post(
        f"/api/v1/lead-purchases/lead/{ctx['lead_id']}/concluir",
        headers=_auth(ctx["customer"]),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["completed"] is True

    async with session_maker() as s:
        lead = (
            await s.execute(select(Lead).where(Lead.id == ctx["lead_id"]))
        ).scalar_one()
        assert lead.status == LeadStatus.closed


@pytest.mark.asyncio
async def test_review_allowed_after_completion(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Avaliação continua liberada mesmo com o lead encerrado (não filtra status)."""
    ctx = await _seed(session_maker)
    await _purchase(client, ctx["pro"], ctx["lead_id"])
    await client.post(
        f"/api/v1/lead-purchases/lead/{ctx['lead_id']}/concluir",
        headers=_auth(ctx["customer"]),
    )

    review = await client.post(
        "/api/v1/reviews/",
        headers=_auth(ctx["customer"]),
        json={"lead_id": str(ctx["lead_id"]), "score": 5, "comment": "Ótimo"},
    )
    assert review.status_code in (200, 201), review.text
