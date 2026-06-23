"""Score de priorização das ideias (módulo Sprints) — função **pura**.

Calculado em **tempo de leitura** (nunca persistido). Igual ao módulo original:

    BASE_URGENCIA = {critica:60, alta:40, media:20, baixa:5}
    BONUS_TIPO    = {bug:+5, conserto:+3, melhoria:0, ideia:0}
    envelhecimento = min(dias_desde_criacao * 1.5, 25)
    bonus_votos    = min(votos_count * 3, 15)
    score = min(BASE + envelhecimento + bonus_votos + BONUS_TIPO, 100)
"""

from __future__ import annotations

from datetime import UTC, datetime

_BASE_URGENCIA = {"critica": 60, "alta": 40, "media": 20, "baixa": 5}
_BONUS_TIPO = {"bug": 5, "conserto": 3, "melhoria": 0, "ideia": 0}

__all__ = ["compute_score"]


def compute_score(
    urgencia: str,
    tipo: str,
    created_at: datetime,
    votos_count: int,
) -> int:
    """Score inteiro [0..100] de priorização de uma ideia."""
    base = _BASE_URGENCIA.get(urgencia, 20)
    bonus_tipo = _BONUS_TIPO.get(tipo, 0)

    created = created_at if created_at.tzinfo else created_at.replace(tzinfo=UTC)
    dias = max((datetime.now(UTC) - created).days, 0)
    envelhecimento = min(dias * 1.5, 25)
    bonus_votos = min((votos_count or 0) * 3, 15)

    return int(min(base + envelhecimento + bonus_votos + bonus_tipo, 100))
