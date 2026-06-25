"""Rotas da feature ``admin`` (Fase 10 — Administração MVP) — ``router = APIRouter()``.

Prefixo ``/admin`` é aplicado pelo agregador (``app.api.__init__``). **Todas** as
rotas exigem ``role == admin`` via ``Depends(require_roles(UserRole.admin))``
(§RN-ADM-05): não-admin recebe ``403`` em qualquer ``/admin/*``. Exceções de
domínio viram HTTP pelo handler global (§3.9).

Endpoints (MVP — admin-panel-spec §2.1, V1):
1. GET   ``/admin/metrics``               → KPIs (usuários, leads, financeiro).
2. GET   ``/admin/users``                 → lista paginada (filtros papel/status/busca).
3. GET   ``/admin/users/{id}``            → detalhe.
4. PATCH ``/admin/users/{id}/status``     → muda status (+ auditoria; não a si mesmo).
5. GET   ``/admin/leads``                 → lista paginada (filtros status/categoria/cidade).
6. PATCH ``/admin/leads/{id}/cancel``     → cancela lead (+ auditoria).
7. GET   ``/admin/payments``              → lista paginada + resumo de receita.
8. GET   ``/admin/audit``                 → auditoria paginada (somente leitura).

Não duplicados (apenas referenciados): CRUD de categorias (``/categories``),
``POST /credits/grant`` e ``POST /payments/orders/{id}/refund`` já existem.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Body, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_roles
from app.database.session import get_db
from app.models import (
    LeadStatus,
    PaymentOrderStatus,
    User,
    UserRole,
    UserStatus,
)
from app.schemas.admin import (
    AdminCoverage,
    AdminLeadListResponse,
    AdminLeadRead,
    AdminMetrics,
    AdminPaymentListResponse,
    AdminUserDetail,
    AdminUserListResponse,
    AdminUserRead,
    AuditLogListResponse,
    UserRoleUpdate,
    UserStatusUpdate,
)
from app.services.admin import AdminService

router = APIRouter()


# --------------------------------------------------------------------------- #
# 1. Métricas
# --------------------------------------------------------------------------- #
@router.get(
    "/metrics",
    response_model=AdminMetrics,
    summary="Métricas do painel (KPIs)",
)
async def get_metrics(
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> AdminMetrics:
    """Contagens e finanças agregadas (sem N+1 — §8)."""
    return await AdminService(db).metrics()


# --------------------------------------------------------------------------- #
# 1b. Cobertura de prestadores (média de idade + por categoria)
# --------------------------------------------------------------------------- #
@router.get(
    "/coverage",
    response_model=AdminCoverage,
    summary="Cobertura de prestadores (média de idade + nº por categoria)",
)
async def get_coverage(
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> AdminCoverage:
    """Média de idade dos prestadores + contagem por categoria (inclui as
    categorias sem nenhum prestador) — mapa de cobertura."""
    return await AdminService(db).coverage()


# --------------------------------------------------------------------------- #
# 2. Listar usuários
# --------------------------------------------------------------------------- #
@router.get(
    "/users",
    response_model=AdminUserListResponse,
    summary="Listar usuários (filtros papel/status/busca)",
)
async def list_users(
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
    role: UserRole | None = Query(default=None),
    user_status: UserStatus | None = Query(default=None, alias="status"),
    q: str | None = Query(default=None, description="Busca por nome/email"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> AdminUserListResponse:
    """Usuários paginados com filtros (gestão de usuários)."""
    items, total = await AdminService(db).list_users(
        role=role, status=user_status, search=q, page=page, page_size=page_size
    )
    return AdminUserListResponse(
        items=items, page=page, page_size=page_size, total=total
    )


# --------------------------------------------------------------------------- #
# 4. Mudar status do usuário — declarado antes de /users/{id} estático evitar
#    ambiguidade não é necessário (caminho distinto), mas mantém clareza.
# --------------------------------------------------------------------------- #
@router.patch(
    "/users/{user_id}/status",
    response_model=AdminUserRead,
    summary="Alterar status do usuário (+ auditoria)",
)
async def update_user_status(
    user_id: uuid.UUID,
    payload: UserStatusUpdate,
    admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> AdminUserRead:
    """Muda ``status`` (active|suspended|blocked); grava auditoria. Não permite
    o admin alterar a própria conta (``422``). ``404`` se inexistente."""
    return await AdminService(db).update_user_status(admin, user_id, payload)


@router.patch(
    "/users/{user_id}/role",
    response_model=AdminUserRead,
    summary="Alterar papel do usuário (promover admin + auditoria)",
)
async def update_user_role(
    user_id: uuid.UUID,
    payload: UserRoleUpdate,
    admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> AdminUserRead:
    """Promove/altera o papel (customer|professional|admin); grava auditoria.
    Não permite o admin alterar o próprio papel (``422``); ``404`` inexistente."""
    return await AdminService(db).update_user_role(admin, user_id, payload)


@router.delete(
    "/users/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Excluir usuário (anonimiza + desativa; auditoria)",
)
async def delete_user(
    user_id: uuid.UUID,
    admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Exclui um usuário (ex.: limpar contas de teste). Anonimiza + remove de
    todas as listagens, revoga sessões e cancela a assinatura. Não exclui a si
    mesmo nem outro admin (``422``); ``404`` se inexistente."""
    await AdminService(db).delete_user(admin, user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --------------------------------------------------------------------------- #
# 3. Detalhe do usuário
# --------------------------------------------------------------------------- #
@router.get(
    "/users/{user_id}",
    response_model=AdminUserRead,
    summary="Detalhe de um usuário",
)
async def get_user(
    user_id: uuid.UUID,
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> AdminUserRead:
    """Detalhe de um usuário (``404`` inexistente)."""
    return await AdminService(db).get_user(user_id)


@router.get(
    "/users/{user_id}/details",
    response_model=AdminUserDetail,
    summary="Ficha completa do usuário (DNA do profissional/contratante)",
)
async def get_user_details(
    user_id: uuid.UUID,
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> AdminUserDetail:
    """Categorias, idade, localização, atendidos, reputação, KYC, créditos."""
    return await AdminService(db).get_user_details(user_id)


# --------------------------------------------------------------------------- #
# 5. Listar leads (moderação)
# --------------------------------------------------------------------------- #
@router.get(
    "/leads",
    response_model=AdminLeadListResponse,
    summary="Listar leads (filtros status/categoria/cidade)",
)
async def list_leads(
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
    lead_status: LeadStatus | None = Query(default=None, alias="status"),
    category_id: uuid.UUID | None = Query(default=None),
    city: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> AdminLeadListResponse:
    """Leads paginados com filtros (moderação de leads)."""
    items, total = await AdminService(db).list_leads(
        status=lead_status,
        category_id=category_id,
        city=city,
        page=page,
        page_size=page_size,
    )
    return AdminLeadListResponse(
        items=items, page=page, page_size=page_size, total=total
    )


# --------------------------------------------------------------------------- #
# 6. Cancelar lead (admin) — opcional, com auditoria
# --------------------------------------------------------------------------- #
@router.patch(
    "/leads/{lead_id}/cancel",
    response_model=AdminLeadRead,
    summary="Cancelar lead (admin, + auditoria)",
)
async def cancel_lead(
    lead_id: uuid.UUID,
    admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
    reason: str | None = Body(default=None, embed=True, max_length=500),
) -> AdminLeadRead:
    """Cancela o lead (``status=cancelled`` + soft delete) e grava auditoria.
    ``404`` inexistente; ``422`` já cancelado. Estorno de créditos (se houver
    compra) é via ``POST /payments/orders/{id}/refund`` (não duplicado)."""
    return await AdminService(db).cancel_lead(admin, lead_id, reason=reason)


# --------------------------------------------------------------------------- #
# 7. Financeiro — pedidos + resumo de receita
# --------------------------------------------------------------------------- #
@router.get(
    "/payments",
    response_model=AdminPaymentListResponse,
    summary="Listar pedidos de pagamento + resumo de receita",
)
async def list_payments(
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
    order_status: PaymentOrderStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> AdminPaymentListResponse:
    """Pedidos paginados (filtro status) + resumo financeiro (§ Financeiro)."""
    items, total, summary = await AdminService(db).list_payments(
        status=order_status, page=page, page_size=page_size
    )
    return AdminPaymentListResponse(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        summary=summary,
    )


# --------------------------------------------------------------------------- #
# 8. Auditoria (somente leitura)
# --------------------------------------------------------------------------- #
@router.get(
    "/audit",
    response_model=AuditLogListResponse,
    summary="Listar trilha de auditoria (somente leitura)",
)
async def list_audit(
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
    action: str | None = Query(default=None),
    entity: str | None = Query(default=None),
    actor_id: uuid.UUID | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> AuditLogListResponse:
    """Auditoria paginada (filtros action/entity/actor) — §7.4."""
    items, total = await AdminService(db).list_audit_logs(
        action=action,
        entity=entity,
        actor_id=actor_id,
        page=page,
        page_size=page_size,
    )
    return AuditLogListResponse(
        items=items, page=page, page_size=page_size, total=total
    )
