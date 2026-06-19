"""Pacote da feature ``admin`` (Fase 10 — Administração MVP).

Reexporta o ``router`` (§3.6) para conveniência. O agregador
(``app.api.__init__``) importa ``app.api.admin.routes`` e monta sob ``/admin``.
"""

from app.api.admin.routes import router

__all__ = ["router"]
