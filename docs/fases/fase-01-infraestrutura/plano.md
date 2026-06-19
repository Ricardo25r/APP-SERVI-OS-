# Fase 1 — Infraestrutura · Plano Técnico

> **Projeto:** FazTudo — Marketplace Inteligente de Prestadores de Serviços Locais
> **Status:** em execução (primeira fase de código).
> **Contrato da base:** [`foundation-conventions.md`](./foundation-conventions.md) — fonte da verdade para layout, portas, variáveis e versões. **Não divergir** sem atualizar o contrato.
> **Regra de fase** (ver [`00-CHECKLIST-EXECUCAO.md`](../../00-CHECKLIST-EXECUCAO.md)): toda fase entrega **código + migrations + testes + documentação + checklist de validação**.

---

## 🎯 Objetivo

Montar o **esqueleto que roda** do monorepo FazTudo: ambiente de desenvolvimento reprodutível (Docker), backend FastAPI com health check verde, frontend Next.js que abre, Alembic configurado para migrations async e CI básico no GitHub.

Critério de sucesso: qualquer dev clona o repositório, sobe a infra, roda backend e frontend, e o `GET /api/v1/health` responde `200 {"status":"ok"}` — **sem nenhuma regra de negócio implementada**.

---

## 📦 Escopo

### ✅ O que ENTRA nesta fase

- **Monorepo** com a estrutura do contrato: `backend/`, `frontend/`, `infra/`, `.github/workflows/`, `docs/` (já existe), `docker-compose.yml`, `.env.example`, `Makefile`, `README.md`, `.gitignore` (já existe).
- **docker-compose** orquestrando os serviços de apoio:
  - `db` — PostgreSQL 16, porta **5432**, banco `trampoja`.
  - `redis` — Redis 7, porta **6379**.
  - `minio` — MinIO (S3 compatível), API na porta **9000** e console na **9001**.
  - (`backend`/`frontend` opcionais no compose; em dev rodam localmente.)
- **`.env.example`** na raiz com as variáveis canônicas do contrato (App, PostgreSQL, Redis, S3/MinIO, JWT, CORS).
- **Backend FastAPI base**:
  - `app/main.py` cria o app, monta routers e middlewares.
  - `app/api/health.py` → endpoint `GET /api/v1/health` retornando `{"status": "ok"}`.
  - `app/api/__init__.py` — router agregador montado em `/api/v1`.
  - `app/core/config.py` — `Settings` via `pydantic-settings` lendo as variáveis do contrato.
  - `app/core/security.py` (esqueleto JWT) e `app/core/logging.py`.
  - `app/database/base.py` (Declarative Base) e `app/database/session.py` (async engine + session maker + `get_db()`).
  - Placeholders com `__init__.py` em `models/`, `schemas/`, `services/`, `repositories/`, `middlewares/` e nos módulos de API das próximas fases (`auth`, `users`, `leads`, `credits`, `payments`, `chat`, `reviews`, `gamification`, `admin`).
  - `pyproject.toml` (deps + ruff + pytest) e `requirements.txt` (espelho para pip).
  - `Dockerfile` do backend.
- **Alembic configurado**: `alembic.ini` + `alembic/env.py` async, apontando para a `DATABASE_URL`. **Sem migrations de domínio ainda** (apenas a estrutura pronta para `alembic upgrade head` rodar sem erro).
- **Frontend Next.js 14 base** (App Router):
  - `src/app/layout.tsx`, `src/app/page.tsx` (landing simples "FazTudo"), `globals.css` (Tailwind), `providers.tsx` (React Query).
  - `src/lib/utils.ts` (`cn()`), `src/services/api.ts` (cliente HTTP usando `NEXT_PUBLIC_API_URL`), base shadcn em `src/components/ui/`.
  - Placeholders (`.gitkeep`) em `modules/`, `hooks/`, `store/`, `types/`.
  - `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `components.json`, `.eslintrc.json`, `.env.local.example`.
- **CI básico** (`.github/workflows/`): lint + testes do backend (ruff + pytest) e lint + build/typecheck do frontend (eslint + tsc + `next build`).
- **Segurança base preparada**: config de JWT e CORS já existem no `config.py` (sem regras ativas — detalhamento nas fases seguintes, ver `docs/17-security`).
- **Documentação da fase**: este `plano.md` e o [`checklist-validacao.md`](./checklist-validacao.md); atualização do `README.md` raiz.

### ❌ O que NÃO ENTRA nesta fase

- **Nenhuma lógica de negócio**: sem autenticação real, sem cadastro, sem perfis, sem leads, sem créditos, sem pagamentos, sem chat, sem avaliações, sem gamificação, sem admin.
- **Nenhuma migration de domínio** / tabelas de negócio (Alembic só fica configurado; o schema vem nas fases seguintes).
- Nenhuma das **decisões pendentes** da seção 2 do checklist (conflitos de schema, tabelas propostas) — elas viram migrations nas fases em que fizerem sentido.
- Integrações externas (gateway de pagamento, email/SMS/push, R2 de produção).
- Deploy de produção / infraestrutura cloud (MinIO é só dev; R2 vem depois).

---

## 🏗️ Arquitetura da base

### Monorepo

```
TrampoJa/
├── backend/                 # API FastAPI (Python 3.12+, async)
├── frontend/                # App Next.js 14 (TypeScript, App Router)
├── infra/                   # scripts de infraestrutura (init db, bucket MinIO, etc.)
├── .github/workflows/       # CI (lint + testes back/front)
├── docs/                    # documentação (já existente)
├── docker-compose.yml       # db + redis + minio (backend/frontend opcionais)
├── .env.example             # variáveis compartilhadas (compose/backend)
├── Makefile                 # atalhos de dev
├── README.md
└── .gitignore
```

### Fluxo de dependências (dev)

```
┌─────────────┐        ┌──────────────────────┐
│  Frontend   │  HTTP  │       Backend        │
│  Next.js    │ ─────▶ │   FastAPI / uvicorn  │
│  :3000      │        │        :8000         │
└─────────────┘        └──────────┬───────────┘
        NEXT_PUBLIC_API_URL       │
        = http://localhost:8000   │ DATABASE_URL / REDIS_URL / S3_ENDPOINT
                                  ▼
              ┌──────────┬──────────┬───────────────┐
              │ Postgres │  Redis   │     MinIO      │
              │  db:5432 │ redis:   │ minio:9000 API │
              │          │  6379    │      :9001 UI  │
              └──────────┴──────────┴───────────────┘
                     (docker-compose)
