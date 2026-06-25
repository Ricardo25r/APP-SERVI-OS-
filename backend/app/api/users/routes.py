"""Rotas da feature ``users`` (perfis — Fase 3) — ``router = APIRouter()`` (§3.6).

Prefixo ``/users`` é aplicado pelo agregador (``app.api.__init__``). Caminhos
relativos. As rotas chamam o :class:`UserProfileService`; exceções de domínio
viram HTTP no handler global (§3.9).

Endpoints (§4 — Fase 3, feature ``users``):
- ``POST/GET/PATCH /me/customer-profile``        → customer.
- ``POST/GET/PATCH /me/professional-profile``    → professional (POST cria wallet).
- ``PUT/GET /me/professional-profile/categories``→ professional.
- ``GET /{user_id}/professional-profile``        → qualquer (perfil público).
"""

from __future__ import annotations

import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.imagecheck import detect_image
from app.core.ratelimit import rate_limit
from app.core.storage import upload_bytes
from app.database.session import get_db
from app.models import User
from app.schemas.auth import ReferralInfoOut, UserOut
from app.schemas.users import (
    BlockIn,
    CategoriesOut,
    CustomerProfileIn,
    CustomerProfileOut,
    CustomerProfileUpdate,
    FavoriteIn,
    PortfolioItemOut,
    ProfessionalProfileIn,
    ProfessionalProfileOut,
    ProfessionalProfilePublicOut,
    ProfessionalProfileUpdate,
    ProfessionalSearchList,
    SetCategoriesIn,
)
from app.services.referrals import ReferralService
from app.services.users import UserProfileService

router = APIRouter()

_MAX_AVATAR_BYTES = 5 * 1024 * 1024
_ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/png", "image/webp"}
_AVATAR_EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}

_MAX_PORTFOLIO_BYTES = 5 * 1024 * 1024
_MAX_PORTFOLIO_ITEMS = 12


