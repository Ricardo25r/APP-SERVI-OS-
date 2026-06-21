"""Service de **conquistas/medalhas** (gamification — doc 08).

Avalia condições e concede medalhas ao profissional. Catálogo é **auto-semeado**
(cria as linhas que faltam em ``achievements``). Concessão é idempotente
(``UNIQUE(user_id, achievement_id)``): ao desbloquear, soma o ``xp_reward`` e
notifica o usuário. Avaliação é **lazy** (ao abrir as conquistas/progresso).
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Achievement,
    LeadPurchase,
    ProfessionalCategory,
    ProfessionalProfile,
    Review,
    User,
    UserAchievement,
)
from app.schemas.gamification import AchievementOut
from app.services.gamification import GamificationService
from app.services.notifications import add_notification

__all__ = ["AchievementService"]

# (slug, nome, descrição, xp_reward) — catálogo de conquistas do profissional.
CATALOG: tuple[tuple[str, str, str, int], ...] = (
    ("perfil_completo", "Perfil completo",
     "Preencheu título, bio, cidade e categorias.", 50),
    ("primeiro_contato", "Primeiro contato",
     "Desbloqueou seu primeiro contato.", 20),
    ("dez_contatos", "Dez contatos",
     "Desbloqueou 10 contatos de clientes.", 100),
    ("primeira_avaliacao", "Primeira avaliação",
     "Recebeu sua primeira avaliação.", 20),
    ("cinco_estrelas", "Cinco estrelas",
     "Recebeu uma avaliação 5 estrelas.", 50),
    ("bem_avaliado", "Bem avaliado",
     "Nota média 4,5+ com 5 ou mais avaliações.", 150),
)


class AchievementService:
    """Avalia/concede conquistas e lista o catálogo com o status do usuário."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.gami = GamificationService(db)

    async def _ensure_catalog(self) -> tuple[dict[str, Achievement], bool]:
        rows = (await self.db.execute(select(Achievement))).scalars().all()
        by_slug = {a.slug: a for a in rows}
        created = False
        for slug, name, desc, xp in CATALOG:
            if slug not in by_slug:
                ach = Achievement(
                    slug=slug, name=name, description=desc, xp_reward=xp
                )
                self.db.add(ach)
                by_slug[slug] = ach
                created = True
        if created:
            await self.db.flush()
        return by_slug, created

    async def _unlocked_map(self, user: User) -> dict[str, bool]:
        """Condições de cada conquista (somente profissional acumula medalhas)."""
        result = {slug: False for slug, *_ in CATALOG}
        profile = (
            await self.db.execute(
                select(ProfessionalProfile).where(
                    ProfessionalProfile.user_id == user.id,
                    ProfessionalProfile.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if profile is None:
            return result

        purchases = (
            await self.db.execute(
                select(func.count())
                .select_from(LeadPurchase)
                .where(LeadPurchase.professional_id == profile.id)
            )
        ).scalar_one()
        categories = (
            await self.db.execute(
                select(func.count())
                .select_from(ProfessionalCategory)
                .where(ProfessionalCategory.professional_id == profile.id)
            )
        ).scalar_one()
        five_stars = (
            await self.db.execute(
                select(func.count())
                .select_from(Review)
                .where(Review.target_id == user.id, Review.score == 5)
            )
        ).scalar_one()
        rating = float(profile.rating or 0)
        total_reviews = profile.total_reviews or 0
        complete = bool(
            (profile.headline or "").strip()
            and (profile.bio or "").strip()
            and (profile.city or "").strip()
            and categories > 0
        )

        result.update(
            {
                "perfil_completo": complete,
                "primeiro_contato": purchases >= 1,
                "dez_contatos": purchases >= 10,
                "primeira_avaliacao": total_reviews >= 1,
                "cinco_estrelas": five_stars >= 1,
                "bem_avaliado": rating >= 4.5 and total_reviews >= 5,
            }
        )
        return result

    async def evaluate_and_list(self, user: User) -> list[AchievementOut]:
        """Concede conquistas recém-desbloqueadas e devolve o catálogo + status."""
        catalog, created = await self._ensure_catalog()

        earned_rows = (
            await self.db.execute(
                select(UserAchievement).where(UserAchievement.user_id == user.id)
            )
        ).scalars().all()
        earned_ids = {r.achievement_id for r in earned_rows}
        earned_slugs = {
            ach.slug for ach in catalog.values() if ach.id in earned_ids
        }

        unlocked = await self._unlocked_map(user)
        granted = False
        for slug, ok in unlocked.items():
            if ok and slug not in earned_slugs:
                ach = catalog[slug]
                self.db.add(
                    UserAchievement(user_id=user.id, achievement_id=ach.id)
                )
                if ach.xp_reward:
                    await self.gami.award_xp(
                        user.id,
                        ach.xp_reward,
                        source="achievement",
                        description=f"Conquista: {ach.name}",
                    )
                add_notification(
                    self.db,
                    user_id=user.id,
                    type="system",
                    title="Nova conquista desbloqueada!",
                    body=ach.name,
                    href="/gamificacao",
                )
                granted = True

        if created or granted:
            await self.db.commit()

        # Recarrega o earned_at (inclui as recém-concedidas).
        earned_rows = (
            await self.db.execute(
                select(UserAchievement).where(UserAchievement.user_id == user.id)
            )
        ).scalars().all()
        earned_at_by_id = {r.achievement_id: r.earned_at for r in earned_rows}

        items: list[AchievementOut] = []
        for slug, name, desc, xp in CATALOG:
            ach = catalog[slug]
            earned_at = earned_at_by_id.get(ach.id)
            items.append(
                AchievementOut(
                    slug=slug,
                    name=name,
                    description=desc,
                    xp_reward=xp,
                    earned=earned_at is not None,
                    earned_at=earned_at,
                )
            )
        return items
