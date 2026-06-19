"""Router agregador da API.

Agrega todos os routers de domínio sob o prefixo `/api/v1`. Nesta fase,
apenas o health check está montado; os demais módulos serão incluídos nas
próximas fases.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.health import router as health_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(health_router)
