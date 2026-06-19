"""Pacote da feature ``categories`` (Fase 3).

Reexporta o ``router`` (§3.6) para conveniência. O agregador
(``app.api.__init__``) importa ``app.api.categories.routes`` e monta sob
``/categories``.
"""

from app.api.categories.routes import router

__all__ = ["router"]
