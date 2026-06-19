"""Pacote da feature ``credits`` (Fase 5).

Reexporta o ``router`` (§3.6) para conveniência. O agregador
(``app.api.__init__``) importa ``app.api.credits.routes`` e monta sob ``/credits``.
"""

from app.api.credits.routes import router

__all__ = ["router"]
