"""Service da feature ``reviews`` (Fase 7 — Avaliações + Reputação).

Concentra a regra de negócio (§3.5): criação da **avaliação mútua** ligada a um
lead comprado, com toda a validação de elegibilidade (anti-fraude/anti-IDOR) e a
**atualização atômica da reputação** do alvo na mesma transação. Faz o
``commit`` (o repositório só faz ``add``/``flush``).

------------------------------------------------------------------------------
Regras de negócio (MVP — alinhado a ``docs/07-reputation-engine``):
------------------------------------------------------------------------------
- Avaliação só é possível quando existe ``LeadPurchase`` para o lead (o
  profissional comprou o lead do contratante — "lead comprado" é a condição do
  reputation-engine para liberar avaliação).
- Os dois lados avaliam **uma vez** cada (``UNIQUE(author_id, lead_id)``):
  - contratante (``lead.customer``) avalia o profissional comprador;
  - profissional comprador avalia o contratante.
- ``target_id`` é **derivado no backend** (o outro lado da transação) — nunca
  vem do cliente (§5.2 — anti-IDOR).
- Sem auto-avaliação (``author != target``); quem não participou do lead → 403.
- ``score`` 1–5 (validado no schema → 422); ``comment`` opcional.
- Avaliações são **imutáveis** (sem edição/exclusão pelo usuário).

------------------------------------------------------------------------------
Atualização de reputação (mesma transação) — mapeamento MVP:
------------------------------------------------------------------------------
- alvo **profissional** → ``professional_profiles.rating`` = média dos scores
  recebidos (0.00–5.00, 2 casas); ``total_reviews`` = contagem.
- alvo **contratante** → ``customer_profiles.reputation_score`` =
  ``round(média * 200)`` (escala 0–1000 do reputation-engine; 5★ = 1000, 1★ =
  200). Mapeamento documentado/simplificado: a escala oficial 0–1000 considera
  múltiplos componentes (resposta, conversão, cancelamentos…); no MVP só as
  avaliações são contabilizadas, via ``round(média * 200)``.

  Observação: ``customer_profiles.reputation_score`` é ``Numeric(3,2)`` no schema
  das Fases 2–5 (faixa 0.00–5.00). Para não divergir da coluna existente sem
  migration manual, **gravamos a média 0.00–5.00 na coluna** e expomos a escala
  0–1000 derivada (``round(média*200)``) no ``ReputationSummary`` da API. Assim a
  regra do reputation-engine fica visível na API sem alterar o tipo da coluna.
"""

from __future__ import annotations

import uuid
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
)
from app.models import Lead, Review, User
from app.repositories.reviews import ReviewRepository
from app.schemas.reviews import (
    PendingReviewItem,
    ReputationSummary,
    ReviewCreate,
    ReviewOut,
)
from app.services.gamification import GamificationService

__all__ = ["ReviewService", "REPUTATION_SCALE"]

# Mapeamento MVP da média de scores (1–5) para a escala 0–1000 do
# reputation-engine (5★ = 1000). Ponto único de configuração.
REPUTATION_SCALE = 200


