"""Exceções de domínio e handlers HTTP (dono: backbone).

Os services lançam estas exceções; um handler global (registrado em
``main.py`` via :func:`register_exception_handlers`) as converte em respostas
JSON padronizadas ``{"detail": "..."}`` com o status HTTP correspondente
(§3.9 do contrato).

| Exceção                  | HTTP |
|--------------------------|------|
| AuthError                | 401  |
| InsufficientCreditsError | 402  |
| PermissionDeniedError    | 403  |
| NotFoundError            | 404  |
| ConflictError            | 409  |
| DomainValidationError    | 422  |
"""

from __future__ import annotations

import logging
import traceback as _tb

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

logger = logging.getLogger("faztudo.errors")


class DomainError(Exception):
    """Base de todas as exceções de domínio. Carrega ``status_code`` e ``detail``."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    default_detail: str = "Erro de domínio."

    def __init__(self, detail: str | None = None) -> None:
        self.detail = detail or self.default_detail
        super().__init__(self.detail)


class AuthError(DomainError):
    """Credenciais/token inválidos ou ausentes."""

    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = "Não autenticado."


class InsufficientCreditsError(DomainError):
    """Saldo insuficiente na carteira para a operação."""

    status_code = status.HTTP_402_PAYMENT_REQUIRED
    default_detail = "Saldo de créditos insuficiente."


class PermissionDeniedError(DomainError):
    """Falha de ownership/role (acesso proibido)."""

    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "Acesso negado."


class NotFoundError(DomainError):
    """Recurso inexistente."""

    status_code = status.HTTP_404_NOT_FOUND
    default_detail = "Recurso não encontrado."


class ConflictError(DomainError):
    """Violação de unicidade / estado conflitante (ex.: lead já comprado)."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = "Conflito de estado."


class DomainValidationError(DomainError):
    """Regra de negócio violada (validação de domínio)."""

    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_detail = "Dados inválidos."


async def domain_exception_handler(_: Request, exc: DomainError) -> JSONResponse:
    """Converte qualquer :class:`DomainError` em JSON ``{"detail": ...}``."""
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


async def unhandled_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    """Captura exceções **não tratadas** (HTTP 500).

    Persiste o erro + ``traceback`` em ``error_logs`` (para o painel admin) e
    devolve ao cliente uma mensagem **genérica** — nunca o traceback
    (defesa contra *information disclosure*). A persistência é best-effort: se
    falhar, ainda assim responde 500 ao cliente.
    """
    tb = "".join(_tb.format_exception(type(exc), exc, exc.__traceback__))
    logger.error(
        "Unhandled %s on %s %s\n%s",
        type(exc).__name__,
        request.method,
        request.url.path,
        tb,
    )
    try:
        from app.database.session import async_session_maker
        from app.models import ErrorLog

        async with async_session_maker() as session:
            session.add(
                ErrorLog(
                    error_type=type(exc).__name__,
                    message=(str(exc) or type(exc).__name__)[:4000],
                    traceback=tb[:20000],
                    path=str(request.url.path)[:512],
                    method=request.method[:10],
                    status_code=500,
                    request_id=getattr(request.state, "request_id", None),
                )
            )
            await session.commit()
    except Exception:  # noqa: BLE001 - persistência best-effort
        logger.exception("Falha ao persistir ErrorLog")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Erro interno. Tente novamente em instantes."},
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Registra os handlers globais no app FastAPI.

    Chamado uma vez no ``main.py``. Subclasses de ``DomainError`` caem no mesmo
    handler; ``Exception`` cobre os 500 não tratados (com captura em ``error_logs``).
    """
    app.add_exception_handler(DomainError, domain_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)


__all__ = [
    "DomainError",
    "AuthError",
    "InsufficientCreditsError",
    "PermissionDeniedError",
    "NotFoundError",
    "ConflictError",
    "DomainValidationError",
    "domain_exception_handler",
    "unhandled_exception_handler",
    "register_exception_handlers",
]
