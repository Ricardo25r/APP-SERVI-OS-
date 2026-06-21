"""Seeds idempotentes (dono: backbone).

Insere o catálogo inicial de **categorias** (§2.5 / §5.1, chave ``slug``) e os
**pacotes de créditos** da Fase 6 (§6, chave ``name``). Ambos são idempotentes:
rodar 2× não duplica.

Uso:

    python -m app.seeds        # roda categorias + pacotes

Mapa categoria → tier (define o custo base do lead: simple=1, medium=3, premium=5):
"""

from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from app.database.session import async_session_maker
from app.models import Category, CategoryTier, CreditPackage

logger = logging.getLogger("faztudo.seeds")

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

# (name, credits, price_cents, discount_percent, is_popular) — §6 + vitrine Tela 05.
INITIAL_PACKAGES: tuple[tuple[str, int, int, int, bool], ...] = (
    ("Starter", 10, 1490, 0, True),
    ("Profissional", 50, 5990, 10, False),
    ("Avançado", 100, 9990, 20, False),
    ("Elite", 250, 19990, 25, False),
    ("Empresarial", 500, 29990, 30, False),
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


async def seed_packages() -> dict[str, int]:
    """Insere os pacotes de créditos iniciais que ainda não existem (§6).

    Idempotente — chave lógica ``name`` (que também é UNIQUE na tabela). Rodar
    2× não duplica. Retorna ``{"created": n, "skipped": m}``.
    """
    created = 0
    updated = 0

    async with async_session_maker() as session:
        result = await session.execute(select(CreditPackage))
        by_name = {p.name: p for p in result.scalars().all()}

        for name, credits, price_cents, discount_percent, is_popular in (
            INITIAL_PACKAGES
        ):
            pkg = by_name.get(name)
            if pkg is None:
                session.add(
                    CreditPackage(
                        name=name,
                        credits=credits,
                        price_cents=price_cents,
                        currency="BRL",
                        active=True,
                        discount_percent=discount_percent,
                        is_popular=is_popular,
                    )
                )
                created += 1
            else:
                # Atualiza preço/selos (idempotente — reaplica os valores atuais).
                pkg.credits = credits
                pkg.price_cents = price_cents
                pkg.discount_percent = discount_percent
                pkg.is_popular = is_popular
                pkg.active = True
                updated += 1

        await session.commit()

    logger.info(
        "Seed de pacotes concluído: %d criados, %d atualizados.", created, updated
    )
    return {"created": created, "updated": updated}


async def _main() -> None:
    logging.basicConfig(level=logging.INFO)
    cats = await seed_categories()
    pkgs = await seed_packages()
    print(f"Categorias: {cats['created']} criadas, {cats['skipped']} ignoradas.")
    print(f"Pacotes: {pkgs['created']} criados, {pkgs['updated']} atualizados.")


if __name__ == "__main__":
    asyncio.run(_main())
