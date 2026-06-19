"""Testes async da feature ``payments`` (Fase 6) — compra de créditos.

Cobre (conforme a tarefa):
- listar pacotes (``GET /payments/packages``);
- criar pedido (``pending``, retorna ``pix_code``/``checkout_url``);
- confirmar via dev/confirm credita a carteira (``CreditTransaction`` ``purchase``)
  e muda o status → ``paid`` (§5.1);
- webhook DUPLICADO não credita 2× (idempotência — §2.4 / §5.3);
- refund (admin) devolve créditos e status → ``refunded`` (§5.4);
- webhook com assinatura inválida → ``401`` (HMAC — §9.1).

Estratégia (self-contained, espelha ``test_credits_purchases.py``): engine
SQLite async em memória; ``app.dependency_overrides[get_db]`` injeta a sessão;
auth via ``create_access_token``.

> **``SELECT FOR UPDATE`` em SQLite:** não é suportado — o repositório aplica o
> ``with_for_update()`` condicionalmente ao dialeto (no-op em SQLite). A
> idempotência é validada pela unicidade (``external_reference``/
> ``provider_event_id``) + checagem de status, que valem em qualquer dialeto.
"""

from __future__ import annotations

import json
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
    CreditPackage,
    CreditTransaction,
    CreditTransactionType,
    CreditWallet,
    PaymentOrder,
    PaymentOrderStatus,
    ProfessionalProfile,
    User,
    UserRole,
    UserStatus,
)
from app.services.payments.dev import SIGNATURE_HEADER, compute_signature
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


async def _make_professional(
    session: AsyncSession,
    *,
    email: str,
    balance: int = 0,
) -> tuple[User, ProfessionalProfile]:
    """Cria usuário professional + perfil + wallet."""
    user = await _make_user(session, role=UserRole.professional, email=email)
    profile = ProfessionalProfile(user_id=user.id, city="Ariquemes", state="RO")
    session.add(profile)
    await session.flush()
    session.add(CreditWallet(professional_id=profile.id, balance=balance))
    await session.flush()
    return user, profile


async def _make_package(
    session: AsyncSession,
    *,
    name: str = "Starter",
    credits: int = 10,
    price_cents: int = 1990,
    active: bool = True,
) -> CreditPackage:
    package = CreditPackage(
        name=name,
        credits=credits,
        price_cents=price_cents,
        currency="BRL",
        active=active,
    )
    session.add(package)
    await session.flush()
    return package


# --------------------------------------------------------------------------- #
# Pacotes
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_list_packages(client: httpx.AsyncClient, session_maker) -> None:
    """``GET /payments/packages`` lista os pacotes ativos (§4 #1)."""
    async with session_maker() as s:
        await _make_package(s, name="Starter", credits=10, price_cents=1990)
        await _make_package(s, name="Elite", credits=250, price_cents=24990)
        await _make_package(
            s, name="Antigo", credits=5, price_cents=990, active=False
        )
        await s.commit()

    resp = await client.get("/api/v1/payments/packages")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    names = {p["name"] for p in body}
    assert names == {"Starter", "Elite"}  # inativo não aparece
    starter = next(p for p in body if p["name"] == "Starter")
    assert starter["credits"] == 10
    assert starter["price_cents"] == 1990
    assert starter["currency"] == "BRL"


