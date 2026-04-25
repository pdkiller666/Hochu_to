#!/bin/bash
# Запускается автоматически после merge'а изменений от task-агента.
# Восстанавливает зависимости и докатывает миграции схемы БД.
set -e

echo "🔄 post-merge: pnpm install --frozen-lockfile"
pnpm install --frozen-lockfile

echo "🔄 post-merge: pnpm --filter @workspace/db push --force (применить любые schema-changes)"
pnpm --filter @workspace/db push --force

echo "✅ post-merge готов"