class ReviewService:
    """Orquestra a criação da avaliação + recálculo atômico da reputação."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = ReviewRepository(db)

    # ------------------------------------------------------------------ #
    # Criação (author = current_user)
    # ------------------------------------------------------------------ #
    async def create(self, current_user: User, data: ReviewCreate) -> ReviewOut:
        """Cria a avaliação do ``current_user`` sobre o outro lado do lead.

        Erros do contrato: ``404`` lead inexistente, ``403`` não participou do
        lead / lead sem compra, ``409`` já avaliou este lead (UNIQUE).
        """
        lead = await self.repo.get_lead_with_purchase(data.lead_id)
        if lead is None:
            raise NotFoundError("Lead não encontrado.")

        # Deriva os dois lados da transação (anti-IDOR: target nunca vem do
        # cliente). Avaliação só após "lead comprado" (reputation-engine).
        target_id = self._resolve_target(lead, current_user)

        # Anti-duplicação (além do UNIQUE no banco): 409 amigável.
        if await self.repo.exists_for_author_lead(current_user.id, lead.id):
            raise ConflictError("Você já avaliou este lead.")

        review = Review(
            author_id=current_user.id,
            target_id=target_id,
            lead_id=lead.id,
            score=data.score,
            comment=data.comment,
        )
        self.repo.add(review)
        try:
            # Materializa a avaliação ANTES de recalcular os agregados (para que
            # a média já inclua este score) e captura corridas no UNIQUE.
            await self.repo.flush()
        except IntegrityError as exc:
            await self.db.rollback()
            raise ConflictError("Você já avaliou este lead.") from exc

        # Atualiza a reputação do alvo na MESMA transação (atômico).
        await self._recalculate_reputation(target_id)

        # Gamificação (Fase 9 — gamification-engine doc 08): a avaliação RECEBIDA
        # concede/penaliza XP do ALVO conforme o score, na MESMA transação. O
        # ``GamificationService.award_xp`` grava a XpTransaction e (quando o alvo
        # é profissional) atualiza xp/level; para um alvo customer só registra a
        # transação (auditoria) — clientes ainda não acumulam nível no MVP.
        await self._award_review_xp(target_id, data.score)

        await self.db.commit()
        await self.db.refresh(review)
        return ReviewOut.model_validate(review)

    # ------------------------------------------------------------------ #
    # Elegibilidade / derivação do alvo
    # ------------------------------------------------------------------ #
    def _resolve_target(self, lead: Lead, current_user: User) -> uuid.UUID:
        """Deriva o ``target_id`` (o outro lado) ou levanta 403.

        Condições (reputation-engine + anti-fraude):
        - o lead precisa ter sido **comprado** (existe ``LeadPurchase``), senão a
          avaliação ainda não é permitida (403);
        - o ``current_user`` precisa ser **um dos dois lados** (contratante dono
          do lead OU profissional que comprou), senão 403;
        - auto-avaliação é impossível por construção (o alvo é sempre o *outro*
          lado).
        """
        purchase = lead.purchase
        if purchase is None or purchase.professional is None:
            raise PermissionDeniedError(
                "Avaliação disponível apenas após a compra do lead."
            )

        professional_user = purchase.professional.user
        professional_user_id = (
            professional_user.id if professional_user is not None else None
        )
        customer_user_id = lead.customer_id

        if current_user.id == customer_user_id:
            # Contratante avalia o profissional comprador.
            if professional_user_id is None:
                raise NotFoundError("Profissional da compra não encontrado.")
            return professional_user_id

        if current_user.id == professional_user_id:
            # Profissional comprador avalia o contratante.
            return customer_user_id

        raise PermissionDeniedError(
            "Você não participou deste lead e não pode avaliá-lo."
        )

    # ------------------------------------------------------------------ #
    # Recálculo de reputação (mesma transação)
    # ------------------------------------------------------------------ #
    async def _recalculate_reputation(self, target_id: uuid.UUID) -> None:
        """Recalcula os agregados de reputação do alvo (profissional/contratante).

        Lê a média/contagem **já gravadas** (pós-flush) e grava:
        - profissional → ``rating`` (0.00–5.00) + ``total_reviews``;
        - contratante  → ``reputation_score`` (média 0.00–5.00 na coluna; escala
          0–1000 derivada na API — ver docstring do módulo).
        """
        average, count = await self.repo.aggregates_for_target(target_id)
        avg_2dp = Decimal(str(average)).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

        professional = await self.repo.get_professional_profile_by_user(target_id)
        if professional is not None:
            professional.rating = avg_2dp
            professional.total_reviews = count
            await self.repo.flush()
            return

        # Alvo é o contratante. Ele pode receber avaliações SEM ter criado o
        # customer_profile (leads.customer_id → users.id direto). Usamos
        # get-or-create para que a reputação persista mesmo nesse caso, na MESMA
        # transação da review (atômico).
        customer = await self.repo.get_or_create_customer_profile_by_user(target_id)
        customer.reputation_score = avg_2dp
        await self.repo.flush()

    # ------------------------------------------------------------------ #
    # Gamificação: XP do alvo conforme o score (mesma transação) — Fase 9
    # ------------------------------------------------------------------ #
    async def _award_review_xp(self, target_id: uuid.UUID, score: int) -> None:
        """Concede/penaliza XP ao alvo conforme o ``score`` (doc 08).

        Mapeamento MVP (gamification-engine §Atividades/§Penalidades):
        - 5★ → +50 (``review_5star``);
        - 4★ → +30 (``review_positive``);
        - 1★/2★ → -50 (``review_negative``);
        - 3★ → 0 (neutro, no-op).

        Sem commit (o ``create`` commita na mesma transação)."""
        if score >= 5:
            amount, source = 50, "review_5star"
        elif score >= 4:
            amount, source = 30, "review_positive"
        elif score <= 2:
            amount, source = -50, "review_negative"
        else:  # score == 3
            return

        await GamificationService(self.db).award_xp(
            user_id=target_id,
            amount=amount,
            source=source,
            description=f"Avaliação {score}★ recebida",
        )

    # ------------------------------------------------------------------ #
    # Avaliações RECEBIDAS por um usuário (público, paginado)
    # ------------------------------------------------------------------ #
    async def list_received(
        self, user_id: uuid.UUID, *, page: int = 1, page_size: int = 20
    ) -> tuple[list[ReviewOut], int]:
        """Avaliações recebidas por ``user_id`` (paginado, público — §4)."""
        limit = page_size
        offset = (page - 1) * page_size
        reviews, total = await self.repo.list_received(
            user_id, limit=limit, offset=offset
        )
        return [ReviewOut.model_validate(r) for r in reviews], total

    async def reputation_summary(self, user_id: uuid.UUID) -> ReputationSummary:
        """Resumo de reputação (média + contagem + escala 0–1000 do MVP)."""
        average, count = await self.repo.aggregates_for_target(user_id)
        avg_2dp = round(average, 2)
        return ReputationSummary(
            user_id=user_id,
            average_score=avg_2dp,
            total_reviews=count,
            reputation_score=round(average * REPUTATION_SCALE),
        )

    # ------------------------------------------------------------------ #
    # Pendências: leads que o current_user ainda pode avaliar
    # ------------------------------------------------------------------ #
    async def list_pending(self, current_user: User) -> list[PendingReviewItem]:
        """Leads comprados em que o usuário participa e ainda não avaliou (§4).

        Cobre os dois papéis: contratante (dono de leads comprados) e profissional
        (que comprou leads). Exclui os leads que o autor já avaliou.
        """
        already = await self.repo.reviewed_lead_ids_for_author(current_user.id)
        items: list[PendingReviewItem] = []

        # Como customer: leads próprios que já foram comprados → avaliar o pro.
        customer_leads = await self.repo.list_purchased_leads_for_customer(
            current_user.id
        )
        for lead in customer_leads:
            if lead.id in already:
                continue
            purchase = lead.purchase
            if purchase is None or purchase.professional is None:
                continue
            pro_user = purchase.professional.user
            if pro_user is None or pro_user.id == current_user.id:
                continue
            items.append(
                PendingReviewItem(
                    lead_id=lead.id,
                    lead_title=lead.title,
                    target_id=pro_user.id,
                    target_name=pro_user.name,
                    role_as="customer",
                )
            )

        # Como professional: leads que ele comprou → avaliar o contratante.
        professional = await self.repo.get_professional_profile_by_user(
            current_user.id
        )
        if professional is not None:
            pro_leads = await self.repo.list_purchased_leads_for_professional(
                professional.id
            )
            for lead in pro_leads:
                if lead.id in already:
                    continue
                customer_user = lead.customer
                if customer_user is None or customer_user.id == current_user.id:
                    continue
                items.append(
                    PendingReviewItem(
                        lead_id=lead.id,
                        lead_title=lead.title,
                        target_id=customer_user.id,
                        target_name=customer_user.name,
                        role_as="professional",
                    )
                )

        return items
