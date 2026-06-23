"""Pacote da feature **sprints** (módulo admin Sprints / Esteira de Ideias).

O agregador (``app.api.__init__``) importa ``app.api.sprints.routes`` e monta sob
``/admin/sprints``.
"""

from app.api.sprints.routes import router

__all__ = ["router"]
