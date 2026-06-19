"""Pacote da feature ``chat`` (Fase 8).

Reexporta o ``router`` (§3.6) para conveniência. O agregador
(``app.api.__init__``) importa ``app.api.chat.routes`` e monta sob ``/chat``.
"""

from app.api.chat.routes import router

__all__ = ["router"]
