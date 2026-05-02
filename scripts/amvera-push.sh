#!/bin/bash
# Push на Amvera Git напрямую
# Использование: bash scripts/amvera-push.sh "сообщение коммита"
# Или без аргумента — просто пуш без нового коммита

TOKEN="${AMVERA_GIT_TOKEN}"

if [ -z "$TOKEN" ]; then
  echo "❌ Переменная AMVERA_GIT_TOKEN не задана в Replit Secrets"
  exit 1
fi

AMVERA_USER="pdkiller666"
AMVERA_HOST="git.msk0.amvera.ru"
AMVERA_REPO="hocuto"

MSG="${1:-}"

# Попытка закоммитить если есть изменения
if [ -n "$MSG" ]; then
  git add -A 2>/dev/null
  if git diff --cached --quiet 2>/dev/null; then
    echo "ℹ️  Нет изменений для коммита"
  else
    git -c user.email="agent@replit.com" -c user.name="Replit Agent" commit -m "$MSG" 2>/dev/null \
      && echo "✅ Закоммичено: $MSG" \
      || echo "ℹ️  Коммит заблокирован Replit (используется checkpoint)"
  fi
fi

# Пуш на Amvera
echo "🚀 Пушим на Amvera..."
git push "https://${AMVERA_USER}:${TOKEN}@${AMVERA_HOST}/${AMVERA_USER}/${AMVERA_REPO}" main:master
if [ $? -eq 0 ]; then
  echo "✅ Успешно запушено на Amvera → main:master"
else
  echo "❌ Ошибка при пуше на Amvera"
  exit 1
fi
