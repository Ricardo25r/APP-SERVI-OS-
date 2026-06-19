"""Ponto de entrada da FazTudo API.

Cria o app FastAPI, configura CORS, registra um middleware simples de logging
e monta o router agregador (`/api/v1`).
"""

from __future__ import annotations

import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import Response

from app.api import api_router
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import setup_logging

setup_logging()

logger = logging.getLogger("faztudo.api")

app = FastAPI(
    title="FazTudo API",
    version="0.1.0",
    debug=settings.APP_DEBUG,
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
async def log_requests(request: Request, call_next) -> Response:
    """Middleware simples de logging: método, caminho, status e duração."""
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
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
