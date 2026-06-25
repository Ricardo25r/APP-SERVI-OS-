"""Rotas da feature ``kyc`` (validação do profissional) — ``router``.

Prefixo ``/kyc``. Usuário envia documento + selfie; admin revisa.
- ``POST /kyc/me``                        → JWT, envia documento + selfie (pending).
- ``GET  /kyc/me``                        → JWT, meu status.
- ``GET  /kyc/admin/pending``             → admin, fila de pendentes.
- ``GET  /kyc/admin/{user_id}/image/{which}`` → admin, imagem (streaming).
- ``PATCH /kyc/admin/{user_id}``          → admin, aprovar/recusar.
"""

from __future__ import annotations

import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_roles
from app.core.ratelimit import rate_limit
from app.database.session import get_db
from app.models import User, UserRole
from app.schemas.kyc import (
    FaceMatchOut,
    KycPendingList,
    KycReviewIn,
    KycStatusOut,
)
from app.services.kyc import KycService

router = APIRouter()

_MAX_BYTES = 8 * 1024 * 1024
_ALLOWED = {"image/jpeg", "image/png", "image/webp"}


async def _read_image(f: UploadFile) -> tuple[bytes, str]:
    if f.content_type not in _ALLOWED:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Use JPG, PNG ou WEBP.",
        )
    data = await f.read()
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Arquivo vazio."
        )
    if len(data) > _MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Imagem muito grande (máximo 8 MB).",
        )
    return data, f.content_type


@router.post(
    "/me",
    response_model=KycStatusOut,
    summary="Enviar documento + selfie para verificação (KYC)",
    dependencies=[Depends(rate_limit("kyc", limit=10, window_seconds=300))],
)
async def submit_kyc(
    document: UploadFile = File(...),
    selfie: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> KycStatusOut:
    """Recebe a foto do documento + selfie do rosto; marca KYC como pendente."""
    doc, doc_ct = await _read_image(document)
    sel, sel_ct = await _read_image(selfie)
    return await KycService(db).submit(
        current_user,
        document=doc,
        document_ct=doc_ct,
        selfie=sel,
        selfie_ct=sel_ct,
    )


@router.get(
    "/me",
    response_model=KycStatusOut,
    summary="Meu status de verificação (KYC)",
)
async def my_kyc(
    current_user: User = Depends(get_current_user),
) -> KycStatusOut:
    return KycService.status_of(current_user)


@router.get(
    "/admin/pending",
    response_model=KycPendingList,
    summary="Fila de KYC pendentes (admin)",
)
async def kyc_pending(
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> KycPendingList:
    items = await KycService(db).list_pending()
    return KycPendingList(items=items, total=len(items))


@router.get(
    "/admin/{user_id}/image/{which}",
    summary="Imagem de KYC (admin, streaming autenticado)",
)
async def kyc_image(
    user_id: uuid.UUID,
    which: str,
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Streama a imagem privada (documento|selfie). Só admin — nunca pública."""
    if which not in ("document", "selfie"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    data, content_type = await KycService(db).get_image(user_id, which)
    return Response(content=data, media_type=content_type or "image/jpeg")


@router.patch(
    "/admin/{user_id}",
    response_model=KycStatusOut,
    summary="Aprovar/recusar KYC (admin)",
)
async def kyc_review(
    user_id: uuid.UUID,
    payload: KycReviewIn,
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> KycStatusOut:
    service = KycService(db)
    await service.review(user_id, approve=payload.approve, reason=payload.reason)
    user = await db.get(User, user_id)
    assert user is not None
    return service.status_of(user)


@router.get(
    "/admin/{user_id}/face-match",
    response_model=FaceMatchOut,
    summary="Score de semelhança facial documento × selfie (assist)",
)
async def kyc_face_match(
    user_id: uuid.UUID,
    _admin: User = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> FaceMatchOut:
    """Auxílio à análise: compara o rosto do documento com o da selfie."""
    return await KycService(db).face_match(user_id)
