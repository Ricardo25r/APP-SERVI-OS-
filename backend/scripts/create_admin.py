"""Cria (ou atualiza) um usuário ADMIN com e-mail e senha.

Uso (código montado em ``/app``)::

    docker exec faztudo-backend python -m scripts.create_admin EMAIL SENHA [NOME]

- Se o e-mail já existir (ativo): eleva a conta a ``admin`` e **redefine a senha**.
- Senão: cria um novo usuário ``admin`` ativo.

A senha é gravada com o hash bcrypt do próprio app (``hash_password``). Ferramenta
de operação — requer acesso ao container (operação privilegiada).
"""

from __future__ import annotations

import asyncio
import sys

from sqlalchemy import func, select

from app.core.security import hash_password
from app.database.session import async_session_maker
from app.models import User, UserRole, UserStatus


async def main(email: str, password: str, name: str) -> None:
    email = email.strip().lower()  # login normaliza p/ minúsculas (auth.py)
    if len(password) < 8:
        print("Senha muito curta (minimo 8 caracteres).")
        return
    async with async_session_maker() as session:
        existing = (
            await session.execute(
                select(User).where(func.lower(User.email) == email.lower())
            )
        ).scalars().first()
        if existing is not None:
            existing.role = UserRole.admin
            existing.status = UserStatus.active
            existing.password_hash = hash_password(password)
            await session.commit()
            print(f"OK: {email} atualizado para ADMIN (senha redefinida).")
            return
        user = User(
            name=name,
            email=email,
            password_hash=hash_password(password),
            role=UserRole.admin,
            status=UserStatus.active,
        )
        session.add(user)
        await session.commit()
        print(f"OK: admin criado -> {email}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso: python -m scripts.create_admin EMAIL SENHA [NOME]")
        raise SystemExit(1)
    asyncio.run(
        main(
            sys.argv[1],
            sys.argv[2],
            sys.argv[3] if len(sys.argv) > 3 else "Administrador",
        )
    )
