#!/bin/bash
# Push последних коммитов на GitHub
# Использование: bash scripts/github-push.sh

TOKEN="${GITHUB_TOKEN:-$GITHUB_PERSONAL_ACCESS_TOKEN}"

if [ -z "$TOKEN" ]; then
  echo "❌ Переменная GITHUB_TOKEN или GITHUB_PERSONAL_ACCESS_TOKEN не задана"
  exit 1
fi

git push "https://pdkiller666:${TOKEN}@github.com/pdkiller666/Hochu_to.git" main
echo "✅ Запушено на GitHub"
