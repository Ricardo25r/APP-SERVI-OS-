"""Pacote da feature ``users`` (perfis — Fase 3).

Reexporta o ``router`` (§3.6) para conveniência. O agregador
(``app.api.__init__``) importa ``app.api.users.routes`` e monta sob ``/users``.
"""

from app.api.users.routes import router

__all__ = ["router"]
