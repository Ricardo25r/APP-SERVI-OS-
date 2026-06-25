"""Rotas de **monitoramento** (Fase 12) — ``router = APIRouter()``.

Prefixo ``/monitoring`` (montado sob ``/api/v1``). **Todas** as rotas são
**admin-only** (``require_roles(UserRole.admin)``) — expõem métricas, saúde do
sistema e tracebacks de erro, que são informações sensíveis.

- ``GET /overview`` → métricas agregadas (req/min, latência, taxa de erro,
  CPU/memória/threads, ping do banco, erros 24h, série de latência, endpoints
  mais lentos).
- ``GET /errors``  → erros recentes (exceções 500) **com traceback**, para
  diagnóstico das linhas de código que falharam.
"""

from __future__ import annotations

import time
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import Response

from app.core import metrics
from app.core.alerts import alerts_status, send_test_alert
from app.core.config import settings
from app.core.deps import require_roles
from app.core.exceptions import NotFoundError
from app.core.ratelimit import rate_limit
from app.database.session import get_db
from app.models import ErrorLog, User, UserRole
from app.services.lead_recycle import recycle_expired_purchases

router = APIRouter()


class ClientErrorIn(BaseModel):
    """Erro de runtime do frontend reportado pelo navegador."""

    message: str = Field(max_length=4000)
    name: str | None = Field(default=None, max_length=160)
    stack: str | None = Field(default=None, max_length=12000)
    url: str | None = Field(default=None, max_length=512)


@router.post(
    "/client-error",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Reportar erro de runtime do frontend",
    dependencies=[Depends(rate_limit("clienterr", limit=30, window_seconds=60))],
)
async def report_client_error(
    payload: ClientErrorIn,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Grava um erro do navegador em ``error_logs`` (aparece no painel admin)."""
    log = ErrorLog(
        error_type=(payload.name or "ClientError")[:160],
        message=(payload.message or "Erro no frontend")[:4000],
        traceback=payload.stack,
        path=payload.url,
        method="CLIENT",
        status_code=0,
    )
    db.add(log)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/recycle-leads", summary="Reciclar leads não contatados (admin)")
async def recycle_leads(
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Dispara manualmente o reciclo de leads comprados e não contatados."""
    recycled = await recycle_expired_purchases(db, now=datetime.now(UTC))
    return {"recycled": recycled}


@router.get("/overview", summary="Visão geral de monitoramento (admin)")
async def overview(
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Métricas agregadas + saúde do sistema (somente admin)."""
    snap = metrics.snapshot()

    # Ping do banco (latência de um SELECT 1).
    db_latency_ms: float | None = None
    t0 = time.perf_counter()
    try:
        await db.execute(text("SELECT 1"))
        db_latency_ms = round((time.perf_counter() - t0) * 1000, 1)
    except Exception:  # noqa: BLE001 - saúde do banco é informativa
        db_latency_ms = None

    # Erros (exceções 500) nas últimas 24h.
    since = datetime.now(UTC) - timedelta(hours=24)
    errors_24h = (
        await db.execute(
            select(func.count())
            .select_from(ErrorLog)
            .where(ErrorLog.created_at >= since)
        )
    ).scalar_one()

    # Status geral: degradado se há 500 recente ou banco indisponível.
    if db_latency_ms is None or snap["server_errors_5m"] > 0:
        status_label = "degraded"
    else:
        status_label = "ok"

    return {
        **snap,
        "db_latency_ms": db_latency_ms,
        "errors_24h": int(errors_24h),
        "status": status_label,
        "alerts": alerts_status(),
    }


@router.get("/errors", summary="Erros recentes com traceback (admin)")
async def recent_errors(
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=200),
) -> dict:
    """Lista os erros (500) mais recentes com o traceback completo."""
    rows = (
        await db.execute(
            select(ErrorLog).order_by(ErrorLog.created_at.desc()).limit(limit)
        )
    ).scalars().all()
    items = [
        {
            "id": str(e.id),
            "created_at": e.created_at.isoformat(),
            "error_type": e.error_type,
            "message": e.message,
            "path": e.path,
            "method": e.method,
            "status_code": e.status_code,
            "request_id": e.request_id,
            "traceback": e.traceback,
        }
        for e in rows
    ]
    return {"items": items, "count": len(items)}


@router.delete("/errors", summary="Limpar os erros registrados (admin)")
async def clear_errors(
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Apaga os registros de erro do painel (ex.: depois de resolver/revisar).
    Não afeta o sistema — só limpa o histórico exibido no monitoramento."""
    result = await db.execute(delete(ErrorLog))
    await db.commit()
    return {"deleted": int(result.rowcount or 0)}


@router.post("/test-error", summary="Dispara um erro de teste (admin, só em debug)")
async def test_error(
    _admin: User = Depends(require_roles(UserRole.admin)),
) -> dict:
    """Levanta uma exceção proposital para validar a captura no painel.

    Disponível **apenas** com ``APP_DEBUG`` (inerte/404 em produção) e somente
    para admin — é uma ferramenta de diagnóstico, não uma rota funcional.
    """
    if not settings.APP_DEBUG:
        raise NotFoundError("Recurso não encontrado.")
    raise RuntimeError(
        "Erro de teste do painel de monitoramento (intencional)."
    )


@router.post("/test-alert", summary="Envia um alerta de teste por e-mail (admin)")
async def test_alert(
    _admin: User = Depends(require_roles(UserRole.admin)),
) -> dict:
    """Dispara um alerta de teste. Retorna ``sent`` (e-mail enviado) ou
    ``dev-log`` (SMTP não configurado — alerta só registrado no log)."""
    result = await send_test_alert()
    return {"result": result}
