"""Seed das categorias iniciais (dono: backbone).

Insere o catálogo inicial de categorias com seus ``tier`` conforme o contrato
(§2.5 / §5.1). Idempotente: não duplica categorias já presentes (chave: ``slug``).

Uso:

    python -m app.seeds

Mapa categoria → tier (define o custo base do lead: simple=1, medium=3, premium=5):
"""

from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from app.database.session import async_session_maker
from app.models import Category, CategoryTier

logger = logging.getLogger("trampoja.seeds")

# (slug kebab-case sem acento, nome exibido, tier) — §2.5.
INITIAL_CATEGORIES: tuple[tuple[str, str, CategoryTier], ...] = (
    ("eletricista", "Eletricista", CategoryTier.medium),
    ("encanador", "Encanador", CategoryTier.medium),
    ("pintor", "Pintor", CategoryTier.medium),
    ("diarista", "Diarista", CategoryTier.simple),
    ("jardinagem", "Jardinagem", CategoryTier.simple),
    ("montagem", "Montagem de Móveis", CategoryTier.simple),
    ("reforma", "Reforma", CategoryTier.premium),
    ("baba", "Babá", CategoryTier.premium),
    ("cuidador", "Cuidador", CategoryTier.premium),
    ("domestica", "Doméstica", CategoryTier.premium),
)


async def seed_categories() -> dict[str, int]:
    """Insere as categorias iniciais que ainda não existem. Idempotente.

    Retorna um resumo ``{"created": n, "skipped": m}``.
    """
    created = 0
    skipped = 0

    async with async_session_maker() as session:
        result = await session.execute(select(Category.slug))
        existing_slugs = set(result.scalars().all())

        for slug, name, tier in INITIAL_CATEGORIES:
            if slug in existing_slugs:
                skipped += 1
                continue
            session.add(Category(name=name, slug=slug, tier=tier, active=True))
            created += 1

        if created:
            await session.commit()

    logger.info("Seed de categorias concluído: %d criadas, %d ignoradas.", created, skipped)
    return {"created": created, "skipped": skipped}


async def _main() -> None:
    logging.basicConfig(level=logging.INFO)
    summary = await seed_categories()
    print(f"Categorias: {summary['created']} criadas, {summary['skipped']} ignoradas.")


if __name__ == "__main__":
    asyncio.run(_main())
