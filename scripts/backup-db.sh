#!/usr/bin/env bash
# Backup do Postgres do FazTudo (rodar na VPS). Agende no cron, ex.:
#   0 3 * * *  cd /root/FazTudo && bash scripts/backup-db.sh >> /var/log/faztudo-backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.prod.yml"
mkdir -p backups
TS="$(date +%Y%m%d-%H%M%S)"
OUT="backups/faztudo-${TS}.sql.gz"

# Lê POSTGRES_USER/DB do .env (fallback faztudo).
POSTGRES_USER="$(grep -E '^POSTGRES_USER=' .env | cut -d= -f2- || echo faztudo)"
POSTGRES_DB="$(grep -E '^POSTGRES_DB=' .env | cut -d= -f2- || echo faztudo)"

echo "==> Dump de ${POSTGRES_DB} -> ${OUT}"
$COMPOSE exec -T db pg_dump -U "${POSTGRES_USER:-faztudo}" "${POSTGRES_DB:-faztudo}" | gzip > "$OUT"

# Retém os 14 backups mais recentes.
ls -1t backups/*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm -f
echo "OK: $OUT"
