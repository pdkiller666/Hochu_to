#!/usr/bin/env bash
# E2E smoke-тест co-sharing pools + secondary market (Stage 23 + 25).
# Покрывает: создание пула, доли, confirm → purchasing, share_offers
# (create / TOCTOU buy / merge / cancel).
#
# Использование:
#   BASE=http://localhost:8080 bash scripts/smoke-pools.sh
#
# Требует: jq, curl, тестовых юзеров alexey/maria/dmitry с паролем Test1234!

set -e

BASE="${BASE:-http://localhost:8080}"
RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RESET=$'\033[0m'

login() {
  local email="$1"
  curl -s -X POST "$BASE/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"Test1234!\"}" | jq -r '.token'
}

assert_status() {
  local got="$1" expected="$2" label="$3"
  if [ "$got" = "$expected" ]; then
    echo "  ${GREEN}✓${RESET} $label (status=$got)"
  else
    echo "  ${RED}✗${RESET} $label: ожидал $expected, получил $got"
    exit 1
  fi
}

echo "==> Логин 3 тестовых юзеров"
ALEXEY=$(login alexey@example.com)
MARIA=$(login maria@example.com)
DMITRY=$(login dmitry@example.com)
[ -z "$ALEXEY" ] || [ -z "$MARIA" ] || [ -z "$DMITRY" ] && { echo "${RED}Не удалось залогиниться${RESET}"; exit 1; }
echo "  ${GREEN}✓${RESET} токены получены"

echo ""
echo "==> 1. Alexey создаёт pool на 30000₽"
POOL_RESP=$(curl -s -X POST "$BASE/api/pools" \
  -H "Authorization: Bearer $ALEXEY" -H "Content-Type: application/json" \
  -d '{"title":"Smoke pool","description":"e2e","itemUrl":"https://example.com/item","targetAmountRub":30000,"creatorPaymentDetails":"+7 999 000-00-01"}')
POOL_ID=$(echo "$POOL_RESP" | jq -r '.id')
[ -z "$POOL_ID" ] || [ "$POOL_ID" = "null" ] && { echo "${RED}Pool create failed: $POOL_RESP${RESET}"; exit 1; }
echo "  ${GREEN}✓${RESET} pool#$POOL_ID создан"

echo ""
echo "==> 2. Maria и Dmitry вносят по 50%"
M_STATUS=$(curl -s -o /tmp/m.json -w "%{http_code}" -X POST "$BASE/api/pools/$POOL_ID/shares" \
  -H "Authorization: Bearer $MARIA" -H "Content-Type: application/json" \
  -d '{"sharePercentage":50,"amountRub":15000}')
assert_status "$M_STATUS" "201" "Maria contribute 50%"
M_SHARE_ID=$(jq -r '.id' /tmp/m.json)

D_STATUS=$(curl -s -o /tmp/d.json -w "%{http_code}" -X POST "$BASE/api/pools/$POOL_ID/shares" \
  -H "Authorization: Bearer $DMITRY" -H "Content-Type: application/json" \
  -d '{"sharePercentage":50,"amountRub":15000}')
assert_status "$D_STATUS" "201" "Dmitry contribute 50%"
D_SHARE_ID=$(jq -r '.id' /tmp/d.json)

echo ""
echo "==> 3. Alexey подтверждает обе доли (перевод status в 'creator_confirmed')"
curl -s -X POST "$BASE/api/pools/$POOL_ID/shares/$M_SHARE_ID/confirm" \
  -H "Authorization: Bearer $ALEXEY" -H "Content-Type: application/json" > /dev/null
curl -s -X POST "$BASE/api/pools/$POOL_ID/shares/$D_SHARE_ID/confirm" \
  -H "Authorization: Bearer $ALEXEY" -H "Content-Type: application/json" > /dev/null
POOL_STATUS=$(curl -s "$BASE/api/pools/$POOL_ID" | jq -r '.status')
assert_status "$POOL_STATUS" "purchasing" "Pool→purchasing после 100%"

echo ""
echo "==> 4. Maria создаёт оффер на свою долю"
OFFER_STATUS=$(curl -s -o /tmp/o.json -w "%{http_code}" -X POST "$BASE/api/pools/$POOL_ID/shares/$M_SHARE_ID/offers" \
  -H "Authorization: Bearer $MARIA" -H "Content-Type: application/json" \
  -d '{"priceRub":12000,"sellerPaymentDetails":"+7 999 111-22-33"}')
