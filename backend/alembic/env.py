"""Ambiente de migrations do Alembic (modo async).

Lê a URL do banco de `app.core.config.settings.DATABASE_URL` e usa
`app.database.base.Base.metadata` como target para autogeneração.
"""

from __future__ import annotations

import asyncio
from logging.config import fileConfig

from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlalchemy.pool import NullPool

from alembic import context

from app.core.config import settings
from app.database.base import Base

# Importa os modelos para que estejam registrados em Base.metadata.
# (Placeholder nesta fase — modelos serão adicionados nas próximas fases.)
import app.models  # noqa: F401

# Objeto de configuração do Alembic.
config = context.config

# Injeta a URL do banco a partir das settings da aplicação.
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Configura o logging a partir do alembic.ini, se presente.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Metadata alvo para autogeneração de migrations.
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Executa migrations em modo 'offline' (apenas emite SQL)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Configura o contexto e roda as migrations sobre uma conexão síncrona."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Cria um engine async e executa as migrations."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=NullPool,
        future=True,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Executa migrations em modo 'online' (async)."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
