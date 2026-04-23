# Инструкция для агента — проект «Хочу_То»

> Файл для агента из другого аккаунта Replit. Содержит все необходимые данные для работы с проектом.

---

## 1. О проекте

**«Хочу_То»** — российский маркетплейс аренды вещей и совместных покупок.

- **Тип**: pnpm-монорепо (full-stack)
- **Фронтенд**: React + Vite + TailwindCSS + Framer Motion + Wouter
- **Бэкенд**: Express 5 + PostgreSQL + Drizzle ORM
- **Язык общения с пользователем**: **только русский**
- **После каждой итерации работы**: обязательно пушить в GitHub через `bash scripts/github-push.sh "описание"`

---

## 2. GitHub

| Параметр | Значение |
|----------|----------|
| Репозиторий | https://github.com/pdkiller666/Hochu_to |
| Пользователь | `pdkiller666` |
| Personal Access Token | `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` |
| Ветка | `main` |

### Установить секрет в Replit:
```
Название: GITHUB_PERSONAL_ACCESS_TOKEN
Значение: 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
```

### Пуш в GitHub:
```bash
bash scripts/github-push.sh "описание изменений"
# Если заблокирован git add/commit (Replit lock):
TOKEN="${GITHUB_TOKEN:-$GITHUB_PERSONAL_ACCESS_TOKEN}"
git push "https://pdkiller666:${TOKEN}@github.com/pdkiller666/Hochu_to.git" main
```

---

## 3. База данных (Replit PostgreSQL)

Переменные окружения уже установлены в Replit Secrets:

| Переменная | Значение |
|------------|----------|
| `DATABASE_URL` | `postgresql://postgres:password@helium/heliumdb?sslmode=disable` |
| `PGHOST` | `helium` |
| `PGPORT` | `5432` |
| `PGUSER` | `postgres` |
| `PGPASSWORD` | `password` |
| `PGDATABASE` | `heliumdb` |

### Прямой доступ к БД:
```bash
PGPASSWORD=password psql -U postgres -h helium -d heliumdb
```

### Применить схему и залить тестовые данные:
```bash
pnpm --filter @workspace/db run push-force      # обновить схему
pnpm --filter @workspace/api-server run seed    # seed данные
```

---

## 4. Amvera (хостинг)

Amvera — российский Docker-хостинг. Деплой происходит автоматически через **GitHub webhook** при каждом пуше в ветку `main`.

### Workflow деплоя:
```
git push → GitHub → Amvera webhook → Docker build (Kaniko) → запуск контейнера
```

### При старте контейнера (CMD в Dockerfile):
```bash
cd /app/lib/db && pnpm run push-force   # синхронизация схемы БД
cd /app && node artifacts/api-server/dist/index.mjs  # запуск сервера
```

### Dockerfile — важные параметры:
- Base: `node:20-slim`
- pnpm версия: `9` (через corepack)
- Сборка фронтенда: `ENV PORT=3000 ENV BASE_PATH=/`
- Продакшн порт: `8080`
- Frontend статика раздаётся бэкендом из `dist/public/`

### Переменные окружения на Amvera (нужно установить вручную в панели):
| Переменная | Описание |
|------------|----------|
| `DATABASE_URL` | URL PostgreSQL базы Amvera |
| `PORT` | `8080` |
| `NODE_ENV` | `production` |
| `ADMIN_EMAIL` | Email первого администратора (или `admin@hochu.to`) |
| `ADMIN_PASSWORD` | Пароль первого администратора |

> **Примечание:** Amvera предоставляет собственную PostgreSQL — URL будет другим, не локальным Replit.

### Доступ в панель Amvera:
Логин и пароль от аккаунта Amvera — у владельца проекта (pdkiller666). Агент не имеет прямого доступа к панели Amvera.

---

## 5. Локальная разработка в Replit

### Запуск воркфлоу:
- **API сервер**: `pnpm --filter @workspace/api-server run dev` → порт `8080`
- **Фронтенд**: `pnpm --filter @workspace/hochu-to run dev` → порт из `$PORT`

### Обязательные переменные окружения (уже в Replit Secrets):
- `DATABASE_URL` — локальная Replit БД
- `GITHUB_PERSONAL_ACCESS_TOKEN` — токен для пуша

### Установка зависимостей:
```bash
pnpm install --no-frozen-lockfile
```

### Структура монорепо:
```
artifacts/
  api-server/       # Express бэкенд (порт 8080)
  hochu-to/         # React фронтенд (Vite)
lib/
  db/               # Drizzle ORM схема + конфиг
  api-client-react/ # Генерированный API клиент (Orval)
  api-spec/         # OpenAPI спецификация
  api-zod/          # Zod валидация
scripts/
  github-push.sh    # Скрипт пуша на GitHub
Dockerfile          # Multi-stage Docker сборка
```

---

