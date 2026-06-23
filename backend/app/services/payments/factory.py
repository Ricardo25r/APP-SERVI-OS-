"""Factory de provedor de pagamento (Fase 6 — §3.5).

Escolhe a implementação concreta de :class:`PaymentProvider` por
``settings.PAYMENT_PROVIDER``. ``DevPaymentProvider`` ativo por padrão; MP/Stripe
ficam documentados (não implementados) e plugam aqui sem tocar service/rotas.
"""

from __future__ import annotations

from app.core.config import settings
from app.services.payments.base import PaymentProvider
from app.services.payments.dev import DevPaymentProvider
from app.services.payments.mercadopago import MercadoPagoProvider

__all__ = ["get_payment_provider"]

_PROVIDERS: dict[str, type[PaymentProvider]] = {
    "dev": DevPaymentProvider,
    "mercadopago": MercadoPagoProvider,
    # "stripe": StripeProvider,             # futuro (§3.4)
}


def get_payment_provider() -> PaymentProvider:
    """Instancia o provedor configurado em ``settings.PAYMENT_PROVIDER``.

    Não cacheado: ``settings`` é estável em runtime, mas instanciar por chamada
    mantém os testes (que alteram ``PAYMENT_PROVIDER``) determinísticos.
    """
    slug = settings.PAYMENT_PROVIDER
    try:
        return _PROVIDERS[slug]()
    except KeyError as exc:
        raise RuntimeError(f"PAYMENT_PROVIDER inválido: {slug!r}") from exc