@router.post(
    "/me/avatar",
    response_model=UserOut,
    summary="Atualizar foto de perfil",
    dependencies=[Depends(rate_limit("avatar", limit=12, window_seconds=60))],
)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Foto de perfil do usuário autenticado (JPG/PNG/WEBP, até 5 MB)."""
    if file.content_type not in _ALLOWED_AVATAR_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Formato inválido. Use JPG, PNG ou WEBP.",
        )
    data = await file.read()
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Arquivo vazio."
        )
    if len(data) > _MAX_AVATAR_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Imagem muito grande (máximo 5 MB).",
        )
    if detect_image(data) is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Arquivo não é uma imagem válida.",
        )
    ext = _AVATAR_EXT.get(file.content_type, "")
    key = f"avatars/{current_user.id}/{uuid.uuid4().hex}{ext}"
    upload_bytes(data, key, content_type=file.content_type)
    current_user.avatar_key = key
    await db.commit()
    await db.refresh(current_user)
    return current_user


# --------------------------------------------------------------------------- #
# Portfólio / galeria de trabalhos (#58)
# --------------------------------------------------------------------------- #
@router.get(
    "/me/portfolio",
    response_model=list[PortfolioItemOut],
    summary="Minha galeria de trabalhos",
)
async def list_my_portfolio(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PortfolioItemOut]:
    return await UserProfileService(db).list_my_portfolio(current_user)


@router.post(
    "/me/portfolio",
    response_model=PortfolioItemOut,
    status_code=status.HTTP_201_CREATED,
    summary="Adicionar foto à galeria de trabalhos",
    dependencies=[Depends(rate_limit("portfolio", limit=20, window_seconds=60))],
)
async def add_portfolio_item(
    file: UploadFile = File(...),
    caption: str | None = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PortfolioItemOut:
    """Foto de trabalho do profissional (JPG/PNG/WEBP, até 5 MB, máx 12)."""
    service = UserProfileService(db)
    existing = await service.list_my_portfolio(current_user)
    if len(existing) >= _MAX_PORTFOLIO_ITEMS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Limite de {_MAX_PORTFOLIO_ITEMS} fotos na galeria.",
        )
    if file.content_type not in _ALLOWED_AVATAR_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Formato inválido. Use JPG, PNG ou WEBP.",
        )
    data = await file.read()
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Arquivo vazio."
        )
    if len(data) > _MAX_PORTFOLIO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Imagem muito grande (máximo 5 MB).",
        )
    if detect_image(data) is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Arquivo não é uma imagem válida.",
        )
    ext = _AVATAR_EXT.get(file.content_type, "")
    key = f"portfolio/{current_user.id}/{uuid.uuid4().hex}{ext}"
    upload_bytes(data, key, content_type=file.content_type)
    return await service.add_portfolio_item(
        current_user, image_key=key, caption=caption
    )


@router.delete(
    "/me/portfolio/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Remover foto da galeria",
)
async def delete_portfolio_item(
    item_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await UserProfileService(db).delete_portfolio_item(current_user, item_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/me/referral",
    response_model=ReferralInfoOut,
    summary="Meu código de indicação (indique e ganhe)",
)
async def my_referral(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReferralInfoOut:
    """Código de indicação do usuário + total de indicados + créditos ganhos."""
    code, total, earned = await ReferralService(db).referral_info(current_user)
    return ReferralInfoOut(
        code=code, total_referrals=total, credits_earned=earned
    )


@router.delete(
    "/me",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Excluir minha conta (LGPD — irreversível)",
)
async def delete_my_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Exclui (anonimiza + desativa) a conta do usuário autenticado.

    Irreversível: revoga as sessões, anonimiza os dados pessoais e remove o
    usuário das listagens. Atende ao direito de eliminação (LGPD Art. 18) e à
    exigência de exclusão de conta das app stores.
    """
    await UserProfileService(db).delete_account(current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --------------------------------------------------------------------------- #
# Customer profile
# --------------------------------------------------------------------------- #
@router.post(
    "/me/customer-profile",
    response_model=CustomerProfileOut,
    status_code=status.HTTP_201_CREATED,
    summary="Criar perfil de contratante",
)
async def create_customer_profile(
    payload: CustomerProfileIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CustomerProfileOut:
    """Cria o perfil 1:1 do contratante (409 se já existe)."""
    service = UserProfileService(db)
    return await service.create_customer_profile(current_user, payload)


@router.get(
    "/me/customer-profile",
    response_model=CustomerProfileOut,
    summary="Obter o próprio perfil de contratante",
)
async def get_customer_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CustomerProfileOut:
    service = UserProfileService(db)
    return await service.get_customer_profile(current_user)


@router.patch(
    "/me/customer-profile",
    response_model=CustomerProfileOut,
    summary="Atualizar o próprio perfil de contratante",
)
async def update_customer_profile(
    payload: CustomerProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CustomerProfileOut:
    service = UserProfileService(db)
    return await service.update_customer_profile(current_user, payload)


# --------------------------------------------------------------------------- #
# Professional profile
# --------------------------------------------------------------------------- #
@router.post(
    "/me/professional-profile",
    response_model=ProfessionalProfileOut,
    status_code=status.HTTP_201_CREATED,
    summary="Criar perfil profissional (+ carteira automática)",
)
async def create_professional_profile(
    payload: ProfessionalProfileIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProfessionalProfileOut:
    """Cria o perfil 1:1 do profissional, a carteira de créditos (saldo 0) e os
    vínculos de categoria informados (409 se já existe; 422 se categoria
    inexistente)."""
    service = UserProfileService(db)
    return await service.create_professional_profile(current_user, payload)


@router.get(
    "/me/professional-profile",
    response_model=ProfessionalProfileOut,
    summary="Obter o próprio perfil profissional",
)
async def get_professional_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProfessionalProfileOut:
    service = UserProfileService(db)
    return await service.get_professional_profile(current_user)


@router.patch(
    "/me/professional-profile",
    response_model=ProfessionalProfileOut,
    summary="Atualizar o próprio perfil profissional",
)
async def update_professional_profile(
    payload: ProfessionalProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProfessionalProfileOut:
    service = UserProfileService(db)
    return await service.update_professional_profile(current_user, payload)


# --------------------------------------------------------------------------- #
# Categorias do profissional (N:N)
# --------------------------------------------------------------------------- #
@router.put(
    "/me/professional-profile/categories",
    response_model=CategoriesOut,
    summary="Definir (substituir) as categorias do profissional",
)
async def set_professional_categories(
    payload: SetCategoriesIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CategoriesOut:
    """Substitui o conjunto de categorias vinculadas (422 se alguma não existe)."""
    service = UserProfileService(db)
    categories = await service.set_professional_categories(
        current_user, payload.category_ids
    )
    return CategoriesOut(categories=categories)


@router.get(
    "/me/professional-profile/categories",
    response_model=CategoriesOut,
    summary="Listar as categorias do profissional",
)
async def get_professional_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CategoriesOut:
    service = UserProfileService(db)
    categories = await service.get_professional_categories(current_user)
    return CategoriesOut(categories=categories)


# --------------------------------------------------------------------------- #
# Catálogo / busca de profissionais (cliente)
# --------------------------------------------------------------------------- #
@router.get(
    "/professionals",
    response_model=ProfessionalSearchList,
    summary="Buscar profissionais (catálogo do cliente)",
)
async def search_professionals(
    category_id: uuid.UUID | None = Query(default=None),
    city: str | None = Query(default=None),
    state: str | None = Query(default=None),
    q: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProfessionalSearchList:
    """Catálogo de profissionais por categoria/cidade/estado/texto, ordenado por
    reputação. Exige autenticação (qualquer usuário)."""
    service = UserProfileService(db)
    return await service.search_professionals(
        category_id=category_id, city=city, state=state, query=q
    )


# --------------------------------------------------------------------------- #
# Favoritos (profissionais salvos pelo cliente)
# --------------------------------------------------------------------------- #
@router.get(
    "/favorites",
    response_model=ProfessionalSearchList,
    summary="Meus profissionais favoritos",
)
async def list_favorites(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProfessionalSearchList:
    return await UserProfileService(db).list_favorites(current_user)


@router.post(
    "/favorites",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Favoritar um profissional",
)
async def add_favorite(
    payload: FavoriteIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await UserProfileService(db).add_favorite(
        current_user, payload.professional_user_id
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete(
    "/favorites/{professional_user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Remover dos favoritos",
)
async def remove_favorite(
    professional_user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await UserProfileService(db).remove_favorite(
        current_user, professional_user_id
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --------------------------------------------------------------------------- #
# Bloqueio entre usuários
# --------------------------------------------------------------------------- #
@router.post(
    "/blocks",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Bloquear um usuário",
)
async def block_user(
    payload: BlockIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await UserProfileService(db).block_user(current_user, payload.user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete(
    "/blocks/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Desbloquear um usuário",
)
async def unblock_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await UserProfileService(db).unblock_user(current_user, user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --------------------------------------------------------------------------- #
# Perfil público
# --------------------------------------------------------------------------- #
@router.get(
    "/{user_id}/professional-profile",
    response_model=ProfessionalProfilePublicOut,
    summary="Perfil público de um profissional",
)
async def get_public_professional_profile(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProfessionalProfilePublicOut:
    """Leitura pública (qualquer usuário autenticado) do perfil de um
    profissional; sem dados sensíveis."""
    service = UserProfileService(db)
    return await service.get_public_professional_profile(
        user_id, viewer_id=current_user.id
    )
