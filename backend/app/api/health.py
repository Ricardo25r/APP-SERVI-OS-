"""Health check endpoint.

Responde em `GET /api/v1/health` quando montado pelo router agregador.
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    """Verifica se a API está no ar."""
    return {"status": "ok"}
