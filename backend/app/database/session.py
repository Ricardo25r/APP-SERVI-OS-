"""Engine async, session maker e dependência `get_db`."""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

# Engine assíncrono (SQLAlchemy 2 + asyncpg).
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.APP_DEBUG,
    pool_pre_ping=True,
    future=True,
)

# Fábrica de sessões assíncronas.
async_session_maker = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependência FastAPI que fornece uma sessão async por request."""
    async with async_session_maker() as session:
        yield session
