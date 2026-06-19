"""Configurações da aplicação carregadas via pydantic-settings.

Lê todas as variáveis canônicas definidas no contrato da Fase 1
(`docs/fases/fase-01-infraestrutura/foundation-conventions.md`).
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuração central da aplicação.

    Os valores padrão refletem o ambiente de desenvolvimento descrito no
    contrato. Em produção, todas as variáveis devem vir do ambiente / `.env`.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # App
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    BACKEND_PORT: int = 8000

    # PostgreSQL
    POSTGRES_USER: str = "trampoja"
    POSTGRES_PASSWORD: str = "trampoja_dev"
    POSTGRES_DB: str = "trampoja"
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432
    # URL async usada pelo backend (SQLAlchemy + asyncpg)
    DATABASE_URL: str = "postgresql+asyncpg://trampoja:trampoja_dev@db:5432/trampoja"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Storage (S3 compatível / MinIO em dev)
    S3_ENDPOINT: str = "http://minio:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_BUCKET: str = "trampoja"
    S3_REGION: str = "us-east-1"

    # Segurança / JWT
    JWT_SECRET: str = "troque-este-segredo-em-producao"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000"

    # Pagamentos / Fase 6
    PAYMENT_PROVIDER: str = "dev"  # dev | mercadopago | stripe ...
    # HMAC do webhook (NUNCA usar o default em produção).
    PAYMENT_WEBHOOK_SECRET: str = "dev-webhook-secret"
    PAYMENT_CURRENCY: str = "BRL"  # moeda padrão dos pacotes/pedidos
    # Base da URL fake de checkout (modo dev).
    PAYMENT_DEV_CHECKOUT_BASE: str = "http://localhost:3000/credits"
    # Futuro (NÃO usados pelo DevPaymentProvider; documentados p/ provedores reais):
    # MP_ACCESS_TOKEN: str = ""
    # MP_WEBHOOK_SECRET: str = ""
    # STRIPE_API_KEY: str = ""
    # STRIPE_WEBHOOK_SECRET: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        """Lista de origens permitidas, derivada de `CORS_ORIGINS`.

        Aceita múltiplas origens separadas por vírgula.
        """
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
