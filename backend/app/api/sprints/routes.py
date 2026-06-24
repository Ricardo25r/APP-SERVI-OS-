"""Rotas do módulo admin **Sprints / Esteira de Ideias** (17 endpoints).

Prefixo ``/admin/sprints`` aplicado pelo agregador (``app.api.__init__``). Todas
exigem ``role=admin``. Exceções de domínio viram HTTP pelo handler global.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_roles
from app.core.storage import presigned_get_url
from app.database.session import get_db
from app.models import User, UserRole
from app.schemas.sprints import (
    AnexoRead,
    ComentarioCreate,
    ComentarioRead,
    IdeaCreate,
    IdeaDetail,
    IdeaListResponse,
    IdeaUpdate,
    Kpis,
    SmartDeleteResult,
    SprintCreate,
    SprintRead,
    SprintUpdate,
    VotoResult,
)
from app.services.sprints import SprintService

router = APIRouter()

_admin = require_roles(UserRole.admin)


# --------------------------------------------------------------------------- #
# KPIs
# --------------------------------------------------------------------------- #
@router.get("/kpis", response_model=Kpis, summary="KPIs da esteira")
async def kpis(
    _user: User = Depends(_admin),
    db: AsyncSession = Depends(get_db),
) -> Kpis:
    return await SprintService(db).kpis()


# --------------------------------------------------------------------------- #
# Ideias
# --------------------------------------------------------------------------- #
@router.get("/ideas", response_model=IdeaListResponse, summary="Listar ideias")
async def list_ideas(
    _user: User = Depends(_admin),
    db: AsyncSession = Depends(get_db),
    aba: str = Query(default="ativa"),
    tipo: str | None = Query(default=None),
    urgencia: str | None = Query(default=None),
    autor: str | None = Query(default=None),
    sprint_id: uuid.UUID | None = Query(default=None),
    busca: str | None = Query(default=None),
    origem: str | None = Query(default=None),
) -> IdeaListResponse:
    items = await SprintService(db).list_ideas(
        aba=aba,
        tipo=tipo,
        urgencia=urgencia,
        autor=autor,
        sprint_id=sprint_id,
        busca=busca,
        origem=origem,
    )
    return IdeaListResponse(items=items)


@router.post(
    "/ideas",
    response_model=IdeaDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Criar ideia",
)
async def create_idea(
    payload: IdeaCreate,
    current_user: User = Depends(_admin),
    db: AsyncSession = Depends(get_db),
) -> IdeaDetail:
    return await SprintService(db).create_idea(current_user, payload)


@router.get(
    "/ideas/{idea_id}", response_model=IdeaDetail, summary="Detalhe da ideia"
)
async def get_idea(
    idea_id: uuid.UUID,
    current_user: User = Depends(_admin),
    db: AsyncSession = Depends(get_db),
) -> IdeaDetail:
    return await SprintService(db).get_detail(current_user, idea_id)


@router.put(
    "/ideas/{idea_id}", response_model=IdeaDetail, summary="Editar ideia"
)
async def update_idea(
    idea_id: uuid.UUID,
    payload: IdeaUpdate,
    current_user: User = Depends(_admin),
    db: AsyncSession = Depends(get_db),
) -> IdeaDetail:
    return await SprintService(db).update_idea(current_user, idea_id, payload)


@router.post(
    "/ideas/{idea_id}/baixar",
    response_model=IdeaDetail,
    summary="Dar baixa (concluir)",
)
async def baixar(
    idea_id: uuid.UUID,
    current_user: User = Depends(_admin),
    db: AsyncSession = Depends(get_db),
) -> IdeaDetail:
    return await SprintService(db).baixar(current_user, idea_id)


@router.post(
    "/ideas/{idea_id}/reabrir", response_model=IdeaDetail, summary="Reabrir"
)
async def reabrir(
    idea_id: uuid.UUID,
    current_user: User = Depends(_admin),
    db: AsyncSession = Depends(get_db),
) -> IdeaDetail:
    return await SprintService(db).reabrir(current_user, idea_id)


@router.delete(
    "/ideas/{idea_id}",
    response_model=SmartDeleteResult,
    summary="Excluir ideia (smart delete)",
)
async def delete_idea(
    idea_id: uuid.UUID,
    confirmar: bool = Query(default=False),
    _user: User = Depends(_admin),
    db: AsyncSession = Depends(get_db),
) -> SmartDeleteResult:
    return await SprintService(db).delete_idea(idea_id, confirmar=confirmar)


@router.post(
    "/ideas/{idea_id}/votar", response_model=VotoResult, summary="Votar (toggle)"
)
async def votar(
    idea_id: uuid.UUID,
    current_user: User = Depends(_admin),
    db: AsyncSession = Depends(get_db),
) -> VotoResult:
    return await SprintService(db).toggle_voto(current_user, idea_id)


@router.post(
    "/ideas/{idea_id}/comentarios",
    response_model=ComentarioRead,
    status_code=status.HTTP_201_CREATED,
    summary="Comentar",
)
async def comentar(
    idea_id: uuid.UUID,
    payload: ComentarioCreate,
    current_user: User = Depends(_admin),
    db: AsyncSession = Depends(get_db),
) -> ComentarioRead:
    return await SprintService(db).add_comentario(current_user, idea_id, payload)


# --------------------------------------------------------------------------- #
# Anexos
# --------------------------------------------------------------------------- #
@router.post(
    "/ideas/{idea_id}/anexos",
    response_model=AnexoRead,
    status_code=status.HTTP_201_CREATED,
    summary="Anexar arquivo",
)
async def upload_anexo(
    idea_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(_admin),
    db: AsyncSession = Depends(get_db),
) -> AnexoRead:
    content = await file.read()
    return await SprintService(db).add_anexo(
        current_user,
        idea_id,
        filename=file.filename or "arquivo",
        content=content,
        content_type=file.content_type,
    )


@router.get("/anexos/{anexo_id}", summary="Baixar anexo")
async def download_anexo(
    anexo_id: uuid.UUID,
    _user: User = Depends(_admin),
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    anexo = await SprintService(db).get_anexo(anexo_id)
    return RedirectResponse(url=presigned_get_url(anexo.path_relativo))


@router.delete("/anexos/{anexo_id}", summary="Remover anexo")
async def delete_anexo(
    anexo_id: uuid.UUID,
    _user: User = Depends(_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    await SprintService(db).delete_anexo(anexo_id)
    return {"ok": True}


# --------------------------------------------------------------------------- #
# Sprints
# --------------------------------------------------------------------------- #
@router.get("/sprints", response_model=list[SprintRead], summary="Listar sprints")
async def list_sprints(
    _user: User = Depends(_admin),
    db: AsyncSession = Depends(get_db),
) -> list[SprintRead]:
    return await SprintService(db).list_sprints()


@router.post(
    "/sprints",
    response_model=SprintRead,
    status_code=status.HTTP_201_CREATED,
    summary="Criar sprint",
)
async def create_sprint(
    payload: SprintCreate,
    _user: User = Depends(_admin),
    db: AsyncSession = Depends(get_db),
) -> SprintRead:
    return await SprintService(db).create_sprint(payload)


@router.put("/sprints/{sprint_id}", response_model=SprintRead, summary="Editar sprint")
async def update_sprint(
    sprint_id: uuid.UUID,
    payload: SprintUpdate,
    _user: User = Depends(_admin),
    db: AsyncSession = Depends(get_db),
) -> SprintRead:
    return await SprintService(db).update_sprint(sprint_id, payload)


@router.delete(
    "/sprints/{sprint_id}",
    summary="Excluir sprint (ideias ficam sem sprint)",
)
async def delete_sprint(
    sprint_id: uuid.UUID,
    _user: User = Depends(_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    await SprintService(db).delete_sprint(sprint_id)
    return {"ok": True}
