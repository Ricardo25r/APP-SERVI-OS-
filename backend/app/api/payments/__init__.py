"""Pacote da feature ``payments`` (Fase 6).

Reexporta o ``router`` (§3.6) para conveniência. O agregador
(``app.api.__init__``) importa ``app.api.payments.routes`` e monta sob
``/payments``.
"""

from app.api.payments.routes import router

__all__ = ["router"]
