"""Pacote da feature ``auth`` (Fase 2).

Reexporta o ``router`` (§3.6) para conveniência. O agregador
(``app.api.__init__``) importa ``app.api.auth.routes`` e monta sob ``/auth``.
"""

from app.api.auth.routes import router

__all__ = ["router"]
