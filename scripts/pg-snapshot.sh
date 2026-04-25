#!/usr/bin/env bash
# Регенерирует scripts/db-snapshots/dev-data.sql из текущей БД (DATABASE_URL).
# Используется для синхронизации тестовых данных после миграций схемы.
#
# Запуск:   bash scripts/pg-snapshot.sh
# Результат: scripts/db-snapshots/dev-data.sql (data-only, INSERTs, public schema)

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL не задан"
  exit 1
fi

OUT="scripts/db-snapshots/dev-data.sql"
mkdir -p "$(dirname "$OUT")"

echo "📦 pg_dump → $OUT"
PGSSLMODE=require pg_dump "$DATABASE_URL" \
  --data-only \
  --inserts \
  --no-owner \
  --no-acl \
  --schema=public \
  --exclude-table-data='__drizzle_migrations' \
  > "$OUT"

LINES=$(wc -l < "$OUT")
SIZE=$(du -h "$OUT" | cut -f1)
INSERTS=$(grep -c '^INSERT' "$OUT" || echo 0)

echo "✅ Снапшот обновлён: $LINES строк, $SIZE, $INSERTS INSERT-ов"
echo "ℹ️  Не забудь закоммитить и запушить:"
echo "   bash scripts/github-push.sh \"Refresh DB snapshot\""
