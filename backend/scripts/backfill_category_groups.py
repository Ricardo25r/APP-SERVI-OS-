"""One-off: preenche ``category_group`` das categorias existentes por nome.

Idempotente — só altera quem está sem grupo ou com grupo diferente do alvo.
Categorias fora do mapa ficam sem grupo (caem em "Outros" na UI) e são listadas
no relatório para ajuste manual no admin.

Rodar dentro do container (após a migração fase 23):
    docker exec faztudo-backend python scripts/backfill_category_groups.py
"""

from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.database.session import async_session_maker
from app.models import Category

NAME_GROUPS: dict[str, str] = {
    "Eletricista": "Reformas e Construção",
    "Encanador": "Reformas e Construção",
    "Gesseiro / Drywall": "Reformas e Construção",
    "Pintor": "Reformas e Construção",
    "Reforma": "Reformas e Construção",
    "Serralheiro": "Reformas e Construção",
    "Ar-condicionado": "Casa e Manutenção",
    "Marido de Aluguel": "Casa e Manutenção",
    "Montagem de Móveis": "Casa e Manutenção",
    "Limpeza de Caixa d'Água": "Casa e Manutenção",
    "Piscineiro": "Casa e Manutenção",
    "Jardinagem": "Casa e Manutenção",
    "Diarista": "Limpeza",
    "Doméstica": "Limpeza",
    "Dedetização / Controle de Pragas": "Limpeza",
    "Limpeza de Estofados/Sofá": "Limpeza",
    "Babá": "Cuidados e Pets",
    "Cuidador": "Cuidados e Pets",
    "Cuidador de Pets": "Cuidados e Pets",
    "Banho e Tosa": "Cuidados e Pets",
    "Técnico de Informática": "Tecnologia e Segurança",
    "Segurança eletrônica": "Tecnologia e Segurança",
    "Motoboy / Entregas": "Transporte e Entregas",
}

# Casa por nome em minúsculas (tolera diferença de caixa).
_BY_LOWER = {k.lower(): v for k, v in NAME_GROUPS.items()}


async def main() -> None:
    updated = 0
    unmatched: list[str] = []
    async with async_session_maker() as session:
        cats = (await session.execute(select(Category))).scalars().all()
        for c in cats:
            target = _BY_LOWER.get(c.name.strip().lower())
            if target is None:
                if not c.group:
                    unmatched.append(c.name)
                continue
            if c.group != target:
                c.group = target
                updated += 1
        await session.commit()

    print(f"Categorias atualizadas: {updated}")
    if unmatched:
        print("Sem grupo (definir no admin /admin/categorias):")
        for name in unmatched:
            print(f"  - {name}")
    else:
        print("Todas as categorias ficaram com grupo.")


if __name__ == "__main__":
    asyncio.run(main())
