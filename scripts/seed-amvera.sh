#!/usr/bin/env bash
# Запускает seed на удалённом Amvera-сервере через /api/admin/seed
# Использование: ./scripts/seed-amvera.sh https://ВАШ-ДОМЕН.amvera.io

set -e

BASE_URL="${1:-}"
if [ -z "$BASE_URL" ]; then
  echo "❌ Укажите URL Amvera-приложения: ./scripts/seed-amvera.sh https://xxx.amvera.io"
  exit 1
fi

ADMIN_EMAIL="${ADMIN_EMAIL:-admin@hochu.to}"
ADMIN_PASS="${ADMIN_PASS:-Admin123!}"

echo "🔐 Авторизация как $ADMIN_EMAIL на $BASE_URL..."
LOGIN_RESP=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")

TOKEN=$(echo "$LOGIN_RESP" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const r=JSON.parse(d); process.stdout.write(r.token || '');" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "❌ Не удалось войти. Ответ: $LOGIN_RESP"
  exit 1
fi

echo "✅ Авторизован. Запускаем seed..."
SEED_RESP=$(curl -s -X POST "$BASE_URL/api/admin/seed" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "📦 Ответ сервера: $SEED_RESP"

OK=$(echo "$SEED_RESP" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); console.log(JSON.parse(d).ok);" 2>/dev/null)
if [ "$OK" = "true" ]; then
  echo "🎉 Seed выполнен успешно!"
else
  echo "❌ Seed вернул ошибку"
  exit 1
fi
