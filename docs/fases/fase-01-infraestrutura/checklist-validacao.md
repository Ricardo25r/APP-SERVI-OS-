# Fase 1 — Infraestrutura · Checklist de Validação

> **Objetivo:** conferir, de forma acionável, que a base do FazTudo está OK (sobe, roda e fica verde) — **sem nenhuma regra de negócio**.
> Referências: [`plano.md`](./plano.md) · [`foundation-conventions.md`](./foundation-conventions.md).
>
> ⚠️ **Windows:** use o launcher **`py`** no lugar de `python` (ex.: `py -m venv`, `py -3.12 -m venv`). Em macOS/Linux troque `py` por `python3` e ative o venv com `source .venv/bin/activate`.

---

## ✅ Resultado da 1ª validação (2026-06-19)

Validação executada com Docker + Python 3.13 + Node 24:

| Item | Status |
|------|--------|
| `docker compose up -d` (db/redis/minio) | ✅ todos *healthy* |
| Bucket MinIO `trampoja` | ✅ criado |
| Backend em container + `GET /api/v1/health` | ✅ `200 {"status":"ok"}` |
| `alembic upgrade head` (na rede do Docker) | ✅ ok (`alembic_version` criada) |
| `pytest` | ✅ 1 passed |
| `ruff check` | ✅ All checks passed |
| Frontend `npm run build` / `tsc --noEmit` | ✅ ok |

> ⚠️ **Quirk do host (Windows):** a conexão **direta do host** ao Postgres em `localhost:5432` via asyncpg falhou (`connection was closed in the middle of operation`) — provável **firewall/antivírus** interceptando a porta 5432. **Não afeta o fluxo recomendado**, em que o backend roda em container e acessa o banco como `db:5432` pela rede do Docker.
> - **Recomendado:** rodar via Docker — `docker compose --profile full up -d` e `make migrate` (alembic no container).
> - **Se quiser rodar o backend localmente (venv):** libere a porta 5432 no antivírus/firewall, ou aponte o `DATABASE_URL` para o IP do host do Docker.

---

## 0) Pré-requisitos

- [ ] **Docker Desktop** instalado e rodando (`docker --version`, `docker compose version`).
- [ ] **Python 3.12+** disponível — no Windows via launcher: `py -3.12 --version` (ou `py --version`).
- [ ] **Node 20+** e npm: `node --version` (>= 20), `npm --version`.
- [ ] Repositório clonado em `C:\TrampoJa`.

---

## 1) Variáveis de ambiente

- [ ] Copiar o exemplo da raiz:
  ```powershell
  copy .env.example .env       # Windows (PowerShell/CMD)
  # cp .env.example .env       # macOS/Linux
  ```
- [ ] (Frontend) copiar o exemplo local:
  ```powershell
  copy frontend\.env.local.example frontend\.env.local
  # cp frontend/.env.local.example frontend/.env.local
  ```
- [ ] Conferir os valores canônicos (portas/host/credenciais) batem com o contrato:
  - `DATABASE_URL=postgresql+asyncpg://trampoja:trampoja_dev@db:5432/trampoja`
  - `REDIS_URL=redis://redis:6379/0`
  - `S3_ENDPOINT=http://minio:9000` · `S3_BUCKET=trampoja` · `S3_ACCESS_KEY/SECRET_KEY=minioadmin`
  - `NEXT_PUBLIC_API_URL=http://localhost:8000`

---

## 2) Infra (Docker) — db / redis / minio

> Requer Docker Desktop em execução.

- [ ] Subir os serviços de apoio:
  ```powershell
  docker compose up -d
  ```
- [ ] Conferir que os 3 containers estão saudáveis:
  ```powershell
  docker compose ps
  ```
- [ ] **PostgreSQL** responde na porta **5432** (banco `trampoja`):
  ```powershell
  docker compose exec db pg_isready -U trampoja -d trampoja
  ```
- [ ] **Redis** responde na porta **6379**:
  ```powershell
  docker compose exec redis redis-cli ping        # esperado: PONG
  ```
