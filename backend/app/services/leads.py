"""Service da feature ``leads`` (Fase 4).

Concentra a regra de negócio (§3.5): classificação de custo (§5.1), ownership e
papéis (§5.2), listagem contextual (customer = próprios leads; professional =
elegíveis via matching MVP §5.3) e montagem do ``LeadRead`` com a visibilidade de
contato correta (§4 / §5.6). Faz o ``commit`` (repositório só faz ``flush``).

**Classificação de custo (§5.1) — configurável num único lugar:** o dict
``TIER_COST`` (custo base por tier da categoria) e a promoção por ``lead_type``
ficam aqui. ``credits_cost`` é gravado na criação e é imutável depois (por isso o
PATCH não troca ``category_id``/``lead_type``).

Fase 11: persiste ``budget_range``/coordenadas, monta a galeria de ``media`` (URLs
presignadas) e calcula ``distance_km`` (Haversine) para o profissional.
"""

from __future__ import annotations

import math
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    DomainValidationError,
    NotFoundError,
    PermissionDeniedError,
)
from app.core.storage import presigned_get_url, upload_bytes
from app.models import (
    Category,
    CategoryTier,
    Lead,
    LeadMedia,
    LeadStatus,
    LeadType,
    User,
    UserRole,
)
from app.repositories.leads import LeadRepository
from app.schemas.leads import (
    CategorySummary,
    CustomerSummary,
    LeadContact,
    LeadCreate,
    LeadMediaOut,
    LeadRead,
    LeadUpdate,
)

__all__ = [
    "LeadService",
    "TIER_COST",
    "PREMIUM_PROMOTED_TYPES",
    "PREMIUM_COST",
    "LEAD_EXPIRATION_DAYS",
    "classify_credits_cost",
]

# --------------------------------------------------------------------------- #
# Classificação de custo (§5.1) — ponto único de configuração.
# --------------------------------------------------------------------------- #
TIER_COST: dict[CategoryTier, int] = {
    CategoryTier.simple: 1,
    CategoryTier.medium: 3,
    CategoryTier.premium: 5,
}

# lead_type que promove o custo ao mínimo premium (contratações de maior valor).
PREMIUM_PROMOTED_TYPES: frozenset[LeadType] = frozenset(
    {LeadType.temporary, LeadType.permanent}
)
PREMIUM_COST: int = 5

# Janela de validade do lead (§5.1): created_at + 30 dias.
LEAD_EXPIRATION_DAYS: int = 30


