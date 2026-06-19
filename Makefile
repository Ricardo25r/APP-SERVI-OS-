# FazTudo — atalhos de desenvolvimento.
# Comandos POSIX: no Windows, rode via Git Bash ou WSL ("make up").
# Requer Docker Desktop instalado e rodando.

# Usa "docker compose" (plugin v2); ajuste para "docker-compose" se necessário.
COMPOSE := docker compose

.DEFAULT_GOAL := help

.PHONY: help up up-full down logs ps db-shell migrate backend-install frontend-install test

help: ## Lista os alvos disponíveis
	@echo "FazTudo — alvos disponíveis:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

up: ## Sobe SÓ a infra (db + redis + minio + createbuckets)
	$(COMPOSE) up -d

up-full: ## Sobe infra + backend + frontend (profile full)
	$(COMPOSE) --profile full up -d --build

down: ## Derruba os containers (mantém os volumes/dados)
	$(COMPOSE) --profile full down

logs: ## Mostra os logs (follow). Ex.: make logs s=backend
	$(COMPOSE) --profile full logs -f $(s)

ps: ## Lista o status dos containers
	$(COMPOSE) --profile full ps

db-shell: ## Abre o psql dentro do container do banco
	$(COMPOSE) exec db psql -U $${POSTGRES_USER:-faztudo} -d $${POSTGRES_DB:-faztudo}

migrate: ## Roda as migrations (alembic upgrade head) no backend
	$(COMPOSE) --profile full exec backend alembic upgrade head

backend-install: ## Instala as deps do backend dentro do container
	$(COMPOSE) --profile full exec backend pip install -r requirements.txt

frontend-install: ## Instala as deps do frontend dentro do container
	$(COMPOSE) --profile full exec frontend npm install

test: ## Roda os testes do backend (pytest)
	$(COMPOSE) --profile full exec backend pytest
