"""Ponto de entrada da FazTudo API.

Cria o app FastAPI, configura CORS, registra um middleware simples de logging
e monta o router agregador (`/api/v1`).
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from datetime import UTC, datetime

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import Response

from app.api import api_router
from app.core import alerts, metrics
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import setup_logging
from app.core.ws_manager import ws_manager
from app.database.session import async_session_maker
from app.services.lead_recycle import (
    recycle_expired_purchases,
    reopen_no_show_purchases,
)
from app.services.winback import send_winback_batch

setup_logging()

logger = logging.getLogger("faztudo.api")

# A documentação interativa e o schema OpenAPI ficam desativados em QUALQUER
# ambiente que não seja explicitamente de desenvolvimento/teste (reduz a
# superfície de exposição — laudo 2026-06-24, V12). Antes só "production"
# fechava; "staging" ou um APP_ENV mal definido deixava /docs aberto.
_docs_enabled = settings.APP_ENV in ("development", "test")
_is_production = not _docs_enabled

app = FastAPI(
    title="FazTudo API",
    version="0.1.0",
    debug=settings.APP_DEBUG,
    docs_url=None if _is_production else "/docs",
    redoc_url=None if _is_production else "/redoc",
    openapi_url=None if _is_production else "/openapi.json",
)

# Handlers globais para as exceções de domínio (§3.9).
register_exception_handlers(app)

# CORS — origens lidas de CORS_ORIGINS (contrato Fase 1).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def observability_middleware(request: Request, call_next) -> Response:
    """Logging + coleta de métricas (latência/status) por request.

    Gera um ``request_id`` (correlaciona com ``error_logs``) e registra a amostra
    no coletor — inclusive quando o handler levanta exceção (conta como 500).
    """
    request.state.request_id = uuid.uuid4().hex
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        elapsed_ms = (time.perf_counter() - start) * 1000
        metrics.record_request(request.method, request.url.path, 500, elapsed_ms)
        raise
    elapsed_ms = (time.perf_counter() - start) * 1000
    metrics.record_request(
        request.method, request.url.path, response.status_code, elapsed_ms
    )
    # Alerta de lentidão (erros 5xx já alertam pelo handler de exceção).
    if elapsed_ms > settings.ALERT_SLOW_MS and response.status_code < 500:
        alerts.alert_slow(request.url.path, request.method, elapsed_ms)
    logger.info(
        "%s %s -> %s (%.1f ms)",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response


# Monta os routers da API sob /api/v1.
app.include_router(api_router)


@app.get("/", tags=["root"])
async def root() -> dict[str, str]:
    """Endpoint raiz informativo."""
    return {"app": "FazTudo API", "docs": "/docs", "health": "/api/v1/health"}


@app.on_event("startup")
async def _start_recycle_worker() -> None:
    """Worker em background: devolve ao mercado leads comprados e não contatados
    dentro da janela (``contact_deadline``). Best-effort; nunca derruba o app."""
    if not settings.CONTACT_RECYCLE_ENABLED:
        return

    async def _loop() -> None:
        interval = max(settings.CONTACT_RECYCLE_INTERVAL_SECONDS, 30)
        while True:
            await asyncio.sleep(interval)
            try:
                async with async_session_maker() as session:
                    now = datetime.now(UTC)
                    # 1) Não contatados na janela (refund). 2) Não compareceram
                    #    até o prazo de chegada (sem refund, +1 no_show).
                    await recycle_expired_purchases(session, now=now)
                    await reopen_no_show_purchases(session, now=now)
            except Exception:  # noqa: BLE001 - worker best-effort
                logger.exception("Falha no worker de reciclo de leads")

    asyncio.create_task(_loop())
    logger.info("Worker de reciclo de leads iniciado.")


@app.on_event("startup")
async def _start_winback_worker() -> None:
    """Worker em background: re-engaja usuários inativos por push (#53).
    Best-effort; respeita preferências/throttle/cooldown; nunca derruba o app."""
    if not settings.WINBACK_ENABLED:
        return

    async def _loop() -> None:
        interval = max(settings.WINBACK_INTERVAL_SECONDS, 600)
        while True:
            await asyncio.sleep(interval)
            try:
                async with async_session_maker() as session:
                    now = datetime.now(UTC)
                    sent = await send_winback_batch(session, now=now)
                    if sent:
                        logger.info("Win-back: %d push enviado(s).", sent)
            except Exception:  # noqa: BLE001 - worker best-effort
                logger.exception("Falha no worker de win-back")

    asyncio.create_task(_loop())
    logger.info("Worker de win-back iniciado.")


@app.on_event("startup")
async def _start_ws_listener() -> None:
    """Consumidor Redis do chat em tempo real (#59) — um por worker uvicorn."""
    await ws_manager.start_listener()
    logger.info("WS listener do chat iniciado.")
