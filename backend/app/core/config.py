"""Configurações da aplicação carregadas via pydantic-settings.

Lê todas as variáveis canônicas definidas no contrato da Fase 1
(`docs/fases/fase-01-infraestrutura/foundation-conventions.md`).
"""

from __future__ import annotations

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Valores-sentinela inseguros que NUNCA podem permanecer em produção.
_INSECURE_JWT_SECRET = "troque-este-segredo-em-producao"  # noqa: S105
_INSECURE_WEBHOOK_SECRET = "dev-webhook-secret"  # noqa: S105


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
    # Default seguro: debug DESLIGADO. Em dev, defina APP_DEBUG=true no ambiente.
    APP_DEBUG: bool = False
    BACKEND_PORT: int = 8000

    # PostgreSQL
    POSTGRES_USER: str = "faztudo"
    POSTGRES_PASSWORD: str = "faztudo_dev"
    POSTGRES_DB: str = "faztudo"
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432
    # URL async usada pelo backend (SQLAlchemy + asyncpg)
    DATABASE_URL: str = "postgresql+asyncpg://faztudo:faztudo_dev@db:5432/faztudo"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Storage (S3 compatível / MinIO em dev)
    S3_ENDPOINT: str = "http://minio:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_BUCKET: str = "faztudo"
    S3_REGION: str = "us-east-1"
    # URL pública do storage (acessível pelo navegador) p/ montar URLs de mídia.
    # O backend faz upload via S3_ENDPOINT (rede interna) e presigna GET aqui.
    S3_PUBLIC_URL: str = "http://localhost:9000"

    # Segurança / JWT
    JWT_SECRET: str = "troque-este-segredo-em-producao"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS — web (localhost:3000) + app nativo Capacitor (WebView usa
    # https://localhost no Android e capacitor://localhost no iOS).
    CORS_ORIGINS: str = "http://localhost:3000,https://localhost,capacitor://localhost"

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

    # Alertas de monitoramento (e-mail via SMTP). Segredos só via env.
    ALERTS_ENABLED: bool = False
    ALERT_EMAIL_TO: str = ""  # destinatário(s), separados por vírgula
    ALERT_SLOW_MS: int = 3000  # request acima disso dispara alerta de lentidão
    ALERT_COOLDOWN_SECONDS: int = 300  # janela mínima entre alertas da mesma chave
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""  # remetente; vazio = usa SMTP_USER
    SMTP_STARTTLS: bool = True
    # URL do painel (link nos e-mails de alerta).
    MONITORING_URL: str = "http://localhost:3000/admin/monitoramento"
    # URL pública do app (base p/ links em e-mails transacionais, ex.: reset).
    FRONTEND_URL: str = "http://localhost:3000"
    # Janela (min) p/ o profissional iniciar o contato após desbloquear o lead.
    CONTACT_WINDOW_MINUTES: int = 60
    # Worker que devolve ao mercado os leads comprados e não contatados a tempo.
    CONTACT_RECYCLE_ENABLED: bool = True
    CONTACT_RECYCLE_INTERVAL_SECONDS: int = 120

    @property
    def cors_origins_list(self) -> list[str]:
        """Lista de origens permitidas, derivada de `CORS_ORIGINS`.

        Aceita múltiplas origens separadas por vírgula.
        """
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @model_validator(mode="after")
    def _fail_fast_in_production(self) -> Settings:
        """Em produção, recusa subir com defaults inseguros (fail-fast).

        Somente quando ``APP_ENV == "production"``: levanta erro se algum segredo
        crítico ainda usar o valor padrão de desenvolvimento ou se o provedor de
        pagamento estiver no modo ``dev`` (fake checkout). Em development/test não
        valida nada — não quebra o ambiente local nem a suíte de testes.
        """
        if self.APP_ENV != "production":
            return self

        problems: list[str] = []
        if self.JWT_SECRET == _INSECURE_JWT_SECRET:
            problems.append(
                "JWT_SECRET ainda usa o valor padrão de desenvolvimento — "
                "defina um segredo forte e único."
            )
        if self.PAYMENT_WEBHOOK_SECRET == _INSECURE_WEBHOOK_SECRET:
            problems.append(
                "PAYMENT_WEBHOOK_SECRET ainda usa o valor padrão de "
                "desenvolvimento — defina o HMAC real do provedor."
            )
        if self.PAYMENT_PROVIDER == "dev":
            problems.append(
                "PAYMENT_PROVIDER='dev' (checkout simulado) não é permitido em "
                "produção — configure um provedor real (ex.: mercadopago)."
            )

        if problems:
            raise ValueError(
                "Configuração insegura para APP_ENV=production:\n- "
                + "\n- ".join(problems)
            )
        return self


settings = Settings()
