#!/usr/bin/env bash
# Deploy/atualização do FazTudo em produção (rodar na VPS, na raiz do projeto).
# Uso: bash scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.prod.yml"

if [ ! -f .env ]; then
  echo "ERRO: falta o arquivo .env na raiz. Copie de infra/env.prod.example e ajuste." >&2
  exit 1
fi

echo "==> Build + subir o stack"
$COMPOSE up -d --build

echo "==> Aguardando o backend ficar saudável..."
sleep 10

echo "==> Migrations (Alembic)"
$COMPOSE exec -T backend python -m alembic upgrade head

echo "==> Seeds (categorias + pacotes de crédito)"
$COMPOSE exec -T backend python -m app.seeds || echo "(seeds já aplicados ou opcionais)"

echo "==> Status"
$COMPOSE ps
echo ""
echo "OK. Acesse: https://faztudo.sispeed.com.br"
echo "Crie o admin com:  $COMPOSE exec backend python -m app.create_admin  (se disponível)"
