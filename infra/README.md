# Infraestrutura de desenvolvimento — TrampoJá

Ambiente local orquestrado via **Docker Compose**: PostgreSQL, Redis e MinIO,
com backend (FastAPI) e frontend (Next.js) opcionais.

> **Pré-requisito: Docker Desktop instalado e em execução.**
> No Windows, os alvos do `Makefile` assumem shell POSIX — rode via **Git Bash**
> ou **WSL**. Sem `make`, use os comandos `docker compose` equivalentes (abaixo).

---

## 1. Configurar variáveis

Copie o arquivo de exemplo para `.env` (fica na raiz do projeto):

```bash
cp .env.example .env        # Linux / macOS / Git Bash
# ou, no Windows CMD:
copy .env.example .env
```

Todos os valores já vêm preenchidos para dev. O `.env` é a fonte única de
configuração — tanto o Compose quanto o backend leem dele.

## 2. Subir o ambiente

Por padrão, só a **infraestrutura** sobe (db + redis + minio + criação do bucket):

```bash
make up
# equivalente sem make:
docker compose up -d
```

Para subir **tudo** (infra + backend + frontend), use o profile `full`:

```bash
make up-full
# equivalente sem make:
docker compose --profile full up -d --build
```

> Por que profiles? `backend` e `frontend` estão marcados com
> `profiles: ["full"]`. Assim, `docker compose up` puro não tenta buildar essas
> imagens (úteis quando você roda o backend/front fora do Docker), e elas só
> sobem com `--profile full`.

## 3. Comandos úteis (Makefile)

| Comando                | O que faz                                             |
|------------------------|-------------------------------------------------------|
| `make up`              | Sobe a infra (db + redis + minio + createbuckets)     |
| `make up-full`         | Sobe infra + backend + frontend (profile full)        |
| `make down`            | Derruba os containers (mantém os volumes/dados)       |
| `make logs`            | Logs em follow (`make logs s=backend` filtra serviço) |
| `make ps`              | Status dos containers                                 |
| `make db-shell`        | Abre `psql` no container do banco                      |
| `make migrate`         | `alembic upgrade head` no backend                      |
| `make backend-install` | Instala deps do backend no container                  |
| `make frontend-install`| Instala deps do frontend no container                 |
| `make test`            | Roda `pytest` no backend                               |
| `make help`            | Lista todos os alvos                                   |

## 4. Portas e endpoints

| Serviço          | Endereço                       | Observação            |
|------------------|--------------------------------|-----------------------|
| PostgreSQL       | `localhost:5432`               | banco `trampoja`      |
| Redis            | `localhost:6379`               |                       |
| MinIO (API S3)   | http://localhost:9000          | endpoint S3           |
| MinIO (Console)  | http://localhost:9001          | UI web                |
| Backend (API)    | http://localhost:8000          | FastAPI (profile full)|
| Frontend         | http://localhost:3000          | Next.js (profile full)|

## 5. Credenciais de dev

Definidas no `.env` (valores padrão de desenvolvimento):

- **PostgreSQL** — usuário `trampoja` / senha `trampoja_dev` / banco `trampoja`
- **MinIO** — usuário `minioadmin` / senha `minioadmin`
  (Console em http://localhost:9001; bucket `trampoja` criado automaticamente
  pelo serviço `createbuckets`.)

> Estas credenciais são **somente para dev**. Em produção, troque tudo
> (incluindo `JWT_SECRET`).

## 6. Parar / limpar

```bash
make down                          # para os containers, preserva os dados
docker compose --profile full down -v   # para e APAGA os volumes (db/minio/redis)
```

## 7. Estrutura

```
infra/
├── postgres/
│   └── init.sql      # extensões (uuid-ossp, pg_trgm, unaccent), roda na 1ª subida
└── README.md         # este arquivo
```
