"""Service da feature ``kyc`` — validação do profissional (revisão manual).

Documento + selfie vão para um **bucket privado** (sem leitura anônima); o admin
vê por streaming autenticado. Status: none → pending → approved/rejected.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.core.storage import get_private_object, upload_private_bytes
from app.models import User
from app.schemas.kyc import KycPendingItem, KycStatusOut
from app.services.notifications import add_notification

__all__ = ["KycService"]

_EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


class KycService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    @staticmethod
    def status_of(user: User) -> KycStatusOut:
        return KycStatusOut(
            status=user.kyc_status or "none",
            submitted_at=user.kyc_submitted_at,
            reviewed_at=user.kyc_reviewed_at,
            reject_reason=user.kyc_reject_reason,
            has_document=bool(user.kyc_document_key),
            has_selfie=bool(user.kyc_selfie_key),
        )

    async def submit(
        self,
        user: User,
        *,
        document: bytes,
        document_ct: str,
        selfie: bytes,
        selfie_ct: str,
    ) -> KycStatusOut:
        bucket = settings.S3_KYC_BUCKET
        doc_key = (
            f"kyc/{user.id}/document-{uuid.uuid4().hex}."
            f"{_EXT.get(document_ct, 'jpg')}"
        )
        selfie_key = (
            f"kyc/{user.id}/selfie-{uuid.uuid4().hex}."
            f"{_EXT.get(selfie_ct, 'jpg')}"
        )
        upload_private_bytes(document, doc_key, document_ct, bucket=bucket)
        upload_private_bytes(selfie, selfie_key, selfie_ct, bucket=bucket)
        user.kyc_document_key = doc_key
        user.kyc_selfie_key = selfie_key
        user.kyc_status = "pending"
        user.kyc_submitted_at = datetime.now(UTC)
        user.kyc_reviewed_at = None
        user.kyc_reject_reason = None
        await self.db.commit()
        await self.db.refresh(user)
        return self.status_of(user)

    async def list_pending(self) -> list[KycPendingItem]:
        rows = (
            (
                await self.db.execute(
                    select(User)
                    .where(
                        User.kyc_status == "pending",
                        User.deleted_at.is_(None),
                    )
                    .order_by(User.kyc_submitted_at.asc())
                )
            )
            .scalars()
            .all()
        )
        return [
            KycPendingItem(
                user_id=u.id, name=u.name, submitted_at=u.kyc_submitted_at
            )
            for u in rows
        ]

    async def count_pending(self) -> int:
        return int(
            (
                await self.db.execute(
                    select(func.count())
                    .select_from(User)
                    .where(
                        User.kyc_status == "pending",
                        User.deleted_at.is_(None),
                    )
                )
            ).scalar_one()
        )

    async def get_image(
        self, user_id: uuid.UUID, which: str
    ) -> tuple[bytes, str | None]:
        user = await self.db.get(User, user_id)
        if user is None:
            raise NotFoundError("Usuário não encontrado.")
        key = user.kyc_document_key if which == "document" else user.kyc_selfie_key
        if not key:
            raise NotFoundError("Imagem de KYC não encontrada.")
        return get_private_object(key, bucket=settings.S3_KYC_BUCKET)

    async def review(
        self, user_id: uuid.UUID, *, approve: bool, reason: str | None
    ) -> None:
        user = await self.db.get(User, user_id)
        if user is None:
            raise NotFoundError("Usuário não encontrado.")
        if user.kyc_status != "pending":
            raise PermissionDeniedError("Este KYC não está pendente.")
        if not approve and not (reason or "").strip():
            raise PermissionDeniedError("Informe o motivo da recusa.")
        user.kyc_status = "approved" if approve else "rejected"
        user.kyc_reviewed_at = datetime.now(UTC)
        user.kyc_reject_reason = None if approve else reason
        add_notification(
            self.db,
            user_id=user.id,
            type="kyc",
            title="Verificação aprovada!" if approve else "Verificação recusada",
            body=(
                "Sua conta foi verificada. Agora você tem o selo de verificado."
                if approve
                else f"Sua verificação foi recusada: {reason}. Reenvie os documentos."
            ),
            href="/profile",
        )
        await self.db.commit()