# --------------------------------------------------------------------------- #
# Criar pedido
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_create_order_pending_with_charge(
    client: httpx.AsyncClient, session_maker
) -> None:
    """``POST /payments/orders`` cria pedido ``pending`` com pix/checkout (§4 #2)."""
    async with session_maker() as s:
        pro, _ = await _make_professional(s, email="p1@t.com", balance=0)
        pkg = await _make_package(s, name="Starter", credits=10, price_cents=1990)
        pkg_id = pkg.id
        await s.commit()

    resp = await client.post(
        "/api/v1/payments/orders",
        headers=_auth(pro),
        json={"package_id": str(pkg_id)},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["status"] == PaymentOrderStatus.pending.value
    assert body["amount_cents"] == 1990  # snapshot do preço
    assert body["credits"] == 10  # snapshot dos créditos
    assert body["provider"] == "dev"
    assert body["pix_code"]  # cobrança fake gerada
    assert body["checkout_url"]
    assert body["external_reference"].startswith("dev_")
    # Não creditou nada na criação.
    assert body["paid_at"] is None


@pytest.mark.asyncio
async def test_create_order_unknown_package_404(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Pacote inexistente → 404 (§4 #2)."""
    async with session_maker() as s:
        pro, _ = await _make_professional(s, email="p404@t.com")
        await s.commit()

    resp = await client.post(
        "/api/v1/payments/orders",
        headers=_auth(pro),
        json={"package_id": str(uuid.uuid4())},
    )
    assert resp.status_code == 404, resp.text


# --------------------------------------------------------------------------- #
# Confirmação (dev/confirm) credita a carteira
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_dev_confirm_credits_wallet_and_marks_paid(
    client: httpx.AsyncClient, session_maker
) -> None:
    """``dev/confirm`` credita a carteira (purchase) e muda status → paid (§5.1)."""
    async with session_maker() as s:
        pro, profile = await _make_professional(s, email="p2@t.com", balance=0)
        pkg = await _make_package(s, name="Starter", credits=10, price_cents=1990)
        pkg_id = pkg.id
        profile_id = profile.id
        await s.commit()

    created = await client.post(
        "/api/v1/payments/orders",
        headers=_auth(pro),
        json={"package_id": str(pkg_id)},
    )
    assert created.status_code == 201, created.text
    order_id = created.json()["id"]

    confirm = await client.post(
        f"/api/v1/payments/dev/confirm/{order_id}",
        headers=_auth(pro),
        json={"event": "paid"},
    )
    assert confirm.status_code == 200, confirm.text
    body = confirm.json()
    assert body["status"] == PaymentOrderStatus.paid.value
    assert body["paid_at"] is not None

    # Carteira creditada com os 10 créditos via CreditTransaction(purchase).
    async with session_maker() as s:
        wallet = (
            await s.execute(
                select(CreditWallet).where(
                    CreditWallet.professional_id == profile_id
                )
            )
        ).scalar_one()
        assert wallet.balance == 10

        txs = (
            await s.execute(
                select(CreditTransaction).where(
                    CreditTransaction.wallet_id == wallet.id
                )
            )
        ).scalars().all()
        assert len(txs) == 1
        assert txs[0].transaction_type == CreditTransactionType.purchase
        assert txs[0].amount == 10
        assert txs[0].balance_before == 0
        assert txs[0].balance_after == 10

        order = (
            await s.execute(
                select(PaymentOrder).where(
                    PaymentOrder.id == uuid.UUID(order_id)
                )
            )
        ).scalar_one()
        assert order.status == PaymentOrderStatus.paid
        assert order.provider_event_id is not None
        assert order.credit_transaction_id == txs[0].id


# --------------------------------------------------------------------------- #
# Webhook idempotente — evento duplicado não credita 2×
# --------------------------------------------------------------------------- #
def _signed_webhook(external_reference: str, event_id: str, event_type: str):
    """Monta ``(body, headers)`` assinados como o provedor dev espera."""
    payload = {
        "external_reference": external_reference,
        "event_id": event_id,
        "type": event_type,
    }
    body = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    headers = {
        SIGNATURE_HEADER: compute_signature(body),
        "content-type": "application/json",
    }
    return body, headers


@pytest.mark.asyncio
async def test_webhook_duplicate_event_does_not_credit_twice(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Webhook duplicado (mesmo external_reference) → não credita 2× (§5.3)."""
    async with session_maker() as s:
        pro, profile = await _make_professional(s, email="p3@t.com", balance=0)
        pkg = await _make_package(s, name="Starter", credits=10, price_cents=1990)
        pkg_id = pkg.id
        profile_id = profile.id
        await s.commit()

    created = await client.post(
        "/api/v1/payments/orders",
        headers=_auth(pro),
        json={"package_id": str(pkg_id)},
    )
    assert created.status_code == 201
    external_reference = created.json()["external_reference"]

    body, headers = _signed_webhook(
        external_reference, "evt-1", "payment.paid"
    )

    # 1ª entrega: credita.
    r1 = await client.post(
        "/api/v1/payments/webhook", content=body, headers=headers
    )
    assert r1.status_code == 200, r1.text
    assert r1.json()["received"] is True

    # 2ª entrega (mesmo evento): no-op idempotente, sem 2º crédito.
    r2 = await client.post(
        "/api/v1/payments/webhook", content=body, headers=headers
    )
    assert r2.status_code == 200, r2.text

    # 3ª entrega com OUTRO event_id, mesmo pedido: pedido já paid → no-op.
    body3, headers3 = _signed_webhook(
        external_reference, "evt-2", "payment.paid"
    )
    r3 = await client.post(
        "/api/v1/payments/webhook", content=body3, headers=headers3
    )
    assert r3.status_code == 200, r3.text

    # Exatamente uma CreditTransaction(purchase) e saldo = 10 (não 20/30).
    async with session_maker() as s:
        wallet = (
            await s.execute(
                select(CreditWallet).where(
                    CreditWallet.professional_id == profile_id
                )
            )
        ).scalar_one()
        assert wallet.balance == 10

        txs = (
            await s.execute(
                select(CreditTransaction).where(
                    CreditTransaction.wallet_id == wallet.id,
                    CreditTransaction.transaction_type
                    == CreditTransactionType.purchase,
                )
            )
        ).scalars().all()
        assert len(txs) == 1


@pytest.mark.asyncio
async def test_webhook_invalid_signature_401(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Webhook com assinatura HMAC inválida/ausente → 401 (§9.1)."""
    async with session_maker() as s:
        pro, _ = await _make_professional(s, email="p4@t.com", balance=0)
        pkg = await _make_package(s, name="Starter", credits=10, price_cents=1990)
        pkg_id = pkg.id
        await s.commit()

    created = await client.post(
        "/api/v1/payments/orders",
        headers=_auth(pro),
        json={"package_id": str(pkg_id)},
    )
    external_reference = created.json()["external_reference"]

    body, _ = _signed_webhook(external_reference, "evt-x", "payment.paid")

    # Assinatura errada.
    bad = await client.post(
        "/api/v1/payments/webhook",
        content=body,
        headers={SIGNATURE_HEADER: "deadbeef", "content-type": "application/json"},
    )
    assert bad.status_code == 401, bad.text

    # Assinatura ausente.
    missing = await client.post(
        "/api/v1/payments/webhook",
        content=body,
        headers={"content-type": "application/json"},
    )
    assert missing.status_code == 401, missing.text


# --------------------------------------------------------------------------- #
# Refund (admin)
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_refund_returns_credits_and_marks_refunded(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Refund (admin) devolve créditos e status → refunded (§5.4)."""
    async with session_maker() as s:
        admin = await _make_user(s, role=UserRole.admin, email="admin@t.com")
        pro, profile = await _make_professional(s, email="p5@t.com", balance=0)
        pkg = await _make_package(s, name="Starter", credits=10, price_cents=1990)
        pkg_id = pkg.id
        profile_id = profile.id
        await s.commit()

    # Cria + paga o pedido.
    created = await client.post(
        "/api/v1/payments/orders",
        headers=_auth(pro),
        json={"package_id": str(pkg_id)},
    )
    order_id = created.json()["id"]
    confirm = await client.post(
        f"/api/v1/payments/dev/confirm/{order_id}",
        headers=_auth(pro),
        json={"event": "paid"},
    )
    assert confirm.status_code == 200
    assert confirm.json()["status"] == PaymentOrderStatus.paid.value

    # Estorno pelo admin.
    refund = await client.post(
        f"/api/v1/payments/orders/{order_id}/refund",
        headers=_auth(admin),
        json={"reason": "Teste de estorno"},
    )
    assert refund.status_code == 200, refund.text
    assert refund.json()["status"] == PaymentOrderStatus.refunded.value
    assert refund.json()["refunded_at"] is not None

    # Saldo voltou a 0 (creditou 10 no paid, estornou +10 no refund = 20?) — NÃO:
    # refund devolve os créditos do pedido (entrada +10). O saldo após paid era
    # 10; um refund "puro" (§5.4) é uma entrada positiva, então o saldo sobe.
    # A regra do contrato é devolver os créditos do pedido (amount>0).
    async with session_maker() as s:
        wallet = (
            await s.execute(
                select(CreditWallet).where(
                    CreditWallet.professional_id == profile_id
                )
            )
        ).scalar_one()
        # 10 (purchase) + 10 (refund) = 20.
        assert wallet.balance == 20

        refund_txs = (
            await s.execute(
                select(CreditTransaction).where(
                    CreditTransaction.wallet_id == wallet.id,
                    CreditTransaction.transaction_type
                    == CreditTransactionType.refund,
                )
            )
        ).scalars().all()
        assert len(refund_txs) == 1
        assert refund_txs[0].amount == 10


@pytest.mark.asyncio
async def test_refund_non_paid_order_409(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Refund de pedido não pago → 409 (§4 #7)."""
    async with session_maker() as s:
        admin = await _make_user(s, role=UserRole.admin, email="admin2@t.com")
        pro, _ = await _make_professional(s, email="p6@t.com", balance=0)
        pkg = await _make_package(s, name="Starter", credits=10, price_cents=1990)
        pkg_id = pkg.id
        await s.commit()

    created = await client.post(
        "/api/v1/payments/orders",
        headers=_auth(pro),
        json={"package_id": str(pkg_id)},
    )
    order_id = created.json()["id"]  # ainda pending

    refund = await client.post(
        f"/api/v1/payments/orders/{order_id}/refund",
        headers=_auth(admin),
        json={},
    )
    assert refund.status_code == 409, refund.text


@pytest.mark.asyncio
async def test_refund_requires_admin(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Refund exige role admin (§5.2 → 403 para professional)."""
    async with session_maker() as s:
        pro, _ = await _make_professional(s, email="p7@t.com", balance=0)
        pkg = await _make_package(s, name="Starter", credits=10, price_cents=1990)
        pkg_id = pkg.id
        await s.commit()

    created = await client.post(
        "/api/v1/payments/orders",
        headers=_auth(pro),
        json={"package_id": str(pkg_id)},
    )
    order_id = created.json()["id"]

    refund = await client.post(
        f"/api/v1/payments/orders/{order_id}/refund",
        headers=_auth(pro),
        json={},
    )
    assert refund.status_code == 403, refund.text
