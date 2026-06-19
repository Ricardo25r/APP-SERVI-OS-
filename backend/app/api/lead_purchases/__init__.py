"""Pacote da feature ``lead_purchases`` (Fase 5).

Reexporta o ``router`` (§3.6) para conveniência. O agregador
(``app.api.__init__``) importa ``app.api.lead_purchases.routes`` e monta sob
``/lead-purchases``.
"""

from app.api.lead_purchases.routes import router

__all__ = ["router"]
