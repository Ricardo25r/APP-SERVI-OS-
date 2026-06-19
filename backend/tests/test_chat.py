"""Testes async da feature ``chat`` (Fase 8).

Cobre (conforme a tarefa):
- a compra de lead **cria** a conversa (abertura automática na mesma transação —
  chat-engine §3.2), com customer = dono do lead e professional = usuário
  comprador, e a mensagem de sistema "Contato liberado" (§3.6);
- ambos os participantes enviam e leem mensagens (recibo de leitura — §3.12);
- um **terceiro** usuário não acessa nem envia → 403 (§3.3 — anti-IDOR);
- **uma** conversa por lead (UNIQUE lead_id) — get-or-create idempotente.

Estratégia (self-contained, espelha ``test_credits_purchases.py``):
- engine SQLite async em memória (``aiosqlite``); ``Base.metadata.create_all``;
- ``app.dependency_overrides[get_db]`` injeta a sessão de teste;
- usuários/categorias/perfis/lead semeados via ORM;
- auth via ``create_access_token`` (claim ``type=access``).

> O ``SELECT ... FOR UPDATE`` da compra é no-op em SQLite (o repositório aplica o
> lock condicionalmente ao dialeto) — validamos a lógica funcional do chat.
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
    Conversation,
    CreditWallet,
    Lead,
    LeadStatus,
    LeadType,
    LeadUrgency,
    Message,
    ProfessionalCategory,
    ProfessionalProfile,
    User,
    UserRole,
    UserStatus,
)
from app.services.chat import CONTACT_RELEASED_MESSAGE
from sqlalchemy import select
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
    session: AsyncSession, *, slug: str, tier: CategoryTier
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
    balance: int = 100,
    name: str = "Profissional",
) -> tuple[User, ProfessionalProfile]:
    user = await _make_user(
        session, role=UserRole.professional, email=email, name=name
    )
    profile = ProfessionalProfile(user_id=user.id, city=city, state=state)
    session.add(profile)
    await session.flush()
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
        status=LeadStatus.open,
        credits_cost=credits_cost,
    )
    session.add(lead)
    await session.flush()
    return lead


async def _seed_purchasable(
    session_maker: async_sessionmaker[AsyncSession],
) -> tuple[User, User, uuid.UUID]:
    """Cria customer (dono), professional elegível e um lead aberto.

    Retorna (customer, professional, lead_id). A compra pelo professional dispara
    a abertura automática da conversa.
    """
    async with session_maker() as s:
        customer = await _make_user(
            s,
            role=UserRole.customer,
            email="dono@t.com",
            name="Dona do Lead",
            phone="+5569999990000",
        )
        cat = await _make_category(s, slug="encanador", tier=CategoryTier.medium)
        pro, _ = await _make_professional(
            s,
            email="pro@t.com",
            city="Ariquemes",
            state="RO",
            category_ids=[cat.id],
            balance=20,
            name="Encanador Pro",
        )
        lead = await _make_lead(s, customer=customer, category=cat, credits_cost=3)
        lead_id = lead.id
        await s.commit()
    return customer, pro, lead_id


async def _buy_lead(
    client: httpx.AsyncClient, pro: User, lead_id: uuid.UUID
) -> None:
    resp = await client.post(
        "/api/v1/lead-purchases/",
        headers=_auth(pro),
        json={"lead_id": str(lead_id)},
    )
    assert resp.status_code == 201, resp.text


# --------------------------------------------------------------------------- #
# Testes
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_purchase_creates_conversation_with_system_message(
    client: httpx.AsyncClient, session_maker
) -> None:
    """A compra do lead cria a conversa (customer/professional) + msg de sistema."""
    customer, pro, lead_id = await _seed_purchasable(session_maker)
    await _buy_lead(client, pro, lead_id)

    # Conversa persistida: 1 por lead, status active, participantes corretos.
    async with session_maker() as s:
        convs = (await s.execute(select(Conversation))).scalars().all()
        assert len(convs) == 1
        conv = convs[0]
        assert conv.lead_id == lead_id
        assert conv.customer_id == customer.id
        assert conv.professional_id == pro.id

        msgs = (
            await s.execute(
                select(Message).where(Message.conversation_id == conv.id)
            )
        ).scalars().all()
        assert len(msgs) == 1
        assert msgs[0].message == CONTACT_RELEASED_MESSAGE
        assert msgs[0].sender_id == pro.id

    # Ambos os participantes veem a conversa na própria listagem.
    for participant, counterpart_name in (
        (customer, "Encanador Pro"),
        (pro, "Dona do Lead"),
    ):
        resp = await client.get(
            "/api/v1/chat/conversations", headers=_auth(participant)
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["total"] == 1
        item = body["items"][0]
        assert item["lead_id"] == str(lead_id)
        assert item["counterpart"]["name"] == counterpart_name
        assert item["lead"]["title"] == "Serviço de teste"
        assert item["last_message"]["message"] == CONTACT_RELEASED_MESSAGE


@pytest.mark.asyncio
async def test_both_participants_exchange_and_read_messages(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Ambos enviam/leem; ``read_at`` é marcado ao abrir o histórico (§3.12)."""
    customer, pro, lead_id = await _seed_purchasable(session_maker)
    await _buy_lead(client, pro, lead_id)

    # Descobre o conversation_id pela listagem do customer.
    listing = await client.get(
        "/api/v1/chat/conversations", headers=_auth(customer)
    )
    conv_id = listing.json()["items"][0]["id"]

    # Customer envia uma mensagem.
    send_cust = await client.post(
        f"/api/v1/chat/conversations/{conv_id}/messages",
        headers=_auth(customer),
        json={"message": "Olá, pode vir amanhã?"},
    )
    assert send_cust.status_code == 201, send_cust.text
    assert send_cust.json()["sender_id"] == str(customer.id)
    assert send_cust.json()["read_at"] is None

    # Profissional responde.
    send_pro = await client.post(
        f"/api/v1/chat/conversations/{conv_id}/messages",
        headers=_auth(pro),
        json={"message": "Posso sim, às 9h."},
    )
    assert send_pro.status_code == 201, send_pro.text
    assert send_pro.json()["sender_id"] == str(pro.id)

    # Profissional abre o histórico: vê as 3 mensagens (sistema + 2) em ordem,
    # e a mensagem recebida do customer é marcada como lida.
    hist_pro = await client.get(
        f"/api/v1/chat/conversations/{conv_id}/messages", headers=_auth(pro)
    )
    assert hist_pro.status_code == 200, hist_pro.text
    items = hist_pro.json()["items"]
    assert hist_pro.json()["total"] == 3
    assert [m["message"] for m in items] == [
        CONTACT_RELEASED_MESSAGE,
        "Olá, pode vir amanhã?",
        "Posso sim, às 9h.",
    ]
    cust_msg = next(m for m in items if m["sender_id"] == str(customer.id))
    assert cust_msg["read_at"] is not None  # marcada como lida pelo profissional

    # Para o customer, agora há 0 não-lidas das mensagens do profissional? Não:
    # ele ainda não abriu o histórico após a resposta do pro → unread >= 1.
    conv_for_customer = await client.get(
        f"/api/v1/chat/conversations/{conv_id}", headers=_auth(customer)
    )
    assert conv_for_customer.status_code == 200
    assert conv_for_customer.json()["unread_count"] >= 1

    # Customer abre o histórico → zera não-lidas dele.
    await client.get(
        f"/api/v1/chat/conversations/{conv_id}/messages", headers=_auth(customer)
    )
    conv_after = await client.get(
        f"/api/v1/chat/conversations/{conv_id}", headers=_auth(customer)
    )
    assert conv_after.json()["unread_count"] == 0


