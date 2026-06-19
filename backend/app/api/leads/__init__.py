"""Pacote da feature ``leads`` (Fase 4).

Reexporta o ``router`` (§3.6) para conveniência. O agregador
(``app.api.__init__``) importa ``app.api.leads.routes`` e monta sob ``/leads``.
"""

from app.api.leads.routes import router

__all__ = ["router"]
