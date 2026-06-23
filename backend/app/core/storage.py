"""Storage S3/MinIO (Fase 11) — upload de mídia de leads + URLs presignadas.

O backend faz upload via ``S3_ENDPOINT`` (rede interna do Docker: ``minio:9000``)
e gera **URLs presignadas de GET** contra ``S3_PUBLIC_URL`` (``localhost:9000``) —
acessíveis pelo navegador sem expor credenciais nem exigir bucket público.

A presign é puramente local (não faz I/O), então montar URLs na leitura é barato
e não falha mesmo se o MinIO estiver indisponível no momento.
"""

from __future__ import annotations

import boto3
from botocore.client import Config

from app.core.config import settings

# Path-style (``host/bucket/key``) é o formato aceito pelo MinIO.
_CFG = Config(signature_version="s3v4", s3={"addressing_style": "path"})


def _client(endpoint: str):
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=settings.S3_REGION,
        config=_CFG,
    )


def upload_bytes(data: bytes, key: str, content_type: str | None = None) -> None:
    """Grava ``data`` no bucket sob ``key`` (via endpoint interno do Docker)."""
    extra = {"ContentType": content_type} if content_type else {}
    _client(settings.S3_ENDPOINT).put_object(
        Bucket=settings.S3_BUCKET, Key=key, Body=data, **extra
    )


def delete_object(key: str) -> None:
    """Remove o objeto ``key`` do bucket (via endpoint interno do Docker)."""
    _client(settings.S3_ENDPOINT).delete_object(
        Bucket=settings.S3_BUCKET, Key=key
    )


def presigned_get_url(key: str, *, expires_seconds: int = 7 * 24 * 3600) -> str:
    """URL **pública** de GET para ``key``.

    O bucket é público (leitura anônima — ``mc anonymous set download``), então
    servimos a mídia por URL direta ``{S3_PUBLIC_URL}/{bucket}/{key}`` (sem
    presign). Isso permite servir as imagens pelo **próprio domínio do app**
    (ex.: ``faztudoapp.com.br/faztudo/...``), sem subdomínio/cert separado.
    ``expires_seconds`` é mantido só por compatibilidade (ignorado).
    """
    _ = expires_seconds  # compat — não usado na URL pública
    base = settings.S3_PUBLIC_URL.rstrip("/")
    return f"{base}/{settings.S3_BUCKET}/{key}"
