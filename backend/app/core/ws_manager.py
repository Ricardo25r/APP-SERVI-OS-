"""Gerenciador de conexões WebSocket do chat em tempo real (#59).

Produção roda **2 workers uvicorn** — um dicionário em memória não basta, porque
a mensagem gravada no worker A precisa alcançar o socket que está no worker B.
Solução: **Redis pub/sub**. Cada worker mantém suas conexões locais e assina um
canal Redis; ao enviar uma mensagem, publica-se o evento e o worker que tiver o
socket do destinatário entrega. Sem Redis (dev, 1 worker) cai no modo local.

Tudo best-effort: uma falha no tempo real **nunca** quebra o envio da mensagem
(que é persistido normalmente e continua chegando pelo polling de fallback).
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid

from fastapi import WebSocket

logger = logging.getLogger("app.core.ws_manager")

_CHANNEL = "faztudo:chat:ws"


class ConnectionManager:
    """Conexões WebSocket locais do worker + ponte Redis entre workers."""

    def __init__(self) -> None:
        self._local: dict[uuid.UUID, set[WebSocket]] = {}
        self._listener: asyncio.Task | None = None

    # -- conexões locais ------------------------------------------------ #
    def register(self, user_id: uuid.UUID, ws: WebSocket) -> None:
        self._local.setdefault(user_id, set()).add(ws)

    def unregister(self, user_id: uuid.UUID, ws: WebSocket) -> None:
        conns = self._local.get(user_id)
        if conns is not None:
            conns.discard(ws)
            if not conns:
                self._local.pop(user_id, None)

    async def _send_one(
        self, user_id: uuid.UUID, ws: WebSocket, payload: dict
    ) -> None:
        """Envia a um socket com timeout — um cliente lento não trava os demais."""
        try:
            await asyncio.wait_for(ws.send_json(payload), timeout=5)
        except Exception:  # noqa: BLE001 - lento/morto: remove e fecha
            self.unregister(user_id, ws)
            try:
                await ws.close()
            except Exception:  # noqa: BLE001
                pass

    async def _deliver_local(self, user_id: uuid.UUID, payload: dict) -> None:
        conns = list(self._local.get(user_id, ()))
        if not conns:
            return
        # Concorrente: um socket congestionado não bloqueia a entrega aos outros.
        await asyncio.gather(
            *(self._send_one(user_id, ws, payload) for ws in conns),
            return_exceptions=True,
        )

    # -- publicação cross-worker --------------------------------------- #
    async def publish(self, user_id: uuid.UUID, payload: dict) -> None:
        """Publica um evento para o usuário em todos os workers (fail-soft)."""
        try:
            from app.core.ratelimit import _redis

            await _redis().publish(
                _CHANNEL,
                json.dumps({"user_id": str(user_id), "payload": payload}),
            )
        except Exception:  # noqa: BLE001 - sem Redis: entrega só local
            await self._deliver_local(user_id, payload)

    async def start_listener(self) -> None:
        """Inicia (uma vez por worker) o consumidor do canal Redis."""
        if self._listener is not None:
            return
        self._listener = asyncio.create_task(self._listen())

    async def _listen(self) -> None:
        while True:
            pubsub = None
            try:
                from app.core.ratelimit import _redis

                pubsub = _redis().pubsub()
                await pubsub.subscribe(_CHANNEL)
                logger.info("WS listener inscrito em %s", _CHANNEL)
                async for msg in pubsub.listen():
                    if msg.get("type") != "message":
                        continue
                    raw = msg.get("data")
                    if isinstance(raw, bytes):
                        raw = raw.decode("utf-8", "ignore")
                    try:
                        data = json.loads(raw)
                        uid = uuid.UUID(data["user_id"])
                    except Exception:  # noqa: BLE001 - payload inválido
                        continue
                    await self._deliver_local(uid, data.get("payload") or {})
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001 - resiliente a queda do Redis
                logger.exception("WS listener caiu; retry em 5s")
                await asyncio.sleep(5)
            finally:
                # Fecha o pubsub anterior antes de recriar (evita vazar conexão
                # quando o Redis fica subindo/caindo — flapping).
                if pubsub is not None:
                    try:
                        await pubsub.aclose()
                    except Exception:  # noqa: BLE001
                        pass


ws_manager = ConnectionManager()
