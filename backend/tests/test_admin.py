"""Testes async da feature ``admin`` (Fase 10 — Administração MVP).

Cobre (conforme a tarefa):
- não-admin recebe ``403`` em ``/admin/*`` (RBAC — §RN-ADM-05);
- admin vê as métricas (contagens + financeiro);
- admin bloqueia um usuário (``status`` muda + auditoria gravada);
- admin **não** bloqueia a si mesmo (``422``);
- listagens paginam (``{items, page, page_size, total}``).

Estratégia (self-contained, espelha ``test_payments.py``): engine SQLite async em
memória; ``app.dependency_overrides[get_db]`` injeta a sessão; auth via
``create_access_token``. O usuário **admin** é criado direto via ORM (não há
registro de admin pela API).
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
    AuditLog,
    Base,
    Category,
    CategoryTier,
    CreditPackage,
    Lead,
    LeadStatus,
    LeadType,
    LeadUrgency,
    PaymentOrder,
    PaymentOrderStatus,
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
    status: UserStatus = UserStatus.active,
) -> User:
    user = User(
        name=name,
        email=email,
        password_hash="x",
        role=role,
        status=status,
    )
    session.add(user)
    await session.flush()
    return user


async def _make_admin(session: AsyncSession, *, email: str = "admin@t.com") -> User:
    """Cria um admin direto via ORM (não há registro de admin pela API)."""
    return await _make_user(
        session, role=UserRole.admin, email=email, name="Admin"
    )


async def _make_category(session: AsyncSession, *, slug: str = "eletricista") -> Category:
    category = Category(
        name=slug.title(), slug=slug, tier=CategoryTier.medium, active=True
    )
    session.add(category)
    await session.flush()
    return category


async def _make_lead(
    session: AsyncSession,
    *,
    customer: User,
    category: Category,
    status: LeadStatus = LeadStatus.open,
    city: str = "Ariquemes",
) -> Lead:
    lead = Lead(
        customer_id=customer.id,
        category_id=category.id,
        title="Trocar tomada",
        description="Detalhe",
        lead_type=LeadType.one_time,
        urgency=LeadUrgency.today,
        city=city,
        state="RO",
        status=status,
        credits_cost=3,
    )
    session.add(lead)
    await session.flush()
    return lead


async def _make_package(session: AsyncSession) -> CreditPackage:
    package = CreditPackage(
        name="Starter", credits=10, price_cents=1990, currency="BRL", active=True
    )
    session.add(package)
    await session.flush()
    return package


async def _make_paid_order(
    session: AsyncSession,
    *,
    user: User,
    package: CreditPackage,
    amount_cents: int = 1990,
    credits: int = 10,
    status: PaymentOrderStatus = PaymentOrderStatus.paid,
) -> PaymentOrder:
    order = PaymentOrder(
        user_id=user.id,
        package_id=package.id,
        provider="dev",
        amount_cents=amount_cents,
        credits=credits,
        currency="BRL",
        status=status,
        external_reference=f"dev_{uuid.uuid4().hex}",
    )
    session.add(order)
    await session.flush()
    return order


# --------------------------------------------------------------------------- #
# RBAC — não-admin recebe 403 em /admin/*
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_non_admin_forbidden_on_all_admin_routes(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Customer e professional recebem 403 em qualquer ``/admin/*`` (§RN-ADM-05)."""
    async with session_maker() as s:
        customer = await _make_user(s, role=UserRole.customer, email="c@t.com")
        professional = await _make_user(
            s, role=UserRole.professional, email="p@t.com"
        )
        await s.commit()

    routes = [
        ("get", "/api/v1/admin/metrics"),
        ("get", "/api/v1/admin/users"),
        ("get", f"/api/v1/admin/users/{uuid.uuid4()}"),
        ("get", "/api/v1/admin/leads"),
        ("get", "/api/v1/admin/payments"),
        ("get", "/api/v1/admin/audit"),
    ]
    for who in (customer, professional):
        for method, path in routes:
            resp = await getattr(client, method)(path, headers=_auth(who))
            assert resp.status_code == 403, f"{method} {path} -> {resp.status_code}"

    # PATCH status também é 403 para não-admin.
    patch_resp = await client.patch(
        f"/api/v1/admin/users/{uuid.uuid4()}/status",
        headers=_auth(customer),
        json={"status": "blocked"},
    )
    assert patch_resp.status_code == 403, patch_resp.text


@pytest.mark.asyncio
async def test_admin_routes_require_auth(client: httpx.AsyncClient) -> None:
    """Sem token → 401 (não autenticado)."""
    resp = await client.get("/api/v1/admin/metrics")
    assert resp.status_code == 401, resp.text


