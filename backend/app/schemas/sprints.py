"""Schemas Pydantic v2 do módulo admin **Sprints / Esteira de Ideias**.

Campos de "enum" validados por ``Literal`` (as colunas no banco são VARCHAR).
``score`` e os contadores compostos são montados no service em tempo de leitura.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TipoIdeia = Literal["bug", "melhoria", "conserto", "ideia"]
Origem = Literal["admin", "usuario"]
Urgencia = Literal["critica", "alta", "media", "baixa"]
StatusIdea = Literal["aberta", "em_andamento", "feita", "arquivada"]
StatusSprint = Literal["planejado", "ativo", "encerrado"]


# --------------------------------------------------------------------------- #
# Sprint
# --------------------------------------------------------------------------- #
class SprintCreate(BaseModel):
    nome: str = Field(min_length=1, max_length=150)
    descricao: str | None = None
    data_inicio: date | None = None
    data_fim: date | None = None
    status: StatusSprint = "planejado"


class SprintUpdate(BaseModel):
    nome: str | None = Field(default=None, max_length=150)
    descricao: str | None = None
    data_inicio: date | None = None
    data_fim: date | None = None
    status: StatusSprint | None = None


class SprintRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nome: str
    descricao: str | None
    data_inicio: date | None
    data_fim: date | None
    status: StatusSprint
    created_at: datetime
    updated_at: datetime
    total_ideias: int = 0
    ideias_feitas: int = 0
    progresso: int = 0


# --------------------------------------------------------------------------- #
# Ideia
# --------------------------------------------------------------------------- #
class IdeaCreate(BaseModel):
    titulo: str = Field(min_length=1, max_length=200)
    descricao: str | None = None
    tipo: TipoIdeia
    urgencia: Urgencia = "media"
    sprint_id: uuid.UUID | None = None
    responsavel_username: str | None = Field(default=None, max_length=100)
    fixado_topo: bool = False


class IdeaUpdate(BaseModel):
    titulo: str | None = Field(default=None, max_length=200)
    descricao: str | None = None
    tipo: TipoIdeia | None = None
    urgencia: Urgencia | None = None
    status: StatusIdea | None = None
    sprint_id: uuid.UUID | None = None
    responsavel_username: str | None = Field(default=None, max_length=100)
    fixado_topo: bool | None = None


class IdeaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    titulo: str
    descricao: str | None
    tipo: TipoIdeia
    urgencia: Urgencia
    status: StatusIdea
    sprint_id: uuid.UUID | None
    autor_username: str
    autor_nome: str | None
    responsavel_username: str | None
    fixado_topo: bool
    votos_count: int
    created_at: datetime
    updated_at: datetime
    feito_em: datetime | None
    feito_por_username: str | None
    # Compostos (montados no service).
    score: int = 0
    anexos_count: int = 0
    comentarios_count: int = 0
    sprint_nome: str | None = None
    origem: Origem = "admin"


class AnexoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tipo: str | None
    filename: str
    mime: str | None
    tamanho_bytes: int | None
    enviado_por_username: str | None
    created_at: datetime
    url: str | None = None  # URL presignada (montada no service)


class ComentarioCreate(BaseModel):
    texto: str = Field(min_length=1)


class ComentarioRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    autor_username: str
    autor_nome: str | None
    texto: str
    created_at: datetime


class EventoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tipo_evento: str
    descricao: str | None
    autor_username: str | None
    created_at: datetime


class IdeaDetail(IdeaRead):
    anexos: list[AnexoRead] = []
    comentarios: list[ComentarioRead] = []
    eventos: list[EventoRead] = []
    votado_por_mim: bool = False


class VotoResult(BaseModel):
    votou: bool
    votos_count: int


class BugReportIn(BaseModel):
    """Corpo de ``POST /sprints/report-bug`` — bug reportado por um usuário do app."""

    titulo: str = Field(min_length=3, max_length=200)
    descricao: str | None = Field(default=None, max_length=4000)


class Kpis(BaseModel):
    abertas: int
    criticas: int
    em_sprint: int
    feitas_no_mes: int


class SmartDeleteResult(BaseModel):
    pode_excluir: bool
    vinculos: list[str] = []
    recomendacao: str | None = None
    excluida: bool = False


class IdeaListResponse(BaseModel):
    items: list[IdeaRead]


__all__ = [
    "TipoIdeia",
    "Urgencia",
    "StatusIdea",
    "StatusSprint",
    "SprintCreate",
    "SprintUpdate",
    "SprintRead",
    "IdeaCreate",
    "IdeaUpdate",
    "IdeaRead",
    "IdeaDetail",
    "AnexoRead",
    "ComentarioCreate",
    "ComentarioRead",
    "EventoRead",
    "VotoResult",
    "Kpis",
    "SmartDeleteResult",
    "IdeaListResponse",
    "Origem",
    "BugReportIn",
]
