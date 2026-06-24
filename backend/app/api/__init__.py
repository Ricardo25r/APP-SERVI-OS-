"""Router agregador da API (dono: backbone).

Monta o ``api_router`` sob o prefixo ``/api/v1`` incluindo o health (Fase 1) e
os routers das features das Fases 2–5 com os módulos/prefixos exatos do contrato
(§3.10):

| Feature        | Módulo                              | Prefixo          |
|----------------|-------------------------------------|------------------|
| auth           | ``app.api.auth.routes``             | ``/auth``        |
| users          | ``app.api.users.routes``            | ``/users``       |
| categories     | ``app.api.categories.routes``       | ``/categories``  |
| leads          | ``app.api.leads.routes``            | ``/leads``       |
| credits        | ``app.api.credits.routes``          | ``/credits``     |
| lead_purchases | ``app.api.lead_purchases.routes``   | ``/lead-purchases`` |

Os ``routes.py`` das features são entregues pelos respectivos agentes. Enquanto
um módulo ainda não existir, ele é **ignorado com aviso** — assim a base da
Fase 1 (health) continua funcionando e cada router é montado automaticamente
assim que o agente da feature adicionar seu ``routes.py``.
"""

from __future__ import annotations

import importlib
import logging

from fastapi import APIRouter

from app.api.health import router as health_router

logger = logging.getLogger("faztudo.api")

api_router = APIRouter(prefix="/api/v1")

# Health da Fase 1 (sempre presente).
api_router.include_router(health_router)

# (módulo do router, prefixo, tag) — ordem do contrato §3.10.
_FEATURE_ROUTERS: tuple[tuple[str, str, str], ...] = (
    ("app.api.auth.routes", "/auth", "auth"),
    ("app.api.users.routes", "/users", "users"),
    ("app.api.categories.routes", "/categories", "categories"),
    ("app.api.leads.routes", "/leads", "leads"),
    ("app.api.credits.routes", "/credits", "credits"),
    ("app.api.lead_purchases.routes", "/lead-purchases", "lead_purchases"),
    ("app.api.payments.routes", "/payments", "payments"),
    ("app.api.reviews.routes", "/reviews", "reviews"),
    ("app.api.chat.routes", "/chat", "chat"),
    ("app.api.gamification.routes", "/gamification", "gamification"),
    ("app.api.admin.routes", "/admin", "admin"),
    ("app.api.monitoring.routes", "/monitoring", "monitoring"),
    ("app.api.notifications.routes", "/notifications", "notifications"),
    ("app.api.push.routes", "/push", "push"),
    ("app.api.analytics.routes", "/analytics", "analytics"),
    ("app.api.kyc.routes", "/kyc", "kyc"),
    ("app.api.reports.routes", "/reports", "reports"),
    ("app.api.support.routes", "/support", "support"),
    ("app.api.sprints.routes", "/admin/sprints", "sprints"),
    ("app.api.sprints.user_routes", "/feedback", "feedback"),
)

for _module_path, _prefix, _tag in _FEATURE_ROUTERS:
    try:
        _module = importlib.import_module(_module_path)
    except ModuleNotFoundError:
        # Feature ainda não implementada — será montada quando o routes.py existir.
        logger.warning(
            "Router da feature ausente (ainda não implementada): %s", _module_path
        )
        continue

    _router = getattr(_module, "router", None)
    if _router is None:
        logger.warning("Módulo %s não expõe 'router'; ignorado.", _module_path)
        continue

    api_router.include_router(_router, prefix=_prefix, tags=[_tag])


__all__ = ["api_router"]