- [ ] **MinIO** acessível: API em http://localhost:9000 e console em http://localhost:9001 (login `minioadmin` / `minioadmin`); bucket `trampoja` existe.
- [ ] Ver logs em caso de falha: `docker compose logs -f db redis minio`.

---

## 3) Backend — FastAPI + health

> Rodar a partir de `C:\TrampoJa\backend`. Quando o backend roda **localmente** (fora do compose), use `localhost` nas variáveis de host (db/redis/minio).

- [ ] Criar e ativar o virtualenv (Windows / launcher `py`):
  ```powershell
  py -3.12 -m venv .venv
  .venv\Scripts\Activate.ps1        # PowerShell
  # .venv\Scripts\activate.bat      # CMD
  # macOS/Linux: python3 -m venv .venv && source .venv/bin/activate
  ```
- [ ] Instalar dependências:
  ```powershell
  py -m pip install --upgrade pip
  py -m pip install -r requirements.txt
  # (ou, se usar pyproject:  py -m pip install -e ".[dev]")
  ```
- [ ] Subir a API:
  ```powershell
  py -m uvicorn app.main:app --reload --port 8000
  # equivalente:  uvicorn app.main:app --reload
  ```
- [ ] **Health check** retorna `200` com `{"status":"ok"}`:
  ```powershell
  curl http://localhost:8000/api/v1/health
  # PowerShell alternativo:
  Invoke-RestMethod http://localhost:8000/api/v1/health
  ```
- [ ] Docs interativas abrem: http://localhost:8000/docs (Swagger) e http://localhost:8000/redoc.

---

## 4) Backend — testes e lint

- [ ] `pytest` verde (inclui o teste do health):
  ```powershell
  py -m pytest
  ```
- [ ] Lint sem erros:
  ```powershell
  py -m ruff check .
  ```

---

## 5) Migrations — Alembic

> Sem migrations de domínio nesta fase; o comando deve apenas **rodar sem erro** (Alembic configurado, async).

- [ ] Banco no ar (passo 2) e `DATABASE_URL` correto no `.env`.
- [ ] Aplicar migrations:
  ```powershell
  py -m alembic upgrade head
  ```
- [ ] Conferir estado:
  ```powershell
  py -m alembic current
  ```

---

## 6) Frontend — Next.js

> Rodar a partir de `C:\TrampoJa\frontend`. Requer `frontend/.env.local` (passo 1).

- [ ] Instalar dependências e fazer o build de produção:
  ```powershell
  npm install
  npm run build      # deve concluir sem erros (inclui typecheck/tsc)
  ```
- [ ] Lint sem erros:
  ```powershell
  npm run lint
  ```
- [ ] Subir em modo dev e abrir a landing:
  ```powershell
  npm run dev
  ```
- [ ] http://localhost:3000 abre a página "FazTudo".
- [ ] Com o backend no ar (passo 3), o `NEXT_PUBLIC_API_URL` aponta para http://localhost:8000 (sem erros de CORS no console — `CORS_ORIGINS` inclui `http://localhost:3000`).

---

## 7) CI (GitHub)

- [ ] Workflow(s) em `.github/workflows/` rodam no push/PR.
- [ ] **Job do backend** verde: ruff + pytest.
- [ ] **Job do frontend** verde: eslint + tsc + `next build`.
- [ ] Badge/status do último commit **verde** no GitHub.

---

## 8) Encerramento

- [ ] Derrubar a infra ao terminar:
  ```powershell
  docker compose down          # mantém volumes
  # docker compose down -v     # remove volumes (zera o banco)
  ```
- [ ] Atalhos do `Makefile` funcionam (se disponível no shell): `make up`, `make down`, `make backend`, `make front`, `make test`.

---

## ✅ Critério de aceite da Fase 1

Tudo acima marcado significa: a base **sobe, roda e fica verde** — Docker (db/redis/minio) ok, `GET /api/v1/health` → `200 {"status":"ok"}`, `pytest` verde, `alembic upgrade head` sem erro, frontend builda e abre, CI verde — **sem nenhuma lógica de negócio**. Só então iniciar a **Fase 2 — Autenticação**.
