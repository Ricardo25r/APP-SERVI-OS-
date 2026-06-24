"""Módulo admin **Sprints / Esteira de Ideias** (gestão de produto).

Ferramenta interna do super admin para bugs/melhorias/consertos/ideias do próprio
produto — dados **globais** (sem tenant). 6 tabelas. Campos de "enum" são
``VARCHAR`` validados por ``Literal`` nos schemas (sem enum nativo). Cascades
reais no banco (``ondelete``) + ``passive_deletes`` nos relationships.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.mixins import CreatedAtMixin, TimestampMixin, UUIDPKMixin

__all__ = [
    "Sprint",
    "SprintIdea",
    "SprintIdeaAnexo",
    "SprintIdeaComentario",
    "SprintIdeaVoto",
    "SprintIdeaEvento",
]


class Sprint(UUIDPKMixin, TimestampMixin, Base):
    """Sprint (ciclo) que agrupa ideias."""

    __tablename__ = "sprints"

    nome: Mapped[str] = mapped_column(String(150), nullable=False)
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True)
    data_inicio: Mapped[date | None] = mapped_column(Date, nullable=True)
    data_fim: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="planejado", server_default="planejado"
    )

    ideias: Mapped[list[SprintIdea]] = relationship(
        "SprintIdea", back_populates="sprint", passive_deletes=True
    )


class SprintIdea(UUIDPKMixin, TimestampMixin, Base):
    """Ideia/card da esteira (bug | melhoria | conserto | ideia)."""

    __tablename__ = "sprint_ideas"

    titulo: Mapped[str] = mapped_column(String(200), nullable=False)
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)
    urgencia: Mapped[str] = mapped_column(
        String(20), nullable=False, default="media", server_default="media"
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="aberta", server_default="aberta"
    )
    sprint_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sprints.id", ondelete="SET NULL"),
        nullable=True,
    )
    autor_username: Mapped[str] = mapped_column(String(100), nullable=False)
    autor_nome: Mapped[str | None] = mapped_column(String(150), nullable=True)
    responsavel_username: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    fixado_topo: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    votos_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    feito_em: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    feito_por_username: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    # "admin" (criada no painel) | "usuario" (bug reportado por contratante/
    # prestador pelo app).
    origem: Mapped[str] = mapped_column(
        String(20), nullable=False, default="admin", server_default="admin"
    )

    sprint: Mapped[Sprint | None] = relationship(
        "Sprint", back_populates="ideias"
    )
    anexos: Mapped[list[SprintIdeaAnexo]] = relationship(
        "SprintIdeaAnexo",
        back_populates="idea",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    comentarios: Mapped[list[SprintIdeaComentario]] = relationship(
        "SprintIdeaComentario",
        back_populates="idea",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    votos: Mapped[list[SprintIdeaVoto]] = relationship(
        "SprintIdeaVoto",
        back_populates="idea",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    eventos: Mapped[list[SprintIdeaEvento]] = relationship(
        "SprintIdeaEvento",
        back_populates="idea",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        Index("ix_sprint_ideas_status", "status"),
        Index("ix_sprint_ideas_sprint_id", "sprint_id"),
        Index("ix_sprint_ideas_urgencia", "urgencia"),
        Index("ix_sprint_ideas_origem", "origem"),
    )


class SprintIdeaAnexo(UUIDPKMixin, CreatedAtMixin, Base):
    """Anexo (imagem/documento) de uma ideia — armazenado no MinIO/S3."""

    __tablename__ = "sprint_idea_anexos"

    idea_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sprint_ideas.id", ondelete="CASCADE"),
        nullable=False,
    )
    tipo: Mapped[str | None] = mapped_column(String(20), nullable=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    path_relativo: Mapped[str] = mapped_column(String(500), nullable=False)
    mime: Mapped[str | None] = mapped_column(String(120), nullable=True)
    tamanho_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    enviado_por_username: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )

    idea: Mapped[SprintIdea] = relationship(
        "SprintIdea", back_populates="anexos"
    )

    __table_args__ = (Index("ix_sprint_idea_anexos_idea_id", "idea_id"),)


class SprintIdeaComentario(UUIDPKMixin, CreatedAtMixin, Base):
    """Comentário em uma ideia."""

    __tablename__ = "sprint_idea_comentarios"

    idea_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sprint_ideas.id", ondelete="CASCADE"),
        nullable=False,
    )
    autor_username: Mapped[str] = mapped_column(String(100), nullable=False)
    autor_nome: Mapped[str | None] = mapped_column(String(150), nullable=True)
    texto: Mapped[str] = mapped_column(Text, nullable=False)

    idea: Mapped[SprintIdea] = relationship(
        "SprintIdea", back_populates="comentarios"
    )

    __table_args__ = (Index("ix_sprint_idea_comentarios_idea_id", "idea_id"),)


class SprintIdeaVoto(UUIDPKMixin, CreatedAtMixin, Base):
    """Voto de um usuário numa ideia (1 por usuário por card)."""

    __tablename__ = "sprint_idea_votos"

    idea_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sprint_ideas.id", ondelete="CASCADE"),
        nullable=False,
    )
    username: Mapped[str] = mapped_column(String(100), nullable=False)

    idea: Mapped[SprintIdea] = relationship(
        "SprintIdea", back_populates="votos"
    )

    __table_args__ = (
        UniqueConstraint("idea_id", "username", name="uq_sprint_idea_votos"),
    )


class SprintIdeaEvento(UUIDPKMixin, CreatedAtMixin, Base):
    """Evento de auditoria/timeline de uma ideia."""

    __tablename__ = "sprint_idea_eventos"

    idea_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sprint_ideas.id", ondelete="CASCADE"),
        nullable=False,
    )
    tipo_evento: Mapped[str] = mapped_column(String(30), nullable=False)
    descricao: Mapped[str | None] = mapped_column(String(300), nullable=True)
    autor_username: Mapped[str | None] = mapped_column(String(100), nullable=True)

    idea: Mapped[SprintIdea] = relationship(
        "SprintIdea", back_populates="eventos"
    )

    __table_args__ = (Index("ix_sprint_idea_eventos_idea_id", "idea_id"),)
