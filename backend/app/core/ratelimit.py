"""Rate limiting simples baseado em Redis (INCR + EXPIRE).

Usado como **dependency por rota** (login/registro/reset/suporte) para conter
brute-force e spam. Chaveado por **IP + escopo**. **Fail-open**: se o Redis
estiver indisponível, NÃO bloqueia o request (disponibilidade > limite).
"""

from __future__ import annotations

import logging

import redis.asyncio as aioredis
from fastapi import HTTPException, Request, status

from app.core.config import settings

logger = logging.getLogger("faztudo.ratelimit")

_client: aioredis.Redis | None = None


def _redis() -> aioredis.Redis:
    global _client
    if _client is None:
        _client = aioredis.from_url(
            settings.REDIS_URL, encoding="utf-8", decode_responses=True
        )
    return _client


def _client_ip(request: Request) -> str:
    """IP REAL do cliente para a chave de rate limit.

    Atrás do Cloudflare, o IP confiável é ``CF-Connecting-IP`` (setado pela CF; o
    cliente não consegue forjar quando o ingress só aceita conexões da CF). NÃO
    confiamos no ``X-Forwarded-For`` cru: o primeiro token é controlado pelo
    cliente e permitiria burlar o rate limit (brute-force) só rotacionando o
    valor a cada requisição.
    """
    cf = request.headers.get("cf-connecting-ip")
    if cf:
        return cf.strip()
    return request.client.host if request.client else "unknown"


def rate_limit(scope: str, *, limit: int, window_seconds: int):
    """Dependency: limita ``limit`` requisições por ``window_seconds`` (IP+escopo).

    Excedeu → ``429`` com header ``Retry-After``.
    """

    async def dependency(request: Request) -> None:
        key = f"rl:{scope}:{_client_ip(request)}"
        try:
            client = _redis()
            count = await client.incr(key)
            if count == 1:
                await client.expire(key, window_seconds)
            if count > limit:
                ttl = await client.ttl(key)
                retry = max(ttl, 1)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=(
                        "Muitas tentativas. Tente novamente em "
                        f"{retry} segundo(s)."
                    ),
                    headers={"Retry-After": str(retry)},
                )
        except HTTPException:
            raise
        except Exception:  # noqa: BLE001 - fail-open se o Redis cair
            logger.warning(
                "Rate limit indisponível (Redis); liberando request (%s).", scope
            )

    return dependency


__all__ = ["rate_limit"]
