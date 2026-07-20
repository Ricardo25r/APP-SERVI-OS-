"""Rotas da feature ``site`` — formulários públicos do site institucional.

Endpoints públicos (sem login), protegidos por rate limit para conter abuso:

- ``POST /site/waitlist``  → captura de e-mail "Avise-me no lançamento".
- ``POST /site/contact``   → mensagem do formulário de contato.

E as listagens para o dono (admin):

- ``GET /site/waitlist``   → admin, e-mails cadastrados (mais recentes primeiro).
- ``GET /site/contact``    → admin, mensagens de contato.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_roles
from app.core.ratelimit import rate_limit
from app.database.session import get_db
from app.models import ContactMessage, User, UserRole, WaitlistEntry
from app.schemas.site import (
    ContactAdminItem,
    ContactAdminList,
    ContactCreate,
    ContactOut,
    WaitlistAdminItem,
    WaitlistAdminList,
    WaitlistCreate,
    WaitlistOut,
)

router = APIRouter()


# --------------------------------------------------------------------------- #
# Waitlist ("Avise-me")                                                        #
# --------------------------------------------------------------------------- #
@router.post(
    "/waitlist",
    response_model=WaitlistOut,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar e-mail na lista de espera do app",
    dependencies=[Depends(rate_limit("waitlist", limit=10, window_seconds=300))],
)
async def create_waitlist_entry(
    payload: WaitlistCreate,
    db: AsyncSession = Depends(get_db),
) -> WaitlistEntry:
    entry = WaitlistEntry(
        email=str(payload.email).strip().lower(),
        source=(payload.source or None),
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.get(
    "/waitlist",
    response_model=WaitlistAdminList,
    summary="Listar e-mails da lista de espera (admin)",
)
async def list_waitlist(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> WaitlistAdminList:
    total = await db.scalar(select(func.count()).select_from(WaitlistEntry)) or 0
    rows = (
        await db.execute(
            select(WaitlistEntry)
            .order_by(WaitlistEntry.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).scalars().all()
    return WaitlistAdminList(
        items=[WaitlistAdminItem.model_validate(r) for r in rows],
        total=int(total),
    )


# --------------------------------------------------------------------------- #
# Contato                                                                      #
# --------------------------------------------------------------------------- #
@router.post(
    "/contact",
    response_model=ContactOut,
    status_code=status.HTTP_201_CREATED,
    summary="Enviar mensagem pelo formulário de contato",
    dependencies=[Depends(rate_limit("contact", limit=5, window_seconds=300))],
)
async def create_contact_message(
    payload: ContactCreate,
    db: AsyncSession = Depends(get_db),
) -> ContactMessage:
    msg = ContactMessage(
        name=payload.name.strip(),
        email=str(payload.email).strip().lower(),
        subject=(payload.subject.strip() if payload.subject else None),
        message=payload.message.strip(),
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


@router.get(
    "/contact",
    response_model=ContactAdminList,
    summary="Listar mensagens de contato (admin)",
)
async def list_contact_messages(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> ContactAdminList:
    total = await db.scalar(select(func.count()).select_from(ContactMessage)) or 0
    rows = (
        await db.execute(
            select(ContactMessage)
            .order_by(ContactMessage.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).scalars().all()
    return ContactAdminList(
        items=[ContactAdminItem.model_validate(r) for r in rows],
        total=int(total),
    )
