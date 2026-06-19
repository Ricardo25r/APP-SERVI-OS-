"""Teste do health check (`/api/v1/health`).

Usa httpx + ASGITransport para exercitar o app sem subir um servidor real.
"""

from __future__ import annotations

import httpx
import pytest
from app.main import app


@pytest.mark.asyncio
async def test_health_ok() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
