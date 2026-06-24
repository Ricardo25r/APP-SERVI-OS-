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


def _send(
    to: list[str], subject: str, body: str, html: str | None = None
) -> None:
    """Envia o e-mail (bloqueante — chamar em thread quando houver loop)."""
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER or "faztudo@localhost"
    msg["To"] = ", ".join(to)
    msg.set_content(body)
    if html:
        msg.add_alternative(html, subtype="html")

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


async def _dispatch(
    to: list[str], subject: str, body: str, html: str | None = None
) -> None:
    if not smtp_configured():
        logger.warning("[EMAIL - dev/log] para=%s | %s", to, subject)
        return
    try:
        await asyncio.to_thread(_send, to, subject, body, html)
        logger.info("E-mail enviado: %s -> %s", subject, to)
    except Exception:  # noqa: BLE001 - transacional best-effort, nunca propaga
        logger.exception("Falha ao enviar e-mail transacional")


def send_email(
    to: str | list[str], subject: str, body: str, html: str | None = None
) -> None:
    """Agenda o envio de um e-mail (fire-and-forget se houver loop ativo).

    ``body`` é o texto puro (fallback); ``html`` (opcional) é a versão rica."""
    recipients = [to] if isinstance(to, str) else list(to)
    recipients = [r.strip() for r in recipients if r and r.strip()]
    if not recipients:
        return
    try:
        asyncio.get_running_loop().create_task(
            _dispatch(recipients, subject, body, html)
        )
    except RuntimeError:
        # Sem loop ativo (contexto sync): envia bloqueante best-effort.
        if not smtp_configured():
            logger.warning("[EMAIL - dev/log] para=%s | %s", recipients, subject)
            return
        try:
            _send(recipients, subject, body, html)
        except Exception:  # noqa: BLE001 - best-effort
            logger.exception("Falha ao enviar e-mail transacional (sync)")


def render_action_email(
    *,
    title: str,
    greeting: str,
    lines: list[str],
    button_label: str,
    button_url: str,
    footer: str = "",
) -> str:
    """HTML simples e branded (azul #0D47A1 / laranja #FF6D00) para e-mails com
    **uma ação** (ex.: redefinir senha). O ``button_url`` fica atrás de um botão —
    o link cru (token longo) não polui o corpo."""
    paragraphs = "".join(
        f'<p style="margin:0 0 12px;color:#333;font-size:15px;'
        f'line-height:1.6">{line}</p>'
        for line in lines
    )
    footer_html = (
        f'<p style="margin:18px 0 0;color:#8a94a6;font-size:12px;'
        f'line-height:1.5">{footer}</p>'
        if footer
        else ""
    )
    return (
        '<!DOCTYPE html><html lang="pt-BR"><head>'
        '<meta charset="utf-8">'
        '<meta name="color-scheme" content="light only">'
        '<meta name="supported-color-schemes" content="light only">'
        '</head><body style="margin:0;color-scheme:light;'
        'background:#f5f7fa;font-family:Arial,Helvetica,sans-serif">'
        '<div style="max-width:480px;margin:0 auto;padding:24px">'
        '<div style="background:#0D47A1;border-radius:12px 12px 0 0;'
        'padding:20px;text-align:center">'
        '<span style="color:#fff;font-size:22px;font-weight:800">Faz'
        '<span style="color:#FF6D00;font-style:italic">Tudo</span></span></div>'
        '<div style="background:#fff;border:1px solid #E8EDF3;border-top:none;'
        'border-radius:0 0 12px 12px;padding:24px">'
        f'<h1 style="margin:0 0 14px;color:#0A357D;font-size:18px">{title}</h1>'
        f'<p style="margin:0 0 12px;color:#333;font-size:15px">{greeting}</p>'
        f"{paragraphs}"
        '<div style="text-align:center;margin:26px 0">'
        f'<a href="{button_url}" style="display:inline-block;background:#FF6D00;'
        'color:#fff;text-decoration:none;font-weight:700;padding:13px 30px;'
        f'border-radius:8px;font-size:15px">{button_label}</a></div>'
        f"{footer_html}"
        "</div></div></body></html>"
    )
