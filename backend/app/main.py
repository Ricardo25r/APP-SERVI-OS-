"""Ponto de entrada da FazTudo API.

Cria o app FastAPI, configura CORS, registra um middleware simples de logging
e monta o router agregador (`/api/v1`).
"""

from __future__ import annotations

import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import Response

from app.api import api_router
from app.core import metrics
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import setup_logging

setup_logging()

logger = logging.getLogger("faztudo.api")

# Em produção, a documentação interativa e o schema OpenAPI ficam desativados
# (reduz superfície de exposição). Fora de produção, mantém os padrões do FastAPI.
_is_production = settings.APP_ENV == "production"

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
    allow_methods=["*"],
    allow_headers=["*"],
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
