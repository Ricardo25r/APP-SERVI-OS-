"""E-mails transacionais de eventos (best-effort, fire-and-forget).

Cada função monta um e-mail de marca (:func:`render_action_email`) e despacha via
:func:`send_email` (que já é não-bloqueante e nunca levanta). Falha de e-mail
**não** deve quebrar o fluxo do evento. Chamar sempre **após o commit** do evento.
"""

from __future__ import annotations

import logging

from app.core.config import settings
from app.core.mailer import render_action_email, send_email

logger = logging.getLogger("app.services.notification_emails")


def send_lead_purchased_email(
    *,
    to_email: str,
    to_name: str,
    professional_name: str,
    lead_title: str,
    conversation_href: str,
) -> None:
    """Avisa o **contratante** que um profissional adquiriu o pedido dele."""
    if not to_email:
        return
    try:
        base = settings.FRONTEND_URL.rstrip("/")
        url = f"{base}{conversation_href}"
        body = (
            f"Olá, {to_name}.\n\n"
            f'{professional_name} aceitou o seu pedido "{lead_title}" no '
            "FazTudo.\n"
            "Abra a conversa para combinar valor, data e os detalhes do "
            "serviço:\n\n"
            f"{url}\n"
        )
        html = render_action_email(
            title="Seu pedido foi aceito!",
            greeting=f"Olá, {to_name}.",
            lines=[
                f"{professional_name} aceitou o seu pedido "
                f'"{lead_title}" no FazTudo.',
                "Abra a conversa para combinar valor, data e os detalhes do "
                "serviço.",
            ],
            button_label="Abrir conversa",
            button_url=url,
            footer="Você recebeu este e-mail porque tem um pedido ativo no "
            "FazTudo.",
        )
        send_email(to_email, "[FazTudo] Seu pedido foi aceito", body, html=html)
    except Exception:  # noqa: BLE001 — e-mail é best-effort, nunca quebra o fluxo
        logger.warning("Falha ao enviar e-mail de aceite de lead", exc_info=True)
