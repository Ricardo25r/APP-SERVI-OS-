"""Service da feature ``gamification`` (Fase 9 — XP + Níveis + Ranking).

MVP do gamification-engine (doc 08). Concentra a regra de negócio (§3.5):

- :func:`award_xp` — concede/penaliza XP de um usuário: grava uma
  ``XpTransaction`` (trilha de auditoria/anti-abuso — doc 08 §Sistema Anti-Abuso)
  **e** atualiza o XP acumulado do profissional (``professional_profiles.xp``),
  recalculando o ``level`` pela tabela de níveis. **Não** faz ``commit`` — segue
  o padrão de :meth:`CreditService.apply_movement` (quem chama commita), o que
  permite conceder XP atomicamente dentro da transação da compra/avaliação.

- ``/me`` (resumo do profissional logado) e ``/ranking`` (top N por XP).

------------------------------------------------------------------------------
Tabela de níveis (doc 08 — Sistema de Níveis) — fonte única:
------------------------------------------------------------------------------
1 Iniciante 0 · 2 Confiável 500 · 3 Profissional 1500 · 4 Especialista 3000 ·
5 Referência Regional 6000 · 6 Elite 12000 · 7 Mestre 25000 · 8 Lenda 50000.

------------------------------------------------------------------------------
Escopo MVP / deferimentos (doc 08 — Roadmap):
------------------------------------------------------------------------------
- Ativos: XP (concessão/penalidade), níveis (recálculo automático) e ranking.
- Estrutura preparada / deferido: Medalhas (``Achievement``/``UserAchievement``
  existem como tabelas, sem lógica de concessão), Missões, Desafios, Temporadas,
  Recompensas automáticas (créditos por marco), Programa de Indicação/Fidelidade.
- XP de customer: o doc prevê gamificação simplificada para clientes (Dashboard
  Cliente). No MVP só o profissional acumula XP/nível (a coluna ``xp``/``level``
  vive em ``professional_profiles``); ``award_xp`` para um usuário sem perfil
  profissional grava a ``XpTransaction`` (auditoria) mas não atualiza nenhum
  agregado — deferido para quando o customer tiver dashboard próprio.
"""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, XpTransaction
from app.repositories.gamification import GamificationRepository
from app.schemas.gamification import (
    LevelInfo,
    MyGamificationOut,
    RankingItem,
    RankingResponse,
    XpTransactionOut,
)

__all__ = ["GamificationService", "LEVELS", "level_for_xp", "MAX_LEVEL"]


# Tabela de níveis (doc 08): ``(número, nome, XP mínimo)``. Ordenada crescente
# por ``min_xp``. Fonte única — qualquer mudança de regra vive aqui.
LEVELS: tuple[tuple[int, str, int], ...] = (
    (1, "Iniciante", 0),
    (2, "Confiável", 500),
    (3, "Profissional", 1500),
    (4, "Especialista", 3000),
    (5, "Referência Regional", 6000),
    (6, "Elite", 12000),
    (7, "Mestre", 25000),
    (8, "Lenda", 50000),
)

MAX_LEVEL = LEVELS[-1][0]


def level_for_xp(xp: int) -> tuple[int, str]:
    """Retorna ``(número, nome)`` do nível correspondente ao ``xp`` acumulado.

    XP nunca fica negativo para fins de nível: um saldo negativo (penalidades)
    mapeia para o nível 1 (Iniciante). Percorre a tabela de baixo para cima.
    """
    current = LEVELS[0]
    for entry in LEVELS:
        if xp >= entry[2]:
            current = entry
        else:
            break
    return current[0], current[1]


def _next_level_threshold(level: int) -> tuple[int, str, int] | None:
    """Retorna ``(número, nome, min_xp)`` do **próximo** nível, ou ``None`` no topo."""
    for entry in LEVELS:
        if entry[0] == level + 1:
            return entry
    return None


