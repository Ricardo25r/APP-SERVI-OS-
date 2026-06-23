"""Rotas da feature ``leads`` (Fase 4) — ``router = APIRouter()`` (§3.6).

Prefixo ``/leads`` é aplicado pelo agregador (``app.api.__init__``). Caminhos
relativos. As rotas chamam o :class:`LeadService`; as exceções de domínio são
convertidas em HTTP pelo handler global registrado em ``main.py`` (§3.9).

Papéis (§4 / §5.2):
- ``POST /``   → customer (cria oportunidade).
- ``GET /``    → customer **ou** professional (listagem contextual).
- ``GET /{id}``→ customer dono **ou** professional elegível/comprador.
- ``PATCH /{id}`` / ``DELETE /{id}`` → customer dono, só enquanto ``open``.
"""

from __future__ import annotations

import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_roles
from app.core.ratelimit import rate_limit
from app.database.session import get_db
from app.models import LeadStatus, User, UserRole
from app.schemas.leads import (
    LeadCreate,
    LeadListResponse,
    LeadMediaOut,
    LeadRead,
    LeadUpdate,
)
from app.services.leads import LeadService

router = APIRouter()


@router.post(
    "/",
    response_model=LeadRead,
    status_code=status.HTTP_201_CREATED,
    summary="Criar lead (oportunidade)",
    dependencies=[Depends(rate_limit("leadcreate", limit=10, window_seconds=60))],
)
async def create_lead(
    payload: LeadCreate,
    current_user: User = Depends(require_roles(UserRole.customer)),
    db: AsyncSession = Depends(get_db),
) -> LeadRead:
    """Customer cria uma oportunidade. ``credits_cost`` e ``expires_at`` são
    calculados no backend (§5.1)."""
    service = LeadService(db)
    return await service.create(current_user, payload)


@router.get(
    "/",
    response_model=LeadListResponse,
    summary="Listar leads (contextual por papel)",
)
async def list_leads(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    status_filter: LeadStatus | None = Query(default=None, alias="status"),
    category_id: uuid.UUID | None = Query(default=None),
    city: str | None = Query(default=None),
    state: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> LeadListResponse:
    """Customer vê os próprios leads; professional vê os elegíveis (§5.3) sem
    contato. Paginação ``{items, page, page_size, total}`` (§4)."""
    service = LeadService(db)
    items, total = await service.list_for_user(
        current_user,
        status=status_filter,
        category_id=category_id,
        city=city,
        state=state,
        page=page,
        page_size=page_size,
    )
    return LeadListResponse(
        items=items, page=page, page_size=page_size, total=total
    )


@router.get(
    "/{lead_id}",
    response_model=LeadRead,
    summary="Detalhe de um lead",
)
async def get_lead(
    lead_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LeadRead:
    """Customer dono vê tudo (com contato); professional vê o detalhe sem contato
    (com contato apenas se comprou)."""
    service = LeadService(db)
    return await service.get(current_user, lead_id)


@router.patch(
    "/{lead_id}",
    response_model=LeadRead,
    summary="Editar lead (dono, só enquanto open)",
)
async def update_lead(
    lead_id: uuid.UUID,
    payload: LeadUpdate,
    current_user: User = Depends(require_roles(UserRole.customer)),
    db: AsyncSession = Depends(get_db),
) -> LeadRead:
    """Edita campos permitidos do lead. Ownership obrigatório e ``status=open``
    (§4). Não troca ``category_id``/``lead_type`` (custo imutável)."""
    service = LeadService(db)
    return await service.update(current_user, lead_id, payload)


@router.delete(
    "/{lead_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Cancelar lead (dono, só enquanto open)",
)
async def cancel_lead(
    lead_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.customer)),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Cancela o lead: ``status=cancelled`` + soft delete. Só o dono, só
    enquanto ``open`` (§4)."""
    service = LeadService(db)
    await service.cancel(current_user, lead_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Limites de upload de mídia (foto do serviço).
MAX_MEDIA_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


@router.post(
    "/{lead_id}/media",
    response_model=LeadMediaOut,
    status_code=status.HTTP_201_CREATED,
    summary="Anexar foto ao lead (dono, só enquanto open)",
)
async def upload_lead_media(
    lead_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles(UserRole.customer)),
    db: AsyncSession = Depends(get_db),
) -> LeadMediaOut:
    """Upload de uma foto do serviço (JPG/PNG/WEBP/GIF, até 5 MB), anexada ao
    lead. Apenas o contratante dono, enquanto o lead está aberto."""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Formato não suportado (use JPG, PNG, WEBP ou GIF).",
        )
    data = await file.read()
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Arquivo vazio."
        )
    if len(data) > MAX_MEDIA_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Imagem muito grande (máximo 5 MB).",
        )
    service = LeadService(db)
    return await service.add_media(
        current_user,
        lead_id,
        filename=file.filename or "foto.jpg",
        content_type=file.content_type,
        data=data,
    )
