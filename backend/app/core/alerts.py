"""Alertas de monitoramento por e-mail (Fase 12).

Dispara e-mail quando ocorre um **erro 500** ou um **request lento**, com THROTTLE
(cooldown por chave) para não inundar a caixa de entrada (anti-flood). Usa apenas
a stdlib (``smtplib``) — sem dependências novas.

Segurança:
- O segredo SMTP vem de **env** (nunca em código/front).
- Sem SMTP configurado, apenas **loga** o alerta (modo dev) — o código fica pronto.
- O corpo do e-mail traz um **resumo + link para o painel** (não despeja traceback
  nem PII no e-mail; o detalhe completo fica no painel admin).
- Envio é **fire-and-forget** em thread: nunca atrasa nem quebra o request.
"""

from __future__ import annotations

import asyncio
import logging
import smtplib
import ssl
import threading
import time
from email.message import EmailMessage

from app.core.config import settings
from app.core.metrics import normalize_path

logger = logging.getLogger("faztudo.alerts")

# Cooldown em memória por chave de alerta (anti-flood).
_last_sent: dict[str, float] = {}
_lock = threading.Lock()


def _should_send(key: str) -> bool:
    now = time.time()
    with _lock:
        if now - _last_sent.get(key, 0.0) < settings.ALERT_COOLDOWN_SECONDS:
            return False
        _last_sent[key] = now
    return True


def _recipients() -> list[str]:
    return [e.strip() for e in settings.ALERT_EMAIL_TO.split(",") if e.strip()]


def _smtp_ready() -> bool:
    return bool(settings.ALERTS_ENABLED and settings.SMTP_HOST and _recipients())


def _mask_emails(emails: list[str]) -> str:
    masked: list[str] = []
    for e in emails:
        if "@" in e:
            name, dom = e.split("@", 1)
            masked.append(f"{name[:2]}***@{dom}")
    return ", ".join(masked)


def _send_smtp(subject: str, body: str) -> None:
    """Envia o e-mail via SMTP (bloqueante — sempre chamar em thread).

    Porta **465** → SSL implícito (``SMTP_SSL``, ex.: Resend). Demais portas →
    STARTTLS opcional (**587** Gmail) ou texto puro (**1025** Mailpit em dev).
    """
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER or "faztudo@localhost"
    msg["To"] = ", ".join(_recipients())
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


async def _dispatch(
    key: str, subject: str, body: str, *, force: bool = False
) -> None:
    if not force and not _should_send(key):
        return
    if not _smtp_ready():
        logger.warning("[ALERTA - dev/log] %s | %s", subject, body.replace("\n", " "))
        return
    try:
        await asyncio.to_thread(_send_smtp, subject, body)
        logger.info("Alerta enviado: %s", subject)
    except Exception:  # noqa: BLE001 - alerta best-effort, nunca propaga
        logger.exception("Falha ao enviar alerta por e-mail")


def _fire(coro) -> None:
    """Agenda o envio sem bloquear o request (fire-and-forget)."""
    try:
        asyncio.get_running_loop().create_task(coro)
    except RuntimeError:
        coro.close()  # sem loop ativo (contexto sync) — descarta a corrotina


async def _dispatch_push(
    key: str, error_type: str, path: str, method: str
) -> None:
    """Push aos ADMINS quando dá erro 500 (throttle próprio; best-effort)."""
    if not _should_send(key):
        return
    try:
        from sqlalchemy import select

        from app.database.session import async_session_maker
        from app.models import User, UserRole
        from app.services.push import PushService, push_enabled

        if not push_enabled():
            return
        async with async_session_maker() as db:
            admin_ids = list(
                (
                    await db.execute(
                        select(User.id).where(
                            User.role == UserRole.admin,
                            User.deleted_at.is_(None),
                        )
                    )
                )
                .scalars()
                .all()
            )
            if not admin_ids:
                return
            await PushService(db).send_to_users(
                admin_ids,
                title="Erro no FazTudo",
                body=f"{error_type} em {method} {path}",
                url="/admin/monitoramento",
                tag="admin-error",
            )
    except Exception:  # noqa: BLE001 - best-effort, nunca propaga
        logger.exception("Falha ao enviar push de erro ao admin")


def alert_error(
    error_type: str,
    path: str,
    method: str,
    request_id: str | None,
    message: str,
) -> None:
    """Agenda alerta de erro 500: e-mail + push aos admins (throttle por rota)."""
    key = f"err:{error_type}:{normalize_path(path)}"
    subject = f"[FazTudo] Erro 500: {method} {path}"
    body = (
        "Ocorreu um erro interno (500) no FazTudo.\n\n"
        f"Tipo: {error_type}\n"
        f"Rota: {method} {path}\n"
        f"Mensagem: {message}\n"
        f"request_id: {request_id or '-'}\n\n"
        f"Traceback completo no painel: {settings.MONITORING_URL}\n"
    )
    _fire(_dispatch(key, subject, body))
    _fire(_dispatch_push(f"push:{key}", error_type, path, method))


def alert_slow(path: str, method: str, duration_ms: float) -> None:
    """Agenda um alerta de lentidão (throttle por rota normalizada)."""
    key = f"slow:{normalize_path(path)}"
    subject = f"[FazTudo] Lentidao: {method} {path} ({int(duration_ms)} ms)"
    body = (
        f"Um request passou do limite de {settings.ALERT_SLOW_MS} ms.\n\n"
        f"Rota: {method} {path}\n"
        f"Duracao: {int(duration_ms)} ms\n\n"
        f"Detalhes no painel: {settings.MONITORING_URL}\n"
    )
    _fire(_dispatch(key, subject, body))


async def send_test_alert() -> str:
    """Envia um alerta de teste (admin). Retorna 'sent' ou 'dev-log'."""
    subject = "[FazTudo] Alerta de teste"
    body = (
        "Este e um alerta de teste do painel de monitoramento do FazTudo.\n"
        "Se voce recebeu este e-mail, os alertas estao funcionando.\n\n"
        f"Painel: {settings.MONITORING_URL}\n"
    )
    if not _smtp_ready():
        logger.warning("[ALERTA TESTE - dev/log] %s", subject)
        return "dev-log"
    await _dispatch("test", subject, body, force=True)
    return "sent"


def notify_support_ticket(
    *,
    subject: str,
    message: str,
    user_name: str,
    user_email: str,
    ticket_id: str,
) -> None:
    """Agenda um e-mail ao suporte quando um chamado é aberto (sem throttle)."""
    mail_subject = f"[FazTudo] Novo chamado: {subject}"
    body = (
        "Um novo chamado de suporte foi aberto no FazTudo.\n\n"
        f"De: {user_name} <{user_email}>\n"
        f"Assunto: {subject}\n"
        f"Chamado: {ticket_id}\n\n"
        f"Mensagem:\n{message}\n"
    )
    _fire(_dispatch(f"ticket:{ticket_id}", mail_subject, body, force=True))


def alerts_status() -> dict:
    """Status (sem segredos) dos alertas, para exibir no painel."""
    return {
        "enabled": bool(settings.ALERTS_ENABLED),
        "configured": _smtp_ready(),
        "email_to": _mask_emails(_recipients()),
        "slow_ms": settings.ALERT_SLOW_MS,
    }
