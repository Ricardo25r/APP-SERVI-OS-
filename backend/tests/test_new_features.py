"""Testes async das features novas (Fases 11–18).

Cobre: notificações, chamados de suporte, conquistas, ranking/me, ``level_min_xp``,
reset de senha (token dev + confirm) e ``contact_deadline`` na compra de lead.

Infra self-contained (espelha ``test_gamification.py``): SQLite async em memória,
``app.dependency_overrides[get_db]`` e auth via ``create_access_token``.
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
    Conversation,
    ConversationStatus,
    CreditWallet,
    CustomerProfile,
    Lead,
    LeadPurchase,
    LeadStatus,
    LeadType,
    LeadUrgency,
    Message,
    Notification,
    ProfessionalCategory,
    ProfessionalProfile,
    User,
    UserRole,
    UserStatus,
)
from app.services.gamification import level_for_xp
from app.services.lead_recycle import recycle_expired_purchases
from sqlalchemy import select
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)


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
# Seed helpers
# --------------------------------------------------------------------------- #
async def _make_user(
    session: AsyncSession, *, role: UserRole, email: str, name: str = "Test"
) -> User:
    user = User(
        name=name, email=email, password_hash="x", role=role,
        status=UserStatus.active,
    )
    session.add(user)
    await session.flush()
    return user


async def _make_category(session: AsyncSession, *, slug: str) -> Category:
    cat = Category(name=slug, slug=slug, tier=CategoryTier.medium, active=True)
    session.add(cat)
    await session.flush()
    return cat


async def _make_professional(
    session: AsyncSession, *, email: str, category_ids: list[uuid.UUID],
    name: str = "Pro", balance: int = 0, xp: int = 0,
    bio: str | None = None, city: str = "Ariquemes", state: str = "RO",
) -> tuple[User, ProfessionalProfile]:
    user = await _make_user(session, role=UserRole.professional, email=email, name=name)
    profile = ProfessionalProfile(
        user_id=user.id, city=city, state=state, headline=f"{name} headline",
        bio=bio, xp=xp, level=level_for_xp(xp)[0],
    )
    session.add(profile)
    await session.flush()
    for cid in category_ids:
        session.add(ProfessionalCategory(professional_id=profile.id, category_id=cid))
    session.add(CreditWallet(professional_id=profile.id, balance=balance))
    await session.flush()
    return user, profile


async def _make_customer(session: AsyncSession, *, email: str) -> User:
    user = await _make_user(session, role=UserRole.customer, email=email, name="Cliente")
    session.add(CustomerProfile(user_id=user.id, city="Ariquemes", state="RO"))
    await session.flush()
    return user


async def _make_lead(
    session: AsyncSession, *, customer: User, category: Category, credits_cost: int = 3
) -> Lead:
    lead = Lead(
        customer_id=customer.id, category_id=category.id, title="Serviço de teste",
        description="Descrição do serviço de teste.", lead_type=LeadType.one_time,
        urgency=LeadUrgency.today, city="Ariquemes", state="RO",
        status=LeadStatus.open, credits_cost=credits_cost,
    )
    session.add(lead)
    await session.flush()
    return lead


# --------------------------------------------------------------------------- #
# Notificações
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_notifications_list_unread_and_mark(
    client: httpx.AsyncClient, session_maker
) -> None:
    async with session_maker() as s:
        user = await _make_customer(s, email="notif@t.com")
        s.add(Notification(user_id=user.id, type="system", title="A", body="x"))
        s.add(Notification(user_id=user.id, type="message", title="B", body="y"))
        await s.commit()

    r = await client.get("/api/v1/notifications", headers=_auth(user))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] == 2
    assert body["unread"] == 2

    count = await client.get("/api/v1/notifications/unread-count", headers=_auth(user))
    assert count.json()["count"] == 2

    nid = body["items"][0]["id"]
    rd = await client.post(f"/api/v1/notifications/{nid}/read", headers=_auth(user))
    assert rd.status_code == 204
    after = await client.get("/api/v1/notifications/unread-count", headers=_auth(user))
    assert after.json()["count"] == 1

    ra = await client.post("/api/v1/notifications/read-all", headers=_auth(user))
    assert ra.status_code == 200
    final = await client.get("/api/v1/notifications/unread-count", headers=_auth(user))
    assert final.json()["count"] == 0


# --------------------------------------------------------------------------- #
# Chamados de suporte
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_support_ticket_flow(
    client: httpx.AsyncClient, session_maker
) -> None:
    async with session_maker() as s:
        user = await _make_customer(s, email="sup@t.com")
        admin = await _make_user(s, role=UserRole.admin, email="adm@t.com", name="Admin")
        await s.commit()

    create = await client.post(
        "/api/v1/support/tickets", headers=_auth(user),
        json={"subject": "Não consigo pagar", "message": "Erro ao comprar créditos."},
    )
    assert create.status_code == 201, create.text
    ticket_id = create.json()["id"]
    assert create.json()["status"] == "open"

    mine = await client.get("/api/v1/support/tickets/me", headers=_auth(user))
    assert mine.json()["total"] == 1

    # Admin vê todos + atualiza status.
    all_t = await client.get("/api/v1/support/tickets", headers=_auth(admin))
    assert all_t.status_code == 200
    assert all_t.json()["total"] == 1
    assert all_t.json()["items"][0]["user_email"] == "sup@t.com"

    patch = await client.patch(
        f"/api/v1/support/tickets/{ticket_id}", headers=_auth(admin),
        json={"status": "closed"},
    )
    assert patch.status_code == 200, patch.text
    assert patch.json()["status"] == "closed"

    # Customer não acessa a listagem de admin.
    forbidden = await client.get("/api/v1/support/tickets", headers=_auth(user))
    assert forbidden.status_code == 403


# --------------------------------------------------------------------------- #
# Conquistas
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_achievements_professional_earns(
    client: httpx.AsyncClient, session_maker
) -> None:
    async with session_maker() as s:
        customer = await _make_customer(s, email="ac@t.com")
        cat = await _make_category(s, slug="eletricista-ac")
        pro, profile = await _make_professional(
            s, email="proac@t.com", category_ids=[cat.id], balance=10,
            bio="Profissional experiente em instalações.",
        )
        lead = await _make_lead(s, customer=customer, category=cat)
        s.add(
            LeadPurchase(
                lead_id=lead.id, professional_id=profile.id,
                credits_used=lead.credits_cost,
            )
        )
        lead.status = LeadStatus.purchased
        await s.commit()

    r = await client.get("/api/v1/gamification/achievements", headers=_auth(pro))
    assert r.status_code == 200, r.text
    body = r.json()
    earned = {i["slug"] for i in body["items"] if i["earned"]}
    assert "perfil_completo" in earned   # headline+bio+cidade+categoria
    assert "primeiro_contato" in earned  # 1 compra
    assert body["total"] >= 6


@pytest.mark.asyncio
async def test_achievements_customer_all_locked(
    client: httpx.AsyncClient, session_maker
) -> None:
    async with session_maker() as s:
        customer = await _make_customer(s, email="acc@t.com")
        await s.commit()

    r = await client.get("/api/v1/gamification/achievements", headers=_auth(customer))
    assert r.status_code == 200
    assert r.json()["earned_count"] == 0


# --------------------------------------------------------------------------- #
# Ranking / minha posição
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_ranking_me_position(
    client: httpx.AsyncClient, session_maker
) -> None:
    async with session_maker() as s:
        cat = await _make_category(s, slug="rank-cat")
        await _make_professional(
            s, email="top@t.com", category_ids=[cat.id], xp=5000, name="Top"
        )
        low_user, _ = await _make_professional(
            s, email="low@t.com", category_ids=[cat.id], xp=100, name="Low"
        )
        await s.commit()

    r = await client.get("/api/v1/gamification/ranking/me", headers=_auth(low_user))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["is_ranked"] is True
    assert body["rank"] == 2
    assert body["total"] == 2


@pytest.mark.asyncio
async def test_ranking_me_customer_not_ranked(
    client: httpx.AsyncClient, session_maker
) -> None:
    async with session_maker() as s:
        customer = await _make_customer(s, email="rc@t.com")
        await s.commit()

    r = await client.get("/api/v1/gamification/ranking/me", headers=_auth(customer))
    assert r.status_code == 200
    assert r.json()["is_ranked"] is False
    assert r.json()["rank"] is None


# --------------------------------------------------------------------------- #
# /me inclui level_min_xp (piso do nível atual)
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_me_includes_level_min_xp(
    client: httpx.AsyncClient, session_maker
) -> None:
    async with session_maker() as s:
        cat = await _make_category(s, slug="mlx")
        pro, _ = await _make_professional(
            s, email="mlx@t.com", category_ids=[cat.id], xp=600,  # nível 2
        )
        await s.commit()

    r = await client.get("/api/v1/gamification/me", headers=_auth(pro))
    assert r.status_code == 200, r.text
    assert r.json()["level"] == 2
    assert r.json()["level_min_xp"] == 500  # piso do nível Confiável


# --------------------------------------------------------------------------- #
# Reset de senha (token dev + confirm troca a senha)
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_password_reset_request_and_confirm(
    client: httpx.AsyncClient, session_maker
) -> None:
    async with session_maker() as s:
        user = await _make_customer(s, email="reset@t.com")
        user_id = user.id
        await s.commit()

    req = await client.post(
        "/api/v1/auth/password-reset/request", json={"email": "reset@t.com"}
    )
    assert req.status_code == 200, req.text
    token = req.json()["reset_token"]
    assert token  # fora de produção o token vem no corpo

    conf = await client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"reset_token": token, "new_password": "novaSenha123"},
    )
    assert conf.status_code == 204, conf.text

    async with session_maker() as s:
        u = (await s.execute(select(User).where(User.id == user_id))).scalar_one()
        assert u.password_hash != "x"  # senha foi trocada (hash novo)


# --------------------------------------------------------------------------- #
# Compra de lead define contact_deadline (janela de 1h)
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_purchase_sets_contact_deadline(
    client: httpx.AsyncClient, session_maker
) -> None:
    async with session_maker() as s:
        customer = await _make_customer(s, email="cd@t.com")
        cat = await _make_category(s, slug="cd-cat")
        pro, _ = await _make_professional(
            s, email="cdpro@t.com", category_ids=[cat.id], balance=10,
        )
        lead = await _make_lead(s, customer=customer, category=cat)
        lead_id = lead.id
        await s.commit()

    r = await client.post(
        "/api/v1/lead-purchases/", headers=_auth(pro),
        json={"lead_id": str(lead_id)},
    )
    assert r.status_code == 201, r.text
    assert r.json()["purchase"]["contact_deadline"] is not None


# --------------------------------------------------------------------------- #
# Reciclo de lead não contatado (worker)
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_recycle_expired_lead_returns_to_market(session_maker) -> None:
    async with session_maker() as s:
        customer = await _make_customer(s, email="rec@t.com")
        cat = await _make_category(s, slug="rec-cat")
        pro, profile = await _make_professional(
            s, email="recpro@t.com", category_ids=[cat.id], balance=0
        )
        lead = await _make_lead(s, customer=customer, category=cat, credits_cost=3)
        s.add(
            LeadPurchase(
                lead_id=lead.id, professional_id=profile.id, credits_used=3,
                contact_deadline=datetime.now(UTC) - timedelta(minutes=5),
            )
        )
        lead.status = LeadStatus.purchased
        s.add(
            Conversation(
                lead_id=lead.id, customer_id=customer.id,
                professional_id=pro.id, status=ConversationStatus.active,
            )
        )
        await s.commit()
        lead_id, profile_id = lead.id, profile.id

    async with session_maker() as s:
        assert await recycle_expired_purchases(s, now=datetime.now(UTC)) == 1

    async with session_maker() as s:
        lead_row = (
            await s.execute(select(Lead).where(Lead.id == lead_id))
        ).scalar_one()
        assert lead_row.status == LeadStatus.open  # voltou ao mercado
        purchase = (
            await s.execute(
                select(LeadPurchase).where(LeadPurchase.lead_id == lead_id)
            )
        ).scalar_one_or_none()
        assert purchase is None  # compra removida (libera o lead p/ recompra)
        wallet = (
            await s.execute(
                select(CreditWallet).where(
                    CreditWallet.professional_id == profile_id
                )
            )
        ).scalar_one()
        assert wallet.balance == 3  # créditos devolvidos


@pytest.mark.asyncio
async def test_recycle_skips_contacted_lead(session_maker) -> None:
    async with session_maker() as s:
        customer = await _make_customer(s, email="rec2@t.com")
        cat = await _make_category(s, slug="rec2-cat")
        pro, profile = await _make_professional(
            s, email="rec2pro@t.com", category_ids=[cat.id], balance=0
        )
        lead = await _make_lead(s, customer=customer, category=cat, credits_cost=3)
        s.add(
            LeadPurchase(
                lead_id=lead.id, professional_id=profile.id, credits_used=3,
                contact_deadline=datetime.now(UTC) - timedelta(minutes=5),
            )
        )
        lead.status = LeadStatus.purchased
        conv = Conversation(
            lead_id=lead.id, customer_id=customer.id,
            professional_id=pro.id, status=ConversationStatus.active,
        )
        s.add(conv)
        await s.flush()
        s.add(Message(conversation_id=conv.id, sender_id=pro.id, message="Olá!"))
        await s.commit()
        lead_id = lead.id

    async with session_maker() as s:
        # Já houve contato (mensagem do profissional) → não recicla.
        assert await recycle_expired_purchases(s, now=datetime.now(UTC)) == 0

    async with session_maker() as s:
        lead_row = (
            await s.execute(select(Lead).where(Lead.id == lead_id))
        ).scalar_one()
        assert lead_row.status == LeadStatus.purchased
