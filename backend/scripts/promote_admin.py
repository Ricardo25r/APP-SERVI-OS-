"""Promove uma conta EXISTENTE a admin (ferramenta de operação/setup).

Uso (dentro do container, código montado em ``/app``)::

    docker exec faztudo-backend python scripts/promote_admin.py seu@email.com

Não cria senha nem usuário — apenas eleva o ``role`` de um usuário já cadastrado
para ``admin``, liberando o painel administrativo. Requer acesso ao container
(operação privilegiada), portanto não adiciona superfície de ataque.
"""

from __future__ import annotations

import asyncio
import sys

from sqlalchemy import func, select

from app.database.session import async_session_maker
from app.models import User, UserRole


async def main(email: str) -> None:
    async with async_session_maker() as session:
        user = (
            await session.execute(
                select(User).where(func.lower(User.email) == email.lower())
            )
        ).scalars().first()
        if user is None:
            print(f"Conta nao encontrada: {email}")
            return
        if user.role == UserRole.admin:
            print(f"{email} ja e admin.")
            return
        user.role = UserRole.admin
        await session.commit()
        print(f"OK: {email} agora e ADMIN. Saia e entre de novo para aplicar.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python scripts/promote_admin.py SEU_EMAIL")
        raise SystemExit(1)
    asyncio.run(main(sys.argv[1]))
