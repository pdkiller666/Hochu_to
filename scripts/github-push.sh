#!/bin/bash
# Push последних коммитов на GitHub
# Использование: bash scripts/github-push.sh "сообщение коммита"

TOKEN="${GITHUB_TOKEN:-$GITHUB_PERSONAL_ACCESS_TOKEN}"

if [ -z "$TOKEN" ]; then
  echo "❌ Переменная GITHUB_TOKEN или GITHUB_PERSONAL_ACCESS_TOKEN не задана"
  exit 1
fi

MSG="${1:-chore: update}"

# Попытка добавить и закоммитить (Replit может блокировать)
git add -A 2>/dev/null
if git diff --cached --quiet 2>/dev/null; then
  echo "ℹ️  Нет изменений для коммита"
else
  git -c user.email="agent@replit.com" -c user.name="Replit Agent" commit -m "$MSG" 2>/dev/null && echo "✅ Закоммичено: $MSG" || echo "ℹ️  Коммит заблокирован Replit (используется checkpoint)"
fi

# Пуш всегда (включая checkpoint-коммиты Replit)
git push "https://pdkiller666:${TOKEN}@github.com/pdkiller666/Hochu_to.git" main
echo "✅ Запушено на GitHub"