def classify_credits_cost(tier: CategoryTier, lead_type: LeadType) -> int:
    """Custo em créditos do lead (§5.1).

    ``base = TIER_COST[tier]``; se ``lead_type`` for temporary/permanent, eleva ao
    mínimo de ``PREMIUM_COST`` (5). Caso contrário, mantém o custo base.
    """
    base = TIER_COST[tier]
    if lead_type in PREMIUM_PROMOTED_TYPES:
        return max(base, PREMIUM_COST)
    return base


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distância em km entre dois pontos (fórmula de Haversine)."""
    radius = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    return 2 * radius * math.asin(math.sqrt(a))


def _profile_coords(profile) -> tuple[float, float] | None:
    """Coordenadas (lat, lng) do profissional, ou ``None`` se não tiver."""
    if profile is None or profile.latitude is None or profile.longitude is None:
        return None
    return (float(profile.latitude), float(profile.longitude))


def _distance_km(lead_lat, lead_lng, viewer_coords) -> float | None:
    """Distância (km, 1 casa) do lead ao ``viewer_coords``, se houver coords."""
    if lead_lat is None or lead_lng is None or viewer_coords is None:
        return None
    return round(
        _haversine_km(
            float(lead_lat), float(lead_lng), viewer_coords[0], viewer_coords[1]
        ),
        1,
    )


class LeadService:
    """Orquestra criação, listagem, leitura, update e cancelamento de leads."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = LeadRepository(db)

    # ------------------------------------------------------------------ #
    # Criação (customer)
    # ------------------------------------------------------------------ #
    async def create(self, current_user: User, data: LeadCreate) -> LeadRead:
        """Cria um lead para o customer autenticado (§4 / §5.1 / §5.2).

        - Apenas ``role == customer`` cria (defesa em profundidade; a rota também
          aplica ``require_roles``).
        - Valida que a categoria existe e está ativa.
        - Calcula ``credits_cost`` (imutável) e ``expires_at`` no backend.
        """
        if current_user.role != UserRole.customer:
            raise PermissionDeniedError("Apenas contratantes podem criar leads.")

        category = await self.repo.category_exists(data.category_id)
        if category is None:
            raise NotFoundError("Categoria não encontrada.")
        if not category.active:
            raise DomainValidationError("Categoria inativa não aceita novos leads.")

        now = datetime.now(UTC)
        lead = Lead(
            customer_id=current_user.id,
            category_id=category.id,
            title=data.title,
            description=data.description,
            lead_type=data.lead_type,
            urgency=data.urgency,
            city=data.city,
            state=data.state.upper(),
            neighborhood=data.neighborhood,
            budget_range=data.budget_range,
            latitude=data.latitude,
            longitude=data.longitude,
            status=LeadStatus.open,
            credits_cost=classify_credits_cost(category.tier, data.lead_type),
            expires_at=now + timedelta(days=LEAD_EXPIRATION_DAYS),
        )
        self.repo.add(lead)
        await self.repo.flush()
        await self.db.commit()

        # Recarrega com relações para montar a resposta (contato visível ao dono).
        created = await self.repo.get_by_id(lead.id)
        assert created is not None  # acabou de ser criado nesta transação
        return self._to_read(created, viewer=current_user, include_contact=True)

    # ------------------------------------------------------------------ #
    # Listagem contextual (customer vs professional)
    # ------------------------------------------------------------------ #
    async def list_for_user(
        self,
        current_user: User,
        *,
        status: LeadStatus | None = None,
        category_id: uuid.UUID | None = None,
        city: str | None = None,
        state: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[LeadRead], int]:
        """Listagem paginada conforme o papel (§4):

        - **customer:** apenas os próprios leads.
        - **professional:** leads elegíveis (matching MVP §5.3), ``status=open``,
          **sem** contato; cada item traz a flag ``affordable``.
        """
        limit = page_size
        offset = (page - 1) * page_size

        if current_user.role == UserRole.customer:
            leads, total = await self.repo.list_owned(
                current_user.id,
                status=status,
                category_id=category_id,
                city=city,
                state=state,
                limit=limit,
                offset=offset,
            )
            items = [
                self._to_read(lead, viewer=current_user, include_contact=True)
                for lead in leads
            ]
            return items, total

        if current_user.role == UserRole.professional:
            profile = await self.repo.get_professional_profile(current_user.id)
            if profile is None:
                # Sem perfil profissional não há critério de elegibilidade.
                return [], 0
            leads, total = await self.repo.list_eligible_for_professional(
                profile,
                category_id=category_id,
                city=city,
                state=state,
                limit=limit,
                offset=offset,
            )
            balance = profile.wallet.balance if profile.wallet is not None else 0
            coords = _profile_coords(profile)
            items = [
                self._to_read(
                    lead,
                    viewer=current_user,
                    include_contact=False,
                    affordable=balance >= lead.credits_cost,
                    viewer_coords=coords,
                )
                for lead in leads
            ]
            return items, total

        # admin (ou outro papel) não tem listagem de leads nesta fase.
        raise PermissionDeniedError("Papel sem acesso à listagem de leads.")

    # ------------------------------------------------------------------ #
    # Detalhe
    # ------------------------------------------------------------------ #
    async def get(self, current_user: User, lead_id: uuid.UUID) -> LeadRead:
        """Detalhe do lead (§4).

        - customer dono: vê tudo + contato.
        - professional elegível ou comprador: vê o detalhe; contato **só** se
          comprou.
        - demais: 403.
        """
        lead = await self.repo.get_by_id(lead_id)
        if lead is None:
            raise NotFoundError("Lead não encontrado.")

        if current_user.role == UserRole.customer:
            if lead.customer_id != current_user.id:
                raise PermissionDeniedError("Você não é o dono deste lead.")
            return self._to_read(lead, viewer=current_user, include_contact=True)

        if current_user.role == UserRole.professional:
            profile = await self.repo.get_professional_profile(current_user.id)
            if profile is None:
                raise PermissionDeniedError("Perfil profissional inexistente.")
            coords = _profile_coords(profile)
            purchased = await self.repo.professional_has_purchased(lead, profile.id)
            if purchased:
                return self._to_read(
                    lead,
                    viewer=current_user,
                    include_contact=True,
                    viewer_coords=coords,
                )
            eligible = await self.repo.is_professional_eligible(profile, lead)
            if not eligible:
                raise PermissionDeniedError("Lead não disponível para você.")
            balance = profile.wallet.balance if profile.wallet is not None else 0
            return self._to_read(
                lead,
                viewer=current_user,
                include_contact=False,
                affordable=balance >= lead.credits_cost,
                viewer_coords=coords,
            )

        raise PermissionDeniedError("Papel sem acesso a este lead.")

    # ------------------------------------------------------------------ #
    # Update (só o dono, só enquanto open)
    # ------------------------------------------------------------------ #
    async def update(
        self, current_user: User, lead_id: uuid.UUID, data: LeadUpdate
    ) -> LeadRead:
        """Atualiza campos editáveis do lead (§4 / §5.2).

        Ownership obrigatório; só enquanto ``status == open``. Não toca
        ``category_id``/``lead_type``/``credits_cost`` (imutáveis).
        """
        lead = await self._get_owned_open_lead(current_user, lead_id)

        payload = data.model_dump(exclude_unset=True)
        if "title" in payload and payload["title"] is not None:
            lead.title = payload["title"]
        if "description" in payload and payload["description"] is not None:
            lead.description = payload["description"]
        if "urgency" in payload and payload["urgency"] is not None:
            lead.urgency = payload["urgency"]
        # neighborhood é nullable: permite explicitamente setar para None.
        if "neighborhood" in payload:
            lead.neighborhood = payload["neighborhood"]
        if "budget_range" in payload:
            lead.budget_range = payload["budget_range"]

        await self.repo.flush()
        await self.db.commit()

        refreshed = await self.repo.get_by_id(lead.id)
        assert refreshed is not None
        return self._to_read(refreshed, viewer=current_user, include_contact=True)

    # ------------------------------------------------------------------ #
    # Cancelamento (DELETE — status=cancelled + soft delete)
    # ------------------------------------------------------------------ #
    async def cancel(self, current_user: User, lead_id: uuid.UUID) -> None:
        """Cancela o lead (§4): ``status=cancelled`` + soft delete. Só o dono e
        só enquanto ``open``.
        """
        lead = await self._get_owned_open_lead(current_user, lead_id)
        lead.status = LeadStatus.cancelled
        lead.deleted_at = datetime.now(UTC)
        await self.repo.flush()
        await self.db.commit()

    # ------------------------------------------------------------------ #
    # Mídia (fotos do lead)
    # ------------------------------------------------------------------ #
    async def add_media(
        self,
        current_user: User,
        lead_id: uuid.UUID,
        *,
        filename: str,
        content_type: str | None,
        data: bytes,
    ) -> LeadMediaOut:
        """Anexa uma foto ao lead (apenas o dono, enquanto ``open``).

        Faz upload do binário no storage (MinIO) e registra ``LeadMedia``.
        """
        lead = await self._get_owned_open_lead(current_user, lead_id)
        ext = ""
        if "." in filename:
            ext = "." + filename.rsplit(".", 1)[1].lower()[:8]
        key = f"leads/{lead.id}/{uuid.uuid4().hex}{ext}"
        upload_bytes(data, key, content_type)
        position = len(lead.media)
        media = LeadMedia(
            lead_id=lead.id,
            object_key=key,
            content_type=content_type,
            position=position,
        )
        self.db.add(media)
        await self.repo.flush()
        await self.db.commit()
        return LeadMediaOut(
            id=media.id, url=presigned_get_url(key), position=position
        )

    # ------------------------------------------------------------------ #
    # Helpers internos
    # ------------------------------------------------------------------ #
    async def _get_owned_open_lead(
        self, current_user: User, lead_id: uuid.UUID
    ) -> Lead:
        """Carrega o lead garantindo papel customer, ownership e ``status=open``."""
        if current_user.role != UserRole.customer:
            raise PermissionDeniedError(
                "Apenas o contratante dono pode alterar o lead."
            )
        lead = await self.repo.get_by_id(lead_id)
        if lead is None:
            raise NotFoundError("Lead não encontrado.")
        if lead.customer_id != current_user.id:
            raise PermissionDeniedError("Você não é o dono deste lead.")
        if lead.status != LeadStatus.open:
            raise DomainValidationError(
                "O lead só pode ser alterado enquanto estiver aberto."
            )
        return lead

    def _to_read(
        self,
        lead: Lead,
        *,
        viewer: User,
        include_contact: bool,
        affordable: bool | None = None,
        viewer_coords: tuple[float, float] | None = None,
    ) -> LeadRead:
        """Monta o ``LeadRead`` aplicando a visibilidade de contato (§4 / §5.6).

        ``include_contact`` deve vir ``True`` apenas para o customer dono ou o
        profissional comprador. ``customer`` (resumo) nunca expõe telefone/email.
        ``viewer_coords`` (do profissional) habilita o cálculo de ``distance_km``.
        """
        category: Category | None = lead.category
        is_purchased = lead.purchase is not None
        # Confirmação de serviço: o customer dono vê o código de chegada (p/
        # mostrar ao profissional) enquanto a chegada não é confirmada.
        purchase = lead.purchase
        arrived = purchase is not None and purchase.arrived_at is not None
        arrival_code = (
            purchase.arrival_code
            if purchase is not None
            and not arrived
            and lead.customer_id == viewer.id
            else None
        )

        contact: LeadContact | None = None
        if include_contact and lead.customer is not None:
            contact = LeadContact(
                name=lead.customer.name,
                email=lead.customer.email,
                phone=lead.customer.phone,
            )

        media = [
            LeadMediaOut(
                id=m.id,
                url=presigned_get_url(m.object_key),
                position=m.position,
            )
            for m in lead.media
        ]

        return LeadRead(
            id=lead.id,
            customer_id=lead.customer_id,
            category_id=lead.category_id,
            title=lead.title,
            description=lead.description,
            lead_type=lead.lead_type,
            urgency=lead.urgency,
            city=lead.city,
            state=lead.state,
            neighborhood=lead.neighborhood,
            budget_range=lead.budget_range,
            latitude=float(lead.latitude) if lead.latitude is not None else None,
            longitude=(
                float(lead.longitude) if lead.longitude is not None else None
            ),
            status=lead.status,
            credits_cost=lead.credits_cost,
            expires_at=lead.expires_at,
            created_at=lead.created_at,
            updated_at=lead.updated_at,
            category=(
                CategorySummary.model_validate(category)
                if category is not None
                else None
            ),
            customer=(
                CustomerSummary.model_validate(lead.customer)
                if lead.customer is not None
                else None
            ),
            is_purchased=is_purchased,
            arrival_code=arrival_code,
            arrived=arrived,
            contact=contact,
            affordable=affordable,
            media=media,
            distance_km=_distance_km(lead.latitude, lead.longitude, viewer_coords),
        )