class GamificationService:
    """Orquestra concessão de XP, progresso (/me) e ranking."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = GamificationRepository(db)

    # ------------------------------------------------------------------ #
    # Concessão de XP (helper central) — sem commit (quem chama commita)
    # ------------------------------------------------------------------ #
    async def award_xp(
        self,
        user_id: uuid.UUID,
        amount: int,
        source: str,
        description: str | None = None,
    ) -> XpTransaction:
        """Concede (ou penaliza, se ``amount < 0``) XP a um usuário.

        Sempre grava uma ``XpTransaction`` (auditoria — doc 08 §Anti-Abuso). Se o
        usuário tem perfil profissional, soma o ``amount`` a
        ``professional_profiles.xp`` e recalcula o ``level`` pela tabela de níveis.

        **Não** faz ``commit`` — o chamador (este service ou os hooks de
        compra/avaliação) commita, permitindo transações compostas atômicas
        (padrão de :meth:`CreditService.apply_movement`).

        ``amount == 0`` é um no-op silencioso (não grava transação) — usado pelos
        hooks de avaliação (score 3 = neutro).
        """
        if amount == 0:
            return XpTransaction(
                user_id=user_id, amount=0, source=source, description=description
            )

        tx = XpTransaction(
            user_id=user_id,
            amount=amount,
            source=source,
            description=description,
        )
        self.repo.add_transaction(tx)

        profile = await self.repo.get_professional_profile_by_user(user_id)
        if profile is not None:
            profile.xp = (profile.xp or 0) + amount
            profile.level = level_for_xp(profile.xp)[0]

        await self.repo.flush()
        return tx

    # ------------------------------------------------------------------ #
    # /me — progresso do usuário logado
    # ------------------------------------------------------------------ #
    async def my_summary(
        self, current_user: User, *, recent_limit: int = 20
    ) -> MyGamificationOut:
        """Resumo de gamificação do ``current_user`` (dashboard — doc 08).

        Profissional: ``xp``/``level`` espelham o perfil + progresso para o
        próximo nível + histórico recente. Customer (sem perfil profissional):
        resposta coerente com ``xp=0``, ``level=1`` e histórico do próprio usuário
        (vazio no MVP, pois clientes ainda não acumulam XP)."""
        profile = await self.repo.get_professional_profile_by_user(current_user.id)
        xp = profile.xp if profile is not None else 0
        level_num, level_name = level_for_xp(xp)

        nxt = _next_level_threshold(level_num)
        if nxt is None:
            next_level = next_name = next_xp = None
            xp_for_next = 0
        else:
            next_level, next_name, next_xp = nxt
            xp_for_next = max(next_xp - xp, 0)

        txs = await self.repo.list_recent_xp(current_user.id, limit=recent_limit)
        return MyGamificationOut(
            xp=xp,
            level=level_num,
            level_name=level_name,
            next_level=next_level,
            next_level_name=next_name,
            next_level_xp=next_xp,
            xp_for_next_level=xp_for_next,
            recent_transactions=[
                XpTransactionOut.model_validate(t) for t in txs
            ],
        )

    # ------------------------------------------------------------------ #
    # /ranking — top N profissionais por XP
    # ------------------------------------------------------------------ #
    async def ranking(
        self,
        *,
        limit: int = 20,
        city: str | None = None,
        state: str | None = None,
    ) -> RankingResponse:
        """Ranking de profissionais (top ``limit`` por XP desc — doc 08).

        Filtros opcionais por ``city``/``state`` (Ranking Municipal/Estadual —
        doc 08). Cada item traz nome, headline, cidade/estado, XP, nível (número +
        nome) e rating (reputação)."""
        rows = await self.repo.top_professionals_by_xp(
            limit=limit, city=city, state=state
        )
        items = [
            RankingItem(
                professional_id=profile.id,
                user_id=user.id,
                name=user.name,
                headline=profile.headline,
                city=profile.city,
                state=profile.state,
                xp=profile.xp,
                level=profile.level,
                level_name=level_for_xp(profile.xp)[1],
                rating=float(profile.rating),
            )
            for profile, user in rows
        ]
        return RankingResponse(items=items, total=len(items))

    # ------------------------------------------------------------------ #
    # /levels — tabela de referência
    # ------------------------------------------------------------------ #
    @staticmethod
    def levels() -> list[LevelInfo]:
        """Tabela de níveis de referência (doc 08 — Sistema de Níveis)."""
        return [
            LevelInfo(level=num, name=name, min_xp=min_xp)
            for num, name, min_xp in LEVELS
        ]