## 6. Тестовые пользователи

Созданы через `pnpm --filter @workspace/api-server run seed`

| Email | Пароль | Роль |
|-------|--------|------|
| `alexey@example.com` | `Test1234!` | owner (владелец) |
| `maria@example.com` | `Test1234!` | renter (арендатор) |
| `dmitry@example.com` | `Test1234!` | renter |
| `irina@example.com` | `Test1234!` | renter |
| `sergey@example.com` | `Test1234!` | renter |
| `anna@example.com` | `Test1234!` | renter |
| `admin@test.ru` | `Admin1234!` | admin |

---

## 7. API — ключевые эндпоинты

Базовый URL в разработке: `http://localhost:8080/api`

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/auth/login` | Вход, возвращает `{ token }` |
| POST | `/auth/register` | Регистрация |
| GET | `/listings` | Список объявлений `{ listings, total, page, totalPages }` |
| GET | `/regions` | Регионы (плоский массив) |
| GET | `/categories` | Категории (плоский массив) |
| GET | `/notifications` | Уведомления (массив) |
| PATCH | `/notifications/:id/read` | Прочитать уведомление |
| POST | `/notifications/read-all` | Прочитать все |
| GET | `/bookings/:id/messages` | Чат бронирования |
| POST | `/bookings/:id/messages` | Отправить `{ content }` |
| GET | `/messages/unread-counts` | Непрочитанные `{ [bookingId]: count }` |
| POST | `/support/tickets` | Создать тикет `{ subject, body, category }` |
| GET | `/support/tickets` | Мои тикеты |
| POST | `/reports` | Жалоба `{ reportType, reportedListingId\|reportedUserId, reason, comment }` |
| PUT | `/bookings/:id/status` | Смена статуса бронирования |

### Авторизация:
```javascript
// В заголовках запросов:
Authorization: Bearer <token>
// Или cookie: token=<token>
```

### Статусы бронирований (матрица переходов):
- `pending` → `confirmed` / `rejected` (owner)
- `confirmed` → `active` (owner)
- `active` → `return_pending` (owner)
- `return_pending` → `completed` (owner)
- `pending` / `confirmed` → `cancelled` (renter)

---

## 8. Бренд и дизайн

| Токен | Значение |
|-------|----------|
| Primary | `#C65D3B` (терракота) |
| Background | `#F2EEE3` (тёплый крем) |
| Accent | `#4A8587` (бирюза) |
| Text | `#2B2B2B` |
| Заголовки | Montserrat |
| Текст | Inter |

---

## 9. Важные нюансы

### esbuild версия:
- `artifacts/api-server/package.json` — строго `"esbuild": "0.25.8"` (не менять!)
- Плагин `esbuild-plugin-pino@2.3.3` требует `>=0.25.0 <=0.25.8`
- В `pnpm-workspace.yaml` есть глобальный override `esbuild: 0.27.3` — для api-server он переопределяется точной версией в package.json

### Replit блокирует git commit/add:
- `git add -A` и `git commit` блокируются главным агентом
- Checkpoint создаётся автоматически в конце каждого диалога
- Пушить нужно через прямой вызов: `git push "https://pdkiller666:${TOKEN}@github.com/pdkiller666/Hochu_to.git" main`

### `.dockerignore`:
Файлы исключены из Docker-образа: `node_modules`, `.git`, `.replit`, `dist`, `amvera.yml`, `replit.md`, `attached_assets`, `artifacts/mockup-sandbox`

### Seed при продакшн-запуске:
Dockerfile CMD запускает `drizzle-kit push-force` + seed при каждом старте контейнера. Это нормально — seed проверяет наличие данных и не дублирует их.

### Переменные фронтенда:
- `VITE_API_URL` — по умолчанию пустая строка (фронтенд и бэкенд на одном домене)
- `PORT` — обязательна при сборке (`vite.config.ts` бросит ошибку без неё)
- `BASE_PATH` — обязательна при сборке (в Dockerfile: `/`)

---

## 10. Команды быстрого старта

```bash
# 1. Установить зависимости
pnpm install --no-frozen-lockfile

# 2. Применить схему БД
pnpm --filter @workspace/db run push-force

# 3. Залить тестовые данные
pnpm --filter @workspace/api-server run seed

# 4. Запустить API (в отдельном терминале)
PORT=8080 pnpm --filter @workspace/api-server run dev

# 5. Запустить фронтенд (в отдельном терминале)
PORT=3001 BASE_PATH=/ pnpm --filter @workspace/hochu-to run dev

# 6. Проверить API
curl http://localhost:8080/api/health

# 7. Запустить production-сборку (тест)
NODE_ENV=production pnpm --filter @workspace/api-server run build
PORT=3000 BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/hochu-to run build

# 8. Пуш на GitHub
bash scripts/github-push.sh "описание изменений" 
```
