#!/bin/bash
# Проверка соответствия GitHub и Amvera репозиториев
# Использование: bash scripts/amvera-check.sh

AMVERA_TOKEN="${AMVERA_GIT_TOKEN}"
GITHUB_TOKEN="${GITHUB_TOKEN}"

AMVERA_USER="pdkiller666"
AMVERA_HOST="git.msk0.amvera.ru"
AMVERA_REPO="hocuto"
GITHUB_REPO="pdkiller666/Hochu_to"

echo "🔍 Проверяем соответствие репозиториев..."
echo ""

if [ -z "$GITHUB_TOKEN" ]; then
  echo "❌ GITHUB_TOKEN не задан"
  exit 1
fi

if [ -z "$AMVERA_TOKEN" ]; then
  echo "❌ AMVERA_GIT_TOKEN не задан"
  exit 1
fi

# GitHub SHA (ищем в object.sha — после "type":"commit")
GITHUB_RESPONSE=$(curl -s \
  -H "Authorization: token ${GITHUB_TOKEN}" \
  "https://api.github.com/repos/${GITHUB_REPO}/git/refs/heads/main")
GITHUB_SHA=$(echo "$GITHUB_RESPONSE" | grep -o '"sha": *"[^"]*"' | tail -1 | grep -o '"[0-9a-f]*"$' | tr -d '"')

# Amvera SHA (через git ls-remote)
AMVERA_SHA=$(git --no-optional-locks ls-remote \
  "https://${AMVERA_USER}:${AMVERA_TOKEN}@${AMVERA_HOST}/${AMVERA_USER}/${AMVERA_REPO}" \
  refs/heads/master 2>/dev/null | cut -f1)

# Локальный HEAD
LOCAL_SHA=$(git --no-optional-locks rev-parse HEAD 2>/dev/null)

echo "📍 Локальный Replit:  ${LOCAL_SHA:0:7}"
echo "🐙 GitHub main:       ${GITHUB_SHA:0:7}"
echo "🚀 Amvera master:     ${AMVERA_SHA:0:7}"
echo ""

OK=true

if [ "${LOCAL_SHA}" = "${GITHUB_SHA}" ]; then
  echo "✅ Replit ↔ GitHub:  в синхроне"
else
  echo "⚠️  Replit ↔ GitHub:  РАСХОЖДЕНИЕ — нужен push на GitHub"
  OK=false
fi

if [ "${GITHUB_SHA}" = "${AMVERA_SHA}" ]; then
  echo "✅ GitHub ↔ Amvera:  в синхроне"
else
  echo "⚠️  GitHub ↔ Amvera:  РАСХОЖДЕНИЕ — деплой ещё не завершён или нужен ручной push"
  OK=false
fi

echo ""
if [ "$OK" = "true" ]; then
  echo "🎉 Все репозитории актуальны!"
else
  echo "💡 Чтобы синхронизировать: bash scripts/github-push.sh \"сообщение\""
fi
