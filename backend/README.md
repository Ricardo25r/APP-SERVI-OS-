# FazTudo — Backend (FastAPI)

API do marketplace FazTudo. Esta é a base da Fase 1: sobe e responde um
health check. Lógica de negócio virá nas próximas fases.

## Requisitos

- Python 3.12+
- PostgreSQL 16, Redis 7 e MinIO (para uso completo; o health check não precisa deles)

## Setup

```bash
# 1. Criar e ativar a venv
python -m venv .venv
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# Linux/macOS:
source .venv/bin/activate

# 2. Instalar dependências (runtime + dev)
pip install -e ".[dev]"
# ou apenas runtime:
pip install -r requirements.txt

# 3. Variáveis de ambiente
cp .env.example .env   # Windows: copy .env.example .env
```

## Rodar a API

```bash
uvicorn app.main:app --reload
```

- Health check: http://localhost:8000/api/v1/health → `{"status": "ok"}`
- Docs (Swagger): http://localhost:8000/docs

## Testes

```bash
pytest
```

## Migrations (Alembic)

O `alembic/env.py` está configurado em modo async e lê `DATABASE_URL` das
settings. Ainda não há migrations geradas nesta fase.

```bash
# aplicar migrations (quando existirem)
alembic upgrade head

# gerar uma nova migration (fases futuras, com modelos definidos)
alembic revision --autogenerate -m "mensagem"
```
