"""Service da feature ``kyc`` — validação do profissional (revisão manual).

Documento + selfie vão para um **bucket privado** (sem leitura anônima); o admin
vê por streaming autenticado. Status: none → pending → approved/rejected.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.core.storage import get_private_object, upload_private_bytes
from app.models import (
    ProfessionalCategory,
    ProfessionalProfile,
    SavedCategoryAlert,
    User,
)
from app.schemas.kyc import FaceMatchOut, KycPendingItem, KycStatusOut
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

    async def face_match(self, user_id: uuid.UUID) -> FaceMatchOut:
        """Score de semelhança facial documento × selfie (assist; CPU em thread).
        Só auxilia a decisão humana — não aprova/recusa sozinho."""
        import asyncio

        user = await self.db.get(User, user_id)
        if user is None:
            raise NotFoundError("Usuário não encontrado.")
        if not user.kyc_document_key or not user.kyc_selfie_key:
            return FaceMatchOut(score=None, doc_face=False, selfie_face=False)
        doc, _ = await self.get_image(user_id, "document")
        sel, _ = await self.get_image(user_id, "selfie")
        from app.core.facematch import compare_faces

        result = await asyncio.to_thread(compare_faces, doc, sel)
        return FaceMatchOut(**result)

    async def _notify_saved_alert_subscribers(self, pro_user: User) -> None:
        """Notifica clientes com alerta salvo na categoria+cidade do novo
        profissional verificado (#60). Mesma transação; tolera ausência de
        perfil/categorias."""
        profile = (
            await self.db.execute(
                select(ProfessionalProfile).where(
                    ProfessionalProfile.user_id == pro_user.id
                )
            )
        ).scalar_one_or_none()
        if profile is None:
            return
        cat_ids = (
            (
                await self.db.execute(
                    select(ProfessionalCategory.category_id).where(
                        ProfessionalCategory.professional_id == profile.id
                    )
                )
            )
            .scalars()
            .all()
        )
        if not cat_ids:
            return
        alerts = (
            (
                await self.db.execute(
                    select(SavedCategoryAlert).where(
                        SavedCategoryAlert.category_id.in_(cat_ids),
                        SavedCategoryAlert.user_id != pro_user.id,
                        or_(
                            SavedCategoryAlert.city.is_(None),
                            SavedCategoryAlert.city == profile.city,
                        ),
                    )
                )
            )
            .scalars()
            .all()
        )
        notified: set[uuid.UUID] = set()
        for alert in alerts:
            if alert.user_id in notified:
                continue
            notified.add(alert.user_id)
            add_notification(
                self.db,
                user_id=alert.user_id,
                type="alert",
                title="Novo profissional na sua categoria",
                body=(
                    f"{pro_user.name} foi verificado e atende uma categoria "
                    "que você está acompanhando."
                ),
                href="/profissionais",
            )

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
        # Reflete a verificação no perfil profissional (selo "verificado" real).
        await self.db.execute(
            update(ProfessionalProfile)
            .where(ProfessionalProfile.user_id == user.id)
            .values(verified=approve)
        )
        if approve:
            await self._notify_saved_alert_subscribers(user)
        await self.db.commit()