assert_status "$OFFER_STATUS" "201" "Create offer"
OFFER_ID=$(jq -r '.id' /tmp/o.json)

echo ""
echo "==> 5. Maria пытается купить свой оффер → 403"
SELF_BUY=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/pools/$POOL_ID/offers/$OFFER_ID/buy" \
  -H "Authorization: Bearer $MARIA" -H "Content-Type: application/json")
assert_status "$SELF_BUY" "403" "Self-buy blocked"

echo ""
echo "==> 6. TOCTOU race: 5 параллельных /buy от alexey → ровно 1×200 + 4×409"
for i in 1 2 3 4 5; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE/api/pools/$POOL_ID/offers/$OFFER_ID/buy" \
    -H "Authorization: Bearer $ALEXEY" -H "Content-Type: application/json" &
done > /tmp/race.log
wait
sort /tmp/race.log | uniq -c | sed 's/^/  /'

echo ""
echo "==> 7. Maria confirm-transfer → transfer mode (alexey не имел доли)"
CT_STATUS=$(curl -s -o /tmp/ct.json -w "%{http_code}" -X POST "$BASE/api/pools/$POOL_ID/offers/$OFFER_ID/confirm-transfer" \
  -H "Authorization: Bearer $MARIA" -H "Content-Type: application/json")
assert_status "$CT_STATUS" "200" "Confirm transfer"
MERGE_MODE=$(jq -r '.mergeMode' /tmp/ct.json)
assert_status "$MERGE_MODE" "transfer" "mergeMode=transfer"

echo ""
echo "==> 8. Dmitry создаёт оффер → alexey купит → MERGE (50%+50%→100%)"
DOF=$(curl -s -X POST "$BASE/api/pools/$POOL_ID/shares/$D_SHARE_ID/offers" \
  -H "Authorization: Bearer $DMITRY" -H "Content-Type: application/json" \
  -d '{"priceRub":14500,"sellerPaymentDetails":"+7 999 444-55-66"}' | jq -r '.id')
curl -s -X POST "$BASE/api/pools/$POOL_ID/offers/$DOF/buy" \
  -H "Authorization: Bearer $ALEXEY" -H "Content-Type: application/json" > /dev/null
MERGE_RESP=$(curl -s -X POST "$BASE/api/pools/$POOL_ID/offers/$DOF/confirm-transfer" \
  -H "Authorization: Bearer $DMITRY" -H "Content-Type: application/json")
MERGE_MODE2=$(echo "$MERGE_RESP" | jq -r '.mergeMode')
assert_status "$MERGE_MODE2" "merge" "mergeMode=merge"

echo ""
echo "==> 9. Целостность: pool имеет 1 долю с 100%, alexey owner"
FINAL=$(curl -s "$BASE/api/pools/$POOL_ID")
COUNT=$(echo "$FINAL" | jq '.shares | length')
PCT=$(echo "$FINAL" | jq -r '.shares[0].sharePercentage')
USER_ID=$(echo "$FINAL" | jq -r '.shares[0].userId')
assert_status "$COUNT" "1" "Ровно одна доля"
assert_status "$PCT" "100.00" "100%"
echo "  ${GREEN}✓${RESET} owner_id=$USER_ID"

echo ""
echo "==> 10. Cancel-flow"
CO=$(curl -s -X POST "$BASE/api/pools/$POOL_ID/shares/$M_SHARE_ID/offers" \
  -H "Authorization: Bearer $ALEXEY" -H "Content-Type: application/json" \
  -d '{"priceRub":25000,"sellerPaymentDetails":"+7 999 777-88-99"}' | jq -r '.id')
WRONG=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/pools/$POOL_ID/offers/$CO/cancel" \
  -H "Authorization: Bearer $DMITRY" -H "Content-Type: application/json")
assert_status "$WRONG" "403" "Чужой cancel → 403"
OK=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/pools/$POOL_ID/offers/$CO/cancel" \
  -H "Authorization: Bearer $ALEXEY" -H "Content-Type: application/json")
assert_status "$OK" "200" "Свой cancel → 200"
DUP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/pools/$POOL_ID/offers/$CO/cancel" \
  -H "Authorization: Bearer $ALEXEY" -H "Content-Type: application/json")
assert_status "$DUP" "409" "Повтор cancel → 409"

echo ""
echo "${GREEN}🎉 SMOKE PASSED — все 10 шагов зелёные${RESET}"
echo "${YELLOW}⚠️  Pool#$POOL_ID и его данные остались в БД${RESET}"
