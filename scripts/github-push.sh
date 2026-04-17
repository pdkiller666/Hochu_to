#!/bin/bash
# Push последних коммитов на GitHub
# Использование: bash scripts/github-push.sh

if [ -z "$GITHUB_TOKEN" ]; then
  echo "❌ Переменная GITHUB_TOKEN не задана"
  exit 1
fi

git push "https://pdkiller666:${GITHUB_TOKEN}@github.com/pdkiller666/Hochu_to.git" main
echo "✅ Запушено на GitHub"
