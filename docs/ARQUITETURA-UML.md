# FazTudo — Arquitetura & UML

Visão de arquitetura do FazTudo (marketplace de serviços locais por créditos).
Diagramas em **Mermaid** (renderizam direto no GitHub). Documento vivo — expandir
conforme o sistema evolui. Esteira #14.

Stack: **FastAPI** (async, SQLAlchemy 2 + Alembic) · **Next.js 14** (export
estático) · **Postgres 16** · **Redis** · **MinIO/S3** · **Capacitor** (Android).
Em produção atrás de **Cloudflare → Traefik → Caddy**.

---

## 1. Implantação (deployment)

```mermaid
flowchart TB
  user([Cliente / Profissional])
  app[App Android - Capacitor<br/>carrega o site ao vivo]
  user --> app
  user -->|navegador / PWA| cf
  app -->|HTTPS| cf

  subgraph Internet
    cf[Cloudflare<br/>WAF + CDN + WebSocket]
  end

  subgraph VPS Hostinger 187.127.0.94
    traefik[Traefik<br/>TLS Let's Encrypt]
    subgraph Docker faztudo_net
      caddy[Caddy interno :80<br/>SPA estática + proxy /api]
      backend[FastAPI<br/>uvicorn --workers 2]
      db[(Postgres 16)]
      redis[(Redis<br/>rate limit + pub/sub WS)]
      minio[(MinIO / S3<br/>bucket público + privado KYC)]
    end
  end

  cf --> traefik --> caddy
  caddy -->|/api/*| backend
  caddy -->|/*| caddy
  caddy -->|/faztudo/*| minio
  backend --> db
  backend --> redis
  backend --> minio
  backend -->|preapproval + webhook| mp[Mercado Pago]
  backend -->|push VAPID| webpush[Web Push]
  backend -->|e-mail| smtp[SMTP/Resend]
```

---

## 2. Camadas do backend

```mermaid
flowchart LR
  R[api/*/routes.py<br/>FastAPI routers] --> S[services/*<br/>regra de negócio + commit]
  S --> Repo[repositories/*<br/>queries SQLAlchemy]
  Repo --> M[models/*<br/>ORM + Alembic]
  S --> Core[core/<br/>deps auth · ratelimit · storage<br/>ws_manager · security · config]
  M --> DB[(Postgres)]
  Core --> Redis[(Redis)]
  Core --> S3[(MinIO/S3)]
```

Padrão por feature: **model → schema (Pydantic v2) → repository → service →
routes**. Exceções de domínio viram HTTP no handler global. RBAC por
`require_roles` + `active_role` (papel duplo cliente/profissional).

---

## 3. Domínio principal (ER)

```mermaid
erDiagram
  USER ||--o| CUSTOMER_PROFILE : tem
  USER ||--o| PROFESSIONAL_PROFILE : tem
  USER ||--o| SUBSCRIPTION : assina
  PROFESSIONAL_PROFILE ||--o| CREDIT_WALLET : possui
  PROFESSIONAL_PROFILE ||--o{ PROFESSIONAL_CATEGORY : atua_em
  CATEGORY ||--o{ PROFESSIONAL_CATEGORY : agrupa
  CATEGORY ||--o{ LEAD : classifica
  CUSTOMER_PROFILE ||--o{ LEAD : publica
  LEAD ||--o| LEAD_PURCHASE : desbloqueada_por
  PROFESSIONAL_PROFILE ||--o{ LEAD_PURCHASE : compra
  CREDIT_WALLET ||--o{ CREDIT_TRANSACTION : movimenta
  LEAD_PURCHASE ||--o| CONVERSATION : abre
  CONVERSATION ||--o{ MESSAGE : contem
  USER ||--o{ REVIEW : autor
  USER ||--o{ REVIEW : alvo
  LEAD ||--o{ REVIEW : sobre
  USER ||--o{ PORTFOLIO_ITEM : mostra
  USER ||--o{ NOTIFICATION : recebe
  USER ||--o{ FAVORITE : salva
  USER ||--o{ USER_BLOCK : bloqueia
  USER ||--o{ SAVED_CATEGORY_ALERT : segue
  USER ||--o{ SUPPORT_TICKET : abre
  SUPPORT_TICKET ||--o{ SUPPORT_TICKET_MESSAGE : thread

  USER {
    uuid id PK
    string email UK
    string phone UK
    enum role
    string status
    int token_version
    date birth_date
    datetime deleted_at
  }
  LEAD {
    uuid id PK
    uuid customer_id FK
    uuid category_id FK
    int credits_cost
    enum urgency
    enum status
  }
  LEAD_PURCHASE {
    uuid id PK
    uuid lead_id FK "UNIQUE (exclusivo)"
    uuid professional_id FK
    int credits_cost
  }
  SUBSCRIPTION {
    uuid id PK
    uuid user_id FK "UNIQUE"
    string status
    string provider_sub_id
    datetime current_period_end
  }
  PROFESSIONAL_PROFILE {
    uuid id PK
    uuid user_id FK
    bool verified
    bool premium "entitlement PRO"
    numeric rating
  }
```

> **Invariantes-chave:** lead é **EXCLUSIVO** (`UNIQUE lead_id` em
> `lead_purchases`); saldo só muda via `CreditTransaction`; `target_id` da
> avaliação é derivado no backend (anti-IDOR); `premium` é a fonte de verdade do
> entitlement da assinatura.

---

## 4. Fluxo: comprar lead → conversar → avaliar

```mermaid
sequenceDiagram
  participant C as Cliente
  participant P as Profissional
  participant API as FastAPI
  participant DB as Postgres
  participant WS as WebSocket/Redis

  C->>API: POST /leads (publica pedido)
  API->>DB: cria LEAD (custo em créditos)
  P->>API: POST /lead-purchases (desbloqueia)
  API->>DB: debita carteira + LEAD_PURCHASE (exclusivo) + abre CONVERSATION
  P->>API: POST /chat/.../messages
  API->>DB: grava MESSAGE
  API->>WS: publica evento -> entrega em tempo real
  WS-->>C: nova mensagem (sem polling)
  C->>API: POST /reviews (após compra do lead)
  API->>DB: REVIEW (target derivado) + recalcula reputação
```

---

## 5. Background workers & integrações

| Worker / Integração | O quê |
|---|---|
| Reciclo de leads | Devolve ao mercado lead comprado e não contatado a tempo |
| Win-back | Push para inativos (>14d) que aceitam marketing (cooldown) |
| WS listener | Consome canal Redis e entrega chat em tempo real (1/worker) |
| Mercado Pago | Crédito avulso (Checkout Pro) + assinatura (preapproval) via webhook |
| Backup | `scripts/backup-db.sh` no cron diário (mantém 3) |
