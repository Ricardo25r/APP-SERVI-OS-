# CI — GitHub Actions

Workflows de integração contínua do monorepo **FazTudo**.

## `ci.yml`

Disparado em:

- `push` para a branch `main`
- `pull_request` direcionado à branch `main`

Usa `concurrency` para cancelar execuções antigas do mesmo ref quando um novo
push chega, economizando minutos de runner.

Os dois jobs rodam **em paralelo**.

### Job `backend`

| Item | Valor |
|------|-------|
| Runner | `ubuntu-latest` |
| Working directory | `backend/` |
| Python | 3.12 (contrato: 3.12+) |
| Cache | pip (chave: `backend/requirements.txt`) |

Passos:

1. Checkout do repositório.
2. Setup do Python 3.12 com cache de pip.
3. Instala deps de `backend/requirements.txt` + `ruff` e `pytest`.
4. `ruff check .` — lint.
5. `pytest` — testes (inclui o teste do health check `/api/v1/health`).

> **Serviços (DB/Redis):** o teste de health não precisa de banco, então o job
> é mantido simples. Quando surgirem testes que dependem de PostgreSQL/Redis,
> adicione um bloco `services:` no nível do job — há um exemplo comentado
> dentro de [`ci.yml`](./ci.yml).

### Job `frontend`

| Item | Valor |
|------|-------|
| Runner | `ubuntu-latest` |
| Working directory | `frontend/` |
| Node | 20 (contrato: 20+) |
| Cache | npm (chave: `frontend/package-lock.json`) |

Passos:

1. Checkout do repositório.
2. Setup do Node 20 com cache npm.
3. Instala deps (`npm install`).
4. `npm run lint` — eslint.
5. `npm run typecheck` — `tsc`.
6. `npm run build` — `next build`.

> **`npm install` vs `npm ci`:** enquanto o `frontend/package-lock.json` não
> for commitado, o job usa `npm install`. Assim que o lockfile existir, troque
> o passo de instalação por `npm ci` (instalação reprodutível e mais rápida).

## Como rodar localmente

```bash
# Backend
cd backend
ruff check .
pytest

# Frontend
cd frontend
npm run lint
npm run typecheck
npm run build
```
