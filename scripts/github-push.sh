#!/bin/bash
# Push последних коммитов на GitHub
# Использование: bash scripts/github-push.sh "сообщение коммита"

TOKEN="${GITHUB_TOKEN:-$GITHUB_PERSONAL_ACCESS_TOKEN}"

if [ -z "$TOKEN" ]; then
  echo "❌ Переменная GITHUB_TOKEN или GITHUB_PERSONAL_ACCESS_TOKEN не задана"
  exit 1
fi

MSG="${1:-chore: update}"

# Добавляем все изменения и коммитим (если есть что коммитить)
git add -A
if git diff --cached --quiet; then
  echo "ℹ️  Нет изменений для коммита"
else
  git -c user.email="agent@replit.com" -c user.name="Replit Agent" commit -m "$MSG"
  echo "✅ Закоммичено: $MSG"
fi

git push "https://pdkiller666:${TOKEN}@github.com/pdkiller666/Hochu_to.git" main
echo "✅ Запушено на GitHub"