@pytest.mark.asyncio
async def test_third_user_forbidden_403(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Terceiro usuário não acessa nem envia na conversa (§3.3 → 403)."""
    customer, pro, lead_id = await _seed_purchasable(session_maker)
    await _buy_lead(client, pro, lead_id)

    listing = await client.get(
        "/api/v1/chat/conversations", headers=_auth(customer)
    )
    conv_id = listing.json()["items"][0]["id"]

    async with session_maker() as s:
        intruder = await _make_user(
            s, role=UserRole.customer, email="intruso@t.com", name="Intruso"
        )
        await s.commit()

    # GET detalhe → 403.
    r_get = await client.get(
        f"/api/v1/chat/conversations/{conv_id}", headers=_auth(intruder)
    )
    assert r_get.status_code == 403, r_get.text

    # GET mensagens → 403.
    r_msgs = await client.get(
        f"/api/v1/chat/conversations/{conv_id}/messages", headers=_auth(intruder)
    )
    assert r_msgs.status_code == 403, r_msgs.text

    # POST mensagem → 403.
    r_post = await client.post(
        f"/api/v1/chat/conversations/{conv_id}/messages",
        headers=_auth(intruder),
        json={"message": "deixa eu entrar"},
    )
    assert r_post.status_code == 403, r_post.text

    # O intruso não vê nenhuma conversa na própria lista.
    r_list = await client.get(
        "/api/v1/chat/conversations", headers=_auth(intruder)
    )
    assert r_list.status_code == 200
    assert r_list.json()["total"] == 0


@pytest.mark.asyncio
async def test_unknown_conversation_404(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Conversa inexistente → 404."""
    _, pro, _ = await _seed_purchasable(session_maker)
    resp = await client.get(
        f"/api/v1/chat/conversations/{uuid.uuid4()}", headers=_auth(pro)
    )
    assert resp.status_code == 404, resp.text


@pytest.mark.asyncio
async def test_one_conversation_per_lead_idempotent(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Get-or-create idempotente: chamar de novo reusa a conversa (UNIQUE lead_id)."""
    customer, pro, lead_id = await _seed_purchasable(session_maker)
    await _buy_lead(client, pro, lead_id)

    async with session_maker() as s:
        before = (await s.execute(select(Conversation))).scalars().all()
        assert len(before) == 1
        conv_id = before[0].id

        # Chamada defensiva direta do service: deve reusar (sem duplicar).
        from app.services.chat import ChatService

        service = ChatService(s)
        again = await service.get_or_create_for_lead(
            lead_id=lead_id,
            customer_id=customer.id,
            professional_id=pro.id,
        )
        await s.commit()
        assert again.id == conv_id

        after = (await s.execute(select(Conversation))).scalars().all()
        assert len(after) == 1


@pytest.mark.asyncio
async def test_empty_message_rejected_422(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Mensagem vazia/só espaços → 422 (validação de schema/serviço — §3.9)."""
    customer, pro, lead_id = await _seed_purchasable(session_maker)
    await _buy_lead(client, pro, lead_id)

    listing = await client.get(
        "/api/v1/chat/conversations", headers=_auth(customer)
    )
    conv_id = listing.json()["items"][0]["id"]

    resp = await client.post(
        f"/api/v1/chat/conversations/{conv_id}/messages",
        headers=_auth(customer),
        json={"message": "   "},
    )
    assert resp.status_code == 422, resp.text
