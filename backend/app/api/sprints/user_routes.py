"""Rota **do usuário** para reportar bugs (contratante/prestador).

Prefixo ``/feedback`` (agregador). Diferente das rotas admin (`/admin/sprints`),
exige apenas autenticação — o bug vira um card ``tipo=bug``, ``origem=usuario`` na
esteira de Sprints, visível no painel admin.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.ratelimit import rate_limit
from app.database.session import get_db
from app.models import User
from app.schemas.sprints import BugReportIn
from app.services.sprints import SprintService

router = APIRouter()


@router.post(
    "/report-bug",
    status_code=201,
    summary="Reportar um bug (qualquer usuário autenticado)",
    dependencies=[Depends(rate_limit("report_bug", limit=10, window_seconds=300))],
)
async def report_bug(
    payload: BugReportIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Cria um card **bug** (``origem=usuario``) na esteira de Sprints a partir
    do relato de um contratante/prestador."""
    await SprintService(db).report_bug(
        current_user, payload.titulo, payload.descricao
    )
    return {"ok": True}
