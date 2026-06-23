"""Testes do módulo admin **Sprints / Esteira de Ideias**.

Cobre: score (unit), criação + evento de auditoria, KPIs, toggle de voto (cache
``votos_count``), baixar/reabrir (esteira→histórico), smart delete (vínculos +
confirmar), eventos de edição (status_mudou/editada), CRUD de sprint (delete põe
``sprint_id=NULL``) e validação de upload de anexo. SQLite async em memória.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta

import httpx
import pytest
import pytest_asyncio
from app.core.security import create_access_token
from app.database.session import get_db
from app.main import app
from app.models import Base, User, UserRole, UserStatus
from app.services.sprints_score import compute_score
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)


# --------------------------------------------------------------------------- #
# Infra
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


async def _admin(session_maker) -> User:
    async with session_maker() as s:
        admin = User(
            name="Admin",
            email="admin@faztudo.com",
            password_hash="x",
            role=UserRole.admin,
            status=UserStatus.active,
        )
        s.add(admin)
        await s.commit()
        await s.refresh(admin)
        return admin


_BASE = "/api/v1/admin/sprints"


# --------------------------------------------------------------------------- #
# Score (unit)
# --------------------------------------------------------------------------- #
def test_score_critica_bug_recente() -> None:
    # crítica(60) + bug(+5) + envelhecimento 0 + votos 0 = 65
    assert compute_score("critica", "bug", datetime.now(UTC), 0) == 65


def test_score_envelhecimento_e_votos_com_teto() -> None:
    antiga = datetime.now(UTC) - timedelta(days=100)
    # crítica(60) + bug(5) + min(100*1.5,25)=25 + min(10*3,15)=15 = 105 → teto 100
    assert compute_score("critica", "bug", antiga, 10) == 100


# --------------------------------------------------------------------------- #
# Fluxo via API
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_create_lista_kpis_e_evento(client, session_maker) -> None:
    admin = await _admin(session_maker)
    resp = await client.post(
        f"{_BASE}/ideas",
        headers=_auth(admin),
        json={"titulo": "Corrigir login", "tipo": "bug", "urgencia": "critica"},
    )
    assert resp.status_code == 201, resp.text
    idea = resp.json()
    assert idea["score"] == 65
    assert idea["autor_username"] == "admin@faztudo.com"
    assert any(e["tipo_evento"] == "criada" for e in idea["eventos"])

    lista = await client.get(f"{_BASE}/ideas?aba=ativa", headers=_auth(admin))
    assert lista.status_code == 200
    assert len(lista.json()["items"]) == 1

    kpis = await client.get(f"{_BASE}/kpis", headers=_auth(admin))
    assert kpis.json() == {
        "abertas": 1,
        "criticas": 1,
        "em_sprint": 0,
        "feitas_no_mes": 0,
    }


@pytest.mark.asyncio
async def test_voto_toggle(client, session_maker) -> None:
    admin = await _admin(session_maker)
    idea_id = (
        await client.post(
            f"{_BASE}/ideas",
            headers=_auth(admin),
            json={"titulo": "Ideia", "tipo": "ideia"},
        )
    ).json()["id"]

    r1 = await client.post(f"{_BASE}/ideas/{idea_id}/votar", headers=_auth(admin))
    assert r1.json() == {"votou": True, "votos_count": 1}
    r2 = await client.post(f"{_BASE}/ideas/{idea_id}/votar", headers=_auth(admin))
    assert r2.json() == {"votou": False, "votos_count": 0}


@pytest.mark.asyncio
async def test_baixar_reabrir_e_historico(client, session_maker) -> None:
    admin = await _admin(session_maker)
    idea_id = (
        await client.post(
            f"{_BASE}/ideas",
            headers=_auth(admin),
            json={"titulo": "Conserto", "tipo": "conserto"},
        )
    ).json()["id"]

    baixa = await client.post(f"{_BASE}/ideas/{idea_id}/baixar", headers=_auth(admin))
    assert baixa.json()["status"] == "feita"
    assert baixa.json()["feito_em"] is not None

    hist = await client.get(f"{_BASE}/ideas?aba=historico", headers=_auth(admin))
    assert len(hist.json()["items"]) == 1
    ativa = await client.get(f"{_BASE}/ideas?aba=ativa", headers=_auth(admin))
    assert ativa.json()["items"] == []

    reab = await client.post(f"{_BASE}/ideas/{idea_id}/reabrir", headers=_auth(admin))
    assert reab.json()["status"] == "aberta"
    assert reab.json()["feito_em"] is None


@pytest.mark.asyncio
async def test_update_gera_eventos(client, session_maker) -> None:
    admin = await _admin(session_maker)
    idea_id = (
        await client.post(
            f"{_BASE}/ideas",
            headers=_auth(admin),
            json={"titulo": "X", "tipo": "melhoria", "urgencia": "alta"},
        )
    ).json()["id"]

    upd = await client.put(
        f"{_BASE}/ideas/{idea_id}",
        headers=_auth(admin),
        json={"urgencia": "critica", "status": "em_andamento"},
    )
    assert upd.status_code == 200, upd.text
    tipos = [e["tipo_evento"] for e in upd.json()["eventos"]]
    assert "status_mudou" in tipos
    assert "editada" in tipos
    descricoes = [e["descricao"] for e in upd.json()["eventos"] if e["descricao"]]
    assert any("urgência: alta → critica" in d for d in descricoes)


@pytest.mark.asyncio
async def test_smart_delete(client, session_maker) -> None:
    admin = await _admin(session_maker)
    idea_id = (
        await client.post(
            f"{_BASE}/ideas",
            headers=_auth(admin),
            json={"titulo": "Com vínculo", "tipo": "bug"},
        )
    ).json()["id"]
    # cria vínculo (comentário)
    await client.post(
        f"{_BASE}/ideas/{idea_id}/comentarios",
        headers=_auth(admin),
        json={"texto": "teste"},
    )

    bloqueado = await client.request(
        "DELETE", f"{_BASE}/ideas/{idea_id}?confirmar=false", headers=_auth(admin)
    )
    assert bloqueado.json()["pode_excluir"] is False
    assert bloqueado.json()["vinculos"]

    ok = await client.request(
        "DELETE", f"{_BASE}/ideas/{idea_id}?confirmar=true", headers=_auth(admin)
    )
    assert ok.json()["excluida"] is True
    # sumiu
    nf = await client.get(f"{_BASE}/ideas/{idea_id}", headers=_auth(admin))
    assert nf.status_code == 404


@pytest.mark.asyncio
async def test_sprint_crud_e_desvincula(client, session_maker) -> None:
    admin = await _admin(session_maker)
    sprint_id = (
        await client.post(
            f"{_BASE}/sprints", headers=_auth(admin), json={"nome": "Sprint 1"}
        )
    ).json()["id"]
    idea_id = (
        await client.post(
            f"{_BASE}/ideas",
            headers=_auth(admin),
            json={"titulo": "Na sprint", "tipo": "bug", "sprint_id": sprint_id},
        )
    ).json()["id"]

    lst = await client.get(f"{_BASE}/sprints", headers=_auth(admin))
    s0 = lst.json()[0]
    assert s0["total_ideias"] == 1 and s0["progresso"] == 0

    await client.request(
        "DELETE", f"{_BASE}/sprints/{sprint_id}", headers=_auth(admin)
    )
    detail = await client.get(f"{_BASE}/ideas/{idea_id}", headers=_auth(admin))
    assert detail.json()["sprint_id"] is None  # FK SET NULL


@pytest.mark.asyncio
async def test_anexo_extensao_invalida(client, session_maker) -> None:
    admin = await _admin(session_maker)
    idea_id = (
        await client.post(
            f"{_BASE}/ideas",
            headers=_auth(admin),
            json={"titulo": "Y", "tipo": "bug"},
        )
    ).json()["id"]
    resp = await client.post(
        f"{_BASE}/ideas/{idea_id}/anexos",
        headers=_auth(admin),
        files={"file": ("malware.exe", b"x", "application/octet-stream")},
    )
    assert resp.status_code == 422, resp.text


@pytest.mark.asyncio
async def test_requer_admin(client, session_maker) -> None:
    async with session_maker() as s:
        prof = User(
            name="Pro",
            email="pro@t.com",
            password_hash="x",
            role=UserRole.professional,
            status=UserStatus.active,
        )
        s.add(prof)
        await s.commit()
        await s.refresh(prof)
    resp = await client.get(f"{_BASE}/kpis", headers=_auth(prof))
    assert resp.status_code == 403
