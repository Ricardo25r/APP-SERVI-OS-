"""Pacote da feature ``gamification`` (Fase 9 — XP + Níveis + Ranking).

Reexporta o ``router`` (§3.6). O agregador (``app.api.__init__``) importa
``app.api.gamification.routes`` e monta sob ``/gamification``.
"""

from app.api.gamification.routes import router

__all__ = ["router"]