# --------------------------------------------------------------------------- #
# Métricas
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_admin_sees_metrics(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Admin vê métricas: contagens por papel/status + financeiro (§8)."""
    async with session_maker() as s:
        admin = await _make_admin(s)
        c1 = await _make_user(s, role=UserRole.customer, email="c1@t.com")
        await _make_user(s, role=UserRole.customer, email="c2@t.com")
        await _make_user(s, role=UserRole.professional, email="p1@t.com")
        category = await _make_category(s)
        await _make_lead(s, customer=c1, category=category, status=LeadStatus.open)
        await _make_lead(
            s, customer=c1, category=category, status=LeadStatus.purchased
        )
        package = await _make_package(s)
        await _make_paid_order(
            s, user=c1, package=package, amount_cents=1990, credits=10
        )
        await _make_paid_order(
            s, user=c1, package=package, amount_cents=4990, credits=30
        )
        await _make_paid_order(
            s,
            user=c1,
            package=package,
            amount_cents=990,
            credits=5,
            status=PaymentOrderStatus.pending,
        )
        await s.commit()

    resp = await client.get("/api/v1/admin/metrics", headers=_auth(admin))
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["users"]["customer"] == 2
    assert body["users"]["professional"] == 1
    assert body["users"]["admin"] == 1
    assert body["users"]["total"] == 4
    assert body["customers"] == 2
    assert body["professionals"] == 1

    assert body["leads"]["open"] == 1
    assert body["leads"]["purchased"] == 1
    assert body["leads"]["total"] == 2

    # Financeiro: só os 2 pagos contam (1990 + 4990 = 6980 centavos).
    assert body["finance"]["paid_orders"] == 2
    assert body["finance"]["revenue_cents"] == 6980
    assert body["finance"]["revenue_brl"] == 69.8
    assert body["credit_packages_sold"] == 40  # 10 + 30 (só pagos)
    assert body["reviews"] == 0
    assert body["conversations"] == 0


# --------------------------------------------------------------------------- #
# Bloquear usuário (status muda + auditoria gravada)
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_admin_blocks_user_changes_status_and_writes_audit(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Admin bloqueia um usuário: status → blocked + AuditLog gravado."""
    async with session_maker() as s:
        admin = await _make_admin(s)
        target = await _make_user(s, role=UserRole.professional, email="t@t.com")
        target_id = target.id
        await s.commit()

    resp = await client.patch(
        f"/api/v1/admin/users/{target_id}/status",
        headers=_auth(admin),
        json={"status": "blocked", "reason": "Fraude confirmada"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == UserStatus.blocked.value

    async with session_maker() as s:
        updated = (
            await s.execute(select(User).where(User.id == target_id))
        ).scalar_one()
        assert updated.status == UserStatus.blocked

        logs = (
            await s.execute(
                select(AuditLog).where(AuditLog.entity_id == target_id)
            )
        ).scalars().all()
        assert len(logs) == 1
        log = logs[0]
        assert log.action == "user_block"
        assert log.entity == "users"
        assert log.actor_id == admin.id
        assert log.meta is not None
        assert log.meta["reason"] == "Fraude confirmada"
        assert log.meta["new_status"] == "blocked"
        assert log.meta["old_status"] == "active"

    # A auditoria aparece em GET /admin/audit.
    audit = await client.get("/api/v1/admin/audit", headers=_auth(admin))
    assert audit.status_code == 200, audit.text
    audit_body = audit.json()
    assert audit_body["total"] == 1
    assert audit_body["items"][0]["action"] == "user_block"


@pytest.mark.asyncio
async def test_admin_cannot_block_self(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Admin não pode alterar o status da própria conta (§ Casos Especiais → 422)."""
    async with session_maker() as s:
        admin = await _make_admin(s)
        admin_id = admin.id
        await s.commit()

    resp = await client.patch(
        f"/api/v1/admin/users/{admin_id}/status",
        headers=_auth(admin),
        json={"status": "blocked", "reason": "teste"},
    )
    assert resp.status_code == 422, resp.text

    # Nenhuma auditoria foi gravada e o status segue active.
    async with session_maker() as s:
        me = (
            await s.execute(select(User).where(User.id == admin_id))
        ).scalar_one()
        assert me.status == UserStatus.active
        count = (await s.execute(select(AuditLog))).scalars().all()
        assert len(count) == 0


@pytest.mark.asyncio
async def test_update_status_unknown_user_404(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Status de usuário inexistente → 404."""
    async with session_maker() as s:
        admin = await _make_admin(s)
        await s.commit()

    resp = await client.patch(
        f"/api/v1/admin/users/{uuid.uuid4()}/status",
        headers=_auth(admin),
        json={"status": "suspended", "reason": "x"},
    )
    assert resp.status_code == 404, resp.text


# --------------------------------------------------------------------------- #
# Listagens paginam
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_user_list_paginates_and_filters(
    client: httpx.AsyncClient, session_maker
) -> None:
    """``GET /admin/users`` pagina e filtra por papel/busca."""
    async with session_maker() as s:
        admin = await _make_admin(s)
        for i in range(5):
            await _make_user(
                s, role=UserRole.professional, email=f"pro{i}@t.com", name=f"Pro {i}"
            )
        await _make_user(s, role=UserRole.customer, email="cust@t.com", name="Cust")
        await s.commit()

    # Página 1 com page_size=2 → 2 itens, total reflete todos (7 = 5 pro + 1 cust + admin).
    resp = await client.get(
        "/api/v1/admin/users?page=1&page_size=2", headers=_auth(admin)
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["page"] == 1
    assert body["page_size"] == 2
    assert len(body["items"]) == 2
    assert body["total"] == 7

    # Filtro por papel professional → 5.
    by_role = await client.get(
        "/api/v1/admin/users?role=professional&page_size=100",
        headers=_auth(admin),
    )
    assert by_role.status_code == 200
    assert by_role.json()["total"] == 5

    # Busca por nome.
    search = await client.get(
        "/api/v1/admin/users?q=cust&page_size=100", headers=_auth(admin)
    )
    assert search.status_code == 200
    assert search.json()["total"] == 1
    assert search.json()["items"][0]["email"] == "cust@t.com"


@pytest.mark.asyncio
async def test_lead_and_payment_listings_paginate(
    client: httpx.AsyncClient, session_maker
) -> None:
    """``GET /admin/leads`` e ``/admin/payments`` paginam (+ resumo financeiro)."""
    async with session_maker() as s:
        admin = await _make_admin(s)
        customer = await _make_user(s, role=UserRole.customer, email="c@t.com")
        category = await _make_category(s)
        for _ in range(3):
            await _make_lead(s, customer=customer, category=category)
        package = await _make_package(s)
        for _ in range(2):
            await _make_paid_order(s, user=customer, package=package)
        await s.commit()

    leads = await client.get(
        "/api/v1/admin/leads?page=1&page_size=2", headers=_auth(admin)
    )
    assert leads.status_code == 200, leads.text
    lbody = leads.json()
    assert lbody["total"] == 3
    assert len(lbody["items"]) == 2
    assert lbody["page_size"] == 2

    payments = await client.get(
        "/api/v1/admin/payments?page=1&page_size=1", headers=_auth(admin)
    )
    assert payments.status_code == 200, payments.text
    pbody = payments.json()
    assert pbody["total"] == 2
    assert len(pbody["items"]) == 1
    assert pbody["summary"]["paid_orders"] == 2
    assert pbody["summary"]["revenue_cents"] == 3980


# --------------------------------------------------------------------------- #
# Cancelar lead (admin) + auditoria
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_admin_cancels_lead_and_writes_audit(
    client: httpx.AsyncClient, session_maker
) -> None:
    """Admin cancela um lead → status cancelled + soft delete + auditoria."""
    async with session_maker() as s:
        admin = await _make_admin(s)
        customer = await _make_user(s, role=UserRole.customer, email="c@t.com")
        category = await _make_category(s)
        lead = await _make_lead(s, customer=customer, category=category)
        lead_id = lead.id
        await s.commit()

    resp = await client.patch(
        f"/api/v1/admin/leads/{lead_id}/cancel",
        headers=_auth(admin),
        json={"reason": "Lead inválido"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == LeadStatus.cancelled.value

    async with session_maker() as s:
        updated = (
            await s.execute(select(Lead).where(Lead.id == lead_id))
        ).scalar_one()
        assert updated.status == LeadStatus.cancelled
        assert updated.deleted_at is not None

        logs = (
            await s.execute(
                select(AuditLog).where(AuditLog.action == "lead_cancel")
            )
        ).scalars().all()
        assert len(logs) == 1
        assert logs[0].entity == "leads"
        assert logs[0].meta["reason"] == "Lead inválido"


@pytest.mark.asyncio
async def test_admin_get_user_detail(
    client: httpx.AsyncClient, session_maker
) -> None:
    """``GET /admin/users/{id}`` retorna o detalhe sem expor password_hash."""
    async with session_maker() as s:
        admin = await _make_admin(s)
        target = await _make_user(
            s, role=UserRole.customer, email="detail@t.com", name="Detail"
        )
        target_id = target.id
        await s.commit()

    resp = await client.get(
        f"/api/v1/admin/users/{target_id}", headers=_auth(admin)
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["email"] == "detail@t.com"
    assert "password_hash" not in body
