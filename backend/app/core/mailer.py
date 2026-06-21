"""E-mail transacional (stdlib ``smtplib``) — para destinatários arbitrários.

Diferente de ``app.core.alerts`` (que envia só para o admin em ``ALERT_EMAIL_TO``),
aqui o destinatário é qualquer endereço (ex.: e-mail de redefinição de senha para
o próprio usuário). Reaproveita as mesmas configs SMTP.

- Porta **465** → SSL implícito (``SMTP_SSL``, ex.: Resend); demais → STARTTLS
  (587 Gmail) ou texto puro (1025 Mailpit dev).
- Envio é **fire-and-forget** (thread) quando há loop ativo: nunca atrasa o
  request. Sem SMTP configurado, apenas **loga** (modo dev).
- Best-effort: qualquer falha é logada, nunca propaga.
"""

from __future__ import annotations

import asyncio
import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger("faztudo.mailer")


def smtp_configured() -> bool:
    """True quando há servidor SMTP configurado (independe dos alertas)."""
    return bool(settings.SMTP_HOST)


def _send(to: list[str], subject: str, body: str) -> None:
    """Envia o e-mail (bloqueante — chamar em thread quando houver loop)."""
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER or "faztudo@localhost"
    msg["To"] = ", ".join(to)
    msg.set_content(body)

    if settings.SMTP_PORT == 465:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(
            settings.SMTP_HOST, settings.SMTP_PORT, context=context, timeout=30
        ) as server:
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        return

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30) as server:
        if settings.SMTP_STARTTLS:
            server.starttls()
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)


async def _dispatch(to: list[str], subject: str, body: str) -> None:
    if not smtp_configured():
        logger.warning("[EMAIL - dev/log] para=%s | %s", to, subject)
        return
    try:
        await asyncio.to_thread(_send, to, subject, body)
        logger.info("E-mail enviado: %s -> %s", subject, to)
    except Exception:  # noqa: BLE001 - transacional best-effort, nunca propaga
        logger.exception("Falha ao enviar e-mail transacional")


def send_email(to: str | list[str], subject: str, body: str) -> None:
    """Agenda o envio de um e-mail (fire-and-forget se houver loop ativo)."""
    recipients = [to] if isinstance(to, str) else list(to)
    recipients = [r.strip() for r in recipients if r and r.strip()]
    if not recipients:
        return
    try:
        asyncio.get_running_loop().create_task(
            _dispatch(recipients, subject, body)
        )
    except RuntimeError:
        # Sem loop ativo (contexto sync): envia bloqueante best-effort.
        if not smtp_configured():
            logger.warning("[EMAIL - dev/log] para=%s | %s", recipients, subject)
            return
        try:
            _send(recipients, subject, body)
        except Exception:  # noqa: BLE001 - best-effort
            logger.exception("Falha ao enviar e-mail transacional (sync)")
