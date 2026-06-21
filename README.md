# FazTudo

**Marketplace Inteligente de Prestadores de Serviços Locais.**

Conecta contratantes que precisam de um serviço a profissionais disponíveis na sua região.
Não é um catálogo — é um **marketplace de oportunidades (leads)**: o profissional usa créditos para acessar oportunidades qualificadas.

> 🚧 **Estágio atual:** **Fase 1 — Infraestrutura** (em execução). O código começou: monorepo, Docker (db/redis/minio), FastAPI base, Next.js base, Alembic e CI. Sem regra de negócio ainda. Ver [plano da Fase 1](docs/fases/fase-01-infraestrutura/plano.md).

---

## 🏗️ Estrutura do projeto

Monorepo:

```
FazTudo/
├── backend/                 # API FastAPI (Python 3.12+, async) — health check em /api/v1/health
├── frontend/                # App Next.js 14 (TypeScript, App Router) — landing "FazTudo"
├── infra/                   # scripts de infraestrutura (init db, bucket MinIO, etc.)
├── .github/workflows/       # CI (lint + testes back/front)
├── docs/                    # documentação (specs + planos de fase)
├── docker-compose.yml       # db (Postgres 16) + redis (7) + minio
├── .env.example             # variáveis compartilhadas (compose/backend)
├── Makefile                 # atalhos de dev
└── README.md
```

> Contrato da base (layout, portas, variáveis e versões): [`docs/fases/fase-01-infraestrutura/foundation-conventions.md`](docs/fases/fase-01-infraestrutura/foundation-conventions.md).

---

## 🚀 Como rodar (dev)

**Pré-requisitos:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) · **Python 3.12+** (no Windows via launcher `py`) · **Node 20+**.

```powershell
# 0. variáveis de ambiente
copy .env.example .env
copy frontend\.env.local.example frontend\.env.local

# 1. infraestrutura (Postgres 5432 · Redis 6379 · MinIO 9000/9001)
docker compose up -d

# 2. backend (a partir de backend/) — usar o launcher "py" no Windows
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
py -m pip install -r requirements.txt
py -m alembic upgrade head
py -m uvicorn app.main:app --reload --port 8000
# health:  GET http://localhost:8000/api/v1/health  ->  200 {"status":"ok"}

# 3. frontend (a partir de frontend/)
npm install
npm run dev          # abre http://localhost:3000
```

> macOS/Linux: troque `py` por `python3`, `copy` por `cp` e ative o venv com `source .venv/bin/activate`.

👉 **Passo a passo completo e checklist de validação:** [`docs/fases/fase-01-infraestrutura/checklist-validacao.md`](docs/fases/fase-01-infraestrutura/checklist-validacao.md).

---

## 📚 Documentação

Toda a especificação do produto está em [`docs/`](docs/).

👉 **Comece pelo [Checklist de Execução](docs/00-CHECKLIST-EXECUCAO.md)** e pelo [índice da documentação](docs/README.md).

| Tema | Documento |
|------|-----------|
| Visão geral + fases | [master-task](docs/01-projeto/master-task.md) |
| Arquitetura | [marketplace-architecture](docs/03-arquitetura/marketplace-architecture.md) |
| Banco de dados | [database-schema](docs/04-banco-de-dados/database-schema.md) |
| Motores | [lead](docs/02-lead-engine/lead-engine.md) · [payment](docs/05-payment-engine/payment-engine.md) · [matching](docs/06-matching-engine/matching-engine.md) · [reputation](docs/07-reputation-engine/reputation-engine.md) · [gamification](docs/08-gamification-engine/gamification-engine.md) |
| Specs complementares | [admin](docs/09-admin-panel/admin-panel-spec.md) · [notification](docs/10-notification-engine/notification-engine.md) · [chat](docs/11-chat-engine/chat-engine.md) · [search](docs/12-search-engine/search-engine.md) · [analytics](docs/13-analytics/analytics-spec.md) · [referral](docs/14-referral-engine/referral-engine.md) · [verification](docs/15-verification-engine/verification-engine.md) · [support](docs/16-support-center/support-center-spec.md) · [security](docs/17-security/security-spec.md) · [future-ai](docs/18-future-ai-engine/future-ai-engine.md) |

---

## 🏗️ Stack planejada

- **Frontend:** Next.js · TypeScript · TailwindCSS · Shadcn UI · React Query · Zustand
- **Backend:** FastAPI · Python · SQLAlchemy · Alembic · Pydantic
- **Banco:** PostgreSQL · **Cache:** Redis · **Storage:** S3-compatible (MinIO em dev, Cloudflare R2 em produção)

## 🗺️ Roadmap de alto nível

Versão **WEB** primeiro (10 fases — ver [checklist](docs/00-CHECKLIST-EXECUCAO.md)), depois apps **Android/iOS**, e por fim camada de **IA** (recomendações, ranking inteligente, antifraude).
