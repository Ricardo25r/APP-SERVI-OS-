"""Pacote da feature ``reviews`` (Fase 7).

Reexporta o ``router`` (§3.6) para conveniência. O agregador
(``app.api.__init__``) importa ``app.api.reviews.routes`` e monta sob
``/reviews``.
"""

from app.api.reviews.routes import router

__all__ = ["router"]
