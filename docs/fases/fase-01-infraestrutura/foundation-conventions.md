# Fase 1 — Convenções da Base (Contrato de Integração)

> **Status:** contrato oficial da Fase 1. Todos os módulos (backend, frontend, infra, CI) **devem** seguir estes valores para encaixarem entre si. Não divergir sem atualizar este documento.

## Layout do monorepo

```
FazTudo/
├── backend/                 # API FastAPI (Python)
├── frontend/                # App Next.js (TypeScript)
├── infra/                   # scripts de infraestrutura (init db, etc.)
├── .github/workflows/       # CI
├── docs/                    # documentação (já existente)
├── docker-compose.yml       # orquestra db + redis + minio (+ backend/frontend opcional)
├── .env.example             # variáveis compartilhadas (compose/backend)
├── Makefile                 # atalhos de dev
├── README.md
└── .gitignore               # (já existe)
```

## Versões

| Ferramenta | Versão alvo |
|-----------|-------------|
| Python | 3.12+ (dev local tem 3.13) |
| Node | 20+ (dev local tem 24) |
| Next.js | 14 (App Router) |
| FastAPI | última estável |
| PostgreSQL | 16 |
| Redis | 7 |
| MinIO | última estável |

## Serviços e portas (docker-compose)

| Serviço | Nome no compose | Porta host | Observação |
|---------|-----------------|-----------|------------|
| PostgreSQL | `db` | 5432 | banco `faztudo` |
| Redis | `redis` | 6379 | |
| MinIO (API) | `minio` | 9000 | storage S3 |
| MinIO (Console) | `minio` | 9001 | UI web |
| Backend | `backend` | 8000 | FastAPI/uvicorn |
| Frontend | `frontend` | 3000 | Next.js |

## Variáveis de ambiente (nomes canônicos)

> Dentro do compose, o host de cada serviço é o nome do serviço (`db`, `redis`, `minio`).
> Rodando localmente sem Docker, usar `localhost`.

```dotenv
# App
APP_ENV=development
APP_DEBUG=true
BACKEND_PORT=8000

# PostgreSQL
POSTGRES_USER=faztudo
POSTGRES_PASSWORD=faztudo_dev
POSTGRES_DB=faztudo
POSTGRES_HOST=db
POSTGRES_PORT=5432
# URL async usada pelo backend (SQLAlchemy + asyncpg)
DATABASE_URL=postgresql+asyncpg://faztudo:faztudo_dev@db:5432/faztudo

# Redis
REDIS_URL=redis://redis:6379/0

# Storage (S3 compatível / MinIO em dev)
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=faztudo
S3_REGION=us-east-1

# Segurança / JWT
JWT_SECRET=troque-este-segredo-em-producao
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS
CORS_ORIGINS=http://localhost:3000
```

Frontend (`frontend/.env.local`):
```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Estrutura do backend (seguir o doc 03-arquitetura)

```
backend/
├── app/
│   ├── main.py                 # cria o FastAPI app, monta routers e middlewares
│   ├── api/
│   │   ├── __init__.py         # router agregador (/api/v1)
│   │   ├── health.py           # GET /api/v1/health
│   │   └── {auth,users,leads,credits,payments,chat,reviews,gamification,admin}/  # vazios c/ __init__.py (placeholders das próximas fases)
│   ├── core/
│   │   ├── config.py           # Settings via pydantic-settings (lê env acima)
│   │   ├── security.py         # helpers JWT (esqueleto)
│   │   └── logging.py          # config de logging
│   ├── database/
│   │   ├── base.py             # Declarative Base
│   │   └── session.py          # async engine + session maker + get_db()
│   ├── models/__init__.py      # placeholder (modelos nas próximas fases)
│   ├── schemas/__init__.py     # placeholder
│   ├── services/__init__.py    # placeholder
│   ├── repositories/__init__.py# placeholder
│   └── middlewares/__init__.py # placeholder
├── alembic/                    # migrations (env.py async configurado, sem migrations ainda)
├── alembic.ini
├── tests/
│   └── test_health.py          # testa /api/v1/health
├── pyproject.toml              # deps + ruff + pytest
├── requirements.txt            # espelho das deps (para pip simples)
├── Dockerfile
└── .env.example                # pode referenciar o root
```

Health endpoint deve responder: `GET /api/v1/health` → `{"status": "ok"}` (200).

## Estrutura do frontend (seguir o doc 03-arquitetura)

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx            # landing simples "FazTudo"
│   │   ├── globals.css         # tailwind
│   │   └── providers.tsx       # React Query provider
│   ├── components/ui/          # base shadcn (button.tsx) + components.json na raiz do frontend
│   ├── modules/{auth,dashboard,leads,credits,chat,reviews,profile,admin}/  # placeholders (.gitkeep)
│   ├── hooks/
│   ├── services/
│   │   └── api.ts              # cliente HTTP base usando NEXT_PUBLIC_API_URL
│   ├── store/                  # zustand
│   ├── types/
│   └── lib/utils.ts            # cn() helper (clsx + tailwind-merge)
├── public/
├── package.json
├── tsconfig.json
├── next.config.mjs
├── tailwind.config.ts
├── postcss.config.mjs
├── components.json             # config shadcn
├── .eslintrc.json
└── .env.local.example
```

## Stack confirmada

- **Frontend:** Next.js 14 (App Router) · TypeScript · TailwindCSS · Shadcn UI · React Query (@tanstack/react-query) · Zustand · React Hook Form · Zod
- **Backend:** FastAPI · SQLAlchemy 2 (async) · asyncpg · Alembic · Pydantic v2 · pydantic-settings · PyJWT · passlib[bcrypt] · redis · boto3 · uvicorn
- **Qualidade:** backend = ruff + pytest; frontend = eslint + tsc

## Princípios

- Tudo validado no backend; nunca confiar no frontend.
- Sem lógica de negócio nesta fase — apenas o esqueleto que roda (health check verde).
- Segurança base já preparada (config JWT, CORS), regras detalhadas virão nas fases seguintes (ver `docs/17-security`).
