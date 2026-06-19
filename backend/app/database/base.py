"""Declarative Base do SQLAlchemy 2.

Todos os modelos do projeto devem herdar de `Base`. Os modelos de negócio
serão adicionados nas próximas fases (pacote `app.models`).
"""

from __future__ import annotations

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base declarativa compartilhada por todos os modelos ORM."""

    pass