```

- Dentro do compose, o host de cada serviço é o **nome do serviço** (`db`, `redis`, `minio`).
- Rodando localmente sem Docker, usar `localhost`.

### Stack confirmada (do contrato)

- **Frontend:** Next.js 14 (App Router) · TypeScript · TailwindCSS · Shadcn UI · React Query (@tanstack/react-query) · Zustand · React Hook Form · Zod.
- **Backend:** FastAPI · SQLAlchemy 2 (async) · asyncpg · Alembic · Pydantic v2 · pydantic-settings · PyJWT · passlib[bcrypt] · redis · boto3 · uvicorn.
- **Qualidade:** backend = ruff + pytest; frontend = eslint + tsc.

### Versões alvo

| Ferramenta | Versão alvo |
|-----------|-------------|
| Python | 3.12+ (dev local pode ter 3.13) |
| Node | 20+ (dev local pode ter 24) |
| Next.js | 14 (App Router) |
| FastAPI | última estável |
| PostgreSQL | 16 |
| Redis | 7 |
| MinIO | última estável |

### Variáveis de ambiente (canônicas)

As variáveis ficam no `.env.example` da raiz (consumido por compose e backend). Resumo:

- **App:** `APP_ENV`, `APP_DEBUG`, `BACKEND_PORT=8000`.
- **PostgreSQL:** `POSTGRES_USER/PASSWORD/DB/HOST/PORT` + `DATABASE_URL=postgresql+asyncpg://trampoja:trampoja_dev@db:5432/trampoja`.
- **Redis:** `REDIS_URL=redis://redis:6379/0`.
- **Storage (MinIO):** `S3_ENDPOINT=http://minio:9000`, `S3_ACCESS_KEY/SECRET_KEY=minioadmin`, `S3_BUCKET=trampoja`, `S3_REGION=us-east-1`.
- **JWT:** `JWT_SECRET`, `JWT_ALGORITHM=HS256`, `ACCESS_TOKEN_EXPIRE_MINUTES=15`, `REFRESH_TOKEN_EXPIRE_DAYS=7`.
- **CORS:** `CORS_ORIGINS=http://localhost:3000`.
- **Frontend** (`frontend/.env.local`): `NEXT_PUBLIC_API_URL=http://localhost:8000`.

> A lista completa e oficial está em [`foundation-conventions.md`](./foundation-conventions.md). Em caso de divergência, o contrato prevalece.

---

## 🔧 Passos de execução

1. **Estrutura do monorepo** — criar as pastas `backend/`, `frontend/`, `infra/`, `.github/workflows/` e os arquivos de raiz (`docker-compose.yml`, `.env.example`, `Makefile`).
2. **Infra (docker-compose)** — declarar `db` (Postgres 16), `redis` (Redis 7) e `minio`, com volumes nomeados e healthchecks; script de init em `infra/` (criação do bucket `trampoja`).
3. **Backend base** — `app/main.py`, router `/api/v1`, `health.py`, `core/config.py` (pydantic-settings lendo o `.env`), `database/base.py` e `session.py` (engine async + `get_db()`), placeholders das próximas fases, `pyproject.toml`/`requirements.txt`, `Dockerfile`.
4. **Alembic** — `alembic.ini` + `alembic/env.py` async lendo `DATABASE_URL`; garantir que `alembic upgrade head` roda sem erro (sem migrations de domínio).
5. **Teste do backend** — `tests/test_health.py` validando `GET /api/v1/health` → `200 {"status":"ok"}`.
6. **Frontend base** — projeto Next.js 14 (App Router) com landing "FazTudo", Tailwind, React Query provider, `services/api.ts`, base shadcn e `.env.local.example`.
7. **CI** — workflow(s) em `.github/workflows/`: backend (ruff + pytest) e frontend (eslint + tsc + `next build`).
8. **Documentação + validação** — este `plano.md`, o `checklist-validacao.md` e a atualização do `README.md`.
9. **Validação final** — rodar o [`checklist-validacao.md`](./checklist-validacao.md) ponta a ponta e confirmar CI verde no GitHub.

---

## ✅ Entregáveis da fase (conforme regra de fase)

- **Código:** monorepo + backend FastAPI base + frontend Next.js base + docker-compose + Makefile.
- **Migrations:** Alembic **configurado** (async), `alembic upgrade head` roda sem erro — sem migrations de domínio.
- **Testes:** `pytest` do backend verde (health check); frontend com `tsc`/`eslint`/`next build` ok.
- **Documentação:** `plano.md` (este), `README.md` raiz atualizado, `foundation-conventions.md` (contrato).
- **Checklist de validação:** [`checklist-validacao.md`](./checklist-validacao.md).

> **Próxima fase:** [Fase 2 — Autenticação](../../00-CHECKLIST-EXECUCAO.md) (cadastro, login, recuperação de senha, JWT + refresh, sessões, RBAC base). **Só iniciar após validar a Fase 1.**
