"""Configuração de logging da aplicação."""

from __future__ import annotations

import logging
from logging.config import dictConfig

from app.core.config import settings


def setup_logging() -> None:
    """Configura o logging raiz da aplicação.

    Usa um formato simples e legível. O nível é DEBUG quando `APP_DEBUG`
    estiver ativo, caso contrário INFO.
    """
    level = "DEBUG" if settings.APP_DEBUG else "INFO"

    dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
                    "datefmt": "%Y-%m-%d %H:%M:%S",
                },
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "default",
                },
            },
            "root": {
                "handlers": ["console"],
                "level": level,
            },
            "loggers": {
                "uvicorn": {"level": level, "handlers": ["console"], "propagate": False},
                "uvicorn.error": {"level": level, "handlers": ["console"], "propagate": False},
                "uvicorn.access": {"level": level, "handlers": ["console"], "propagate": False},
            },
        }
    )

    logging.getLogger(__name__).debug("Logging configurado (level=%s)", level)
