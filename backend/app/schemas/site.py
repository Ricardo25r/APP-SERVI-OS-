"""Schemas da feature ``site`` (formulários públicos do site institucional).

- Waitlist ("Avise-me no lançamento"): coleta e-mail + origem.
- Contato: nome, e-mail, assunto e mensagem.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

__all__ = [
    "WaitlistCreate",
    "WaitlistOut",
    "WaitlistAdminItem",
    "WaitlistAdminList",
    "ContactCreate",
    "ContactOut",
    "ContactAdminItem",
    "ContactAdminList",
]


# --------------------------------------------------------------------------- #
# Waitlist ("Avise-me")                                                        #
# --------------------------------------------------------------------------- #
class WaitlistCreate(BaseModel):
    email: EmailStr
    source: str | None = Field(default=None, max_length=40)


class WaitlistOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    created_at: datetime


class WaitlistAdminItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    source: str | None = None
    created_at: datetime


class WaitlistAdminList(BaseModel):
    items: list[WaitlistAdminItem]
    total: int


# --------------------------------------------------------------------------- #
# Contato                                                                      #
# --------------------------------------------------------------------------- #
class ContactCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    subject: str | None = Field(default=None, max_length=200)
    message: str = Field(min_length=1, max_length=4000)


class ContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime


class ContactAdminItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    email: EmailStr
    subject: str | None = None
    message: str
    created_at: datetime


class ContactAdminList(BaseModel):
    items: list[ContactAdminItem]
    total: int
