#!/usr/bin/env bash
# Доливает 15 тестовых объявлений в каждую категорию на Amvera.
# Использование: ./scripts/seed-test-listings-amvera.sh https://ВАШ-ДОМЕН.amvera.io [N]
#   N — количество на категорию (по умолчанию 15).

set -e

BASE_URL="${1:-}"
PER_CATEGORY="${2:-15}"
if [ -z "$BASE_URL" ]; then
  echo "❌ Укажите URL: ./scripts/seed-test-listings-amvera.sh https://xxx.amvera.io [N]"
  exit 1
fi

ADMIN_EMAIL="${ADMIN_EMAIL:-admin@hochu.to}"
ADMIN_PASS="${ADMIN_PASS:-Admin123!}"

echo "🔐 Логин $ADMIN_EMAIL → $BASE_URL ..."
LOGIN_RESP=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")

TOKEN=$(echo "$LOGIN_RESP" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const r=JSON.parse(d); process.stdout.write(r.token || '');" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "❌ Не удалось войти. Ответ: $LOGIN_RESP"
  exit 1
fi

echo "✅ Авторизован. Запускаем seed (по $PER_CATEGORY на категорию) ..."
RESP=$(curl -s -X POST "$BASE_URL/api/admin/seed-test-listings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"perCategory\":$PER_CATEGORY}")

echo "📦 Ответ:"
echo "$RESP" | node -e "
const d = require('fs').readFileSync('/dev/stdin','utf8');
const r = JSON.parse(d);
if (!r.ok) { console.log('❌', r.error || d); process.exit(1); }
console.log('🎉 Добавлено объявлений:', r.inserted);
console.log('📊 Сейчас в категориях:');
Object.entries(r.perCategory).forEach(([s,c]) => console.log('   ' + s.padEnd(15) + c));
"
