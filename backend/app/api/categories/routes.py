"""Rotas da feature ``categories`` (Fase 3) — ``router = APIRouter()`` (§3.6).

Prefixo ``/categories`` é aplicado pelo agregador (``app.api.__init__``); aqui os
caminhos são relativos. As rotas chamam o :class:`CategoryService`; as exceções
de domínio viram HTTP no handler global registrado em ``main.py`` (§3.9).

Papéis (§4 do contrato):
- ``GET /``        → público (lista; default só ativas).
- ``GET /{id}``    → público (detalhe).
- ``POST /``       → admin (criar).
- ``PATCH /{id}``  → admin (atualizar parcial).
- ``DELETE /{id}`` → admin (desativa: ``active=False``; sem hard delete).
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

from app.core.deps import require_roles
from app.database.session import get_db
from app.models import Category, User, UserRole
from app.schemas.categories import CategoryIn, CategoryOut, CategoryUpdate
from app.services.categories import CategoryService

router = APIRouter()

_MAX_IMG_BYTES = 5 * 1024 * 1024
_ALLOWED_IMG = {"image/jpeg", "image/png", "image/webp"}
_IMG_EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


@router.get(
    "/",
    response_model=list[CategoryOut],
    summary="Listar categorias (público; default só ativas)",
)
async def list_categories(
    db: AsyncSession = Depends(get_db),
    active: bool = Query(
        default=True,
        description="True (default) lista apenas categorias ativas; "
        "False inclui as inativas.",
    ),
    q: str | None = Query(
        default=None,
        description="Filtra por name/slug (case-insensitive, contém).",
    ),
) -> list[Category]:
    """Endpoint público. Por padrão retorna apenas categorias ativas (§4).

    ``?active=false`` inclui as inativas; ``?q=`` filtra por ``name``/``slug``.
    """
    service = CategoryService(db)
    return await service.list_categories(include_inactive=not active, query=q)


@router.get(
    "/{category_id}",
    response_model=CategoryOut,
    summary="Detalhe de uma categoria (público)",
)
async def get_category(
    category_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Category:
    """Retorna a categoria pelo ``id`` ou 404 (público)."""
    service = CategoryService(db)
    return await service.get_category(category_id)


@router.post(
    "/",
    response_model=CategoryOut,
    status_code=status.HTTP_201_CREATED,
    summary="Criar categoria (admin)",
)
async def create_category(
    payload: CategoryIn,
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> Category:
    """Cria uma categoria. Exige ``role == admin`` (§5.2). ``slug`` é gerado a
    partir de ``name`` quando ausente; unicidade de ``name``/``slug`` validada."""
    service = CategoryService(db)
    return await service.create_category(payload)


@router.patch(
    "/{category_id}",
    response_model=CategoryOut,
    summary="Atualizar categoria parcialmente (admin)",
)
async def update_category(
    category_id: uuid.UUID,
    payload: CategoryUpdate,
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> Category:
    """Atualiza parcialmente a categoria. Exige ``role == admin`` (§5.2)."""
    service = CategoryService(db)
    return await service.update_category(category_id, payload)


@router.post(
    "/{category_id}/image",
    response_model=CategoryOut,
    summary="Definir/atualizar a foto da categoria (admin)",
)
async def set_category_image(
    category_id: uuid.UUID,
    file: UploadFile = File(...),
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> Category:
    """Upload da foto da categoria (JPG/PNG/WEBP, até 5 MB). Exige ``admin``."""
    if file.content_type not in _ALLOWED_IMG:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Formato inválido. Use JPG, PNG ou WEBP.",
        )
    data = await file.read()
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Arquivo vazio."
        )
    if len(data) > _MAX_IMG_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Imagem muito grande (máximo 5 MB).",
        )
    ext = _IMG_EXT.get(file.content_type, "")
    service = CategoryService(db)
    return await service.set_image(
        category_id, data, content_type=file.content_type, ext=ext
    )


@router.delete(
    "/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Desativar categoria (admin; soft via active=False)",
)
async def delete_category(
    category_id: uuid.UUID,
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Desativa a categoria (``active=False``) preservando leads/vínculos (§4).

    Sem hard delete. Exige ``role == admin`` (§5.2)."""
    service = CategoryService(db)
    await service.deactivate_category(category_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
