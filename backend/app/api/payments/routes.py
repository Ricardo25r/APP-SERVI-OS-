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

import json
import uuid

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Request,
    Response,
    status,
)
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
    PaymentSettingsRead,
    PaymentSettingsUpdate,
    RefundRequest,
    WebhookReceived,
)
from app.schemas.subscriptions import (
    SubscriptionInfo,
    SubscriptionSettingsRead,
    SubscriptionSettingsUpdate,
    SubscriptionStartOut,
)
from app.services.payments.factory import get_payment_provider
from app.services.payments.service import PaymentService
from app.services.subscriptions import SubscriptionService

_SUBSCRIPTION_TOPICS = {
    "subscription_preapproval",
    "preapproval",
    "subscription_authorized_payment",
    "authorized_payment",
}

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
# Dados de recebimento (Pix/banco) — comprador vê; admin edita
# --------------------------------------------------------------------------- #
@router.get(
    "/payment-info",
    response_model=PaymentSettingsRead,
    summary="Dados de recebimento para o comprador (Pix/banco)",
)
async def payment_info(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaymentSettingsRead:
    """Dados que o comprador usa para pagar (chave Pix + banco/conta/titular)."""
    service = PaymentService(db)
    return PaymentSettingsRead.model_validate(
        await service.get_payment_settings()
    )


@router.get(
    "/settings",
    response_model=PaymentSettingsRead,
    summary="Ver dados de recebimento (admin)",
)
async def get_settings(
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> PaymentSettingsRead:
    service = PaymentService(db)
    return PaymentSettingsRead.model_validate(
        await service.get_payment_settings()
    )


@router.put(
    "/settings",
    response_model=PaymentSettingsRead,
    summary="Atualizar dados de recebimento (admin)",
)
async def update_settings(
    payload: PaymentSettingsUpdate,
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> PaymentSettingsRead:
    service = PaymentService(db)
    return PaymentSettingsRead.model_validate(
        await service.update_payment_settings(payload)
    )


# --------------------------------------------------------------------------- #
# Assinatura / plano PRO (#56) — config no admin (liga/desliga + valores) e
# fluxo do profissional. Entregue DESLIGADO (enabled=false).
# --------------------------------------------------------------------------- #
@router.get(
    "/subscription-settings",
    response_model=SubscriptionSettingsRead,
    summary="Configuração da assinatura (admin)",
)
async def get_subscription_settings(
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionSettingsRead:
    return SubscriptionSettingsRead.model_validate(
        await SubscriptionService(db).get_settings()
    )


@router.put(
    "/subscription-settings",
    response_model=SubscriptionSettingsRead,
    summary="Editar a assinatura: liga/desliga e valores (admin)",
)
async def update_subscription_settings(
    payload: SubscriptionSettingsUpdate,
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionSettingsRead:
    return SubscriptionSettingsRead.model_validate(
        await SubscriptionService(db).update_settings(payload)
    )


@router.get(
    "/subscription",
    response_model=SubscriptionInfo,
    summary="Meu plano / status da assinatura",
)
async def my_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionInfo:
    """O plano (quando habilitado) + o status da assinatura do usuário."""
    return await SubscriptionService(db).get_info(current_user)


@router.post(
    "/subscription/subscribe",
    response_model=SubscriptionStartOut,
    summary="Assinar o plano PRO (gera link de checkout)",
)
async def subscribe(
    current_user: User = Depends(require_roles(UserRole.professional)),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionStartOut:
    """Cria a assinatura no Mercado Pago. Recusa (422) se o plano está desligado."""
    url = await SubscriptionService(db).subscribe(current_user)
    return SubscriptionStartOut(checkout_url=url)


@router.post(
    "/subscription/cancel",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Cancelar minha assinatura",
)
async def cancel_subscription(
    current_user: User = Depends(require_roles(UserRole.professional)),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await SubscriptionService(db).cancel(current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
    (§4 #2). Erros: ``404`` pacote inexistente, ``422`` pacote inativo.

    No modo beta (``PAYMENTS_ENABLED=false``) a compra fica indisponível (403)."""
    if not settings.PAYMENTS_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compra de créditos temporariamente indisponível.",
        )
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

    # Tópico de assinatura (#56)? A validação forte é a reconsulta AUTENTICADA à
    # API do MP (fetch_*) no SubscriptionService — não há o que forjar, a consulta
    # é autoritativa (mesma filosofia do fluxo avulso). O HMAC do MP não cobre bem
    # esses tópicos (o manifesto usa o data.id da URL), então não o exigimos aqui.
    try:
        peek = json.loads(body.decode("utf-8")) if body else {}
    except (ValueError, UnicodeDecodeError):
        peek = {}
    topic = (
        (peek.get("type") or peek.get("topic"))
        if isinstance(peek, dict)
        else None
    )
    if topic in _SUBSCRIPTION_TOPICS:
        await SubscriptionService(db).handle_webhook(peek)
        return WebhookReceived(received=True)

    provider = get_payment_provider()
    payload = provider.verify_webhook(headers, body)  # 401 se inválido (avulso)
    event = provider.parse_event(payload)  # 422 se não mapeável
    # Cobrança de ciclo de assinatura que chegou no tópico 'payment': o crédito é
    # feito pelo tópico authorized_payment — aqui só reconhecemos (evita 404 +
    # retentativa do MP) em vez de procurar em payment_orders.
    if event.external_reference.startswith("sub_"):
        return WebhookReceived(received=True)
    service = PaymentService(db)
    await service.handle_event(event)  # 404 se external_reference desconhecida
    return WebhookReceived(received=True)


# --------------------------------------------------------------------------- #
# 6. Dev confirm (dono/admin) — montado SÓ quando PAYMENT_PROVIDER=dev E o
#    ambiente NÃO for produção (nunca expor o confirm simulado em prod).
# --------------------------------------------------------------------------- #
if settings.PAYMENT_PROVIDER == "dev" and settings.APP_ENV != "production":

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


@router.post(
    "/orders/{order_id}/confirmar",
    response_model=PaymentOrderRead,
    summary="Confirmar pagamento manual (admin) — Pix manual",
)
async def confirm_order(
    order_id: uuid.UUID,
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> PaymentOrderRead:
    """Admin confirma um pedido pago via **Pix manual** → credita a carteira do
    profissional e marca ``paid``. ``404`` inexistente; ``409`` não pendente."""
    service = PaymentService(db)
    return await service.admin_confirm_order(order_id)


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
