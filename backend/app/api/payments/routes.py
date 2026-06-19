"""Rotas da feature ``payments`` (Fase 6) — ``router = APIRouter()`` (§3.6).

Prefixo ``/payments`` é aplicado pelo agregador (``app.api.__init__``). Caminhos
relativos. As rotas chamam o :class:`PaymentService`; exceções de domínio viram
HTTP pelo handler global registrado em ``main.py`` (§3.9).

Endpoints (§4):
1. GET  ``/packages``            → público (vitrine de pacotes ativos).
2. POST ``/orders``              → professional (cria pedido + cobrança).
3. GET  ``/orders``              → professional (próprios pedidos, paginado).
4. GET  ``/orders/{id}``         → professional dono.
5. POST ``/webhook``             → SEM JWT, valida HMAC (idempotente).
6. POST ``/dev/confirm/{id}``    → dono/admin, SÓ se PAYMENT_PROVIDER=dev.
7. POST ``/orders/{id}/refund``  → admin (estorno em créditos).
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user, require_roles
from app.database.session import get_db
from app.models import PaymentOrderStatus, User, UserRole
from app.schemas.payments import (
    CreditPackageRead,
    DevConfirmRequest,
    PaymentOrderCreate,
    PaymentOrderListResponse,
    PaymentOrderRead,
    RefundRequest,
    WebhookReceived,
)
from app.services.payments.factory import get_payment_provider
from app.services.payments.service import PaymentService

router = APIRouter()


# --------------------------------------------------------------------------- #
# 1. Catálogo (público)
# --------------------------------------------------------------------------- #
@router.get(
    "/packages",
    response_model=list[CreditPackageRead],
    summary="Listar pacotes de créditos",
)
async def list_packages(
    db: AsyncSession = Depends(get_db),
    active: bool = Query(default=True),
) -> list[CreditPackageRead]:
    """Pacotes ativos (default). ``?active=false`` lista todos (§4 #1)."""
    service = PaymentService(db)
    return await service.list_packages(active_only=active)


# --------------------------------------------------------------------------- #
# 2. Criar pedido (professional)
# --------------------------------------------------------------------------- #
@router.post(
    "/orders",
    response_model=PaymentOrderRead,
    status_code=status.HTTP_201_CREATED,
    summary="Criar pedido de compra de créditos",
)
async def create_order(
    payload: PaymentOrderCreate,
    current_user: User = Depends(require_roles(UserRole.professional)),
    db: AsyncSession = Depends(get_db),
) -> PaymentOrderRead:
    """Cria o pedido ``pending`` e gera a cobrança (pix/checkout). Não credita
    (§4 #2). Erros: ``404`` pacote inexistente, ``422`` pacote inativo."""
    service = PaymentService(db)
    return await service.create_order(current_user, payload.package_id)


# --------------------------------------------------------------------------- #
# 3. Listar pedidos próprios (professional)
# --------------------------------------------------------------------------- #
@router.get(
    "/orders",
    response_model=PaymentOrderListResponse,
    summary="Listar meus pedidos",
)
async def list_orders(
    current_user: User = Depends(require_roles(UserRole.professional)),
    db: AsyncSession = Depends(get_db),
    order_status: PaymentOrderStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> PaymentOrderListResponse:
    """Pedidos do profissional autenticado (paginado — §4 #3)."""
    service = PaymentService(db)
    items, total = await service.list_orders_for_user(
        current_user, status=order_status, page=page, page_size=page_size
    )
    return PaymentOrderListResponse(
        items=items, page=page, page_size=page_size, total=total
    )


# --------------------------------------------------------------------------- #
# 5. Webhook (SEM JWT — valida HMAC). Declarado antes de /orders/{id} para
#    evitar qualquer ambiguidade de rota.
# --------------------------------------------------------------------------- #
@router.post(
    "/webhook",
    response_model=WebhookReceived,
    summary="Webhook do provedor (HMAC; idempotente)",
)
async def webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> WebhookReceived:
    """Callback do provedor (§4 #5). Lê o corpo **cru**, valida a assinatura HMAC
    (``verify_webhook``), normaliza o evento (``parse_event``) e processa
    (``handle_event``) de forma idempotente. Sempre ``200`` em evento válido
    (inclusive duplicado); ``401`` assinatura inválida; ``404`` external_reference
    desconhecida; ``422`` payload não mapeável."""
    body = await request.body()
    headers = dict(request.headers)

    provider = get_payment_provider()
    payload = provider.verify_webhook(headers, body)  # 401 se inválido
    event = provider.parse_event(payload)  # 422 se não mapeável

    service = PaymentService(db)
    await service.handle_event(event)  # 404 se external_reference desconhecida
    return WebhookReceived(received=True)


# --------------------------------------------------------------------------- #
# 6. Dev confirm (dono/admin) — montado SÓ quando PAYMENT_PROVIDER=dev.
# --------------------------------------------------------------------------- #
if settings.PAYMENT_PROVIDER == "dev":

    @router.post(
        "/dev/confirm/{order_id}",
        response_model=PaymentOrderRead,
        summary="Confirmar pagamento simulado (dev-only)",
    )
    async def dev_confirm(
        order_id: uuid.UUID,
        payload: DevConfirmRequest | None = None,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> PaymentOrderRead:
        """Simula o webhook para o pedido: assina internamente e chama o MESMO
        handler do webhook real (§4 #6). Default ``event="paid"``. Erros:
        ``404`` pedido, ``403`` não-dono/não-admin, ``409`` já não-pendente."""
        data = payload or DevConfirmRequest()
        service = PaymentService(db)
        return await service.dev_confirm(
            current_user, order_id, event=data.event
        )


# --------------------------------------------------------------------------- #
# 7. Refund (admin)
# --------------------------------------------------------------------------- #
@router.post(
    "/orders/{order_id}/refund",
    response_model=PaymentOrderRead,
    summary="Estornar pedido em créditos (admin)",
)
async def refund_order(
    order_id: uuid.UUID,
    payload: RefundRequest | None = None,
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> PaymentOrderRead:
    """Estorna um pedido ``paid`` devolvendo os créditos (§4 #7 / §5.4). Sempre
    em créditos. Erros: ``404`` pedido, ``409`` pedido não está pago."""
    data = payload or RefundRequest()
    service = PaymentService(db)
    return await service.refund(order_id, reason=data.reason)


# --------------------------------------------------------------------------- #
# 4. Detalhe de um pedido (professional dono) — declarado por último para não
#    capturar ``/orders`` (estático) nem ``/orders/{id}/refund``.
# --------------------------------------------------------------------------- #
@router.get(
    "/orders/{order_id}",
    response_model=PaymentOrderRead,
    summary="Detalhe de um pedido",
)
async def get_order(
    order_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.professional)),
    db: AsyncSession = Depends(get_db),
) -> PaymentOrderRead:
    """Detalhe do pedido do dono (§4 #4 — ``404`` inexistente, ``403`` não-dono)."""
    service = PaymentService(db)
    return await service.get_order_for_user(current_user, order_id)
