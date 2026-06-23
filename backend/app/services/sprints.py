"""Service do módulo admin **Sprints / Esteira de Ideias**.

Orquestra ideias/sprints/anexos/comentários/votos + **auditoria** (eventos),
**toggle de voto** (recalcula o cache ``votos_count``), **smart delete** e
**score em leitura**. Identidade do autor mapeada do ``User`` do FazTudo
(``autor_username = email``, ``autor_nome = name``). Commit no service.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DomainValidationError, NotFoundError
from app.core.storage import delete_object, presigned_get_url, upload_bytes
from app.models import (
    Sprint,
    SprintIdea,
    SprintIdeaAnexo,
    SprintIdeaComentario,
    SprintIdeaEvento,
    SprintIdeaVoto,
    User,
)
from app.schemas.sprints import (
    AnexoRead,
    ComentarioCreate,
    ComentarioRead,
    EventoRead,
    IdeaCreate,
    IdeaDetail,
    IdeaRead,
    IdeaUpdate,
    Kpis,
    SmartDeleteResult,
    SprintCreate,
    SprintRead,
    SprintUpdate,
    VotoResult,
)
from app.services.sprints_score import compute_score

__all__ = ["SprintService"]

_IMG_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
_DOC_EXT = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv"}
_MAX_BYTES = 10 * 1024 * 1024  # 10 MB
_ATIVA = ("aberta", "em_andamento")
_HISTORICO = ("feita", "arquivada")


class SprintService:
    """Casos de uso do módulo de gestão de produto (admin)."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #
    def _evento(
        self,
        idea_id: uuid.UUID,
        tipo_evento: str,
        descricao: str | None,
        autor_username: str,
    ) -> None:
        self.db.add(
            SprintIdeaEvento(
                idea_id=idea_id,
                tipo_evento=tipo_evento,
                descricao=descricao,
                autor_username=autor_username,
            )
        )

    def _to_idea_read(
        self,
        idea: SprintIdea,
        anexos_count: int,
        comentarios_count: int,
        sprint_nome: str | None,
    ) -> IdeaRead:
        return IdeaRead(
            id=idea.id,
            titulo=idea.titulo,
            descricao=idea.descricao,
            tipo=idea.tipo,
            urgencia=idea.urgencia,
            status=idea.status,
            sprint_id=idea.sprint_id,
            autor_username=idea.autor_username,
            autor_nome=idea.autor_nome,
            responsavel_username=idea.responsavel_username,
            fixado_topo=idea.fixado_topo,
            votos_count=idea.votos_count,
            created_at=idea.created_at,
            updated_at=idea.updated_at,
            feito_em=idea.feito_em,
            feito_por_username=idea.feito_por_username,
            score=compute_score(
                idea.urgencia, idea.tipo, idea.created_at, idea.votos_count
            ),
            anexos_count=anexos_count,
            comentarios_count=comentarios_count,
            sprint_nome=sprint_nome,
        )

    def _anexo_read(self, anexo: SprintIdeaAnexo) -> AnexoRead:
        out = AnexoRead.model_validate(anexo)
        out.url = presigned_get_url(anexo.path_relativo)
        return out

    async def _get_idea(self, idea_id: uuid.UUID) -> SprintIdea:
        idea = (
            await self.db.execute(
                select(SprintIdea).where(SprintIdea.id == idea_id)
            )
        ).scalar_one_or_none()
        if idea is None:
            raise NotFoundError("Ideia não encontrada.")
        return idea

    # ------------------------------------------------------------------ #
    # KPIs
    # ------------------------------------------------------------------ #
    async def kpis(self) -> Kpis:
        async def _count(*conds) -> int:
            stmt = select(func.count()).select_from(SprintIdea)
            for c in conds:
                stmt = stmt.where(c)
            return int((await self.db.execute(stmt)).scalar_one())

        ativas = SprintIdea.status.in_(_ATIVA)
        inicio_mes = datetime.now(UTC).replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        return Kpis(
            abertas=await _count(ativas),
            criticas=await _count(ativas, SprintIdea.urgencia == "critica"),
            em_sprint=await _count(ativas, SprintIdea.sprint_id.isnot(None)),
            feitas_no_mes=await _count(
                SprintIdea.status == "feita",
                SprintIdea.feito_em.isnot(None),
                SprintIdea.feito_em >= inicio_mes,
            ),
        )

    # ------------------------------------------------------------------ #
    # Ideias — leitura
    # ------------------------------------------------------------------ #
    async def list_ideas(
        self,
        *,
        aba: str = "ativa",
        tipo: str | None = None,
        urgencia: str | None = None,
        autor: str | None = None,
        sprint_id: uuid.UUID | None = None,
        busca: str | None = None,
    ) -> list[IdeaRead]:
        statuses = _HISTORICO if aba == "historico" else _ATIVA
        stmt = select(SprintIdea).where(SprintIdea.status.in_(statuses))
        if tipo:
            stmt = stmt.where(SprintIdea.tipo == tipo)
        if urgencia:
            stmt = stmt.where(SprintIdea.urgencia == urgencia)
        if autor:
            stmt = stmt.where(SprintIdea.autor_username == autor)
        if sprint_id:
            stmt = stmt.where(SprintIdea.sprint_id == sprint_id)
        if busca:
            like = f"%{busca}%"
            stmt = stmt.where(
                or_(
                    SprintIdea.titulo.ilike(like),
                    SprintIdea.descricao.ilike(like),
                )
            )
        ideas = list((await self.db.execute(stmt)).scalars().all())
        if not ideas:
            return []

        ids = [i.id for i in ideas]
        anexos_map = dict(
            (
                await self.db.execute(
                    select(SprintIdeaAnexo.idea_id, func.count())
                    .where(SprintIdeaAnexo.idea_id.in_(ids))
                    .group_by(SprintIdeaAnexo.idea_id)
                )
            ).all()
        )
        coment_map = dict(
            (
                await self.db.execute(
                    select(SprintIdeaComentario.idea_id, func.count())
                    .where(SprintIdeaComentario.idea_id.in_(ids))
                    .group_by(SprintIdeaComentario.idea_id)
                )
            ).all()
        )
        sprint_ids = [i.sprint_id for i in ideas if i.sprint_id]
        sprint_map = (
            dict(
                (
                    await self.db.execute(
                        select(Sprint.id, Sprint.nome).where(
                            Sprint.id.in_(sprint_ids)
                        )
                    )
                ).all()
            )
            if sprint_ids
            else {}
        )

        items = [
            self._to_idea_read(
                i,
                int(anexos_map.get(i.id, 0)),
                int(coment_map.get(i.id, 0)),
                sprint_map.get(i.sprint_id),
            )
            for i in ideas
        ]
        if aba == "historico":
            items.sort(key=lambda x: x.feito_em or x.created_at, reverse=True)
        else:
            # fixado_topo DESC, score DESC, created_at ASC (sort estável).
            items.sort(key=lambda x: x.created_at)
            items.sort(key=lambda x: (x.fixado_topo, x.score), reverse=True)
        return items

    async def get_detail(
        self, current_user: User, idea_id: uuid.UUID
    ) -> IdeaDetail:
        idea = await self._get_idea(idea_id)
        anexos = list(
            (
                await self.db.execute(
                    select(SprintIdeaAnexo)
                    .where(SprintIdeaAnexo.idea_id == idea_id)
                    .order_by(SprintIdeaAnexo.created_at)
                )
            ).scalars().all()
        )
        comentarios = list(
            (
                await self.db.execute(
                    select(SprintIdeaComentario)
                    .where(SprintIdeaComentario.idea_id == idea_id)
                    .order_by(SprintIdeaComentario.created_at)
                )
            ).scalars().all()
        )
        eventos = list(
            (
                await self.db.execute(
                    select(SprintIdeaEvento)
                    .where(SprintIdeaEvento.idea_id == idea_id)
                    .order_by(SprintIdeaEvento.created_at.desc())
                )
            ).scalars().all()
        )
        sprint_nome = None
        if idea.sprint_id:
            sprint_nome = (
                await self.db.execute(
                    select(Sprint.nome).where(Sprint.id == idea.sprint_id)
                )
            ).scalar_one_or_none()
        votado = (
            await self.db.execute(
                select(SprintIdeaVoto.id).where(
                    SprintIdeaVoto.idea_id == idea_id,
                    SprintIdeaVoto.username == current_user.email,
                )
            )
        ).first() is not None

        base = self._to_idea_read(
            idea, len(anexos), len(comentarios), sprint_nome
        )
        detail = IdeaDetail(**base.model_dump())
        detail.anexos = [self._anexo_read(a) for a in anexos]
        detail.comentarios = [ComentarioRead.model_validate(c) for c in comentarios]
        detail.eventos = [EventoRead.model_validate(e) for e in eventos]
        detail.votado_por_mim = votado
        return detail

    # ------------------------------------------------------------------ #
    # Ideias — escrita
    # ------------------------------------------------------------------ #
    async def create_idea(
        self, current_user: User, data: IdeaCreate
    ) -> IdeaDetail:
        idea = SprintIdea(
            titulo=data.titulo,
            descricao=data.descricao,
            tipo=data.tipo,
            urgencia=data.urgencia,
            status="aberta",
            sprint_id=data.sprint_id,
            autor_username=current_user.email,
            autor_nome=current_user.name,
            responsavel_username=data.responsavel_username,
            fixado_topo=data.fixado_topo,
        )
        self.db.add(idea)
        await self.db.flush()
        self._evento(idea.id, "criada", None, current_user.email)
        await self.db.commit()
        return await self.get_detail(current_user, idea.id)

    async def update_idea(
        self, current_user: User, idea_id: uuid.UUID, data: IdeaUpdate
    ) -> IdeaDetail:
        idea = await self._get_idea(idea_id)
        changes = data.model_dump(exclude_unset=True)
        diffs = {k: v for k, v in changes.items() if getattr(idea, k) != v}
        if not diffs:
            return await self.get_detail(current_user, idea_id)

        if "status" in diffs:
            old, new = idea.status, diffs["status"]
            self._evento(
                idea.id, "status_mudou", f"status: {old} → {new}",
                current_user.email,
            )
            if new == "feita":
                idea.feito_em = datetime.now(UTC)
                idea.feito_por_username = current_user.email
            elif old == "feita":
                idea.feito_em = None
                idea.feito_por_username = None
        if "sprint_id" in diffs:
            self._evento(
                idea.id, "movida_sprint", "sprint atualizada", current_user.email
            )
        edit_fields = [k for k in diffs if k not in ("status", "sprint_id")]
        if edit_fields:
            desc = (
                f"urgência: {idea.urgencia} → {diffs['urgencia']}"
                if "urgencia" in diffs
                else None
            )
            self._evento(idea.id, "editada", desc, current_user.email)

        for key, value in diffs.items():
            setattr(idea, key, value)
        await self.db.commit()
        return await self.get_detail(current_user, idea_id)

    async def baixar(self, current_user: User, idea_id: uuid.UUID) -> IdeaDetail:
        idea = await self._get_idea(idea_id)
        idea.status = "feita"
        idea.feito_em = datetime.now(UTC)
        idea.feito_por_username = current_user.email
        self._evento(idea.id, "deu_baixa", None, current_user.email)
        await self.db.commit()
        return await self.get_detail(current_user, idea_id)

    async def reabrir(self, current_user: User, idea_id: uuid.UUID) -> IdeaDetail:
        idea = await self._get_idea(idea_id)
        idea.status = "aberta"
        idea.feito_em = None
        idea.feito_por_username = None
        self._evento(idea.id, "reaberta", None, current_user.email)
        await self.db.commit()
        return await self.get_detail(current_user, idea_id)

    async def delete_idea(
        self, idea_id: uuid.UUID, *, confirmar: bool
    ) -> SmartDeleteResult:
        await self._get_idea(idea_id)  # 404 se não existe

        async def _count(model) -> int:
            return int(
                (
                    await self.db.execute(
                        select(func.count())
                        .select_from(model)
                        .where(model.idea_id == idea_id)
                    )
                ).scalar_one()
            )

        n_anexos = await _count(SprintIdeaAnexo)
        n_coment = await _count(SprintIdeaComentario)
        n_votos = await _count(SprintIdeaVoto)
        vinculos: list[str] = []
        if n_anexos:
            vinculos.append(f"{n_anexos} anexo(s)")
        if n_coment:
            vinculos.append(f"{n_coment} comentário(s)")
        if n_votos:
            vinculos.append(f"{n_votos} voto(s)")

        if vinculos and not confirmar:
            return SmartDeleteResult(
                pode_excluir=False,
                vinculos=vinculos,
                recomendacao=(
                    "Esta ideia tem vínculos. Confirme para excluir tudo "
                    "(inclusive os arquivos anexados)."
                ),
                excluida=False,
            )

        # Apaga os arquivos do bucket antes do cascade.
        anexos = list(
            (
                await self.db.execute(
                    select(SprintIdeaAnexo).where(
                        SprintIdeaAnexo.idea_id == idea_id
                    )
                )
            ).scalars().all()
        )
        for a in anexos:
            try:
                delete_object(a.path_relativo)
            except Exception:  # noqa: BLE001 - best-effort
                pass

        # Remove filhos + a ideia (explícito p/ robustez em qualquer dialeto).
        for model in (
            SprintIdeaAnexo,
            SprintIdeaComentario,
            SprintIdeaVoto,
            SprintIdeaEvento,
        ):
            await self.db.execute(
                delete(model).where(model.idea_id == idea_id)
            )
        await self.db.execute(delete(SprintIdea).where(SprintIdea.id == idea_id))
        await self.db.commit()
        return SmartDeleteResult(
            pode_excluir=True, vinculos=vinculos, excluida=True
        )

    async def toggle_voto(
        self, current_user: User, idea_id: uuid.UUID
    ) -> VotoResult:
        idea = await self._get_idea(idea_id)
        username = current_user.email
        existing = (
            await self.db.execute(
                select(SprintIdeaVoto).where(
                    SprintIdeaVoto.idea_id == idea_id,
                    SprintIdeaVoto.username == username,
                )
            )
        ).scalar_one_or_none()
        if existing is not None:
            await self.db.delete(existing)
            votou = False
        else:
            self.db.add(SprintIdeaVoto(idea_id=idea_id, username=username))
            votou = True
        await self.db.flush()
        count = int(
            (
                await self.db.execute(
                    select(func.count())
                    .select_from(SprintIdeaVoto)
                    .where(SprintIdeaVoto.idea_id == idea_id)
                )
            ).scalar_one()
        )
        idea.votos_count = count
        await self.db.commit()
        return VotoResult(votou=votou, votos_count=count)

    async def add_comentario(
        self, current_user: User, idea_id: uuid.UUID, data: ComentarioCreate
    ) -> ComentarioRead:
        await self._get_idea(idea_id)
        c = SprintIdeaComentario(
            idea_id=idea_id,
            autor_username=current_user.email,
            autor_nome=current_user.name,
            texto=data.texto,
        )
        self.db.add(c)
        self._evento(idea_id, "comentou", None, current_user.email)
        await self.db.commit()
        await self.db.refresh(c)
        return ComentarioRead.model_validate(c)

    # ------------------------------------------------------------------ #
    # Anexos
    # ------------------------------------------------------------------ #
    async def add_anexo(
        self,
        current_user: User,
        idea_id: uuid.UUID,
        *,
        filename: str,
        content: bytes,
        content_type: str | None,
    ) -> AnexoRead:
        await self._get_idea(idea_id)
        ext = f".{filename.rsplit('.', 1)[-1].lower()}" if "." in filename else ""
        if ext in _IMG_EXT:
            tipo = "imagem"
        elif ext in _DOC_EXT:
            tipo = "documento"
        else:
            raise DomainValidationError(
                "Tipo de arquivo não permitido (imagens ou documentos)."
            )
        if len(content) > _MAX_BYTES:
            raise DomainValidationError("Arquivo acima do limite de 10 MB.")

        key = f"sprints/{idea_id}/{uuid.uuid4().hex}{ext}"
        upload_bytes(content, key, content_type)
        anexo = SprintIdeaAnexo(
            idea_id=idea_id,
            tipo=tipo,
            filename=filename,
            path_relativo=key,
            mime=content_type,
            tamanho_bytes=len(content),
            enviado_por_username=current_user.email,
        )
        self.db.add(anexo)
        self._evento(idea_id, "anexou", filename, current_user.email)
        await self.db.commit()
        await self.db.refresh(anexo)
        return self._anexo_read(anexo)

    async def get_anexo(self, anexo_id: uuid.UUID) -> SprintIdeaAnexo:
        anexo = (
            await self.db.execute(
                select(SprintIdeaAnexo).where(SprintIdeaAnexo.id == anexo_id)
            )
        ).scalar_one_or_none()
        if anexo is None:
            raise NotFoundError("Anexo não encontrado.")
        return anexo

    async def delete_anexo(self, anexo_id: uuid.UUID) -> None:
        anexo = await self.get_anexo(anexo_id)
        try:
            delete_object(anexo.path_relativo)
        except Exception:  # noqa: BLE001 - best-effort
            pass
        await self.db.delete(anexo)
        await self.db.commit()

    # ------------------------------------------------------------------ #
    # Sprints
    # ------------------------------------------------------------------ #
    async def list_sprints(self) -> list[SprintRead]:
        sprints = list(
            (
                await self.db.execute(
                    select(Sprint).order_by(Sprint.created_at.desc())
                )
            ).scalars().all()
        )
        if not sprints:
            return []
        ids = [s.id for s in sprints]
        total_map = dict(
            (
                await self.db.execute(
                    select(SprintIdea.sprint_id, func.count())
                    .where(SprintIdea.sprint_id.in_(ids))
                    .group_by(SprintIdea.sprint_id)
                )
            ).all()
        )
        feitas_map = dict(
            (
                await self.db.execute(
                    select(SprintIdea.sprint_id, func.count())
                    .where(
                        SprintIdea.sprint_id.in_(ids),
                        SprintIdea.status == "feita",
                    )
                    .group_by(SprintIdea.sprint_id)
                )
            ).all()
        )
        out: list[SprintRead] = []
        for s in sprints:
            total = int(total_map.get(s.id, 0))
            feitas = int(feitas_map.get(s.id, 0))
            r = SprintRead.model_validate(s)
            r.total_ideias = total
            r.ideias_feitas = feitas
            r.progresso = round(feitas / total * 100) if total else 0
            out.append(r)
        return out

    async def create_sprint(self, data: SprintCreate) -> SprintRead:
        sprint = Sprint(
            nome=data.nome,
            descricao=data.descricao,
            data_inicio=data.data_inicio,
            data_fim=data.data_fim,
            status=data.status,
        )
        self.db.add(sprint)
        await self.db.commit()
        await self.db.refresh(sprint)
        return SprintRead.model_validate(sprint)

    async def update_sprint(
        self, sprint_id: uuid.UUID, data: SprintUpdate
    ) -> SprintRead:
        sprint = (
            await self.db.execute(select(Sprint).where(Sprint.id == sprint_id))
        ).scalar_one_or_none()
        if sprint is None:
            raise NotFoundError("Sprint não encontrada.")
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(sprint, key, value)
        await self.db.commit()
        await self.db.refresh(sprint)
        return SprintRead.model_validate(sprint)

    async def delete_sprint(self, sprint_id: uuid.UUID) -> None:
        sprint = (
            await self.db.execute(select(Sprint).where(Sprint.id == sprint_id))
        ).scalar_one_or_none()
        if sprint is None:
            raise NotFoundError("Sprint não encontrada.")
        # Ideias vinculadas ficam sprint_id=NULL (FK SET NULL — explícito p/ SQLite).
        await self.db.execute(
            update(SprintIdea)
            .where(SprintIdea.sprint_id == sprint_id)
            .values(sprint_id=None)
        )
        await self.db.execute(delete(Sprint).where(Sprint.id == sprint_id))
        await self.db.commit()
