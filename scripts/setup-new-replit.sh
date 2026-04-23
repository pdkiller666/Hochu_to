#!/bin/bash
# Полное развёртывание проекта Хочу_То на новом Replit-аккаунте.
# Запуск: bash scripts/setup-new-replit.sh
#
# Что делает:
#   1. Проверяет наличие $DATABASE_URL (Replit auto-provisions при модуле postgresql-16)
#   2. Устанавливает зависимости (pnpm install)
#   3. Накатывает схему БД (drizzle-kit push)
#   4. Заливает тестовые данные (5 пользователей + 22 листинга + 7 броней + отзывы + ...)
#   5. Напоминает о SESSION_SECRET и GITHUB_TOKEN

set -e

echo "🚀 Развёртывание Хочу_То на новом Replit"
echo ""

# 1. БД
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL не задан. В .replit должен быть модуль postgresql-16."
  echo "   Открой Tools → Database и подключи PostgreSQL."
  exit 1
fi
echo "✅ DATABASE_URL найден: $(echo $DATABASE_URL | sed 's/:[^:@]*@/:***@/')"

# 2. Зависимости
echo ""
echo "📦 Устанавливаю зависимости (pnpm install)..."
pnpm install --frozen-lockfile

# 3. Миграции
echo ""
echo "🗄️  Накатываю схему БД (drizzle push)..."
pnpm --filter @workspace/db push

# 4. Тестовые данные
echo ""
echo "🌱 Заливаю снапшот тестовых данных..."
SNAPSHOT="scripts/db-snapshots/dev-data.sql"
if [ ! -f "$SNAPSHOT" ]; then
  echo "⚠️  Снапшот $SNAPSHOT не найден — пропускаю."
  echo "   Альтернатива: pnpm --filter @workspace/api-server seed (только регионы+категории+демо)"
else
  PGSSLMODE=require psql "$DATABASE_URL" < "$SNAPSHOT" > /tmp/seed.log 2>&1 \
    && echo "✅ Снапшот залит ($(wc -l < $SNAPSHOT) строк)" \
    || { echo "❌ Ошибка при заливке. Лог: /tmp/seed.log"; tail -20 /tmp/seed.log; exit 1; }
fi

# 5. Секреты
echo ""
echo "🔐 ПРОВЕРЬ СЕКРЕТЫ В Tools → Secrets:"
echo "   ─ DATABASE_URL — обязателен (Replit auto-provisions при модуле postgresql-16)"
echo "     ✅ найден (см. выше)"
echo "   ─ GITHUB_TOKEN  — для пуша на GitHub (опционально, см. docs/AGENT_INSTRUCTIONS.md §13)"
[ -z "$GITHUB_TOKEN" ] && echo "     ⚠️  НЕ найден" || echo "     ✅ установлен"
echo ""
echo "ℹ️  Других секретов сейчас не требуется (auth работает на cookie без подписи)."
echo "   Когда подключишь ЮKassa — добавь YOOKASSA_SHOP_ID + YOOKASSA_SECRET_KEY."

echo ""
echo "🎉 Готово! Запусти workflow «Start application» (кнопка Run сверху)."
echo "   Тестовые аккаунты см. в docs/AGENT_INSTRUCTIONS.md → Test users."
