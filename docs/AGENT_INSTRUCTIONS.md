# Инструкция для агента — проект «Хочу_То»

> Файл для агента из другого аккаунта Replit. Содержит все необходимые данные для работы с проектом.

---

## 0. БЫСТРЫЙ СТАРТ ДЛЯ НОВОГО АГЕНТА (02.05.2026)

> Если ты агент, который только что принял проект — прочитай этот блок первым.

### Где мы сейчас
- **Последний закрытый этап: Stage 39** — Fintech Core & Escrow Engine ✅
- **Тестовые аккаунты**: `admin@hochu.to / AdminTest99!` (superadmin, id=1) · `tenant_test@test.ru / Test1234!` (renter, id=10)
- **Бот**: `@Helper251223_bot` — онлайн, токен в секрете `TELEGRAM_BOT_TOKEN`
- **API**: порт 8080 · **Фронт**: порт 5000 (workflow `Start application`)

### ✅ BACKLOG — Мобильный UX (ВЫПОЛНЕНО 13.05.2026 — Stage UI-1)
Анализ топовых маркетплейсов (AliExpress, Ozon, Avito) показал 5 ключевых улучшений. **Все реализованы.**

| # | Что | Статус | Файлы |
|---|-----|--------|-------|
| **M-1** | **Нижняя навигация (Bottom Tab Bar)** — Главная/Каталог/Избранное/Чаты/Профиль | ✅ Done | `BottomNav.tsx` (новый), `Layout.tsx` |
| **M-2** | **Бейдж доступности на карточке** — «Свободно» / «Занято» | ✅ Done | `ListingCard.tsx` |
| **M-3** | **Категории горизонтальный скролл** под поиском на главной и в каталоге | ✅ Done | `Home.tsx`, `Catalog.tsx` |
| **M-4** | **Кнопка «Арендовать» прямо на карточке** | ✅ Done | `ListingCard.tsx` |
| **M-5** | **Город/локация чипом на карточке** | ✅ Done | `ListingCard.tsx` |

Дополнительно реализованы в Stage UI-1:
- **Поиск-дропдаун** в хедере (автодополнение: листинги + категории, 250мс дебаунс)
- **Полноэкранная подпись** в DigitalActUpload + `userRole` логика (правильная сторона сделки)
- **Picker позиции кадра** в ListingForm (3×3 grid, кодируется как `#pos=top_left` в URL фото)

### Что НЕЛЬЗЯ ломать (критические инварианты)
| Инвариант | Где |
|-----------|-----|
| Gemini хедер авторизации: **НЕ** `Authorization`, а `X-Auth-Token: Bearer …` | `lib/ai-service.ts` |
| Gemini model: `gemini-flash-latest` (не `gemini-1.5-flash` — 404) | `lib/ai-service.ts` |
| Amvera messages field: `text` (не `content`) | `lib/ai-service.ts` |
| `.trim()` на всех API-ключах (хвостовой `\n` → загадочный 401) | `lib/ai-service.ts`, `lib/telegram.ts` |
| `sharp` в `dependencies` (не `devDependencies`) — иначе prod-сборка падает | `artifacts/api-server/package.json` |
| `seedDefaultAdmin` делает роль `superadmin` (не `admin`) — идемпотентно | `index.ts` |
| Hot-swap telegram токена: **await** + DB rollback при 401 | `lib/telegram.ts:hotSwapToken` |
| Telegram `launch({ dropPendingUpdates: true })` — обязательно при prod-деплое | `lib/telegram.ts:startBot` |
| `telegramEnv` по умолчанию `"dev"` в БД — на проде вручную ставить `"prod"` | AdminPage → Telegram-бот |
| Broadcast валидирует роль через `isValidBroadcastRole()` → 400 при невалидной | `routes/admin.ts` |
| Буллеты инфографики ≤32 символа (`BULLET_MAX_CHARS=16`) | `lib/image-service.ts` |
| Webhook ЮKassa: HMAC-SHA256 обязателен в production | `routes/webhooks.ts` |

### Архитектура одним взглядом
```
pnpm monorepo
├── lib/db/                  Drizzle ORM + schema (30+ таблиц)
├── artifacts/api-server/    Express 5 API (:8080)
│   ├── src/lib/             ai-service, telegram, notifications, scheduler, yookassa, image-service
│   ├── src/middleware/      auth, requireRole (RBAC 8 ролей)
│   └── src/routes/          28 роутов (auth, listings, bookings, pools, telegram, admin, ...)
├── artifacts/hochu-to/      React+Vite фронт (:5000)
│   └── src/pages/           17 страниц (Home, Dashboard, AdminPage, PoolDetail, ...)
└── scripts/                 github-push.sh, setup-new-replit.sh, db-snapshots/
```

### Правила работы
1. **Язык с пользователем**: только русский
2. **После каждой итерации**: агент **сам** пушит и проверяет — см. §13. Одна команда:
   ```bash
   git push "https://pdkiller666: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@github.com/pdkiller666/Hochu_to.git" main 2>&1 && \
   git push "https://pdkiller666:4_5AznCgvidfr5x@git.msk0.amvera.ru/pdkiller666/hocuto" main:master 2>&1 && \
   GITHUB_TOKEN=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 AMVERA_GIT_TOKEN=4_5AznCgvidfr5x bash scripts/amvera-check.sh
   ```
3. **Перед каждым пушем**: обновить оба файла — `replit.md` (карта проекта) и `docs/AGENT_INSTRUCTIONS.md` (журнал + инвентаризация)
4. **Не трогать** артефакт-воркфлоу (`artifacts/*`) — они неудаляемы, платформа управляет ими
5. **`git add/commit` заблокированы** из агента; `git push` существующих чекпойнтов — **работает**
6. **Новые NOT NULL поля в схеме** — всегда с `DEFAULT` или nullable, иначе `drizzle push` упадёт на проде

### Последние закрытые этапы
- **Stage 38-UE — Universal SMS Adapter** (**✅ 02.05.2026**) — горячесменный SMS-провайдер (MTS Exolve / SMSC / Stream Telecom), circuit breaker (Telegram 60s → SMS fallback), OTP верификация телефона. Таб «Интеграции» в AdminPage. Секция «Верификация телефона» в Dashboard.
- **Stage 39 — Fintech Core & Escrow Engine** (**✅ 02.05.2026**) — атомарные кошельки с SELECT FOR UPDATE, escrow hold/release/payout, комиссия Math.ceil. Таб «Кошелёк» в Dashboard. WalletStatsCard в AdminPage → Выплаты. API `/wallet/*`.
- **Telegram debug-fix** (**✅ 13.05.2026**) — 4 бага продакшна: (1) `.trim()` на токене в `initTelegramBot()`, (2) `launch({ dropPendingUpdates: true })` + retry 15s при 409 Conflict, (3) поле `telegramEnv` в ответе `/admin/telegram/status` (было `env` → фронт читал неверно), (4) `botUsername` в `/api/telegram/status` + кликабельная ссылка на бота в Dashboard OTP-инструкциях. **Важно для Amvera**: задать `TELEGRAM_BOT_TOKEN` в Variables и в AdminPage → Telegram-бот переключить env Dev → Prod.
- **Stage UI-1 — Мобильный UX + Search + Photo** (**✅ 13.05.2026**) — M-1..M-5 + поиск-дропдаун + фуллскрин подпись + picker кадра. Подробности в секции ниже.

### Следующие кандидаты Stage 40+
- Stage 21b: контакты через ЮKassa (real-branching в `contacts.ts`)
- Stage 21c: холд брони через ЮKassa (capture при `completed`)
- Stage 39+: OTP-верификация владельца при confirmed→active (escrow start verify)
- Подписки владельцев (Pro/Бизнес): таблица + роуты + UI
- Joint Purchases: полная коллективная механика (паи, эскроу, закрытие)

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

### Пуш в GitHub (из Shell пользователя):
```bash
GITHUB_TOKEN=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 bash scripts/github-push.sh "описание изменений"
```

> **Если `git add -A` заблокирован** (Replit lock `.git/index.lock`):
> ```bash
> git push "https://pdkiller666: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@github.com/pdkiller666/Hochu_to.git" main
> ```
> Replit-агент не может делать `git add/commit`, но `git push` существующих чекпойнтов работает.
> Чекпойнт-коммит создаётся автоматически Replit в конце каждого диалога.

### Проверить актуальность на GitHub:
```bash
git log --oneline -5
git log origin/main..HEAD --oneline   # покажет непушенные коммиты
```

---

## 3. База данных (Replit PostgreSQL)

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

### ⚠️ КРИТИЧНО: Ветки Amvera

| Где | Ветка |
|-----|-------|
| Replit / GitHub | `main` |
| Amvera git repo (`git.msk0.amvera.ru`) | `master` |
| Amvera webhook (слушает GitHub) | `main` |

Это **разные ветки**. Amvera держит свой git-репозиторий на ветке `master`, но webhook настроен слушать GitHub `main`. При прямом push в Amvera нужно указывать `main:master`.

### Workflow деплоя (основной — через GitHub):
```
Replit checkpoint (main) → git push → GitHub (main) → Amvera webhook → Docker build из master → запуск контейнера
```

### Команды деплоя (агент выполняет сам после чекпойнта):

> **Важно:** `git add/commit` заблокированы, но `git push` существующих чекпойнтов работает из агента.
> Подробная инструкция — в §13 этого файла.

**Шаг 1 — push в GitHub + Amvera + проверка (одна команда):**
```bash
git push "https://pdkiller666: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@github.com/pdkiller666/Hochu_to.git" main 2>&1 && \
git push "https://pdkiller666:4_5AznCgvidfr5x@git.msk0.amvera.ru/pdkiller666/hocuto" main:master 2>&1 && \
GITHUB_TOKEN=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 AMVERA_GIT_TOKEN=4_5AznCgvidfr5x bash scripts/amvera-check.sh
```

**Форс-пуш в Amvera (если rejected non-fast-forward):**
```bash
git push --force "https://pdkiller666:4_5AznCgvidfr5x@git.msk0.amvera.ru/pdkiller666/hocuto" main:master 2>&1
```

### При старте контейнера (CMD в Dockerfile):
```bash
node /app/lib/db/migrate-prod.mjs                    # 0) drizzle push (создаёт таблицы)
                                                     # 1) ALTER TABLE ... IF NOT EXISTS (легаси)
                                                     # 2) seed категорий/регионов/demo
node artifacts/api-server/dist/index.mjs             # запуск сервера
```

> **Важно:** если в схему добавляется новый NOT NULL столбец без DEFAULT — обязательно
> сделайте его nullable или добавьте DEFAULT, иначе `drizzle-kit push --force` упадёт на проде
> с ошибкой `column contains null values`.

### Dockerfile — важные параметры:
- Base: `node:20-slim`
- pnpm версия: `9` (через corepack)
- Сборка фронтенда: `ENV PORT=3000 ENV BASE_PATH=/`
- Продакшн порт: `8080`
- Frontend статика раздаётся бэкендом из `dist/public/`

### Переменные окружения на Amvera:
| Переменная | Описание |
|------------|----------|
| `DATABASE_URL` | URL PostgreSQL базы Amvera |
| `PORT` | `8080` |
| `NODE_ENV` | `production` |
| `ADMIN_EMAIL` | Email первого администратора |
| `ADMIN_PASSWORD` | Пароль первого администратора |
| `SESSION_SECRET` | Секрет JWT/сессий (≥32 символа, `openssl rand -hex 32`) |
| `GEMINI_API_KEY` | Google Gemini API — основной AI-провайдер (генерация описаний + инфографика) |
| `AMVERA_API_TOKEN` | Amvera AI Inference (DeepSeek-V3 через `/models/deepseek`) — второй AI-провайдер |
| `DEEPSEEK_API_KEY` | Прямой DeepSeek API (`api.deepseek.com`) — третий AI-провайдер, резерв после Amvera (Stage 33.0). Значение: `sk-bbf4cc431aa4488895da859c9516492e` |
| `YOOKASSA_SHOP_ID` | ID магазина ЮKassa (Stage 21a, **обязателен** при `is_commercial_mode=true`) |
| `YOOKASSA_SECRET_KEY` | Секретный ключ API ЮKassa (Stage 21a, обязателен в коммерческом режиме) |
| `YOOKASSA_WEBHOOK_SECRET` | Секрет для верификации HMAC-SHA256 подписи вебхуков (Stage 21a, **обязателен в production** — иначе webhook отдаёт 401) |

**Webhook URL для личного кабинета ЮKassa:** `https://<домен>/api/webhooks/yookassa`
для событий `payment.succeeded` и `payment.canceled`.

---

## 5a. Перенос на новый аккаунт Replit (быстрый старт с нуля)

Если открываешь репозиторий с **другого Replit-аккаунта** (или новый Repl), для полного восстановления окружения:

### Шаг 1: Импорт из GitHub
- New Repl → Import from GitHub → `https://github.com/pdkiller666/Hochu_to`
- Replit автоматически подхватит `.replit` (модули `nodejs-24` + `postgresql-16`).

### Шаг 2: Установить секреты (Tools → Secrets)
| Ключ | Назначение | Источник |
|---|---|---|
| `SESSION_SECRET` | подпись JWT/сессий — **обязательно** | Сгенерировать любую строку ≥32 символов: `openssl rand -hex 32` |
| `GITHUB_TOKEN` | для пуша на GitHub (опционально) | `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` (см. раздел 2) или новый PAT |
| `GEMINI_API_KEY` | Google Gemini — основной AI-провайдер (опционально, без ключа работает mock) | Google AI Studio: https://aistudio.google.com/apikey |
| `AMVERA_API_TOKEN` | Amvera DeepSeek-V3 — второй AI-провайдер (опционально) | Панель управления Amvera |
| `DEEPSEEK_API_KEY` | Прямой DeepSeek API — резерв после Amvera (Stage 33.0, опционально) | `sk-bbf4cc431aa4488895da859c9516492e` |
| `TELEGRAM_BOT_TOKEN` | Telegraf bot-токен (Stage 38) — если NULL в `platform_settings`, бот берёт отсюда | BotFather в Telegram. Текущий бот: `@Helper251223_bot` |

`DATABASE_URL`, `PGHOST`, `PGPASSWORD` и т.п. **Replit задаёт автоматически** при наличии модуля `postgresql-16`.

### Шаг 3: Один скрипт делает всё
```bash
bash scripts/setup-new-replit.sh
```
Скрипт:
1. Проверит `DATABASE_URL`.
2. `pnpm install --frozen-lockfile`.
3. `pnpm --filter @workspace/db push` — накатит схему (22 таблицы).
4. `psql < scripts/db-snapshots/dev-data.sql` — зальёт **актуальный снапшот**: 7 пользователей, 22 объявления, 7 броней, 4 отзыва, 1 тикет, 1 заявка фонда, балансы и аудит-лог.
5. Подскажет про `SESSION_SECRET` и `GITHUB_TOKEN`.

### Шаг 4: Run
Кнопка ▶ Run сверху → workflow `Start application` поднимет API (8080) и фронт (5173).

### Альтернатива: чистая БД без тестовых данных
```bash
pnpm --filter @workspace/db push                       # схема
pnpm --filter @workspace/api-server seed               # только регионы (85 субъектов РФ) + категории + базовый демо-сет
```

### Что НЕ переносится автоматически и требует внимания:
- **Старые JWT-сессии разлогинятся** (новый `SESSION_SECRET`) — это нормально, нужно перелогиниться.
- **Загруженные файлы** (`/uploads/*`) — не в git, на новом Repl папка пустая. У нас пока нет загруженных аватарок, так что не критично.
- **Amvera-деплой** — независим от Replit, продолжает работать со своим окружением.

### Обновление снапшота тестовых данных
Если нужно обновить дамп после новых тестов:
```bash
PGSSLMODE=require pg_dump "$DATABASE_URL" --data-only --column-inserts --no-owner --no-privileges \
  -t users -t regions -t categories -t listings -t bookings -t booking_events -t booking_messages \
  -t reviews -t notifications -t platform_settings -t support_tickets -t support_messages \
  -t claims -t contact_balances -t contact_purchases -t joint_purchases -t newsletter \
  -t admin_audit_log -t favorites -t reports \
  > scripts/db-snapshots/dev-data.sql
```

---

## 5. Локальная разработка в Replit

### Запуск воркфлоу:
- **API сервер**: `pnpm --filter @workspace/api-server run dev` → порт `8080`
- **Фронтенд**: `pnpm --filter @workspace/hochu-to run dev` → порт из `$PORT`

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

### Важно: esbuild версия:
- `artifacts/api-server/package.json` — строго `"esbuild": "0.25.8"` (не менять!)
- Плагин `esbuild-plugin-pino@2.3.3` требует `>=0.25.0 <=0.25.8`

---

## 6. Тестовые пользователи

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
| GET | `/listings/:id` | Карточка объявления (телефон маскируется при `freeShowOwnerPhoneMode=after_payment`) |
| GET | `/regions` | Регионы |
| GET | `/categories` | Категории |
| GET | `/settings` | Публичные настройки платформы |
| GET | `/notifications` | Уведомления |
| PATCH | `/notifications/:id/read` | Прочитать уведомление |
| POST | `/notifications/read-all` | Прочитать все |
| GET | `/bookings/:id/messages` | Чат бронирования |
| POST | `/bookings/:id/messages` | Отправить `{ content }` |
| GET | `/messages/unread-counts` | Непрочитанные `{ [bookingId]: count }` |
| POST | `/support/tickets` | Создать тикет |
| GET | `/support/tickets` | Мои тикеты |
| POST | `/reports` | Жалоба |
| PUT | `/bookings/:id/status` | Смена статуса бронирования |
| POST | `/contacts/unlock` | Купить доступ к контактам владельца Free-объявления |
| POST | `/telegram/generate-otp` | Генерировать 6-значный OTP для привязки к боту (TTL 10 мин) |
| GET | `/telegram/status` | `{linked, hasOtp, otpExpiresAt, preferences}` |
| POST | `/telegram/unlink` | Отвязать Telegram (идемпотентно) |
| PATCH | `/telegram/preferences` | `{bookings?, system?, chats?: boolean}` |
| GET | `/admin/telegram/status` | Статус бота: `{online, username, env, hasToken}` (superadmin) |
| POST | `/admin/telegram/broadcast` | Рассылка `{text, link?, role?}` всем или по роли (superadmin) |

### Авторизация:
```javascript
Authorization: Bearer <token>
// или cookie: token=<token>
```

### Статусы бронирований:
- `pending` → `confirmed` / `rejected` (owner)
- `confirmed` → `active` (owner)
- `active` → `return_pending` (owner)
- `return_pending` → `completed` (owner)
- `pending` / `confirmed` → `cancelled` (renter)

---

## 8. Экономика платформы (Модель А — актуально на 23.04.2026)

### Два тарифа объявлений

| Параметр | Premium (`ownerProtectionEnabled=true`) | Free (`ownerProtectionEnabled=false`) |
|---|---|---|
| Создание | Бесплатно | Бесплатно, лимит `freeListingsMaxPerOwner` активных |
| Условие создания | — | Требует телефон в профиле (если `freeListingsRequirePhone=true`) |
| Кто может создать | Все | Если `freeListingsEnabled=true` |
| Арендатор платит | `rent + renterFundContrib` | `contactPriceSingle` ₽ за доступ к контактам |
| Телефон владельца | Не нужен, всё через платформу | Скрыт пока не куплен доступ (`freeShowOwnerPhoneMode=after_payment`) |

### Формула Гарантийного фонда (Модель А: один фонд, два независимых опт-ина)

```
fundShare = max(rent × shieldFeePercent%, shieldFeeMin)

ownerFundContrib  = ownerOptedIn  ? fundShare : 0
renterFundContrib = renterOptedIn ? fundShare : 0

// Premium-сделка:
total       = rent + renterFundContrib
ownerPayout = rent - serviceFee - taxFee - ownerFundContrib

// Variant 3 (Free + арендатор апгрейдит защиту):
isFreeUpgrade = !ownerOptedIn && renterOptedIn
total         = rent + serviceFee + taxFee + renterFundContrib   // арендатор платит за всё
ownerPayout   = rent                                              // владелец получает 100%
```

### Маппинг полей в БД (`bookings`):
| Поле | Значение |
|------|----------|
| `fundContribution` | `ownerFundContrib` — взнос ВЛАДЕЛЬЦА в фонд |
| `renterFundContribution` | `renterFundContrib` — взнос АРЕНДАТОРА в фонд |
| `serviceFee` | Сервисная комиссия |
| `taxFee` | Налоговая компенсация |
| `ownerPayout` | Итоговая выплата владельцу |
| `totalPrice` | Сумма к оплате арендатором (без залога) |

### `platform_settings` — что реально работает и что нет:

#### ✅ Настройки, подключённые к логике бэкенда:
| Поле | Где используется |
|------|-----------------|
| `serviceFeePercent` | `bookings.ts` — комиссия из аренды |
| `taxFeePercent` | `bookings.ts` — налог |
| `shieldFeePercent` / `shieldFeeMin` | `bookings.ts` — доля фонда обеих сторон |
| `riskCoveragePercent` / `riskCoverageMin` | Автоматически зеркалятся из `shieldFee*` при сохранении в `admin.ts` (legacy-совместимость) |
| `depositMultiplier` / `depositMin` | `bookings.ts` — автозалог |
| `protMultElectronics/Tools/Leisure/SpecialMachinery` | `listings.ts` — лимит фонда по категории |
| `newUserProtectionCap` / `newUserDealsThreshold` | `listings.ts` — лимит для новых пользователей |
| `freeListingsEnabled` | `listings.ts` POST — блокирует создание Free если `false` |
| `freeListingsMaxPerOwner` | `listings.ts` POST — считает активные Free объявления владельца |
| `freeListingsRequirePhone` | `listings.ts` POST — проверяет наличие телефона в профиле |
| `freeShowOwnerPhoneMode` | `listings.ts` GET /:id — маскирует `ownerPhone: null` если `after_payment` |
| `freeToPremiumUpgradeEnabled` | `bookings.ts` — блокирует апгрейд Free→Premium если `false` |
| `defaultCatalogSort` | `listings.ts` GET / — дефолтная сортировка каталога |
| `contactPriceSingle` / `contactPricePack10` / `contactPriceUnlimited30d` | `contacts.ts` — цены |
| `freeContactsBonus` | `contacts.ts` — welcome-бонус при регистрации |
| `contactLifetimeDays` | `contacts.ts` — срок жизни купленного контакта |

#### ⚙️ Сортировки каталога (`?sort=`):
| Значение | Описание |
|----------|----------|
| `new` | По дате создания DESC (дефолт если не задано `defaultCatalogSort`) |
| `protected_first` | Premium-объявления сверху, потом Free; внутри — по дате |
| `price_asc` / `price_desc` | По цене |
| `rating` | По среднему рейтингу (JS-сортировка) |
| `popular` | По количеству бронирований (JS-сортировка) |

#### ❌ Настройки в UI, которые пока не подключены к логике:
| Поле | Статус |
|------|--------|
| `vipPrice*` / `urgentPrice*` / `boostPrice*` | Система продвижения не реализована |
| `subscriptionProMonthly` / `subscriptionBusinessMonthly` | Подписки не реализованы |
| `subscriptionBusinessCommissionPercent` | Не применяется |
| `jointPurchaseFeePercent` | Совместные покупки не реализованы |
| `minPremiumShareInResults` | Требует сложной логики пагинации |
| `showFormatBadges` | Бейджи всегда показываются |
| `contactPackRefundEnabled` / `contactPackRefundWindowDays` | Только передаются в UI, логики возврата нет |
| `yookassaEnabled` / `sbpEnabled` / `cloudpaymentsEnabled` | Платёжная интеграция не реализована |

---

## 9. Бренд и дизайн

| Токен | Значение |
|-------|----------|
| Primary | `#C65D3B` (терракота) |
| Background | `#F2EEE3` (тёплый крем) |
| Accent | `#4A8587` (бирюза) |
| Text | `#2B2B2B` |
| Заголовки | Montserrat |
| Текст | Inter |

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

# 7. Пуш на GitHub (из Shell)
GITHUB_TOKEN=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 bash scripts/github-push.sh "Stage X: описание"
```

---

## 11. Дорожная карта (актуально на 02.05.2026 — Stage 38 закрыт, Stage 24 заморожен до открытия ИП)

### Сводка стадий 29–38 (02.05.2026)

| Stage | Дата | Название | Статус |
|-------|------|----------|--------|
| 29 | 29.04 | Trust Score Engine V6 | ✅ 13 сигналов, decay 180 дней, score_components JSONB |
| 30D-G | 28.04 | AI Provider Hardening | ✅ Gemini primary, Amvera/DeepSeek fallback, LLaMA stub |
| 30H | 29.04 | Amvera pivot llama → DeepSeek-V3 | ✅ Endpoint + response shape fix |
| 30J | 29.04 | Gemini model name regression fix | ✅ `gemini-flash-latest` alias |
| 32 | 29.04 | Documentation & Roadmap Sync | ✅ AGENT_INSTRUCTIONS update |
| 32-debug | 29.04 | Smoke-pass + Cookie Fix | ✅ auth cookie samesite |
| 32.1 | 02.05 | Trust Score V8 — публичный рейтинг | ✅ `GET /api/users/:id/trust-score` public |
| 33.0 | 30.04 | AI Redundancy + UI Polish | ✅ 3rd provider DeepSeek direct; AI retry/fallback |
| 33.1 | 30.04 | UI & Logic Polish — GPS, Gender, Cache | ✅ GPS авто-регион, кэш TrustScore 60с |
| 33.1.5 | 02.05 | Safe Technical Debt Polish | ✅ типы, eslint, cleanup |
| Prod-Fix-1 | 02.05 | sharp в prod-зависимостях | ✅ sharp → dependencies (не devDependencies) |
| 33.1 AI | 02.05 | AI Arbitration Hardening | ✅ Vision analysis → Gemini stable alias |
| 34 | 02.05 | Real-time WebSockets | ✅ ws chat + notifications, `/ws` endpoint |
| 35 | 02.05 | Mobile Responsiveness Polish | ✅ breakpoints, touch targets, burger меню |
| 35b | 02.05 | Soft Delete Account | ✅ `DELETE /api/users/me`, анонимизация, 30с confirm |
| 36 | 02.05 | RBAC — Role-Based Access Control | ✅ 8 ролей, `requireRole()` middleware, staff pages |
| 37 | 02.05 | Staff Profiles & UI Polish | ✅ staff UI, role badges, ownerRole в listings |
| 37.1 | 02.05 | Platform Owner → superadmin by default | ✅ seedDefaultAdmin идемпотентно повышает до superadmin |
| 38 | 02.05 | Telegram Bot & Notification Engine | ✅ `@Helper251223_bot`, OTP, prefs, hot-swap, broadcast |

**Следующие кандидаты для Stage 39+:**
- Stage 21b — контакты через ЮKassa (при `commercial=true`)
- Stage 21c — холд брони через ЮKassa (capture при завершении)
- Подписки владельцев (Pro/Бизнес) — таблица + роуты + UI
- Joint Purchases — полноценная коллективная механика (паи, эскроу, закрытие)
- WebSocket fallback / SSE для pool Timeline
- Авто-cancel buyout-запросов после N дней без активности

---

### Stage 28 (27.04.2026) — Co-Sharing Full Buyout: полный выкуп пула одним совладельцем

**Зачем.** Финальная точка жизненного цикла пула — выход «жизни без бывших»: один из совладельцев готов забрать вещь себе целиком, выплатив остальным справедливую сумму. До Stage 28 это было невозможно технически: secondary marketplace (Stage 25) позволял торговать долями только по одной, и не было механики «купить всё разом → ликвидировать пул → передать listing в личное владение».

**Архитектурное решение.** Создан **общий buyout-flow** (`routes/buyouts.ts`, ~620 строк) поверх двух новых таблиц `buyout_requests` + `buyout_participants`. Принципиально:
- Один pending-запрос на пул в каждый момент времени (partial unique index на `(pool_id) WHERE status='pending'` — защита от race conditions).
- Каждой не-инициаторной доле соответствует ровно одна строка `buyout_participants` со снимком (sharePercentage, shareAmountRub, priceRub).
- Расчёт payout = `share.amountRub × residualRatio`, где `residualRatio` — то же зеркало формулы Stage 26-B suggested-price (`max(0.1, 1 − meter × depPct/100)`).
- **Атомарный confirm** в `db.transaction`: TOCTOU-update участника → загрузка живой доли → merge `sharePercentage += participant.sharePercentage, amountRub += participant.amountRub` у инициатора → DELETE доли участника → если инициатор достиг 100% (с запасом 99.99 для DECIMAL-погрешности) → `pool.status='liquidated'`, `listing.pool_id=NULL`, `listing.custodian_id=initiator`, `buyout_request.status='completed'`.
- Audit + notify — **post-commit, best-effort** (та же модель что в Stage 25/27 confirm-transfer): `void recordAuditEvent` + try/catch вокруг `createNotification`.

**Backend (5 endpoints):**

1. `POST /api/pools/:poolId/buyout` (auth, инициатор) — pre-checks: я владелец доли, ≥1 другой совладелец, нет активного pending-запроса; расчёт payout per participant; tx-вставка request + participants; audit `buyout_requested`; notify всех участников (`pool_buyout_requested`).
2. `GET /api/pools/:poolId/buyout` (public) — возвращает последний по `createdAt` запрос (любой статус) + всех участников с join `users.name`. UI используется и для активных, и для completed-плашки.
3. `POST /api/buyouts/:id/participants/:pid/mark-transferred` (auth, инициатор) — атомарный TOCTOU `pending_approval → user_transferred`; audit `buyout_transferred`; notify участника (`pool_buyout_transferred`: «X перевёл вам Y₽»).
4. `POST /api/buyouts/:id/participants/:pid/confirm` (auth, участник) — основная атомарная транзакция (см. выше); audit `buyout_confirmed` + (при ликвидации) `pool_liquidated`; notify инициатору (`pool_buyout_confirmed`) + всем остальным (`pool_buyout_completed`).
5. `POST /api/buyouts/:id/cancel` (auth, инициатор) — запрещено если хоть один participant уже `confirmed` (защита от частичного отката после merge); статус → `canceled`; notify всех (`pool_buyout_canceled`).

**Состояние «Step A: Согласиться» — UI-only.** Enum `buyout_participant_status` имеет ровно 3 значения, и каждое означает фактическое состояние сделки. «Согласие» участника — это локальный React-state (`acceptedParticipants: Set<number>`), управляющий показом СБП-реквизитов инициатора. БД-статус не меняется, потому что согласие без действия (перевода) не имеет юридического веса. Это сознательное упрощение: участник может «согласиться», увидеть реквизиты — но если инициатор не переведёт деньги, участник никогда не нажмёт «Деньги получил», и сделка истечёт через `cancel`.

**Уведомления** — расширен `NotifType` 5 типами: `pool_buyout_requested`, `pool_buyout_transferred`, `pool_buyout_confirmed`, `pool_buyout_canceled`, `pool_buyout_completed`. Все обёрнуты в try/catch — падение notify не валит транзакцию.

**Frontend** (`PoolDetail.tsx` — компонент `BuyoutBlock` ~330 строк):
- Размещён между `MarketplaceBlock` и `SharesList`.
- Polling `refetchInterval: 15_000` (быстрее чем TimelineBlock — критичные для UX переходы статусов).
- Если пул `liquidated` + completed-запрос → показывает финальную плашку «X — единственный владелец».
- Если нет pending-запроса И есть `canInitiateBuyout` → две стадии: «Выкупить весь пул» → confirm-плашка → POST.
- Если есть pending-запрос:
  - **Инициатор** видит список участников (`BuyoutInitiatorRow`): статус каждого + кнопка «Я перевёл деньги» для `pending_approval` + ссылка «Отменить запрос» (нативный `confirm()` пока, AlertDialog — followup).
  - **Участник** видит свою карточку (`BuyoutParticipantCard`): сначала «Согласиться» → раскрывается СБП-блок инициатора → ждёт `user_transferred` → кнопка «Деньги получил» → атомарный merge + ликвидация.
  - **Сторонний** (админ/наблюдатель) видит read-only список.

**API client** (`api-pools.ts`): новые типы `BuyoutRequest`, `BuyoutParticipant`, `BuyoutDetailResponse`, `CreateBuyoutResponse` + 5 функций (`getPoolBuyout`, `createPoolBuyout`, `markBuyoutTransferred`, `confirmBuyoutParticipant`, `cancelBuyout`).

**E2E smoke test (PASS):** Иван (60%) + Пётр (40%) → Иван POST buyout → Пётр получает priceRub=40000 (residual=1.0, нет listing) → проверка permissions: Пётр пробует confirm без mark → 409, Пётр пробует mark → 403, Иван mark → OK, Иван повторно mark → 409 invalid_transition, Иван пробует confirm → 403, Пётр confirm → атомарный merge: Иван 100%/100000₽, Пётр доля удалена, pool=liquidated, request=completed, participant=confirmed. Все 5 ожидаемых статусов в БД корректны.

**Что НЕ сделано (Stage 28 followup):**
- Замена нативного `confirm()` на shadcn `AlertDialog`.
- Эскроу-модель для buyout (Stage 24 — commercial mode): вместо СБП p2p — холд в ЮKassa, авто-релиз при ликвидации.
- Поддержка частичного выкупа (например, Иван покупает только долю Петра, оставляя Дмитрия) — сейчас ставка «всё или ничего».
- Авто-cancel запросов после N дней без активности (cron).
- UI-сценарий «participant отказывается»: сейчас отказ = просто игнор, инициатор должен сам отменить. Можно добавить явную кнопку «Отказаться» с уведомлением инициатору.
- Гендерное склонение в нотификациях.



### Stage 27 (25.04.2026) — Co-Sharing Transparency: Notifications + Audit Log

**Зачем.** Закрытие технического долга Stage 25. P2P-режим работает на доверии (СБП-переводы), но без уведомлений участники узнавали о действиях друг друга только при обновлении страницы — это ломает доверие. Stage 27 даёт реактивную прозрачность: push-уведомления + публичную хронологию.

**Архитектурное решение по audit storage.** Промт изначально требовал использовать только существующие таблицы. Но `booking_events.booking_id` — NOT NULL FK (не подходит для пулов), `admin_audit_log.admin_id` — NOT NULL и admin-only. Создана **новая универсальная** таблица `audit_events` (`entity_type`, `entity_id`, `actor_id` nullable, `event_type`, `metadata jsonb`) — обобщение паттерна `booking_events`, рассчитанное на любые будущие сущности (offers, payouts, claims). НЕТ FK на entity_id — события переживают удаление сущности.

**Backend** (`artifacts/api-server/src/lib/audit-events.ts` + `routes/pools.ts`):
- Helper `recordAuditEvent({entityType, entityId, actorId, eventType, metadata})` — никогда не бросает наружу (try/catch внутри). Вызывается через `void` после `res.json()` — аудит не блокирует ответ клиенту.
- 8 event types: `pool_created`, `share_contributed`, `share_confirmed`, `pool_purchasing` (system, actor=NULL), `offer_created`, `offer_reserved`, `share_transferred`, `offer_canceled`.
- Новый endpoint `GET /api/pools/:id/events` (public, без auth) — возвращает события в `ASC createdAt`-порядке с join `users` для actorName/actorAvatar.

**Push-уведомления** — расширен `NotifType` в `lib/notifications.ts` 4 типами:
- `pool_share_received_funds` → creator: «X перевёл средства за долю».
- `pool_purchasing` → ВСЕМ участникам + creator: «Сбор завершён, начало закупки».
- `pool_offer_reserved` → seller: «X хочет выкупить вашу долю».
- `pool_share_received` → buyer: «Доля перешла к вам!».

Все вызовы `createNotification` обёрнуты в свой try/catch — падение нотификации не должно ломать основной поток.

**Frontend** (`PoolDetail.tsx` — компонент `TimelineBlock`):
- Блок «История событий» в самом низу карточки пула. Иконка + 1 строка человекочитаемого описания + локальное время.
- Polling `refetchInterval: 30_000` (без WS на этапе беты).
- Empty state, loading state, error state.
- `describeEvent()` — switch по `eventType`, форматирование metadata (priceRub, sharePercentage, mergeMode, ownerId).

**API client** (`api-pools.ts`):
- Новый тип `PoolEvent` + функция `listPoolEvents(poolId)`.

**Smoke E2E (PASS):**
- Полный сценарий 8 действий между alexey/maria/dmitry: create → contribute×2 → confirm×2 (→pool_purchasing) → offer_created → buy → confirm-transfer (merge).
- Результат: 9 событий в `audit_events` (включая system-event с actor_id=NULL), 7 push'ей в правильных адресатах.

**Что НЕ сделано (Stage 27 followup):**
- WebSocket/SSE вместо polling.
- Унификация: перенести `bookings/claims` audit на `audit_events` (миграция-разовая).
- GC «осиротевших» событий после удаления пула (нет FK по дизайну, но нужен либо триггер, либо периодический cleanup).
- Гендерное склонение в текстах нотификаций («перевёл/перевела»).
- Stage 28 (Buyout) — следующий логический шаг: автоматический выкуп всей вещи одним из совладельцев с расчётом остаточной стоимости и автогенерацией офферов остальным.



### Stage 26-B (27.04.2026) — Co-Sharing Final Polish: справедливая цена + фонд обслуживания + цифровая передача

**Зачем.** Закрытие практических болей P2P-режима, выявленных после Stage 25/26: продавец доли не понимает, какую цену поставить (риск занижения/завышения); фонд обслуживания пула пуст и нечем покрывать ремонт; передача физической вещи между совладельцами происходила «на словах» без юридического следа.

**Backend:**

1. **Suggested price** (`routes/pools.ts:1196` — `GET /api/pools/:id/shares/:shareId/suggested-price`):
   - Расчёт справедливой цены доли с учётом износа (`wear_and_tear` из Stage 26): `marketValue × (1 - wearPct) × sharePercentage`.
   - Возвращает `{ suggestedPriceRub, breakdown: { marketValue, wearPct, sharePct, residualValue } }`.
   - Используется фронтом для автозаполнения поля цены в форме создания offer'а.

2. **Maintenance fund accrual** (`routes/bookings.ts:678,756` — внутри `completed`-перехода):
   - При завершении аренды совладельцем платформа списывает `serviceFee` и зачисляет его в `pools.maintenance_fund_balance` соответствующего пула (атомарно, в той же транзакции что и обновление статуса).
   - Audit-event `fund_accrued` с metadata `{ amountRub, bookingId }` — для прозрачной хронологии в TimelineBlock.

3. **Pool handover (цифровой акт передачи)** (`routes/digital_acts.ts:428,562,636`):
   - Новый `type='pool_handover'` в digital_acts. Поток: текущий хранитель создаёт акт с фото/подписью/GPS → получатель подтверждает → атомарно меняется `listings.custodian_id`.
   - Audit-event `custodian_changed` с metadata `{ fromUserId, toUserId, actId }`.
   - В `PoolDetail.tsx` добавлены UI-кнопки «Передать вещь» (для текущего хранителя) и «Принять вещь» (для получателя), плюс отображение текущего custodian'а.

**Frontend** (`PoolDetail.tsx`):
- Suggested price: интегрирован прямо в форму offer'а через `useQuery(["suggested-price", poolId, shareId])` (строка 877) — отдельного `SellShareModal.tsx` НЕ создавалось, всё внутри страницы пула. API-хелпер в `lib/api-pools.ts:231`.
- Pool handover UI: блок «Хранитель сейчас: …» (строка 605) + DigitalActWizard с `type="pool_handover"` (строка 631) + force-refresh пула после смены custodian'а.

**Smoke-проверка (27.04.2026):**
- API Server: `Server listening port 8080`, все маршруты резолвятся.
- `/api/admin/stats/extended` → HTTP 200, `/api/pools` → HTTP 200.
- Prod-сборка фронта: 3659 модулей, 1.76 MB JS, без ошибок.

**Что НЕ сделано (followup для Stage 26-B):**
- Авто-предложение справедливой цены при создании offer'а (сейчас юзер видит цифру, но должен сам её скопировать).
- Расход `maintenance_fund_balance` (приход есть, расход — отдельная фича: ремонт/выплаты совладельцам).
- Pool handover: загрузка фото/подписи в S3 (сейчас храним в `digital_acts.media_urls` как заглушка).



### Stage 25 (25.04.2026) — Вторичный рынок долей (P2P beta)

**Зачем.** Превращаем платформу в мини-биржу: совладельцы могут продавать свои доли. На beta-этапе деньги переводятся напрямую через СБП (платформа = реестр прав); commercial-режим (Stage 24) добавит эскроу через ЮKassa и платформенную комиссию.

**БД** (`lib/db/src/schema/co_sharing.ts`). В `share_offers` добавлены 3 nullable-поля:
- `buyer_id integer FK→users` — кто зарезервировал оффер. NULL = свободно.
- `reserved_at timestamp` — момент резервации. Используется TTL'ом в `/buy` (30 минут — старше = можно перехватить, без cron).
- `seller_payment_details text` — СБП-реквизиты продавца, показываются buyer'у после `/buy`.

Жизненный цикл оффера: `open + buyer_id=NULL` → `open + buyer_id=X (reserved)` → `sold` (атомарный merge) | `canceled`. Existing-enum `[open, sold, canceled]` без расширения.

**Backend** (`artifacts/api-server/src/routes/pools.ts`) — 5 новых endpoints:
1. `POST /api/pools/:id/shares/:shareId/offers` (auth) — create. Валидация: ownership, `paymentStatus ∈ {creator_confirmed, escrow_held}` (нельзя продать неоплаченную долю — иначе можно «продать» фейк), нет другого открытого оффера на эту долю. Zod: `priceRub > 0`, `sellerPaymentDetails ≥ 3 символов`.
2. `GET /api/pools/:id/offers` — list открытых. JOIN `pool_shares` (sharePercentage, amountRub) + `users` (sellerName, sellerAvatar).
3. `POST /api/pools/:id/offers/:offerId/buy` (auth) — резервация. **TOCTOU + TTL:** `UPDATE … WHERE status='open' AND (buyer_id IS NULL OR reserved_at < NOW() - 30 minutes) RETURNING`. При параллельных «Купить» победит ровно один. Self-check: `cannot_buy_own_offer`. После 30 минут «протухший» резерв перехватывается следующим buyer'ом — без необходимости в cron-задаче.
4. `POST /api/pools/:id/offers/:offerId/confirm-transfer` (auth, только seller) — **АТОМАРНАЯ ПЕРЕДАЧА ВЛАДЕНИЯ**. Внутри `db.transaction`:
   - TOCTOU `UPDATE share_offers SET status='sold' WHERE id=? AND status='open' AND seller_id=?` — защита от двойного confirm.
   - SELECT свежей доли продавца внутри tx; повторная проверка `seller_id == userId` (защита от race с предыдущим merge).
   - **Merge logic:** если у buyer уже есть `pool_shares` запись для этого `pool_id` (UNIQUE(pool_id, user_id)) → `UPDATE buyer.share SET sharePercentage += seller.percentage, amountRub += seller.amount` + `DELETE seller.share`. Иначе → `UPDATE seller.share SET user_id = buyer_id` (transfer ownership).
   - Сложение процентов на стороне SQL через `sql\`${sharePercentage} + ${seller.sharePercentage}\`` — DECIMAL(5,2) точность сохраняется, CHECK (>0 AND <=100) валидирует.
   - Возвращает `{ offer, share, mergeMode: "merge" | "transfer" }`.
5. `POST /api/pools/:id/offers/:offerId/cancel` (auth, только seller) — отмена с TOCTOU guard (`WHERE status='open'`), сбрасывает `buyer_id` и `reserved_at`.

`GET /api/pools/:id` теперь дополнительно отдаёт `offers[]` (открытые с join'ами) — фронт за один запрос рендерит и доли, и рынок.

**Ошибки в транзакции** возвращаются через `Object.assign(new Error, { httpStatus, httpBody })` — после rollback'а внешний catch вытаскивает `httpStatus/httpBody` и отвечает корректным кодом.

**Frontend** (`artifacts/hochu-to/src/lib/api-pools.ts`). Новые типы (`ShareOfferDetail`, `ShareOfferStatus`, `BuyOfferResponse`, `ConfirmTransferResponse`) и функции: `createShareOffer`, `listOffers`, `buyShareOffer`, `confirmShareTransfer`, `cancelShareOffer`.

**Frontend** (`artifacts/hochu-to/src/pages/PoolDetail.tsx`):
- В `SharesList` для своей оплаченной доли (без открытого оффера) — кнопка «Продать» (icon `Tag`). Если оффер уже стоит — бейдж «На продаже».
- Новый `MarketplaceBlock` (между ResidualValueBlock и SharesList): список открытых офферов с `OfferRow`. Для buyer'а — кнопка «Купить»; для seller'а — `SellerOfferActions` (cancel + если зарезервировано «Подтвердить получение и передать долю»); для buyer'а который уже зарезервировал — текст «Переведите по СБП и ждите подтверждения».
- `SellShareModal`: расчёт справедливой цены = `calculateResidualValue(targetAmount, listing.wearAndTearMeter, depPercent) × sharePercentage / 100`. Блок-tip с residual + износ %, инпут цены с кнопкой «Сбросить к справедливой», инпут СБП-реквизитов, чек-бокс согласия.
- `BuyOfferModal`: двухфазный (зарезервировать → показать СБП-реквизиты с copy-button + инструкции).

**Smoke E2E на pool#15 (30000₽, 2 совладельца maria + dmitry):**
- Validation: создание (201), дубль (409 `offer_already_open`), чужая доля (403 `not_share_owner`), пустые реквизиты (400 zod).
- TOCTOU race: 5 параллельных POST `/buy` от alexey → ровно 1×200 + 4×409 `offer_unavailable`.
- Self-check: maria → 403 `cannot_buy_own_offer`.
- **Transfer-mode** (alexey не имел доли): maria → alexey, share#13 user_id 14→13, `mergeMode='transfer'`. Дубль confirm → 409 `offer_not_open`.
- **Merge-mode** (у alexey уже 50% после A): dmitry продаёт → alexey. Result: share#13 sharePercentage 50→100, amountRub 15000→30000, share#14 удалена. **Целостность:** `SUM(sharePercentage)=100.00`, `SUM(amount)=30000` ✓.
- Cancel-flow: create + 403 чужой cancel + 200 свой cancel + 409 повтор.
- Negative auth: confirm-transfer от не-seller → 403 `only_seller_can_confirm`.

**Code review (architect): PASS.** SEVERE-замечание (TTL на резерв) закрыто сразу — атомарным SQL-условием в `/buy`, без cron.

**Что НЕ сделано (Stage 25 followup, future):**
- Уведомления (`createNotification` для seller/buyer о ключевых событиях).
- Аудит-лог (`recordEvent`) для history/forensics.
- Серверное зеркало `calculateResidualValue` (когда понадобится для API-расчётов).
- Авто-переоценка существующих офферов при изменении wearAndTearMeter (сейчас цена «замораживается» при создании).
- Комиссия платформы при продаже + эскроу — Stage 24 (commercial mode).
- UI: замена нативного `confirm()` на shadcn `AlertDialog` в confirmShareTransfer.

### Stage 26 (25.04.2026) — Wear and Tear (амортизация физических активов)

**Зачем.** Подготовка к вторичному рынку долей (Stage 25). Без счётчика износа продажа доли в б/у-вещи шла бы по цене новой → крах экономики.

**БД:** в `platform_settings` добавлено `depreciationPerRentalPercent: integer default 1` (% падения оценочной стоимости за одну успешно завершённую аренду; 100 аренд = floor 10%). Поле `listings.wear_and_tear_meter` с Stage 23a используется как счётчик аренд.

**Backend.** `PUT /api/bookings/:id` при переходе в `completed` инкрементирует `listings.wear_and_tear_meter` на +1 (внутри существующего `Promise.all`). Cancel/reject не доходят до этого блока. `GET /api/pools/:id` возвращает связанный `listing: { id, wearAndTearMeter, pricePerDay, isAvailable, custodianId } | null`. `depreciationPerRentalPercent` экспортируется в `/api/settings`.

**Frontend.** `lib/pricing.ts` — `calculateResidualValue(initialPrice, meter, pct)` с floor 10% и safeguards для `initialPrice <= 0`. `PoolDetail.tsx` — фиолетовый блок «Оценочная стоимость сейчас» (residual + бейдж `N аренд · износ X%` с tooltip). `AdminPage.tsx` — поле «Износ за одну завершённую аренду (%)» в блоке «Совместные покупки».

**Smoke.** alexey бронирует listing#43 (owner=dmitry) → completed → meter 0→1 ✓. Формула 30000₽: 0 аренд → 30000; 50 → 15000; 200 → 3000 (floor) ✓.

### Stage 23c (24.04.2026) — закрыт

### Stage 22b-followup (25.04.2026) — закрыт бэклог Stage 22b

**Видео-аплоад в Цифровых Актах.** Отдельный endpoint `POST /api/upload-video` (multer, 100МБ, mime allowlist mp4/webm/quicktime; расширение нормализуется по mime, чтобы фронт всегда мог проиграть `<video>`). Файлы хранятся в `UPLOADS_DIR`, отдаются через ту же статику что и фото. Multer-ошибки обёрнуты — возвращают JSON 400, а не HTML stack trace.

В `routes/digital_acts.ts` валидация `videoUrl`: либо внутренний путь `/^\/uploads\/[A-Za-z0-9._-]+\.(mp4|webm|mov|m4v)$/i`, либо абсолютный URL (`new URL(...)` + протокол http(s)). Иначе 400 `invalid_video_url`. Это защищает от data:URI, javascript:URI, path-traversal `/uploads/../etc/passwd` и подмены расширения (`.exe`).

В Zod-схеме `insertDigitalActSchema` ослаблено `videoUrl: z.string().url()` → `z.string().min(1)` — финальная валидация форматов на уровне роута.

Фронт `DigitalActUpload.tsx`: после поля «ссылка» добавлен разделитель «или» и кнопка «Загрузить видео-файл». При успехе — компактный превью-плеер `<video controls>` с кнопкой «Удалить». Лимит размера зеркалит бэкенд (100МБ).

**Авто-предложение акта за 24 часа.** В `scheduler.ts` добавлены типы `reminder_checkin_soon` и `reminder_checkout_soon` (внесены в `REMINDER_TYPES` и `NotifType`). Новая «Query 3b» один раз за тик подгружает из `digital_acts` пары `(bookingId, type)` и собирает Set-ы `hasCheckIn` / `hasCheckOut`, чтобы дедупликация была zero-per-booking-queries и пережила тысячи активных броней без деградации.

Логика срабатывания (между rule 2 и rule 4 в `runReminders`):
- `confirmed` + `startDate === tomorrow` + `!hasCheckIn` → `reminder_checkin_soon` обеим сторонам;
- `active` + `endDate === tomorrow` + `!hasCheckOut` → `reminder_checkout_soon` обеим сторонам.

Дедупликация через тот же Set `${bookingId}:${type}:${userId}` — повторный тик ровно через 24+ часа не дублирует, и появление акта в БД полностью гасит дальнейшие напоминания этого типа.

**Smoke-тесты Stage 22b-followup (15/15 PASS):**
1. POST `/api/upload-video` без файла → 400 `no_file`
2. POST `/api/upload-video` с jpeg → 400 `invalid_file` («Только MP4 / WebM / MOV») + JSON, не HTML
3. POST `/api/upload-video` с tiny.mp4 → 200 `{url:"/uploads/<uuid>.mp4"}`
4. Файл реально создан в `artifacts/api-server/uploads/`
5. Статика отдаёт его как `video/mp4`
6. POST `/api/upload-video` без auth → 401
7. POST `/api/upload` (фото) — 4 PNG-файла валидны
8. POST `/api/bookings/17/digital-acts` с внутренним `videoUrl` → 201, акт создан
9. БД: `digital_acts.video_url = '/uploads/<uuid>.mp4'`
10. Дедупликация: рестарт API → существующий check_in акт гасит новые `reminder_checkin_soon` (count=2 до и после)
11. POST с `videoUrl="https://youtu.be/abc123"` → 201
12. POST с `videoUrl="data:video/mp4;base64,..."` → 400 `invalid_video_url`
13. POST с `videoUrl="/uploads/../etc/passwd"` → 400 `invalid_video_url` (regex отвергает `..`)
14. POST с `videoUrl="/uploads/foo.exe"` → 400 `invalid_video_url` (whitelist расширений)
15. POST с `videoUrl=null` → 201 (поле необязательное)

Дополнительно подтверждено: при создании тестовой брони `confirmed` со `start_date=tomorrow` без актов scheduler-тик при рестарте API создал ровно 2 уведомления `reminder_checkin_soon` (renter + owner) с правильным названием листинга.

## 11.bak. Дорожная карта (актуально на 25.04.2026 — Stage 22b)

### ✅ Готово
| Этап | Описание |
|------|----------|
| 1 | Free-тариф «🪧 Объявление — бесплатно» |
| 2 | Все настройки монетизации в админке (`platform_settings`) |
| 3 | Каталог: бейджи Free/Premium + фильтр `safeOnly` |
| 4 | Платные контакты — БД + API (`contact_balances`, `contact_unlocks`) |
| 5 | Платные контакты — UI (`ContactPurchaseModal`, вкладка «Баланс контактов») |
| 6 | Апгрейд Free → Premium в брони + аудит `renter_upgraded_to_protection` |
| 🐛 | Хотфиксы 23.04 утро: audit_log, header, бронирование Direct Contact, отображение ошибок |
| 7 | **Экономика Модель А**: один Гарантийный фонд, два независимых опт-ина (владелец + арендатор) |
| 7a | Variant 3 (Free Upgrade): арендатор платит service+tax+fund, владелец получает 100% rent |
| 7b | UI чекбокс «Защитить через Гарантийный фонд» для арендатора в `ListingDetail` |
| 7c | Фикс хардкода `150 ₽` → динамический `contactPriceSingle` в 3 местах `ListingDetail` |
| 7d | Пересчёт reschedule по Модели А (раньше игнорировал ownerFundContrib, Variant 3) |
| 7e | Унификация полей фонда в админке: одна секция «Гарантийный фонд (Модель А)» |
| 7f | Зеркалирование `shieldFee* ↔ riskCoverage*` в `admin.ts` при сохранении |
| 7g | **Подключение «фантомных» настроек** к реальной логике бэкенда |
| 7g-1 | `calcMaxProtection` в `listings.ts` — убраны хардкоды, читает `protMult*` и `newUser*` из настроек |
| 7g-2 | `freeListingsEnabled/MaxPerOwner/RequirePhone` — проверяются при создании Free-объявления |
| 7g-3 | `freeShowOwnerPhoneMode` — маскирует телефон в GET `/listings/:id` при `after_payment` |
| 7g-4 | `freeToPremiumUpgradeEnabled` — блокирует апгрейд Free→Premium если выключено |
| 7g-5 | `defaultCatalogSort` — используется как дефолт в GET `/listings` |
| 7g-6 | Добавлен кейс `protected_first` в сортировку каталога |
| 7g-7 | `ListingForm.tsx` — обработка ошибок `free_disabled/free_limit_reached/phone_required` |
| 8 | Расширенная аналитика админки (`/api/admin/stats/extended`, 4 блока, кэш 60с) |
| 9 | UX-полировка ListingDetail: цена-заголовок = `pricePerDay`, уменьшенное PC-фото, простой CTA на Free-карточке |
| 10 | **Bug fix:** OpenAPI `itemCategory` enum дополнен `special_machinery` — теперь синхронен на всех слоях (zod, серверные касты, клиент, БД-комментарий) |
| 11 | **UX-мотивация:** ListingDetail переписан с акцентом на выгоды (escrow / фонд / арбитраж) для обеих сторон, без пустых обещаний |
| 17a | **Payout Requests:** реквизиты карты/СБП, очередь заявок владельцев на вывод, ручной mark-paid с проставлением `payoutSettledAt` |
| 17b | **Compensation Payouts:** claims расширены реквизитами, админский поток approve→mark-paid→reject, кнопка «Подать претензию» в Dashboard |
| 17b-limits | **Анти-фрод фонда:** `fundReserveRatioPct/maxClaimAmountSingleRub/maxClaimsPerUserMonth/maxClaimAmountPerListingPct` + KPI-карточки |
| 17c | **Аналитика фонда:** `GET /api/claims/analytics`, lazy-блок с LineChart баланса, топ-получатели, флаги подозрительных паттернов |
| 17d | **E2E-отладка перед деплоем:** 67 сценариев за все роли, RBAC по 6 admin-эндпоинтам |
| seed | `POST /api/admin/seed-test-listings` — идемпотентная заливка 150 объявлений (15×10 категорий) с picsum-фото, пометка `[seed-test]` |
| 18 | **Платное продвижение:** `is_featured/featured_until/is_urgent/urgent_until/boosted_until` + `listing_promotions`, `/api/promotions/pricing\|listings/:id\|me\|admin`, продление поверх активного, бейджи VIP/Срочно/Топ, модалка `PromoteListingModal` |
| 19a | **Промо во всех каруселях:** `promoOrder = [VIP DESC, Срочно DESC, Boost DESC]` префикс во ВСЕ ветки сортировки + `promoTier()` для JS-сортировок `popular`/`rating` |
| 19b | **Бейдж «Часто берут» по броням:** `bookingCount >= 10 && rating < 4.5` вместо устаревшего `reviewCount >= 10` |
| 19d-quality | **Порог качества «Новинок»:** `?quality=true` → `array_length(photos)≥1` и `char_length(description)≥50` (только в карусели на главной) |
| 19e | **Денормализация счётчиков:** `bookingCount/reviewCount/avgRating/favoritesCount` колонки + idempotent backfill, убраны N+1 sub-queries; `popular`/`rating` теперь чистый SQL |
| 19c | **Гибридная метрика «Хитов» + просмотры:** `listing_views(viewer_key, hour_bucket)` UNIQUE, hit-score `bookingCount × 5 + reviewCount × 2 + favoritesCount + views_30d`. `GET /:id` теперь отдаёт все 5 счётчиков (фикс контракта) |
| 19f | **Бейджи и кнопка «Продвигать» на детальной карточке:** VIP/Срочно/Топ/«Часто берут» в обоих заголовках `/listings/:id`; кнопка «Продвигать объявление» в правом сайдбаре для владельца |
| 20a | **СБП + payout-реквизиты владельцев:** базовая поддержка СБП-перечислений в `payout_requests` |
| 20b | **Полировка СБП:** whitelist 25 банков, нормализация телефона `+7XXXXXXXXXX`, partial unique indexes от дублей реквизитов |
| 20c | **Поля ЮKassa в админке:** `yookassa_secret_key` в `platform_settings` + UI-блок настройки + защита от утечки секрета в публичные GET |
| 21a | **Soft Launch Toggle + YooKassa Core:** master-флаг `is_commercial_mode`, таблица `payments`, REST-клиент ЮKassa, webhook `/api/webhooks/yookassa`, BetaBanner, mock/real branching в promotions, soft-обнуление serviceFee/taxFee/fund для bookings/contacts при OFF. **Пост-review фиксы:** allowlist для master-toggle, listing_promotion создаётся только в webhook, выручка по `payments.succeeded`, детерм. Idempotence-Key, HMAC + timingSafeEqual + fail-closed, raw body, FOR UPDATE anti-replay |
| 21b | **Бета-дисклеймеры:** info-блок «Бета-режим» под «Итого к оплате» в `ListingDetail` (читает `publicSettings.isCommercialMode`); warning-баннер вверху `SubmitClaimModal` в `Dashboard` — компенсации в бета-режиме обрабатываются вручную |
| 22a | **Цифровой Акт — каркас:** таблица `digital_acts` (booking_id FK, type='check_in'/'check_out', photos jsonb≥4, video_url, metadata jsonb с EXIF/GPS, created_by_user_id), routes `GET/POST /api/bookings/:id/digital-acts`, **блокировка перехода `confirmed → active` без check_in акта (409 `digital_act_required`)**, фронтовый `DigitalActUpload.tsx` с EXIF через `exifr`, кнопки в карточках брони (confirmed/active для обеих сторон), 409-перехват в `handleStatusChange` с авто-открытием модалки; в админке `BookingOverrideModal` — сетка превью актов с GPS-маркерами для арбитража |
| 22a-hardening | **Hardening Цифрового Акта (25.04.2026):** `UNIQUE(booking_id, type)` в схеме (один акт каждого типа на бронь) + Postgres `23505 → HTTP 409 act_already_exists`, photo URL whitelist regex `/^\/uploads\/[A-Za-z0-9._-]+\.(jpe?g\|png\|webp\|heic\|heif)$/i` (блок внешних URL, `data:`-URI, path-traversal), фронтовый детект 409 через `ApiError.status` (а не парсинг сообщения). **E2E регрессия `/tmp/test-stage22a-v2.sh` — 31/31** на реальных юзерах из снапшота (3 owner + 3 renter + admin + stranger): RBAC всех ролей, форджи фото, дубликаты, happy-path, public-settings |
| 22b | **Карта арбитража + электронная подпись (25.04.2026):** новый `SignaturePad.tsx` (нативный HTML5 canvas + PointerEvents для мышь/палец/стилус, retina-aware через `devicePixelRatio`, метод `clear/isEmpty/toDataURL` через `useImperativeHandle`); новый `DigitalActMap.tsx` (компактная Leaflet-карта read-only, фирменный `#C65D3B` пин); подпись обязательна на стороне фронта (`disabled` кнопки «Сохранить акт») и бэка (`validateSignature()` — regex `/^data:image\/png;base64,[A-Za-z0-9+/=]+$/` + лимит 300КБ + PNG-magic-байты → 400 `signature_required`). Хранение в `metadata.signature` без миграции БД. Админский `DigitalActsBlock` отображает карту по первой GPS-точке из `metadata.photoExif` + PNG-подпись + бейджи 📍/✍️ |
| 23a-hardening | **Hardening Stage 23a (25.04.2026, по итогам код-ревью):** все FK через `references()` — RESTRICT на user-references (creator/user/seller), CASCADE на pool→shares→offers, SET NULL на listings.pool_id/custodian_id. 5 `pgEnum` для state-полей (`pool_status`, `pool_collection_method`, `pool_procurement_strategy`, `pool_share_payment_status`, `share_offer_status`) — БД отвергает мусорные значения. 7 CHECK constraints: `pools_target_amount_positive` (>0), `pool_shares_percent_range` (0..100, строго >0), amount/price `>= 0`, `listings_wear_meter_range` (0..10000 bp). `UNIQUE(pool_id, user_id)` блокирует «фантомные дубликаты» долей. Индексы: `pools(status, expires_at)`, `pool_shares(pool_id)`, `(user_id)`, `share_offers(share_id, status)`, `listings(pool_id)`, `(custodian_id)`. **8/8 негативных и 4/4 позитивных smoke-теста на реальных юзерах.** |
| 23c | **Co-Sharing: auto-listing + co-owner pricing (25.04.2026):** Расширил `digital_acts` — `bookingId` стал nullable, добавлен `poolId` (FK pools.id ON DELETE CASCADE), partial unique-индексы и CHECK XOR (акт привязан ровно к одному из {booking, pool}). Новый `POST /api/pools/:poolId/digital-acts`: атомарная транзакция creator-only при `status='purchasing'` пишет genesis-акт, создаёт listing-черновик (`title=pool.title`, `photos=act.photos`, `ownerId=custodianId=creatorId`, `poolId`, `pricePerDay='0'`, `isAvailable=false`) и race-safe переводит pool→`active`. Ошибки: 403 `only_creator_can_activate`, 409 `pool_not_purchasing`/`act_already_exists`/`pool_status_race`. **Pricing:** helper `isCoOwner(userId, listing)` → если арендатор — владелец доли (`payment_status IN creator_confirmed,escrow_held`), в `POST /api/bookings` (Сценарий А) и `PATCH /:id/reschedule` обнуляем `rent/taxFee/ownerPayout/ownerFundContrib`, кладём фиксированную таксу `days × coOwnerDailyFeeRub` в `serviceFee`; `renterFundContribution` (если включена) сохраняется как страховка. **Hardening (post-architect):** до Сценария Б (`!protectionEnabled`) принудительно ставим `protectionEnabled=true` для co-owner — нельзя обойти через прямой контакт. **TOCTOU guard:** во всех 3 write-ветках (POST А, POST Б, PATCH /reschedule) перед `INSERT/UPDATE` повторно вызывается `isCoOwner(...)`; при изменении статуса доли между чтением и записью → 409 `co_owner_state_changed` (optimistic concurrency без блокировок). **Frontend:** `DigitalActUpload` принимает `bookingId?` или `poolId?`; в `PoolDetail` добавлен блок «Шаг 2: Подтвердите покупку и создайте объявление» (creator+purchasing → DigitalActUpload → toast → редирект `/cabinet/listings`). Заодно починен пред-существующий баг `GET /api/pools/:id` (несуществующие колонки `users.firstName/lastName/avatarUrl` → теперь сервер сам разбивает `name` на части для совместимости с фронт-типом). **Smoke на реальных юзерах:** alexey/maria/dmitry — pool 30000₽, контрибы по 15000, активация → listing#90 + pool→active, 403 для maria, 409 для дубля, co-owner booking 3 дня × 500₽/день → `rent=0, service=300, totalPrice=300`. |
| 23a | **Co-Sharing — фундамент БД (25.04.2026):** 3 новые таблицы `pools` (creator/title/target/actual/maintenance_fund/collection_method `p2p_direct`/`platform_escrow`/procurement_strategy `self_managed`/`platform_concierge`/status `funding/purchasing/active/liquidated/canceled`), `pool_shares` (% владения с двумя знаками + `payment_status` `pending/user_transferred/creator_confirmed/escrow_held`), `share_offers` (вторичный рынок долей). `listings` получил `pool_id` / `custodian_id` (динамический Хранитель) / `wear_and_tear_meter`. `platform_settings` + админ-UI: `pool_fee_self_managed_percent` (5%), `pool_fee_concierge_percent` (12%), `co_owner_daily_fee_rub` (100₽). User-UI пулов и флоу СБП — в Stage 23b. Старая `joint_purchases` сохранена как legacy-трекер. ID = `serial` (не uuid — конвенция проекта). |

### 🚧 Следующие приоритеты

#### Stage 21b — ЮKassa для покупки контактов
- [ ] `routes/contacts.ts`: при `isCommercialMode=true` — branching на real-payment вместо beta_free
- [ ] Webhook handler для `target_type=contact_pack` (single / pack10 / unlimited30d → `contact_balances`)
- [ ] UI ContactPurchaseModal: обработка `mode:"redirect"` (по аналогии с PromoteListingModal)

#### Stage 21c — Холд бронирований Premium через ЮKassa
- [ ] `routes/bookings.ts`: при `isCommercialMode=true` + защита включена — `createPayment({ capture: false })` на сумму брони + Shield Fee
- [ ] Webhook: target_type=`booking_protection`, статус брони `pending → confirmed` только после `succeeded`
- [ ] При завершении — `capturePayment` (списание); при отмене — `cancelPayment` (возврат хОлда)

#### Реальные банковские выплаты
- [ ] Замена ручного `mark-paid` на автомат через ЮKassa Payouts / банковский API
- [ ] Применимо к `payout_requests` (выплаты владельцам) и `claims` (компенсации фонда)

#### Подписки владельцев
- [ ] Pro / Бизнес тарифы с пониженной комиссией
- [ ] DB-таблица `subscriptions` + `POST /api/subscriptions/checkout`

#### Реальные банковские выплаты
- [ ] Замена ручного `mark-paid` на автомат через ЮKassa Payouts / банковский API
- [ ] Применимо к `payout_requests` (выплаты владельцам) и `claims` (компенсации фонда)

#### Подписки владельцев
- [ ] Pro / Бизнес тарифы с пониженной комиссией
- [ ] DB-таблица `subscriptions` + `POST /api/subscriptions/checkout`

### 📦 Бэклог
- 🤝 Партнёрские договоры с юрлицами (бейдж «Партнёр платформы», 5% комиссии)
- 📊 Trust Score (рейтинг доверия пользователю, на основе истории сделок и отзывов)
- 🔔 `showFormatBadges` → фронтовый переключатель в админке
- 📊 `minPremiumShareInResults` → логика «буфера Premium» в пагинации
- 🗂️ Admin-RBAC через middleware `requireAdmin` (сейчас в каждом хендлере ручной `await isAdmin()`)
- 🚀 Индексы для аналитики на проде: `bookings(status, protection_enabled, payout_settled_at)`, `claims(status, paid_at)`, `claims(claimant_id, created_at)`

---

## 11a. Инвентаризация проекта (02.05.2026 — актуально после Stage 38)

> Состояние реальной кодовой базы. Источники: 30+ модулей API (~12 000 строк), 17 страниц фронта, 30+ таблиц БД, `platform_settings` (50+ полей).

### Карта модулей API (`artifacts/api-server/src/`)

| Файл | Что делает |
|------|-----------|
| `index.ts` | Bootstrap: DB connect, seedDefaultAdmin (→superadmin), initTelegramBot, scheduler, WebSocket, static |
| `lib/db.ts` | Drizzle + pg pool, `DATABASE_URL` |
| `lib/platform-settings.ts` | Singleton-кэш 60с, `publicSettings()`, `adminSettings()` |
| `lib/notifications.ts` | `createNotification()` + fire-and-forget Telegram dispatch |
| `lib/scheduler.ts` | node-cron каждый час, 6 правил напоминаний по бронированиям |
| `lib/ai-service.ts` | Gemini → DeepSeek-V3 (Amvera) → DeepSeek (direct) → mock fallback |
| `lib/image-service.ts` | Инфографика 1080×1080 через sharp + SVG, буллеты ≤32 символа |
| `lib/yookassa.ts` | REST-клиент ЮKassa (createPayment, capture, cancel, HMAC-SHA256 webhook) |
| `lib/telegram.ts` | Telegraf bot: startBot, handleOtp, sendTelegramToUser, broadcastToAll, hotSwapToken |
| `lib/audit-events.ts` | `recordAuditEvent()` — универсальный аудит (пулы, любые сущности) |
| `middleware/auth.ts` | `requireAuth()`, `requireRole(...roles)`, JWT decode/verify |
| `routes/auth.ts` | register, login, logout, refresh, me |
| `routes/listings.ts` | CRUD объявлений, фото, AI-генерация, инфографика, бейджи |
| `routes/bookings.ts` | Полный статус-машина брони, payout-расчёт, wear_and_tear++ при completed |
| `routes/reviews.ts` | Двусторонние отзывы + ответы, recomputeListingRating |
| `routes/notifications.ts` | GET/PATCH read/read-all |
| `routes/favorites.ts` | Toggle + денорм-счётчик |
| `routes/contacts.ts` | Покупка доступа к телефону (3 тарифа), bypass в beta-режиме |
| `routes/promotions.ts` | VIP/Срочно/Boost, ЮKassa branching, продление, журнал |
| `routes/claims.ts` | Заявки гарантийного фонда + аналитика |
| `routes/payouts.ts` | Payout requests владельцев, mark-paid |
| `routes/support.ts` | support_tickets + messages |
| `routes/reports.ts` | Жалобы |
| `routes/pools.ts` | Co-Sharing: создание пулов, доли, вторичный рынок, buyout (Stages 23-28) |
| `routes/digital_acts.ts` | Цифровые акты передачи (pool_handover, обычный) |
| `routes/telegram.ts` | OTP, status, unlink, preferences (Stage 38) |
| `routes/admin.ts` | Все admin-эндпоинты: users, listings, settings, stats, audit, economy, telegram |
| `routes/webhooks.ts` | ЮKassa вебхук с FOR UPDATE anti-replay |
| `routes/trust-score.ts` | `GET /api/users/:id/trust-score` публичный V8 (13 сигналов) |

### Карта страниц фронта (`artifacts/hochu-to/src/pages/`)

| Страница | URL | Что показывает |
|----------|-----|----------------|
| `Home.tsx` | `/` | Каталог + 4 маркетинговые карусели + GeoIP авто-регион |
| `ListingDetail.tsx` | `/listings/:id` | Галерея, бейджи, бронирование, отзывы, чат, AI-инфографика |
| `CreateListing.tsx` | `/listings/create` | Форма + AI-описание + авто-расчёт maxProtectionLimit |
| `EditListing.tsx` | `/listings/:id/edit` | Редактирование |
| `Dashboard.tsx` | `/dashboard` | Бронирования, мои объявления, профиль, уведомления, Telegram-привязка |
| `AdminPage.tsx` | `/admin` | 11+ табов: Overview, Users, Listings, Bookings, Support, Reports, Audit, Economy, Payments, Shield Claims, Telegram |
| `PoolDetail.tsx` | `/pools/:id` | Пул Co-Sharing: доли, рынок, buyout, Timeline, handover |
| `JointPurchases.tsx` | `/joint-purchases` | Доска заявок (частично, без полной механики) |
| `Support.tsx` | `/support` | Мои тикеты + форма создания |
| `StaffDirectory.tsx` | `/staff` | Список персонала (roles: moderator/admin/support/arbiter/staff/superadmin) |
| `TrustScorePage.tsx` | `/users/:id/trust` | Публичный Trust Score V8 + компоненты |
| `Auth.tsx` | `/auth` | Login / Register |
| `NotFound.tsx` | `*` | 404 |

### ✅ Что РЕАЛЬНО работает (Stage 38)

**Ядро платформы:**
- Auth: register/login/refresh/logout/me, JWT, bcrypt, `auth_sessions` в БД
- RBAC (Stage 36): 8 ролей (`renter/owner/moderator/admin/superadmin/support/arbiter/staff`), middleware `requireRole()`, staff-страницы с badges
- Каталог + сортировки: 6 веток + `?quality=true`, promo-префикс, GeoIP авто-регион
- Объявления CRUD: 4 категории, до 10 фото, `listingNumber БТ-YYYY-NNNNNN`, авто-модерация аномальных цен
- Бронирования: полный статус-машина pending→completed, reschedule, нумерация `ХТ-YYYY-NNNNNN`, аудит `booking_events`, race-condition защита
- Real-time WebSockets (Stage 34): `/ws` endpoint, live-чат по броне + push-уведомления без polling
- Двусторонние отзывы + ответы, `recomputeListingRating()`
- Избранное с денорм-счётчиком

**Финансы:**
- Dual Shield финансовая модель: множители категорий, Shield Fee, риск-резерв, ownerPayout (все ставки в `platform_settings`, кэш 60с)
- Payout Requests (Stage 17a): реквизиты карты/СБП, очередь, `mark-paid` админом
- Compensation Claims (Stage 17b): лимиты анти-фрода, аналитика фонда (LineChart, топ-получатели)
- Платное продвижение (Stage 18+19): VIP/Срочно/Boost, журнал `listing_promotions`, ЮKassa branching при `commercial=true`
- Контакты — платная разблокировка телефона (3 тарифа), bypass в beta-режиме

**AI & Контент:**
- AI-генерация описаний: Gemini → DeepSeek-V3 (Amvera) → DeepSeek (direct) → smart-mock. `actualProvider` + `fallback` в ответе
- AI-инфографика 1080×1080 (sharp + SVG), буллеты ≤32 символа
- AI-Арбитражор (Vision analysis) для разрешения споров

**Уведомления:**
- In-app + Scheduler (6 правил cron каждый час)
- **Telegram (Stage 38):** `@Helper251223_bot`, OTP-привязка (TTL 10 мин), preferences (bookings/system/chats), hot-swap токена с автооткатом, broadcast по роли, dev/prod режим
- `createNotification()` fire-and-forget → Telegram dispatch

**Co-Sharing (Stages 23a–28):**
- Пулы (`pools`), доли (`pool_shares`), статус-машина `funding→purchasing→active→liquidated`
- Вторичный рынок долей (`share_offers`): TOCTOU-защита, TTL 30 мин, атомарный merge
- Амортизация (`wear_and_tear_meter`, `depreciationPerRentalPercent`)
- Цифровые акты передачи (`digital_acts`, pool_handover)
- Buyout (Stage 28): полный выкуп пула, атомарный confirm, ликвидация
- Аудит (`audit_events`) + уведомления (5 типов buyout_*)

**Trust Score V8 (Stage 32.1):**
- 13 сигналов, decay 180 дней, `score_components JSONB`
- Публичный `GET /api/users/:id/trust-score`

**Мобильность (Stage 35):**
- Адаптивная вёрстка: breakpoints, touch targets, burger-меню

**Soft delete (Stage 35b):**
- `DELETE /api/users/me` → анонимизация, `isBanned=true`, `banReason='account_deleted'`

**Админка (11+ табов):**
- Overview+Analytics, Users, Listings, Bookings, Support, Reports, Audit, Economy, Payments, Shield Claims, **Telegram** (статус бота, env, broadcast)

### 🟡 Частично реализовано

**Платежи ЮKassa:**
- ✅ Stage 21a Core: `lib/yookassa.ts`, `payments` таблица, webhook HMAC, mock branching для промо
- ❌ Stage 21b: `contacts.ts` при `commercial=true` всё ещё bypass'ит — нужен real-branching
- ❌ Stage 21c: `bookings.ts` не вызывает `createPayment({ capture: false })` — холд брони не реализован

**Совместные покупки (старый раздел, не Co-Sharing):**
- `joint_purchases` таблица есть; API GET+POST без auth; UI показывает `toast("Скоро!")`
- `joint_purchase_fee_percent=3` в settings — никогда не применяется в коде

**Подписки владельцев:**
- Цены в `platform_settings` (`subscription_pro_monthly=499`, etc.) — таблицы, роутов, UI нет

### 🔴 Бэклог — не начато
- Stage 21b/21c — ЮKassa для контактов и холда брони
- Подписки владельцев (Pro/Бизнес): таблица + роуты + UI
- Joint Purchases — полная коллективная механика (паи, эскроу, закрытие/возврат)
- Партнёрские договоры юрлиц (бейдж «Партнёр платформы»)
- `minPremiumShareInResults=60` — буфер Premium в пагинации
- `showFormatBadges` — фронтовый переключатель
- Production analytics indexes: `bookings(status, protection_enabled)`, `claims(status, paid_at)`
- Авто-cancel buyout-запросов после N дней без активности (cron)
- WebSocket/SSE для pool Timeline (сейчас polling 30с)

### Самые критичные пробелы для запуска
1. **ЮKassa 21b/21c** — без реального холда и контактных платежей коммерческий режим не работает
2. **Joint Purchases** — убрать «Скоро!» или реализовать коллективную механику
3. **Подписки** — ответить на вопрос «нужны ли вообще» (анализ в разделе 11b)

---

## 11b. Подписки в нашей экономике — анализ необходимости (24.04.2026)

> Открытый вопрос пользователя: «не понимаю, куда и надо ли вообще вводить подписки в нашу экономику».

### Текущая модель: 4 ручки монетизации
1. **Free-размещение** (`free_listings_max_per_owner=10`, требует телефон) — владелец платит 0₽. Монетизация платформы = арендатор покупает контакт за 49 ₽ (или пак 10 за 299₽ / безлимит-30дней за 699₽).
2. **Premium-with-Shield бронь** — владелец платит 0₽ за размещение, но с каждой брони идёт `service_fee_percent=10%` сервис (вычет из payout) + `shield_fee_percent=5%` Shield + `risk_coverage_percent=5%` фонд (последние два оплачивает арендатор сверху).
3. **Платное продвижение поштучно** (Stage 18) — VIP 199/349/599 ₽, Срочно 99/199 ₽, Boost 49 ₽/24ч.
4. **Гарантийный фонд** — реинвестируется в выплаты по claims, с лимитом резерва (`fundReserveRatioPct`).

### Что бы дали подписки (Pro 499₽/мес, Бизнес 1990₽/мес)
- Снять лимит 10 free-объявлений → монетизация крупных арендодателей (10+ единиц техники).
- Пониженная комиссия для Бизнес (5% вместо 10%) → стимул B2B-игрокам выбирать нас.
- Безлимитные/скидочные промо в подписку.
- Аналитика просмотров (для Pro/Бизнес).
- Бейдж «Бизнес» = социальное доказательство.
- Прогнозируемый recurring revenue для платформы (улучшает unit-economics).

### Аргументы ПРОТИВ ввода подписок сейчас
- Усложнение модели (5-я ценовая ручка поверх 4 существующих) — отпугнёт ранних пользователей.
- На текущем масштабе (~170 объявлений, мало пользователей) подписка не наберёт критическую массу.
- Без массы профессиональных арендодателей подписка не взлетит (нужно сначала привлечь B2B).
- ЮKassa — более срочный блокер: без неё подписки технически не списать.

### 3 варианта решения (для обсуждения с пользователем)

**Вариант A — Отказаться от подписок** ✂️
- Упростить экономику до 4 ручек: Free + Premium-броней + промо поштучно + контакты.
- Снять/спрятать UI «Подписки» в админке, удалить поля из `platform_settings` (или оставить как dormant).
- + Простая, прозрачная модель, понятная пользователю.
- − Потеря B2B-инструмента для крупных игроков (или они уйдут в Avito).

**Вариант B — Только Бизнес-подписка для юрлиц** 🎯
- Один тариф «Бизнес» (1990₽/мес) с понижением комиссии до 5% и бейджем «Партнёр».
- Заменяет одновременно «Этап 5 — Партнёрские бейджи» из Monetization Roadmap.
- + Чистая B2B-модель, минимум сложности, объединяет две идеи в одну.
- − Не закрывает потребности «активных физлиц» (10-30 объявлений), которые хотели бы Pro подешевле.

**Вариант C — Полная Pro/Бизнес как заложено** 📊
- Pro 499₽/мес: безлимит free-объявлений + 5 поднятий + 1 VIP в месяц + аналитика.
- Бизнес 1990₽/мес: всё из Pro + комиссия 5% + безлимит поднятий + 5 VIP + бейдж.
- + Максимизация выручки на активных владельцах, recurring доход.
- − Сложно объяснить «зачем мне Pro если я могу купить промо поштучно». Нужна реально ценная разница (например, аналитика просмотров, которой пока нет).

### Технический пред-блокер (одинаковый для B и C)
**ЮKassa должна быть запущена раньше подписок** — без рекуррентных платежей подписка вырождается в «админ ставит галочку вручную», что не масштабируется.

### Рекомендация (на 24.04.2026)
Сначала запустить **ЮKassa** (для уже реализованных фич: промо, контакты), потом — Вариант B (Бизнес-подписка для юрлиц). Полную Pro/Бизнес откладывать до момента, когда наберётся ≥50 активных владельцев с 5+ объявлениями каждый.

> Решение пользователя по выбору варианта будет занесено в этот же раздел.

**Решение от 24.04.2026:** выбран **Вариант B** (Бизнес-подписка для юрлиц) с расчётом на расширение до Pro в будущем. Дизайн и план реализации — в разделе 11c.

---

## 11c. Бизнес-подписка для юрлиц — фундамент и план развития (24.04.2026)

> Перспективная фича. **Не реализовывать прежде ЮKassa.** Раздел зафиксирован для будущих сессий, чтобы при возврате к теме не пере-проектировать с нуля.

### Цель и аудитория
Дать юрлицам/ИП с парком техники (10+ единиц) экономический инструмент:
- Снять лимит `free_listings_max_per_owner=10` (поднять до условного безлимита, например 500).
- Снизить сервис-комиссию с 10% до 5% (используется уже существующая настройка `subscription_business_commission_percent=5`).
- Бейдж «Партнёр платформы» на карточке и в профиле — социальное доказательство для арендатора.
- Включённый пакет промо в месяц (например, 3 VIP × 7д + 5 Срочно × 3д) — даёт ощутимую материальную ценность сверх скидки на комиссию.

**Цена:** `subscription_business_monthly=1990 ₽/мес` (уже в `platform_settings`).

**Прогноз unit-economics:**
- Точка безубыточности для платформы — владелец делает ≥40 тыс. ₽ оборота/мес (40 000 × 5% = 2000 ₽ потери комиссии vs 1990 ₽ подписки).
- Для владельца выгодно при обороте ≥40 тыс. ₽/мес (раньше платил 4000 ₽ комиссии, теперь 2000 + 1990 = 3990 ₽; плюс получил пакет промо ~600 ₽ и бейдж).
- Чистый recurring доход для платформы появляется на оборотах <40k₽/мес владельца (плата за бренд + лимит).

### Архитектура (расширяемая под будущий Pro)

#### 1. БД-схема (новые таблицы — НЕ накатывать до запуска ЮKassa)

```ts
// lib/db/src/schema/subscriptions.ts (будущий файл)
export const subscriptionTierEnum = pgEnum("subscription_tier", ["business", "pro"]);
//                                                                            ^ зарезервировано на будущее
export const subscriptionStatusEnum = pgEnum("subscription_status",
  ["active", "past_due", "cancelled", "expired"]);

export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  tier: subscriptionTierEnum("tier").notNull(),                  // первая версия — только "business"
  status: subscriptionStatusEnum("status").notNull().default("active"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),                  // конец оплаченного периода
  cancelledAt: timestamp("cancelled_at"),                         // когда пользователь нажал «отменить»
  autoRenew: boolean("auto_renew").notNull().default(true),
  yookassaPaymentMethodId: text("yookassa_payment_method_id"),    // для рекуррента (см. ЮKassa save_payment_method)
  pricePaidRub: integer("price_paid_rub").notNull(),              // зафиксированная цена на момент покупки
});

// История платежей (для аудита, биллинга, расследований)
export const subscriptionPaymentsTable = pgTable("subscription_payments", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").notNull().references(() => subscriptionsTable.id),
  yookassaPaymentId: text("yookassa_payment_id").notNull().unique(),  // идемпотентность webhook'ов
  amountRub: integer("amount_rub").notNull(),
  status: text("status").notNull(),                               // succeeded / canceled / refunded
  paidAt: timestamp("paid_at"),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

**Индексы:**
- `subscriptions(user_id, status)` — быстрая проверка «активна ли подписка у юзера».
- `subscriptions(expires_at) WHERE status='active'` — для cron'а истечения.
- `subscription_payments(subscription_id, period_start)` — биллинг-история.

**Расширяемость под Pro:** enum `subscription_tier` уже включает `pro`. Добавление Pro = новый тариф в `platform_settings` + поле `tier='pro'` в `subscriptions` + ветка в логике применения скидки. Никаких миграций не требуется.

#### 2. Поля в `platform_settings`
**Уже есть** (используем как есть):
- `subscription_business_monthly=1990` — цена.
- `subscription_business_commission_percent=5` — пониженная комиссия.

**Добавить** (под расширяемость):
- `subscription_business_max_listings INT NOT NULL DEFAULT 500` — лимит объявлений для Бизнес.
- `subscription_business_included_vip_count INT NOT NULL DEFAULT 3` — VIP в пакете.
- `subscription_business_included_urgent_count INT NOT NULL DEFAULT 5` — Срочно в пакете.
- `subscription_business_grace_period_days INT NOT NULL DEFAULT 3` — окно для повторной попытки списания (status='past_due' → 'expired').

#### 3. API-слой (новый модуль `routes/subscriptions.ts`)
```
GET  /api/subscriptions/tiers                  публичный — описание тарифов с ценами из platform_settings
GET  /api/subscriptions/me                     текущая подписка пользователя + остаток включённых промо
POST /api/subscriptions/me/checkout            создать платёж в ЮKassa, вернуть confirmation_url (save_payment_method=true)
POST /api/subscriptions/me/cancel              отменить авто-продление (доступ до конца оплаченного периода сохраняется)

// Webhooks
POST /api/subscriptions/yookassa-webhook       идемпотентно обработать события payment.succeeded / payment.canceled

// Admin
GET    /api/admin/subscriptions                список всех подписок с фильтрами (status, tier)
PATCH  /api/admin/subscriptions/:id            ручное продление/смена статуса (для саппорта)
```

#### 4. Применение пониженной комиссии
В `routes/bookings.ts` при расчёте платежа:
```ts
const ownerSubscription = await getActiveSubscription(listing.ownerId);  // helper с кэшем 60с
const serviceFeePercent = ownerSubscription?.tier === "business"
  ? settings.subscriptionBusinessCommissionPercent   // 5%
  : settings.serviceFeePercent;                      // 10%
```
Helper `getActiveSubscription(userId)` — единственная точка проверки. Будущий Pro подключится через `tier === "pro" ? settings.subscriptionProCommissionPercent : ...` без изменения вызывающего кода.

#### 5. UI
- **Dashboard → новая вкладка «Подписка»**: текущий статус + дата окончания + кнопка «Оформить» / «Отменить».
- **Профиль владельца**: бейдж «Партнёр платформы» (если `subscription.tier='business'` и `status='active'`).
- **Карточка объявления**: бейдж «Партнёр» через тот же `BadgeRow` (новый тип в `getListingBadges`).
- **Админка → новая вкладка «Подписки»**: список + поиск + ручное продление.

#### 6. Cron-задачи (расширение `lib/scheduler.ts`)
- **Ежедневно в 03:00:** `expireSubscriptions()` — все `status='active' AND expires_at < now()` → попытка списания через ЮKassa (если `auto_renew=true` и есть `payment_method_id`); неудача → `status='past_due'`; через `grace_period_days` неудач → `status='expired'`.
- **За 3 дня до окончания:** уведомление пользователю «Подписка истекает через 3 дня».
- **За 1 день и в день окончания:** аналогичные напоминания.

### Поэтапный план реализации

| Этап | Что | Зависит от |
|------|-----|------------|
| **M0 — Pre-req** | Запустить ЮKassa-интеграцию для уже существующих фич (контакты, промо). Проверить webhook, идемпотентность, save_payment_method. | — |
| **M1 — Скелет** | Drizzle-схема (`subscriptions` + `subscription_payments`) + `db:push --force`. Расширить `platform_settings` 4 новыми полями. Helper `getActiveSubscription()` с кэшем. | M0 |
| **M2 — Применение скидки** | Подключить helper в `routes/bookings.ts` (без UI). Smoke-тест: вручную вставить запись в `subscriptions` → бронь рассчитывается с 5% вместо 10%. | M1 |
| **M3 — Покупка** | `POST /api/subscriptions/me/checkout` + webhook + UI вкладки «Подписка» в Dashboard + страница «Спасибо за оформление». | M2 |
| **M4 — Бейдж** | Бейдж «Партнёр» в `BadgeRow`, профиле владельца, карточке. | M3 |
| **M5 — Жизненный цикл** | Cron `expireSubscriptions` + уведомления + `cancel` endpoint + админ-вкладка. | M4 |
| **M6 — Включённый пакет промо** | Поля `business_included_vip_count/included_urgent_count` начинают работать: при покупке промо для подписчика автоматически списываются «бесплатные» из пакета, потом платные. | M5 |

### Точка расширения до Pro (когда наберётся ≥50 активных владельцев с 5+ объявлениями)
- Добавить `subscription_pro_monthly` (уже в БД), `subscription_pro_commission_percent`, `subscription_pro_max_listings`, и т.д.
- Один новый case в `getActiveSubscription()` логике скидок.
- Один новый tier в UI вкладке «Подписка».
- Никаких миграций схемы — всё через enum-значение `'pro'`, которое уже зарезервировано в `subscription_tier`.

### Метрики для решения «вводить Pro или нет» (через 6 мес после Бизнеса)
- Количество активных Бизнес-подписчиков ≥20 → подтверждение спроса на recurring-модель.
- Запросы из саппорта/чата вида «есть ли тариф подешевле» ≥15 в месяц → есть аудитория Pro.
- Средний оборот Бизнес-подписчика ≥30k₽/мес → unit-economics Pro (499 ₽) сходится при обороте ≥10k₽/мес.

### Что НЕ делать сейчас
- Не накатывать миграции `subscriptions/subscription_payments` до запуска ЮKassa.
- Не показывать в публичном UI обещание «подписки скоро» без чёткой даты — токсично для доверия (см. ситуацию с «Совместными покупками — Скоро!»).
- Не плодить tier'ов сверх `business` + зарезервированного `pro`.

### Открытые вопросы для будущей сессии
1. Бейдж «Партнёр платформы» — это тот же бейдж, что и для KYC-проверенных юрлиц через документы (УНН/ОГРН), или это два разных бейджа?
2. Включённый пакет промо в подписке — fixed (3 VIP/мес) или «пул бонусных рублей» (500 ₽ на промо/мес, тратятся на любые промо)?
3. Возврат при отмене посередине месяца — нет (доступ до конца периода) или pro-rata?

---

## 11d. Trust & Verification — фундамент и план развития (24.04.2026)

> **Двухуровневая концепция доверия.** Уровень 1 (Проверенный владелец) — реализуется сейчас как MVP. Уровень 2 (Trust Score) — фундамент в схеме, реализация позже когда наберётся данных для калибровки.

### Базовое разграничение

**«Проверенный владелец»** — бинарный бейдж. Админ вручную подтверждает базовую достоверность владельца после проверки (телефон активен, скан документа в чате с поддержкой и т.п.). Без юридической силы — это «модератор посмотрел и подтвердил».

**Trust Score** — числовой 0–100. Автоматический, считается из истории (сделки, отзывы, жалобы, возраст аккаунта). Дополняет, а не заменяет «Проверенного владельца».

### Уровень 1 — Проверенный владелец (MVP)

#### Схема (новые поля в `users`)
```ts
isVerified: boolean("is_verified").notNull().default(false),
verifiedAt: timestamp("verified_at"),
verifiedByAdminId: integer("verified_by_admin_id").references(() => usersTable.id),
verificationNote: text("verification_note"),   // внутренняя заметка админа: «Скан паспорта в тикете #234»
```

#### API
- **Расширить existing** `PATCH /api/admin/users/:id` — принимать `isVerified: boolean` + опциональный `verificationNote`. При смене значения автоматом проставлять `verifiedAt = now()` и `verifiedByAdminId = req.userId`. Запись в `admin_audit_log`.
- **В response `GET /api/users/:id`** — отдавать `isVerified, verifiedAt` (публично — без `verificationNote` и `verifiedByAdminId`).
- **В каждом объявлении** (`GET /api/listings`, `GET /api/listings/:id`) — добавить `ownerIsVerified: boolean` через JOIN с users (без денорм-копии — JOIN дешевый при индексе на `users.id`).

#### UI
- **`getListingBadges`** в `lib/badges.ts` — добавить ветку: `if (l.ownerIsVerified) → бейдж "Проверенный владелец"` (Award, фиолетовый). Тот же бейдж в `getDetailBadges` для `/listings/:id`.
- **Профиль владельца** (`OwnerProfile.tsx`) — большой бейдж с галочкой возле имени.
- **Админка → вкладка «Пользователи» → строка пользователя** — toggle «Проверенный» + текстовое поле «Заметка верификатора».
- **Dashboard владельца** — блок «Хочу пройти верификацию» с кнопкой «Создать заявку в поддержку» (создаёт `support_ticket` категории `verification_request`). Без отдельного flow — переиспользуем существующий саппорт.

#### Что НЕ входит в MVP
- Загрузка скана паспорта/ОГРН на сайте — это PII, требует отдельного хранилища с шифрованием и юридической оценки. Документы пересылаются админу через тикет вручную.
- Самообслуживание (юзер сам нажимает «верифицироваться» и через 5 сек получает бейдж) — не безопасно. Только через админа.
- Авто-сброс верификации при смене телефона/email — позже, когда появится event-bus.

### Уровень 2 — Trust Score (фундамент)

#### Схема (добавить вместе с Уровнем 1, чтобы не делать ещё одну миграцию)
```ts
trustScore: integer("trust_score"),                          // 0..100, NULL = не вычислялось
trustScoreUpdatedAt: timestamp("trust_score_updated_at"),
```

#### Формула `computeTrustScore(user)` — стартовая версия (калибруется)
```
base = 50

// История сделок (max +30)
+ Math.min(user.completedDealsCount * 10, 30)

// Качество (max +20)
+ (avgRatingAsOwner >= 4.5 ? 20 : avgRatingAsOwner >= 4.0 ? 10 : 0)

// Верификация (+15)
+ (user.isVerified ? 15 : 0)

// Возраст аккаунта (max +10)
+ Math.min(Math.floor(monthsSinceCreated / 6) * 5, 10)

// Штрафы
- (approvedClaimsAgainstUser * 10)
- (user.isBanned || user.bannedHistory ? 20 : 0)

// Clamp
return Math.max(0, Math.min(100, score))
```

#### Cron (расширение `lib/scheduler.ts`)
Раз в сутки в 04:00 — пересчёт `trustScore` для всех владельцев с активными объявлениями. Один SELECT с агрегатами + один batch UPDATE.

#### UI (Уровень 2 — после калибровки)
- На карточке объявления и в профиле владельца: цветной маркер `87/100` рядом с именем (зелёный 70+, жёлтый 40-69, серый <40).
- В каталоге: фильтр «только владельцы с TS ≥ 70».
- В Dashboard владельца: «Ваш Trust Score: 65. Что повысит: завершить ещё 2 сделки (+20), пройти верификацию (+15)».

### Расширяемость
| Будущее расширение | Что меняется | Что НЕ ломается |
|---|---|---|
| KYC-документы через сайт (загрузка скана паспорта) | Новая таблица `kyc_documents` + отдельный модератор-flow | Существующий бейдж и поля `is_verified` остаются |
| Авто-верификация через Госуслуги ESIA | Новый endpoint `/api/auth/esia/callback`, проставляет `isVerified=true` | UI бейджа без изменений |
| Trust Score 2.0 (с весами по категориям, ML и т.п.) | Только helper `computeTrustScore` | Поле в БД и UI остаются |
| Бейдж «Партнёр платформы» (для юрлиц с подпиской Бизнес) | Новый бейдж с приоритетом ВЫШЕ «Проверенный» | Не конфликтует с этим бейджем — может быть оба |

### Поэтапный план

| Этап | Что | Примерный объём | Статус |
|------|-----|-----------------|--------|
| **V1 — Схема** | 6 новых полей в `users` (`is_verified`, `verified_at`, `verified_by_admin_id`, `verification_note`, `trust_score`, `trust_score_updated_at`) + `db:push --force` | 1 файл, 1 миграция | ✅ ГОТОВО (Stage 19g) |
| **V2 — API** | Расширить `PATCH /api/admin/users/:id`, добавить `isVerified` в `GET /api/users/:id`, добавить `ownerIsVerified` в каждое объявление через JOIN | 2 файла | ✅ ГОТОВО (Stage 19g) |
| **V3 — Бейдж** | Ветка в `lib/badges.ts` (`getListingBadges` + `getDetailBadges`), бейдж в `OwnerProfile.tsx` | 2 файла | ✅ ГОТОВО (Stage 19g) |
| **V4 — Админ-toggle** | UI в `AdminPage.tsx` — checkbox «Проверенный» + textarea «Заметка верификатора» в карточке пользователя | 1 файл | ✅ ГОТОВО (Stage 19g) |
| **V5 — Заявка от владельца** | Категория `verification_request` в `support_tickets`, кнопка «Подать заявку на верификацию» в Dashboard → создаёт тикет | 2 файла | ✅ ГОТОВО (Stage 19g) |
| **V6 — Trust Score helper** | `lib/trust-score.ts` с формулой + триггеры из `reviews.ts`/`admin.ts` + audit_events | 1 файл | ✅ ГОТОВО (Stage 29, ретроспективно задокументировано Stage 32 — 29.04.2026) |
| **V7 — Cron + админ-кнопка «Пересчитать»** | Ежесуточный пересчёт через `lib/scheduler.ts` + ручной trigger в админке | 2 файла | ⏳ Stage 29 followup (сейчас score освежается только по событиям review/admin, ежесуточного cron нет) |
| **V8 — Публичный показ Trust Score** | Маркер на карточке + фильтр в каталоге + блок в Dashboard | 3-4 файла | ⏳ отложено до калибровки (100+ сделок и 50+ владельцев) |

**MVP «Проверенный владелец» (V1–V5) выпущен в Stage 19g 24.04.2026.**

**V6 (Trust Score helper) выпущен в Stage 29 (29.04.2026).** Реальная формула отличается от стартовой версии этого раздела: база 20 вместо 50, рейтинг масштабируется пропорционально (`(avgRating/5)*30`), убраны компоненты «возраст аккаунта» и «бан-история». Полное описание — в журнале Stage 29 в конце этого файла.

V7–V8 — публичный показ Trust Score — делается после накопления данных (минимум 100 завершённых сделок и 50 владельцев — иначе калибровка бессмысленна). Сейчас score виден только владельцу в его Dashboard и админу в карточке пользователя.

### Что НЕ делать сейчас
- Не добавлять KYC-документы и хранение PII — нужна отдельная процедура, юридическая оценка, защищённое хранилище.
- Не показывать Trust Score публично пока он не калиброван на реальных данных (на ~10 владельцах любая формула выдаёт «псевдо-точные» цифры с большим шумом).
- Не давать «Проверенному владельцу» материальных скидок (например пониженный депозит) — это создаёт инцентив на накрутку верификации. Сначала проверить, что одного визуального бейджа достаточно.

### Решённые вопросы (ответы зафиксированы при реализации Stage 19g, 24.04.2026)
1. **Категория тикета `verification_request`** → ✅ добавлена в `supportCategoryEnum`. Отдельная категория даёт админу фильтр в очереди и анти-дубль на уровне БД (см. урок ниже).
2. **Истечение верификации** → ✅ бессрочная. Если нужно отозвать — админ снимает галочку, происходит запись `unverify_user` в `admin_audit_log`.
3. **Влияние сброса верификации на Trust Score** → ⏸ отложено до V6 (Trust Score). Поле `trust_score` в схеме есть, но формула пока не реализована.

### Уроки Stage 19g (для будущих V6–V8 и других anti-duplicate API)
- **Anti-duplicate ВСЕГДА на уровне БД, а не только на уровне маршрута.** Паттерн `SELECT existing → INSERT new` имеет TOCTOU race: 5 параллельных запросов проходят SELECT одновременно и создают 5 дубликатов. Правильно: partial unique index + `try/catch` на Postgres error code `23505` (unique_violation) → 409. SELECT-проверка остаётся как fast-path (избегает ошибок в логах при обычной работе), но единственный источник правды — БД.
- **Пример:** `support_tickets_verification_singleton_idx UNIQUE (user_id) WHERE category='verification_request' AND status IN ('open','in_progress')` в `lib/db/src/schema/support.ts`.
- **Применять к:** любым «не более одного активного X на пользователя/ресурс» (заявки на верификацию, открытые claims, активные boost-ы, текущие подписки, незакрытые payout_requests и т.д.).
- **Не применять к:** счётчикам и денормализованным полям — там нужны атомарные UPDATE с условием (как `bookingCountDelta` в Stage 19e).
- **Drizzle-синтаксис:** `pgTable("…", {…columns…}, (t) => ({ idxName: uniqueIndex("idx_name").on(t.col).where(sql\`…\`) }))`. После добавления индекса — `pnpm --filter @workspace/db push`.

---

## 12. Журнал релизов

### 25.04.2026 — Stage 23a: Co-Sharing — фундамент БД и админ-настройки

**Цель:** заложить архитектуру для модуля «Совместные покупки» (фракционное владение физическими активами). Без user-facing UI — только БД и админка.

**Новые таблицы (`lib/db/src/schema/co_sharing.ts`, ID = `serial`):**

| Таблица | Назначение |
|---|---|
| `pools` | Кампания сбора + параметры пула: цель, факт, фонд обслуживания, метод сбора (`p2p_direct`/`platform_escrow`), стратегия (`self_managed`/`platform_concierge`), статус (`funding/purchasing/active/liquidated/canceled`), `creator_payment_details` (СБП-телефон при p2p), `expires_at`, `protection_mode` |
| `pool_shares` | Доли участников (% с двумя знаками + сумма ₽), статус оплаты (`pending`/`user_transferred`/`creator_confirmed`/`escrow_held`) |
| `share_offers` | Вторичный рынок: продажа долей между пользователями |

**Расширение `listings`:** `pool_id` (FK на пул, NULL для обычных), `custodian_id` (динамический Хранитель — меняется через Цифровой Акт), `wear_and_tear_meter` (для честной цены при продаже доли).

**Новые `platform_settings` + админ-UI:**
- `pool_fee_self_managed_percent` numeric, default **`5`** — самостоятельная закупка с реимбурсиментом
- `pool_fee_concierge_percent` numeric, default **`12`** — VIP-консьерж (DNS/Ozon, штрих-код)
- `co_owner_daily_fee_rub` integer, default **`100`** — ежедневный сбор с совладельца за личное использование

**Бэкенд-каркас (без бизнес-роутов):**
- `lib/platform-settings.ts` → DEFAULTS + `publicSettings()` отдают новые 3 поля.
- `routes/admin.ts` → 3 поля в whitelist `allowed`, 2% поля в `PERCENT_FIELDS` (валидация 0..100), 1 в `NON_NEG_INT_FIELDS`.

**Smoke-тесты бэкенда (5/5):**
1. `GET /api/admin/settings` → новые поля видны (`5.00`/`12.00`/`100`)
2. `PUT` валидное (7/15/150) → 200, значения сохраняются
3. `PUT poolFeeConciergePercent=150` → 400 invalid_value «Должно быть число от 0 до 100»
4. `PUT coOwnerDailyFeeRub=-50` → 400 invalid_value «целое неотрицательное число»
5. `INSERT INTO pools` с минимальным набором → row создаётся с дефолтами `status='funding'`, `protection_mode=true`, `maintenance_fund_balance=0`

**Совместимость со старым `joint_purchases`:**
Эта legacy-таблица (простой трекер сборов) не трогается — на неё может быть ссылка из старого UI. Помечена в админ-форме как «legacy joint_purchases». Новый модуль `pools` живёт параллельно. Решение о sunset legacy — позже, когда Stage 23b закроет все её сценарии.

**ID convention:** `serial` (как везде в проекте). User изначально просил `uuid`, но смешивать `serial` и `uuid` ID — это проблема joins и системное правило безопасности БД проекта.

**Файлы изменены:** 7 (1 новая схема + 3 правки схем + 2 правки бэка + 1 правка админки + 2 правки docs). Миграция применена через `pnpm --filter @workspace/db push`.

**Что разблокировано для Stage 23b:** UI создания пулов, флоу СБП-перевода с подтверждением, авто-листинг при `pools.status = active`, передача Хранителя через Цифровой Акт, расчёт износа на каждой бронировке.

### 25.04.2026 — Stage 22b: карта арбитража + электронная подпись

**Цель:** замкнуть «Стальной Щит #2» — добавить визуализацию GPS-точки съёмки для арбитра и слой юридической дисциплины через подпись участника.

**Новые компоненты:**
- `artifacts/hochu-to/src/components/SignaturePad.tsx` — нативный HTML5 canvas + PointerEvents (унифицировано для мыши/пальца/стилуса), `touch-action: none` (не скроллится при подписи на мобиле), retina через `devicePixelRatio`, `ResizeObserver` для адаптивности (с сохранением рисунка при resize). Public API через `useImperativeHandle`: `clear()`, `isEmpty()`, `toDataURL()`. Никаких новых npm-зависимостей.
- `artifacts/hochu-to/src/components/DigitalActMap.tsx` — минимальная Leaflet-карта: один пин по `(lat, lng)`, OSM-тайлы, `scrollWheelZoom: false`, attribution off. Фирменный SVG-pin `#C65D3B`. Высота настраивается prop'ом (по умолчанию 180px).

**Изменения в `artifacts/hochu-to/src/components/DigitalActUpload.tsx`:**
- Импорт `SignaturePad` + `useRef<SignaturePadHandle>`.
- Финальный блок «✍️ Подпись *» под видео.
- В `submit()`: ранний `return` если `signatureRef.current.isEmpty()`. Подпись сохраняется в `metadata.signature` (data:image/png;base64).
- Кнопка «Сохранить акт» disabled пока холст пуст.

**Backend `artifacts/api-server/src/routes/digital_acts.ts`:**
- Функция `validateSignature(raw)` — ручная проверка вместо Zod. Причина: api-server bundler (esbuild через `build.mjs`) не резолвит `zod/v4` (DB-схема использует это, но api-server в обычной коде использует `@workspace/api-zod`). Регекс `/^data:image\/png;base64,[A-Za-z0-9+/=]+$/` + лимит 300КБ.
- Проверка после photo-whitelist, перед state-machine. Ошибки → 400 `signature_required` с разными сообщениями (пустая / большая / неверный формат).
- БД-миграция не требуется: подпись сидит в существующем `metadata jsonb`.

**Админка `artifacts/hochu-to/src/pages/AdminPage.tsx` → `DigitalActsBlock`:**
- Извлечение первой GPS-точки: `meta.photoExif.find(e => typeof e?.lat === "number" && typeof e?.lng === "number")` — если есть, рисуем карту высотой 160px с координатами под ней.
- Извлечение подписи: `typeof meta.signature === "string" && startsWith("data:image/png;base64,")` — если есть, рисуем `<img>` подписи в белом боксе с границей, max-h-32.
- Бейджи в шапке акта: `📍 GPS` / `✍️ Подпись`.

**Smoke-тесты бэкенда (5/5):**
| Сценарий | Ответ |
|---|---|
| Без подписи в metadata | 400 `signature_required` «Подпись обязательна — нарисуйте её…» |
| Пустая строка | 400 `signature_required` «Подпись обязательна…» |
| `data:image/jpeg;base64,…` | 400 `signature_required` «Подпись должна быть PNG…» |
| XSS внутри base64 (`<script>...`) | 400 `signature_required` «Подпись должна быть PNG…» (alphabet check) |
| Валидная PNG-подпись на UNIQUE-дубликат | 409 `act_already_exists` (значит signature_check прошёл) |

**Совместимость с бета-режимом (`is_commercial_mode === false`):** Stage 22b живёт целиком на стороне frontend canvas + backend regex, не зависит от платежей. Работает идентично в обоих режимах.

**Файлы изменены:** 5 файлов (2 новых компонента + 3 правки). Миграции БД нет.

### 25.04.2026 — Stage 22a hardening + полная e2e регрессия (31/31)

**Контекст:** после code-review каркаса Stage 22a выявлены 4 ужесточающих фикса. Одновременно запрошена полноценная регрессия не только smoke (которая была на токене админа), а на реальных ролях.

**Hardening (4 фикса):**
1. **`UNIQUE(booking_id, type)` в `lib/db/src/schema/digital_acts.ts`** — один акт каждого типа на бронь физически невозможно создать дважды. Применено через `pnpm --filter @workspace/db push --force`.
2. **Postgres `23505 → HTTP 409 `act_already_exists`** в `artifacts/api-server/src/routes/digital_acts.ts` (POST handler ловит ошибку UNIQUE и отдаёт «Цифровой акт этого типа уже создан»).
3. **Photo URL whitelist** в том же файле: `const SAFE_UPLOAD_RE = /^\/uploads\/[A-Za-z0-9._-]+\.(jpe?g|png|webp|heic|heif)$/i;` — Zod `.refine()` отбивает внешние URL, `data:`-URI и path-traversal (`/uploads/../etc/passwd`). Это закрывает дыру: до фикса можно было прислать любой текст в `photos[]`.
4. **Фронтовый детект 409 через `ApiError.status`** в `artifacts/hochu-to/src/pages/Dashboard.tsx` (`handleStatusChange`) — раньше парсилось `e.message.includes('digital_act_required')`, что ломалось при i18n; теперь `e instanceof ApiError && e.status === 409 && e.body?.code === 'digital_act_required'`.

**Подготовка тестовой среды (важно для будущих регрессий):**
- ~~Снапшот `scripts/db-snapshots/dev-data.sql` несовместим с текущей схемой~~ — **✅ обновлён (Stage 33.1.5, 02.05.2026)**: `pg_dump --column-inserts --data-only` c расширенным списком таблиц (добавлены pools, pool_shares, share_offers, digital_acts, payments, payout_methods, payout_requests). 379 строк.
- Рабочий путь сейчас: руками создать `admin@hochu.to / Admin123!` (через `/api/auth/register` + `UPDATE users SET role='admin'`), затем `POST /api/admin/seed` (85 регионов + 10 категорий + 6 тестовых пользователей + 14 листингов) + `POST /api/admin/seed-test-listings` (50 объявлений).
- **Тестовые юзеры (все пароль `Test1234!`):**
  - Owners: `alexey@example.com`, `maria@example.com`, `dmitry@example.com`
  - Renters: `irina@example.com`, `sergey@example.com`, `anna@example.com`
- **Login возвращает `{user, token}`** — поле `token`, НЕ `accessToken`. Register требует `role: 'renter'|'owner'`. `itemCategory` enum: `''|electronics|tools|leisure|special_machinery`.
- Переход `confirmed → active` разрешён **только OWNER** (renter может только cancelled/return_pending).

**E2E регрессия `/tmp/test-stage22a-v2.sh` — 31/31 ✅**

| Группа | Сценарии |
|---|---|
| Подготовка | Логины 4 ролей, получение ID, доступный листинг (6) |
| Бизнес-правила | owner не может арендовать своё; pending→confirmed (2) |
| Блок digital_act_required | confirmed→active без акта → 409 (1) |
| Авторизация акта | без auth/чужой/другой renter/другой owner → 401/403 (4) |
| Валидация фото | внешний URL, path-traversal, data-URI, <4 фото → 400 (4) |
| Состояние брони | неверный type, check_out на confirmed → 400/422 (2) |
| Создание акта | check_in renter с GPS+EXIF, check_out owner → 201 (2) |
| UNIQUE / иммутабельность | повтор check_in/check_out → 409 (2) |
| GET акта | owner/renter/admin видят акты, чужой → 403 (5) |
| Happy-path | confirmed→active с актом → 200; sorting (2) |
| Public-settings | listings detail + `/api/public-settings` (2) |
| Admin override | `/api/admin/bookings/:id` доступен админу (1) |

**Что НЕ делалось (намеренно):** реальный UI-скриншот не получен (Replit preview ждёт порт 5000, workflow слушает 5173 — не вмешивался в конфиг). Подключение компонентов на фронте проверено grep'ом по коду — все импорты и вызовы на месте.

**Файлы изменены:** `lib/db/src/schema/digital_acts.ts`, `artifacts/api-server/src/routes/digital_acts.ts`, `artifacts/hochu-to/src/pages/Dashboard.tsx`. Регрессионный скрипт сохранён вне репо: `/tmp/test-stage22a-v2.sh` (создаёт нового stranger каждый раз, без конфликтов).

**Push:** `9d6018f Add digital act functionality for proof of item condition` → `origin/main` (синхронизирован).

### 24.04.2026 вечер — Stage 21b + 22a: Бета-дисклеймеры + Цифровой Акт (каркас)

**Stage 21b — Бета-дисклеймеры:**
- `artifacts/hochu-to/src/pages/ListingDetail.tsx` — под блоком «Итого к оплате» добавлен info-блок «🧪 Бета-режим: списания не происходят» (виден при `publicSettings.isCommercialMode === false`).
- `artifacts/hochu-to/src/pages/Dashboard.tsx` — `SubmitClaimModal` получил `usePublicSettings` + warning-баннер вверху: в бета-режиме компенсации обрабатываются вручную, реальных выплат нет.

**Stage 22a — Цифровой Акт (каркас):**
- **Schema** `lib/db/src/schema/digital_acts.ts`: `id serial`, `bookingId int FK→bookings`, `type 'check_in'|'check_out'`, `photos jsonb (string[]≥4)`, `videoUrl text?`, `metadata jsonb` (EXIF/GPS/devicePlatform), `createdByUserId int FK→users`, `createdAt`. Drizzle-zod схема с `.refine(photos.length≥4)`. Применено `pnpm --filter @workspace/db push --force`.
- **Backend** `artifacts/api-server/src/routes/digital_acts.ts`:
  - `GET /api/bookings/:id/digital-acts` — возвращает все акты брони (отсортированные по createdAt DESC). Доступ: владелец, арендатор, админ.
  - `POST /api/bookings/:id/digital-acts` — создание акта. Auth, проверка участника брони, валидация Zod (photos≥4), запись `created_by_user_id = req.userId`.
- **Backend block** `artifacts/api-server/src/routes/bookings.ts` (PUT `/:id`): при попытке `confirmed → active` проверяется наличие `digital_acts(type='check_in')` для брони. Нет акта → **409 `digital_act_required`** с русским сообщением «Сначала создайте Цифровой акт приёмки (минимум 4 фото)».
- **Frontend** `artifacts/hochu-to/src/components/DigitalActUpload.tsx`: модалка загрузки. File input multi (image/*), preview-сетка, валидация min 4. EXIF + GPS извлекаются через npm `exifr` (peer-warning от orval по typescript — не критично). После выбора файлов — параллельный upload через существующий `POST /api/upload` (multer "photos" max 10, 10MB), затем POST на digital-acts с метаданными `{photoExif: [...], extractedFromExif: true/false, devicePlatform}`.
- **Frontend integration** `artifacts/hochu-to/src/pages/Dashboard.tsx`: добавлены кнопки «🛡️ Цифровой акт приёмки» (в карточках `confirmed` для owner и renter) и «🛡️ Цифровой акт возврата» (в `active` для обеих сторон). State `digitalActModal: { bookingId, type } | null` + рендер `<DigitalActUpload>`. **`handleStatusChange` ловит 409 `digital_act_required`** → автоматически открывает модалку Check-in акта + toast «Загрузите минимум 4 фото вещи перед передачей».
- **Admin visibility** `artifacts/hochu-to/src/pages/AdminPage.tsx`: новый компонент `DigitalActsBlock` в `BookingOverrideModal` — для арбитража. Подгружает акты через `useFetch`, рисует список с бейджем (📥 Check-in / 📤 Check-out), датой, GPS-маркером (если EXIF содержит координаты), сеткой превью 4-в-ряд (клик → открыть фото в новой вкладке). Если актов нет — амбер-предупреждение «Доказательств у сторон нет».
- **Smoke test (24.04.2026 вечер):** workflow `Start application` поднялся, `/api/health → 200`, токен админа `admin@hochu.to` работает, GET/POST `/api/bookings/:id/digital-acts` корректно отвечают auth/404 на несуществующую бронь. Таблица `digital_acts` создана в БД (`to_regclass` подтвердил).

### 24.04.2026 — Stage 21a: Soft Launch Toggle + YooKassa Core
- **Цель:** подготовить публичный бета-запуск без риска для существующих флоу. Все пользовательские потоки (бронирования, контакты, claims, отзывы, цифровые акты, чаты) **визуально не меняются** — переопределяется только финансовая математика и платёжные шлюзы.
- **Master-тумблер:** `platform_settings.is_commercial_mode boolean default false`. Через `publicSettings()` отдаётся во фронт под ключом `isCommercialMode`. Сохраняется в БД через `PUT /api/admin/settings` (есть в `allowed` и `BOOL_FIELDS`).
- **Новая таблица `payments`** (`lib/db/src/schema/payments.ts`): id, user_id, amount_rub, status (pending/succeeded/canceled/refunded/failed), yookassa_payment_id UNIQUE, target_type (promotion/contact_pack/booking_protection), target_id, provider (yookassa/mock), idempotency_key, metadata jsonb, paid_at, timestamps. Применено через `pnpm --filter @workspace/db push --force`.
- **REST-клиент `lib/yookassa.ts`:** Idempotence-Key (поддержка детерминированного ключа), `createPayment` (capture default `true`, опция `capture:false` для будущих холдов броней), `getPayment`, `capturePayment`, `cancelPayment`, `verifyWebhookSignature` (HMAC-SHA256 + timingSafeEqual). Реквизиты: ENV `YOOKASSA_SHOP_ID/SECRET_KEY` имеют приоритет над `platform_settings`.
- **Бета-режим (OFF, по умолчанию):**
  - `routes/bookings.ts` (POST + dates-change recompute) обнуляет serviceFee/taxFee/fundContribution/renterFundContribution.
  - `routes/contacts.ts` (`POST /listings/:id/contact-purchase`) — мгновенный bypass без списания, `source: "beta_free"`, toast «В рамках бета-теста открытие контактов бесплатно!».
  - `routes/promotions.ts` — мок-флоу: продвижение активируется мгновенно, в `payments` пишется `provider:"mock", status:"succeeded", amountRub:0`. Ответ `{mode:"instant"}`.
  - На фронте — sticky `BetaBanner.tsx` (закрывается на 24ч через localStorage), скрыт на `/admin`. Подключён в `App.tsx`.
- **Коммерческий режим (ON):**
  - `routes/promotions.ts` — реальный платёж: создаётся pending-payment без `listing_promotion`, ЮKassa возвращает `confirmation_url`, ответ `{mode:"redirect", paymentUrl}`. **Запись `listing_promotion` создаётся только в webhook** при `succeeded`. Idempotence-Key детерминирован: `promo-payment-${payment.id}`.
  - `routes/webhooks.ts` (`POST /api/webhooks/yookassa`) — верифицирует HMAC-подпись через **raw body** (`req.rawBody` из `express.json({ verify })`), подтверждает статус через `getPayment` (защита от подмены payload), внутри транзакции делает `SELECT ... FOR UPDATE` по `yookassa_payment_id` (anti-replay для параллельных вебхуков), создаёт `listing_promotion` + активирует флаги VIP/Срочно/Boost (`GREATEST(now, текущее) + interval days`).
  - `/api/promotions/admin` — выручка считается строго по `payments(status='succeeded' AND target_type='promotion' AND provider='yookassa')`. Мок (0₽) и pending не учитываются.
  - В админке (`pages/AdminPage.tsx` таб «Платежи») — крупный блок «Коммерческий режим (ИП + ЮKassa)» с тумблером и предупреждениями.
- **Безопасность (пост-review фиксы):**
  - HMAC-SHA256 + `timingSafeEqual` (защита от timing-атак).
  - В production без `YOOKASSA_WEBHOOK_SECRET` — fail-closed (401), в dev — принимаем без подписи.
  - Поддержка форматов заголовка: `sha256=<hex>` и `<hex>`.
- **Новые ENV:** `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`, `YOOKASSA_WEBHOOK_SECRET`. Webhook URL: `https://<домен>/api/webhooks/yookassa` для событий `payment.succeeded`, `payment.canceled`.
- **Известные ограничения:**
  - В webhook сейчас активируется только `target_type=promotion`. `contact_pack` (Stage 21b) и `booking_protection` (Stage 21c) — следующие итерации.
  - `is_commercial_mode` — отдельный master-toggle, независимый от полей «ЮKassa включена» (Stage 20c).
- **Файлы:** `lib/db/src/schema/{platform_settings.ts,payments.ts,index.ts}`, `artifacts/api-server/src/{app.ts,lib/yookassa.ts,lib/platform-settings.ts,routes/{bookings.ts,contacts.ts,promotions.ts,webhooks.ts,admin.ts,index.ts}}`, `artifacts/hochu-to/src/{App.tsx,components/{BetaBanner.tsx,PromoteListingModal.tsx},pages/AdminPage.tsx}`.

### 23.04.2026 утро+1 — Hotfix: «вечная Москва» в шапке региона
- **Симптом:** в шапке региона постоянно появлялась «Москва» — даже после автоопределения геолокации (через кнопку или Catalog) при переходе на другую страницу регион снова сбрасывался на Москву.
- **Корень бага (3 цепляющиеся проблемы):**
  1. **Backend `/api/geoip` для local IP жёстко возвращал `regionSlug:"moscow"`** (строка 71 `geoip.ts`). На Replit-превью все запросы идут с локальных IP (10.x/127.0.0.1) → бэк всегда отдавал Москву → фронт это кешировал в `localStorage` на 7 дней.
  2. **Catalog обновлял локальный стейт + кеш, но не RegionContext** → шапка не видела свежее значение и при следующей навигации читала стрый кеш «moscow».
  3. **Header useEffect** не вызывал `detectRegionByServerGeoIP` сам — только читал кеш. И при каждом remount `if (preferred) setSelectedRegion(preferred)` мог перезаписать актуальный выбор пользователя в контексте.
- **Что исправлено:**
  - `artifacts/api-server/src/routes/geoip.ts` — для local IP теперь отдаём `{regionSlug:null, local:true}` вместо хардкода Москвы.
  - `artifacts/hochu-to/src/components/layout/Header.tsx` — useEffect теперь: (а) НЕ перезаписывает `selectedSlug`, если он уже стоит в контексте; (б) если кеша и профиля нет — активно вызывает `detectRegionByServerGeoIP(regions)` через бэкенд и сохраняет результат.
  - `artifacts/hochu-to/src/pages/Catalog.tsx` — обёртка `setRegion(slug)` теперь синхронно обновляет и локальный стейт, и `useRegion()`-контекст шапки → определённый на каталоге регион сразу виден в Header.
  - `artifacts/hochu-to/src/lib/region-context.tsx` — формат кеша получил поле `v: GEO_CACHE_VERSION = 2`. У всех клиентов с залежавшейся «moscow» кеш будет одноразово сброшен и перезаписан корректным значением.
- **Файлы:** `artifacts/api-server/src/routes/geoip.ts`, `artifacts/hochu-to/src/components/layout/Header.tsx`, `artifacts/hochu-to/src/pages/Catalog.tsx`, `artifacts/hochu-to/src/lib/region-context.tsx`.

### 23.04.2026 утро — Stage 16: Verified Reviews — крючок lock-in
- **Контекст:** базовая система отзывов уже была построена (схема `reviewsTable` с типами `listing`/`renter`, эндпоинты `POST /api/reviews` + `GET /can-review/:bookingId` с проверкой `booking.status==='completed'`, форма на `ListingDetail`, модалка и `handleOpenReview` в `Dashboard`, кнопки «Оценить вещь / арендатора» в History-табе). Цель итерации — закрыть **3 пробела** из промта Stage 16, которые делают систему «доверенной» и подталкивают пользователей переходить в нашу платформу.
- **(1) UNIQUE-индекс на уровне БД** — `reviews_unique_per_booking_author_type ON reviews(booking_id, author_id, review_type) WHERE booking_id IS NOT NULL`. До этого был только app-level dedup, что допускало race condition при двойном клике. Зафиксирован в `lib/db/src/schema/reviews.ts` через `uniqueIndex(...)` (drizzle-kit push не удалит индекс).
- **(2) Tooltip «Только проверенные отзывы»** на `ListingDetail.tsx` рядом с рейтингом-плашкой: title-атрибут «Только проверенные отзывы. Оставить отзыв можно лишь после завершённой сделки через платформу — поэтому накрутка невозможна» + иконка `ShieldCheck`. Главный психологический крючок: владельцы видят, что репутацию **нельзя получить, минуя платформу**, — это и есть lock-in.
- **(3) CTA «Оцените сделку» прямо в `BookingCard`** (incoming/outgoing табы) — раньше кнопки были только в History-табе. Теперь после завершения сделки (`status==='completed'`) в обычном списке броней появляется яркая кнопка: для арендатора — «Оцените сделку — оставьте отзыв о вещи и владельце» (amber), для владельца — «Оцените сделку — оставьте отзыв об арендаторе» (blue). Кнопка использует **существующий** `handleOpenReview` и общую модалку — без дублирования стейта. После отправки `reviewedIds` показывает «Отзыв оставлен — спасибо!» с зелёной галкой.
- **Что сделано НЕ было** (осознанно отложено): денормализация `users.rating_avg` + `users.review_count` для быстрых запросов. Сейчас рейтинг считается агрегацией из `reviews` per-listing — на текущих объёмах (4 отзыва) JOIN не тормозит. Добавим, когда упрёмся в производительность.
- **Файлы:** `lib/db/src/schema/reviews.ts` (UNIQUE), `artifacts/hochu-to/src/pages/ListingDetail.tsx` (tooltip + ShieldCheck), `artifacts/hochu-to/src/pages/Dashboard.tsx` (CTA в BookingCard), `scripts/db-snapshots/dev-data.sql` (обновлён).

### 23.04.2026 ночь+4 — Stage 15: Переносимость на новый Replit-аккаунт
- **Цель:** возможность открыть проект с любого Replit-аккаунта и за 2 команды восстановить полное окружение.
- **Создан скрипт `scripts/setup-new-replit.sh`** — единая точка входа: проверяет `DATABASE_URL`, ставит deps, накатывает схему через `drizzle-kit push`, заливает снапшот тестовых данных, подсказывает про `SESSION_SECRET`/`GITHUB_TOKEN`.
- **Создан снапшот `scripts/db-snapshots/dev-data.sql`** (68 КБ, 502 строки) через `pg_dump --data-only --column-inserts` — содержит все 7 пользователей с bcrypt-хешами, 22 объявления, 7 броней, 4 отзыва, 1 тикет, 1 заявку фонда, балансы контактов, аудит-лог, настройки платформы и newsletter. **На новом Repl всё восстановится 1-в-1.**
- **Добавлен раздел 5a в `docs/AGENT_INSTRUCTIONS.md`** — пошаговая инструкция импорта из GitHub, установки секретов, запуска setup-скрипта, альтернатива «чистая БД через seed», команда обновления снапшота, список того что НЕ переносится автоматом (uploads, JWT-сессии).
- **Добавлен раздел Quick Setup в `replit.md`** — короткая ссылка для агента, всегда в памяти.
- **Что НЕ автоматизируется на новом аккаунте (требует ручных действий):**
  1. `SESSION_SECRET` — обязательно установить в Tools → Secrets (`openssl rand -hex 32`).
  2. `GITHUB_TOKEN` — для пуша (опционально, токен есть в разделе 2 документации).
  3. `/uploads/*` — пустая папка (загруженных аватаров пока нет, не критично).
- **Файлы:** `scripts/setup-new-replit.sh`, `scripts/db-snapshots/dev-data.sql`, `docs/AGENT_INSTRUCTIONS.md` (раздел 5a), `replit.md`.

### 23.04.2026 ночь+3 — Stage 14: Bug hunt + фиксы валидации
- **Систематический прогон 19 негативных сценариев** через REST: чужие ресурсы, отрицательные цены, SQL-инъекции, конкурентные брони, weak passwords, длинные тексты — большинство уже корректно отбиваются.
- **Проверка ложных «багов» из прошлого отчёта:**
  - `GET /api/admin/claims` — путь действительно отсутствует, **но** AdminPage использует `GET /api/claims` (с проверкой роли в `claims.ts:9-15`) — работает корректно. Не баг.
  - Admin тикеты — есть отдельный `/api/admin/tickets` (admin.ts:832), AdminPage его и использует. Личный `/api/support/tickets` отдаёт только свои тикеты по дизайну. Не баг.
- **Найдено и исправлено 4 реальных бага** (с учётом code-review архитектора):
  1. **Бронь с `endDate < startDate`** проходила без ошибки → `bookings.ts` POST: введён хелпер `validateRange(start,end)` → `400 invalid_dates`.
  2. **Бронь на прошедшую дату** проходила → `start < todayStr` в том же хелпере → `400 invalid_dates`.
  3. **Невалидный формат даты** (`2026-13-40`, ISO datetime `2026-04-23T10:00:00Z`) проваливался в lex-сравнение → ранний regex-чек `/^\d{4}-\d{2}-\d{2}$/` + `isNaN(new Date(...).getTime())` → `400 invalid_date_format`.
  4. **Неизвестный `/api/*` в dev** возвращал HTML 404 (Express default) → `app.ts`: catch-all `app.use("/api", ...)` после роутов отдаёт `{ error: "not_found" }` JSON в любом окружении.
- **После code-review:** валидация дат вынесена в локальный хелпер `validateRange()` и вызывается **в обеих ветках** (Direct и Premium) на effective dates после нормализации `?? today` — закрыли пропуск через partial input, на который указал архитектор.
- **Прошли проверки (валидация уже была корректной):**
  - SQL-инъекции в поиске: параметризованные запросы, `q="' OR 1=1--"` → 200, естественные результаты.
  - Self-booking own listing → 400 «Нельзя арендовать свою вещь».
  - Конкурентные брони на пересекающиеся даты → 400 «Выбранные даты уже заняты».
  - Отзыв без завершённой брони → 400 validation_error.
  - Rating > 5 / отрицательный → 400.
  - Невалидный JWT → 401 (auth middleware).
  - Доступ к чужим ресурсам через PATCH/POST на чужой ID → 403/404.
- **Файлы:** `artifacts/api-server/src/routes/bookings.ts`, `artifacts/api-server/src/app.ts`.
- **Тестовый мусор удалён** (брони id 8-12 из охоты), бд снова в чистом состоянии: 7 броней, 22 объявления.

### 23.04.2026 ночь+2 — Stage 13: Профиль администратора + полный тест
#### Профиль администратора (UX)
- **Проблема:** при входе под `admin@test.ru` пользователь попадал на обычную страницу «Настройки профиля» с переключателем ролей «Арендатор/Владелец», полем «О себе», соцсетями, счётчиком завершённых аренд — бессмысленным для служебного аккаунта.
- **Решение:** `Dashboard.tsx` — условный рендер: при `user.role === "admin"` вместо обычной формы показывается `AdminAccountPanel`.
- **Новый компонент `AdminAccountPanel`** (добавлен в конец `Dashboard.tsx`):
  1. **Хедер** — оранжевый бейдж «Администратор платформы» (Shield-иконка, фирменный `#C65D3B`), имя, email, дата вступления. Аватар с заменой. Сноска «Профиль не показывается арендаторам».
  2. **Быстрый доступ** — 4 кнопки: Админ-панель `/admin`, Денежные потоки `/admin?tab=finance`, Аналитика `/admin?tab=analytics`, Журнал аудита `/admin?tab=audit`.
  3. **Личные данные** — только имя и телефон (для подписи в поддержке и связи между админами). Без ролей, bio, регионов, соцсетей.
  4. **Безопасность** — раскрывающаяся секция: смена email + пароля через существующий `PUT /api/users/:id/credentials` с проверкой текущего пароля. С предупреждением «разлогинит на других устройствах».
- **Импорты:** добавлены `Shield`, `KeyRound`, `ScrollText`, `Activity`, `ExternalLink`, `BarChart2`, `ChevronRight` из lucide-react.

#### Code review Stage 12 → исправления
- **Фильтр периода применён к claims:** `claimsWhere` теперь включает `gte(claimsTable.updatedAt, since)`, все 4 KPI (`fund.out`, `fund.balance`, `counts.paidClaims`, `revenue.*`) попадают в одно временное окно.
- **Default period = `month`** (раньше был `all`), синхронизирован с OpenAPI-контрактом.
- **Валидация enum period:** неизвестное значение → `400 { error: "invalid_period" }`. Проверено: `?period=invalid` → HTTP 400.
- **Integer-округление:** все денежные поля заменены с `parseFloat(x.toFixed(2))` на `Math.round(x)` → соответствует OpenAPI-типу `integer`.

#### Полный тест-прогон (23.04.2026)
- Тестовые аккаунты: `admin@test.ru / Admin1234!`, `alexey@example.com / Test1234!` (owner), `anna@example.com`, `irina@example.com`, `sergey@example.com` (renters) / `Test1234!`.
- **Тестовые данные созданы:**
  - +5 объявлений: велосипед Trek, шуруповёрт Bosch, палатка Marmot (Алексей), мотоблок Нева, JBL PRX825W (Дмитрий)
  - +5 броней (Direct и Premium, разные статусы: pending, completed)
  - +2 отзыва (Алексей 5.0⭐, Анна 5.0⭐)
  - +1 тикет поддержки, +1 заявка в Гарантийный фонд, +1 совместная закупка
- **Корректные пути API (найдено в тестах):**
  - `/api/me/contact-balance` (не `/contacts/balance`)
  - `/api/claims/my` (список заявок пользователя)
  - `/api/claims` POST — обязательное поле `type` (значения: `damage`, `loss` и т.д.)
  - `/api/support/tickets` POST — поле `body` (не `message`)
  - `/api/admin/audit-log` (не `/audit`)
  - `/api/reviews` POST — `reviewType: "listing"` (renter→листинг) или `"renter"` (owner→арендатор), поле `text` (не `comment`)
- **Найдено 2 мелких бага:**
  1. Admin не видит чужие тикеты через `GET /api/support/tickets` → не может ответить через API-тест (в UI AdminPage это работает через свой запрос).
  2. `GET /api/admin/claims` → 404 (путь не зарегистрирован, в UI обходится напрямую).
- **Итог:** 22 объявления, 7 пользователей, 7 броней, revenue=2123₽ в бд после тестов.

### 23.04.2026 ночь+1 — Stage 12: Денежные потоки (derived ledger)
- **Backend:** новый роут `artifacts/api-server/src/routes/finance.ts` с двумя эндпоинтами:
  - `GET /api/me/finance` — личный журнал пользователя (summary + entries[]) выведен на лету из `bookings` и `contact_purchases`. Типы записей: `rent_payout`, `rent_paid`, `direct_cash_in/out`, `contact_fee_paid`, `contact_topup`, `fund_in/out`, `deposit_hold/release`. Статусы: `pending`, `settled`, `off_platform`, `held`.
  - `GET /api/admin/finance?period=today|week|month|all` — агрегаты платформы: revenue (service+tax+contacts), fund (in/out/balance), payouts (pending/settled), counts, recent[50].
  - Регистрация в `routes/index.ts`. Без миграций — структура подготовлена под будущий реальный платёжный шлюз.
- **Frontend:**
  - `Dashboard.tsx`: новая вкладка «Финансы» (иконка Coins) с KPI-карточками, фильтром по типу записи и таблицей транзакций. Иконки `ArrowDownToLine` (in) / `ArrowUpFromLine` (out) / `Clock` (pending).
  - `AdminPage.tsx`: новый таб «Денежные потоки» (иконка Banknote, между «Аналитика» и «Пользователи»). KPI-сетка 2×4 (Выручка / Фонд / К выплате / Выплачено), счётчики, переключатель периода, таблица последних 50 сделок с детализацией (сервис / налог / фонд / выплата владельцу).
- **OpenAPI:** в `lib/api-spec/openapi.yaml` добавлены пути `/me/finance`, `/admin/finance` и схемы `FinanceEntry`, `FinanceSummary`, `UserFinanceResponse`, `AdminFinanceResponse`. Codegen прогнан → `lib/api-zod` и `lib/api-client-react` обновлены.
- **Smoke-тест:** owner alexey — lifetimeEarned 9480 ₽, pendingPayout 11850 ₽; admin — revenue total 1969 ₽ (service 1200 + tax 720 + contacts 49), fund balance 1200 ₽.

### 23.04.2026 ночь — UX мотивация ListingDetail для обеих сторон
- Карточка объявления переписана так, чтобы пользователи видели **выгоды**, а не сухие затраты.
- **Арендатор** в раскрытом блоке «Сервис и защита»:
  - «Безопасная сделка через эскроу» + объяснение «Деньги попадают владельцу только после того, как вы получили вещь. Чек, поддержка и проведение возврата — на нас.»
  - «Защита Гарантийным фондом» + «Если случится поломка, утеря или спор — фонд компенсирует ущерб **по решению арбитража** (в пределах лимита). Вы не остаётесь один на один с владельцем.»
  - Финальная фраза-сравнение: «личная встреча с незнакомцем, наличные, риск залогом» vs «карта, защита и поддержка за N ₽ на всю сделку».
- **Владелец** видит зелёную карточку «На карту: X с суток — чистыми», и в ON-режиме объяснение про эскроу/поддержку, в OFF-режиме — мягкая формулировка про эквайринг и чек.
- Блок «Гарантийный фонд подключён» расширен до 3 конкретных пунктов: компенсация до лимита по арбитражу, +просмотры 2× чаще, нейтральный арбитраж. Метрика 2× согласована между ON-зелёным и OFF-амбер блоками.
- Файл: `artifacts/hochu-to/src/pages/ListingDetail.tsx`.

### 23.04.2026 поздний вечер — Bug fix несогласованности категорий
- В `lib/api-spec/openapi.yaml` enum `itemCategory` содержал только три значения (`electronics / tools / leisure`), но админская вкладка «Экономика», `utils.ts`, расчёт `maxProtectionLimit` и слаг-маппинг `auto → special_machinery` использовали четыре. POST/PATCH `/api/listings` со `special_machinery` отбрасывался zod-валидацией → множитель `protMultSpecialMachinery` никогда не применялся.
- Добавлен `special_machinery` в OpenAPI enum.
- Перегенерированы `lib/api-zod` и `lib/api-client-react` через `pnpm --filter @workspace/api-spec run codegen`.
- В `routes/listings.ts` расширены TS-касты (POST + PATCH) и добавлено `special_machinery: 5000` в обе карты `categoryAvg` (детектор аномальной цены).
- В `ListingForm.tsx` расширен payload-каст.
- Подчищен устаревший комментарий в `lib/db/src/schema/listings.ts`.
- Smoke-тест: POST с `itemCategory:"special_machinery"` → 200, `maxProtectionLimit: 25000` (применился множитель + кап для новичка).

### 23.04.2026 поздний вечер — Stage 17a: Payout Requests (заявки на выплату)
- **Контекст:** аудит экономики выявил 7 пробелов; самая болезненная — владелец зарабатывает в Premium-сделках, но не может вывести деньги. Решение без интеграции эквайринга — внутренний реестр.
- **Schema (lib/db/src/schema):**
  - `payout_methods.ts` — реквизиты владельца: type `card|sbp`, `cardLast4` (PCI-safe, полный номер не храним), `holderName`, `bankName`, `sbpPhone`, `sbpBank`, `isDefault`. Уникальный индекс на (userId, isDefault) через partial unique.
  - `payout_requests.ts` — заявки: `amountRub`, status enum `pending|approved|paid|rejected`, `methodSnapshot` jsonb (фиксация реквизитов на момент заявки), `bookingIds` jsonb int-массив, `adminNote`, `rejectionReason`, `paymentRef` (ссылка на чек/референс перевода), `paidAt`.
  - `bookings.ts` — добавлены `payoutSettledAt timestamp NULL` и `payoutRequestId int NULL` (закрывает бронь от повторного включения в новые заявки).
  - Миграция применена через `drizzle-kit push --force`.
- **Backend (`artifacts/api-server/src/routes/payouts.ts` ~430 строк):**
  - User CRUD: `GET/POST/PATCH/DELETE /api/me/payout-methods`. POST принимает полный номер карты, маскирует до last4, дальше не хранит.
  - User: `GET /api/me/payouts` — список своих заявок + summary (`available`, `inActiveRequests`, `eligibleSum`, `minPayoutRub`).
  - User: `POST /api/me/payouts` — создание заявки. Логика available = `Σ(ownerPayout по completed-броням без payoutSettledAt)` − `Σ(amount по pending+approved заявкам)`. Минимум `MIN_PAYOUT_RUB=500`. При создании броньки фиксируются на `payoutRequestId`.
  - Admin: `GET /api/admin/payouts?status=…` — очередь с join по owner.
  - Admin: `POST /api/admin/payouts/:id/approve` — переход pending→approved.
  - Admin: `POST /api/admin/payouts/:id/mark-paid` — транзакционно: status→paid, `paidAt=now`, `paymentRef`, и `bookings.payoutSettledAt=now` для всех bookingIds. После этого брони уже не попадают в available.
  - Admin: `POST /api/admin/payouts/:id/reject` — транзакционно: status→rejected + отвязка `bookings.payoutRequestId=NULL` (брони возвращаются в «доступные»).
  - Inline-валидация без zod (api-server не имеет прямой зависимости).
- **finance.ts:** `summary` обогащён `availableForPayout` и `inActiveRequests`. Settled-брони (`payoutSettledAt IS NOT NULL`) исключаются из `pendingPayout`. В `entries` добавлены типы `payout_request`, `payout_paid`, `payout_rejected`.
- **Frontend Dashboard.tsx — FinanceTab → PayoutsBlock:**
  - Карточка «Доступно к выводу» (зелёный) + «В активных заявках» + кнопка «Запросить выплату» (disabled если < 500 ₽).
  - Подсекция «Реквизиты для выплат» — список с дефолтным методом, добавление/удаление.
  - Список своих заявок со статусами, методом, суммой, причиной отклонения / референсом перевода.
  - Модалки: `RequestPayoutModal` (выбор метода + опциональная сумма), `AddPayoutMethodModal` (форма карта/СБП).
- **Frontend AdminPage.tsx — таб «Выплаты» (icon Wallet):**
  - Фильтр по статусу (pending/approved/paid/rejected/all).
  - Карточка каждой заявки: владелец, сумма, реквизиты-снимок, список ID броней.
  - Кнопки `Одобрить` (с confirm), `Отклонить` (модалка с причиной), `Отметить «Выплачено»` (модалка с референсом + комментарием).
- **Что НЕ сделано (требует ЮKassa и т.п.):** автоматический трансфер денег, эскроу, KYC по 115-ФЗ, автосписание налогов с самозанятых.

### 23.04.2026 вечер — Подключение «фантомных» настроек платформы
- Полный аудит `platform_settings`: выявлено 15+ полей, которые были в UI-форме админки, но не применялись в логике бэкенда.
- `calcMaxProtection` в `listings.ts` переписана как `async`, читает `protMultElectronics/Tools/Leisure/SpecialMachinery`, `newUserProtectionCap`, `newUserDealsThreshold` из базы вместо хардкодов.
- POST `/listings`: добавлены проверки `freeListingsEnabled` (403), `freeListingsMaxPerOwner` (422), `freeListingsRequirePhone` (422).
- GET `/listings/:id`: маскирует `ownerPhone → null` если `freeShowOwnerPhoneMode = after_payment`.
- GET `/listings`: добавлен `sort=protected_first` (Premium выше Free); дефолт берётся из `defaultCatalogSort`.
- POST `/bookings`: проверяет `freeToPremiumUpgradeEnabled` перед Free→Premium апгрейдом.
- `ListingForm.tsx`: `onError` обрабатывает коды `free_disabled`, `free_limit_reached`, `phone_required` → понятные toast-уведомления.

### 23.04.2026 день — Экономика Модель А + Variant 3
- `calculateTotalPrice` в `lib/utils.ts` полностью переписана: новый интерфейс `PriceBreakdown` с `fundShare`, `ownerFundContrib`, `renterFundContrib`, `isFreeUpgrade`. Старые поля (`shieldFee`, `riskCoverage`, `combinedServiceFee`) сохранены как deprecated-алиасы для `ListingForm` и `ListingCard`.
- `bookings.ts`: create и reschedule пересчитаны по Модели А. Три ветки: Premium (оба опт-инули), Variant 3 (Free + рентер апгрейдит), Free прямой расчёт.
- `ListingDetail.tsx`: чекбокс «Защитить через Гарантийный фонд»; дефолт — включён на Premium, выключен на Free; описание меняется в реальном времени.
- Хардкод `150 ₽` заменён на `contactPriceSingle` в 3 местах.
- Унификация секции фонда в `AdminPage.tsx`: два поля вместо четырёх; `onChange` одновременно пишет в `shieldFee*` и `riskCoverage*`.
- Зеркалирование в `admin.ts`: при сохранении одной пары автоматически обновляется другая.

### 23.04.2026 утро — Хотфиксы бронирования и шапки
- `audit_log`: таблица создана через `push-force`.
- Header (lg breakpoint): иконки и бейджи уменьшены, текст и аватар появляются с xl.
- Бронирование «Прямой расчёт»: `protectionEnabled` и `renterProtectionEnabled` добавлены в Zod-схему.
- `ListingDetail`: `onError` выводит сообщение сервера в баннер.

---

## 12a. Чек-лист переезда на новый Replit-аккаунт

> Готовность: **высокая**. Весь код в GitHub, БД дампится автоматически, секретов почти нет.
> Если что-то незакоммичено локально — сначала пушни (см. §13), потом переезжай.

### Что унесёт переезд автоматически (после `git clone` + setup-скрипта)
- ✅ Весь исходный код (pnpm monorepo)
- ✅ Схема БД (через `pnpm --filter @workspace/db push`)
- ✅ Тестовые данные: 7 пользователей, 22 объявления, 7 броней, регионы, категории, отзывы, нотификации, и т.д. — `scripts/db-snapshots/dev-data.sql` (~590 INSERT-ов, актуален на 23.04.2026 23:00)
- ✅ Загруженные изображения объявлений (~10 МБ, 20 файлов в `artifacts/api-server/uploads/`) — лежат прямо в репо
- ✅ Конфиги: `.replit`, `replit.nix`, `pnpm-workspace.yaml`, `tsconfig.base.json`, и т.д.
- ✅ Документация: `docs/AGENT_INSTRUCTIONS.md` (журнал всех итераций), `replit.md`

### Что нужно сделать вручную на новом аккаунте
1. **Создать новый Repl** → импортировать из GitHub (`pdkiller666/Hochu_to`).
2. **Tools → Database** → подключить **PostgreSQL 16**. Replit создаст `DATABASE_URL` автоматически.
3. **Tools → Secrets** → добавить:
   - `GITHUB_TOKEN` = `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` (для `scripts/github-push.sh`)
   - **больше ничего не нужно** — auth работает на cookie без подписи, JWT-секрета нет.
4. В Shell: `bash scripts/setup-new-replit.sh` — установит зависимости, накатит схему, зальёт снапшот.
5. Нажать **Run** (workflow «Start application» уже сконфигурирован).

### Тестовые аккаунты после восстановления
- `admin@example.com` / `admin123` — администратор
- `owner1@example.com`, `owner2@example.com` / `owner123` — владельцы (есть Premium-брони → доступны выплаты)
- `renter1@example.com`, `renter2@example.com` / `renter123` — арендаторы

### Перед самим переездом (на старом аккаунте)
1. **Запушить всё** — `bash scripts/github-push.sh "финальный коммит"` из Shell.
2. **Обновить снапшот БД**, если со времени последнего обновления (см. метку выше) накапливал данные:
   ```bash
   PGSSLMODE=require pg_dump "$DATABASE_URL" --data-only --inserts --no-owner --no-acl --schema=public > scripts/db-snapshots/dev-data.sql
   git add scripts/db-snapshots/dev-data.sql && git commit -m "Refresh DB snapshot" && bash scripts/github-push.sh "Refresh DB snapshot"
   ```
3. **Проверить uploads** — если добавлял новые фото листингов, они должны быть в `artifacts/api-server/uploads/` и закоммичены (`uploads/` НЕ в `.gitignore`).
4. **Amvera-деплой** — переезд не затронет, т.к. он деплоится из GitHub по webhook независимо от Replit-аккаунта.

### Что НЕ переедет (и не нужно)
- ❌ Данные production-БД на Amvera — это отдельная база, доступ через её панель.
- ❌ Replit-checkpoints — не переносятся между аккаунтами; это нормально, т.к. в GitHub есть полная история.
- ❌ Local-only файлы в `/tmp/`, `node_modules/`, `dist/`, `.expo/` — пересоздадутся.

---

## Журнал — Stage 17b-core (Compensation Payouts)

**Дата:** 2026-04-23
**Цель:** замкнуть цикл гарантийного фонда — заявки на компенсацию реально приводят к выплате получателю.

**Что сделано:**
1. **Schema (`lib/db/src/schema/claims.ts`)** — добавлены поля:
   - `payoutToUserId` (int) — кому платить (owner или renter из брони)
   - `payoutMethodId` (int) — выбранные реквизиты получателя
   - `methodSnapshot` (jsonb) — PCI-safe снапшот реквизитов на момент approve
   - `paymentRef` (text), `paidAt` (timestamp) — заполняются при mark-paid
   - `rejectionReason` (text) — причина отклонения
2. **Backend (`artifacts/api-server/src/routes/claims.ts`)** — полностью переписан:
   - `GET /claims/fund-status` — баланс фонда (in/out/balance) для админа.
   - `GET /claims/payout-methods/:userId` — реквизиты получателя для админа.
   - `GET /claims/my` — мои заявки.
   - `POST /claims` — валидация: только Premium-сделка, описание ≥10 симв., requestedAmount ≤ maxProtectionLimit (через JOIN `listings`), нет дубликатов, уведомления второй стороне + админам.
   - `PATCH /claims/:id` — admin меняет статус pending↔admin_review/adminNote; user правит evidence/description пока pending.
   - `POST /claims/:id/approve` — admin: указывает payoutToUserId, payoutMethodId, approvedAmount; проверяет, что получатель — участник брони, сумма ≤ maxProtectionLimit и ≤ fund.balance; снимает snapshot реквизитов; уведомляет получателя и заявителя.
   - `POST /claims/:id/mark-paid` — admin фиксирует paymentRef, paidAt; повторная проверка баланса фонда; уведомляет получателя.
   - `POST /claims/:id/reject` — обязательная rejectionReason; уведомление заявителю.
3. **Frontend Dashboard (`Dashboard.tsx`)**:
   - Кнопка «Подать претензию» в карточках завершённых Premium-броней (history-таб, рядом с «Оценить»).
   - Модалка `SubmitClaimModal` — выбор типа (повреждение/кража), описание, ссылка на доказательства, запрашиваемая сумма с подсказкой лимита.
   - Блок `MyClaimsBlock` в `FinanceSection` — список моих заявок со статусами, причиной отклонения, комментарием админа, paymentRef.
4. **Frontend AdminPage (`AdminPage.tsx`)** — таб «Заявки фонда» переписан:
   - 3 KPI-карточки фонда (поступления / выплаты / доступный баланс).
   - Фильтры: активные / на рассмотрении / ожидают выплаты / выплачены / отклонённые / все.
   - В карточке claim: статус, тип, заявитель, сумма (запрошена/одобрена), бронь, snapshot реквизитов, кнопки.
   - Модалки `ClaimApproveModal` (выбор владелец/арендатор → подгрузка реквизитов → сумма с проверками лимита и баланса фонда), `ClaimMarkPaidModal` (paymentRef), `ClaimRejectModal` (rejectionReason).

**Что игнорирует/не делает (бэклог Stage 17b-limits):**
- Резерв фонда (% поступлений неприкосновенный).
- Лимит claims на пользователя в месяц.
- Лимит на одно объявление как % от maxProtectionLimit.
- График баланса фонда по дням, топ-получателей, флаг подозрительных паттернов.

**Миграция:** выполнена через `pnpm --filter @workspace/db push --force` — добавлены 6 новых колонок в `claims`. Существующие записи сохранены (новые поля nullable).

**Проверено:**
- `tsc --noEmit` — новых ошибок в claims.ts нет (старые в admin.ts/contacts.ts не моя зона).
- API живой (200 OK на /api/health), Dashboard и AdminPage компилируются (vite 200 OK).

---

## Журнал — Stage 17b-limits (Резерв и анти-фрод лимиты фонда)

**Цель:** управляемая защита фонда от слива через массовые «царапины» и недобросовестные claims.

**Схема (`platform_settings`)** — добавлены 4 поля:
- `fundReserveRatioPct` (default 20) — % поступлений, который не выдаётся.
- `maxClaimAmountSingleRub` (default 150 000) — лимит одной выплаты, ₽ (0 = без лимита).
- `maxClaimsPerUserMonth` (default 3) — лимит активных/одобренных/выплаченных claims на одного юзера за месяц (rejected не считаются).
- `maxClaimAmountPerListingPct` (default 100) — потолок одной выплаты как % от `maxProtectionLimit` объявления.

**Backend (`artifacts/api-server/src/routes/claims.ts`):**
- `calcFundBalance()` теперь возвращает дополнительно `reserve`, `availableForClaims`, `reserveRatioPct`. Эндпоинт `/fund-status` отдаёт расширенный объект.
- `countClaimsThisMonth(userId)` — счёт по `createdAt >= 1 число месяца` и `status != 'rejected'`.
- `POST /claims`: проверки `maxClaimAmountSingleRub`, `maxClaimAmountPerListingPct`, `maxClaimsPerUserMonth` (HTTP 400 / 429 с понятными русскими сообщениями).
- `POST /claims/:id/approve`: те же лимиты + `availableForClaims` вместо `balance`.
- `POST /claims/:id/mark-paid`: повторная проверка `availableForClaims`.

**UI:**
- AdminPage → Claims: KPI-блок расширен с 3 до 5 карточек (Поступило / Выплачено / Баланс / Резерв % / К выплате). `ClaimApproveModal` получает `availableForClaims` как ограничение.
- AdminPage → Settings: новый раздел «Гарантийный фонд — анти-фрод» с 4 полями. Все 4 имени добавлены в `INT_FIELDS` (валидация целое ≥ 0).

**Миграция:** `pnpm --filter @workspace/db push --force` — добавлены 4 колонки `integer NOT NULL DEFAULT …`. Существующие записи получили дефолты автоматически.

**Что осталось на потом (вне scope):** график баланса фонда по дням, топ-получатели, флаг подозрительных паттернов (несколько claims на одну категорию подряд).

**Проверено:** API живой (200 OK на `/api/health`), `/api/claims/fund-status` отдаёт 401 без токена (норма), Vite билд 200 OK.

---

## Журнал — Stage 17c (Аналитика гарантийного фонда)

**Цель:** дать админу инструменты быстрого аудита фонда — увидеть динамику баланса, кому уходят деньги и есть ли подозрительные паттерны.

**Backend (`artifacts/api-server/src/routes/claims.ts`):**
- Новый эндпоинт `GET /api/claims/analytics?days=7|30|90` (admin only).
- Возвращает три блока:
  - `daily[]` — за последние N дней: дата, поступления (completed Premium-брони), выплаты (paid claims), накопительный баланс. Стартовый баланс окна берётся из всех событий «до». Считает напрямую SQL (TO_CHAR + GROUP BY).
  - `topRecipients[]` — топ-10 получателей выплат за всё время (GROUP BY `payoutToUserId`, JOIN users).
  - `suspicious[]` — пользователи с ≥2 не-rejected заявок за последние 90 дней; для каждого проставлены человекочитаемые причины (`3 заявок за 90 дней`, `2 отклонены`, `2 уже выплачены`).

**UI (`artifacts/hochu-to/src/pages/AdminPage.tsx`):**
- В `ClaimsTab` добавлена кнопка «Показать аналитику фонда» справа от фильтров. Раскрывает блок `FundAnalyticsBlock` (lazy — fetch только по клику).
- Блок содержит:
  - Переключатель окна: 7 / 30 / 90 дней.
  - LineChart (recharts) с тремя линиями: баланс (фиолетовая), поступления (зелёная), выплаты (красная). Подписи дат сокращены до `MM-DD`.
  - Таблица топ-получателей.
  - Список флагов с цветными бейджами причин и итоговой запрошенной суммой; если флагов нет — зелёное «Подозрительной активности не обнаружено».

**Зависимости:** `recharts ^2.15.2` уже в `package.json`. БД-миграций не требуется.

**Проверено:** API живой (200 OK на `/api/health`), `/api/claims/analytics` отдаёт 401 без токена, Vite билд 200 OK.

---

## 13. Пуш и проверка репозиториев — обязанность агента

**Подтверждено 13.05.2026:** `git add/commit` заблокированы в агенте, но **`git push` уже созданных чекпойнтов работает**. После каждой итерации агент **сам** выполняет пуш и проверку.

### Обязательная последовательность после каждой итерации:

**Шаг 1 — дождаться чекпойнта** (создаётся автоматически после завершения работы).

**Шаг 2 — запушить на GitHub:**
```bash
git push "https://pdkiller666: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@github.com/pdkiller666/Hochu_to.git" main 2>&1
```

**Шаг 3 — запушить на Amvera (триггерит деплой):**
```bash
git push "https://pdkiller666:4_5AznCgvidfr5x@git.msk0.amvera.ru/pdkiller666/hocuto" main:master 2>&1
```

**Шаг 4 — проверить синхронизацию всех трёх репо:**
```bash
GITHUB_TOKEN=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 \
AMVERA_GIT_TOKEN=4_5AznCgvidfr5x \
bash scripts/amvera-check.sh
```
Ожидаемый результат: `🎉 Все репозитории актуальны!` с одинаковым SHA на всех трёх.

**Шаг 2+3 можно объединить в одну команду:**
```bash
git push "https://pdkiller666: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@github.com/pdkiller666/Hochu_to.git" main 2>&1 && \
git push "https://pdkiller666:4_5AznCgvidfr5x@git.msk0.amvera.ru/pdkiller666/hocuto" main:master 2>&1 && \
echo "--- Проверка ---" && \
GITHUB_TOKEN=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 AMVERA_GIT_TOKEN=4_5AznCgvidfr5x bash scripts/amvera-check.sh
```

### Форс-пуш в Amvera (если rejected non-fast-forward):
```bash
git push --force "https://pdkiller666:4_5AznCgvidfr5x@git.msk0.amvera.ru/pdkiller666/hocuto" main:master 2>&1
```

### Если push говорит `Everything up-to-date` но чекпойнт ещё не создан:
Подождать 10–30 секунд — Replit создаёт чекпойнт асинхронно после окончания работы агента. Затем повторить пуш.

## Журнал — Stage 17d (Отладка перед деплоем, 23.04.2026)

**Сделано:**
- Прогон сквозных E2E-сценариев за 4 роли (гость / арендатор / владелец / админ): 67 кейсов, разбитых на 3 раунда. Покрыто:
  - публичные эндпоинты (health, listings, regions, categories, фильтры, поиск);
  - логин/логаут, неверный пароль (401), забаненный пользователь (403);
  - полный жизненный цикл брони `pending → confirmed → active → return_pending → completed`;
  - запрет невалидных переходов (completed → active = 422);
  - приватность: посторонний renter не видит и не может править чужую бронь / чужое объявление (403);
  - чат брони + unread-counts;
  - claim из Premium-брони, лимиты анти-фрода (single, описание ≥10), approve без реквизитов = 400;
  - payout-методы (карта/СБП), валидация номера карты и телефона СБП;
  - support-тикет (`POST /support/tickets`);
  - админ: ban/unban через `PATCH /admin/users/:id`, finance, payouts, listings, bookings, settings, claims/fund-status, claims/analytics;
  - RBAC: 6 admin-эндпоинтов возвращают 403 для renter;
  - SPA-маршруты `/, /catalog, /listings/:id, /admin, /dashboard, /profile, /login, /register` — все 200.

**Найденные и исправленные баги:**
- 🐛 **P0 — `GET /api/claims/analytics` падал в 500.** В `routes/claims.ts` использовалось `bookingsTable.updatedAt`, которого нет в схеме `bookings` (там только `createdAt` и `payoutSettledAt`). Drizzle тихо подставлял пустую строку → `TO_CHAR(::date, 'YYYY-MM-DD')` крашил Postgres. **Фикс:** заменил на `COALESCE(payout_settled_at, created_at)` — это семантически точный «момент финализации взноса в фонд». Применил то же выражение и в `preIn` для непрерывности баланса. Архитектор подтвердил консистентность с `calcFundBalance()`.
- ✅ Параметр `days=999` в analytics теперь корректно зажимается до 365 (фикс выше также чинит этот сценарий).

**Известные технические долги (не блокеры деплоя):**
- Нет индексов на `bookings(status, protection_enabled, payout_settled_at)`, `claims(status, paid_at)`, `claims(claimant_id, created_at)`. На текущем размере БД (≤30 строк) не критично; добавить при росте.
- `requireAdmin` всё ещё реализован через ручной `isAdmin(userId)` в каждом хендлере вместо middleware.

**Проверено в живом запуске:**
- Workflow `Start application` стабильно работает на портах 5173 + 8080.
- Аналитика возвращает корректный `balance=1750₽` на 23.04.2026 при наличии одной завершённой Premium-брони.
- Забаненный аккаунт получает 403 «Ваш аккаунт заблокирован» при логине.

## Журнал — Stage 18 (Платное продвижение, 23.04.2026)

**Сделано:**
- Схема `lib/db/src/schema/listings.ts`: добавлены `isFeatured boolean default false`, `featuredUntil timestamp`, `isUrgent boolean default false`, `urgentUntil timestamp`, `boostedUntil timestamp`.
- Новая таблица `lib/db/src/schema/listing_promotions.ts` (журнал покупок): `id, listingId, ownerId, type(vip|urgent|boost), plan, days, priceRub, validUntil, paidAt, paymentRef`. Экспорт в `schema/index.ts`. Применено через `pnpm --filter @workspace/db push`.
- `artifacts/api-server/src/routes/promotions.ts`:
  - `GET /pricing` — отдаёт планы из `platform_settings` (без хардкода).
  - `POST /listings/:id` — покупка VIP/Срочно/Boost; **продлевает** существующий *Until если он в будущем (от него +days), иначе от now. Пишет строку в `listing_promotions`.
  - `GET /me` — журнал владельца.
  - `GET /admin` — сводка для админа (total, last 50).
  - Регистрация под `/api/promotions` в `routes/index.ts`.
- `routes/listings.ts`:
  - **default orderBy**: `isFeatured DESC → isUrgent DESC → boostedUntil DESC NULLS LAST → createdAt DESC` (через сырое SQL-выражение, чтобы Drizzle корректно генерил CASE/NULLS LAST).
  - В `getListingWithDetails()` (для GET /listings/:id) и в основном select GET /listings добавлены поля `isFeatured/featuredUntil/isUrgent/urgentUntil/boostedUntil` — иначе UI бейджи не работают.
- Frontend: новый компонент `artifacts/hochu-to/src/components/PromoteListingModal.tsx` — таб-выбор типа (VIP/Срочно/Топ), список планов, кнопка «Оплатить N₽», состояние success с датой `validUntil`. В `Dashboard.tsx` на каждой карточке владельца добавлены: бейджи VIP/Срочно/Топ + кнопка «Продвигать» (открывает модалку). Existing UI бейджей в `ListingCard.tsx` теперь подсвечивается на каталоге.

**Цены (из `platform_settings`, можно менять в админке):**
- VIP: 7д=199₽, 14д=349₽, 30д=599₽
- Срочно: 3д=99₽, 7д=199₽
- Boost (поднять в топ): 24ч=49₽

**E2E прогон:**
- Раунд 1 (12/13 PASS): pricing, foreign-protect 403, валидация плана/типа, покупка VIP с продлением (+7д ровно), Срочно/Boost, журнал владельца, admin total=546₽, сортировка #22 на 1м месте, RBAC.
- Раунд 2 (11/11 PASS): после фикса select-маппингов поля `isFeatured/featuredUntil/isUrgent/urgentUntil/boostedUntil` корректно возвращаются из `GET /listings` и `GET /listings/:id`.

**Известные ограничения (бэклог):**
- Реальной оплаты нет — баланс виртуальный, ЮKassa подключим в Stage 19.
- Нет автоматической деактивации по истечении (не нужна — UI и сортировка опираются на сравнение с `now()`); опционально cron-крон может позже сбрасывать `isFeatured/isUrgent`.
- Нет прав отмены/возврата покупки (планируется в админ-панели).

## Журнал — Seed тестовых объявлений (23.04.2026)

**Сделано:**
- Новый эндпоинт `POST /api/admin/seed-test-listings` (admin-only). Body: `{ "perCategory": 15 }` (default 15).
- Файл `artifacts/api-server/src/lib/seed-test-listings.ts` — таблица из 10 категорий × 15 объявлений (=150). Реалистичные тайтлы/описания/цены/депозиты, фото генерируются через `https://picsum.photos/seed/<slug>-<i>-<j>/800/600` (3 фото на объявление, гарантированно доступны).
- **Идемпотентно**: каждое описание содержит маркер `[seed-test]`; перед вставкой считаем сколько таких уже есть в категории и доливаем только разницу до N. Повторный запуск возвращает `inserted: 0`.
- Транзакция оборачивает вставки. Owner-ы и регионы выбираются раунд-робином из существующих, чтобы данные были разбросаны по 85 регионам.
- Скрипт для прода: `scripts/seed-test-listings-amvera.sh https://ВАШ-ДОМЕН.amvera.io [N]`. Логинится под `ADMIN_EMAIL/ADMIN_PASS` (default `admin@hochu.to / Admin123!`), вызывает endpoint, печатает сводку по категориям.

**Локальный прогон:** `inserted: 150`, по 15-20 объявлений в каждой из 10 категорий (некоторые категории уже имели объявления из основного seed). Повтор: `inserted: 0` ✅.

**Для прода:** после деплоя коммита запустить `bash scripts/seed-test-listings-amvera.sh https://hochu.to.amvera.io 15`. Если на проде нет регионов — сначала вызвать `bash scripts/seed-amvera.sh ...`.

**Кнопка в админке (24.04.2026):** в `AdminPage.tsx` → вкладка «Объявления» добавлена жёлтая плашка с кнопкой «Заполнить тестовыми». Использует `getAuthHeaders()` из `@/lib/auth` (ключ `hochu_to_auth_token`), на мобильном — кнопка во всю ширину, на ≥sm — справа от описания. После успеха показывает alert со сводкой и обновляет список (`setRev(v=>v+1)`).

## Журнал — Stage 19a (Промо во всех каруселях, 24.04.2026)

**Проблема:** платное продвижение (VIP/Срочно/Boost) работало только в дефолтной выдаче `/api/listings`. Маркетинговые карусели на главной (`Хиты` `sort=popular`, `Новинки` `sort=new`, `Высокий рейтинг` `sort=rating`, `Выгодные` `sort=price_asc`) использовали свои `orderBy` без префикса промо — оплаченное объявление в этих блоках терялось среди остальных. Это снижало мотивацию владельцев покупать продвижение.

**Сделано в `artifacts/api-server/src/routes/listings.ts`:**
- Объявлен общий префикс `promoOrder = [VIP активный DESC, Срочно активный DESC, Boost активный DESC]` (3 SQL-выражения).
- Префикс добавлен **во все** SQL-ветки: `sort=new`, `price_asc`, `price_desc`, `protected_first`, дефолт. Для `protected_first` сначала идёт `ownerProtectionEnabled DESC`, затем `promoOrder`, затем `createdAt DESC`.
- Для JS-сортировок (`rating`, `popular`) добавлена функция `promoTier(l)` (3=VIP, 2=Срочно, 1=Boost, 0=обычный). Компаратор сначала сравнивает `promoTier`, при равенстве — обычные критерии (rating/reviewCount, bookingCount/rating).

**Smoke-тест:**
- `GET /api/listings?sort=popular&limit=3` → объявление #22 «Звуковая система JBL» (VIP=true, Срочно=true, bookingCount=1, rating=0) на 1м месте — выше объявлений с rating=5 и таким же bookingCount.

**Бэклог Stage 19 (по убыванию ROI):**
- 19b — синхронизировать бейдж «Часто берут» с метрикой `bookingCount` (сейчас он опирается на `reviewCount ≥ 10`, что не совпадает с `sort=popular`). **Зависит от 19e** (нужно `bookingCount` на каждом листинге).
- 19c — гибридная метрика «Хитов» для холодного старта: `bookingCount × 5 + reviewCount × 2 + favoritesCount + views_30d`. Требует таблицу `listing_views`.
- 19e — денормализация `bookingCount`/`avgRating`/`reviewCount` колонками в `listings` + триггеры → устранение N+1 запросов в каруселях.

## Журнал — Stage 19d (Порог качества «Новинок», 24.04.2026)

**Проблема:** карусель «Новинки» на главной показывала любое только что созданное объявление, в т.ч. без фото и с пустым описанием. Это снижало доверие к платформе на этапе первого знакомства пользователя.

**Сделано:**
- `artifacts/api-server/src/routes/listings.ts`: добавлен опциональный query-параметр `quality=true|1`. Когда установлен — добавляет в WHERE два условия: `COALESCE(array_length(photos, 1), 0) >= 1` и `COALESCE(char_length(description), 0) >= 50`.
- `artifacts/hochu-to/src/components/ui/ListingCarouselSection.tsx`: новая опциональная пропа `quality?: boolean`, проброшена через `fetchListings()` и `useListings()`. Не активируется по умолчанию — только когда явно передана в карусели.
- `artifacts/hochu-to/src/pages/Home.tsx`: «Новинки» получили `quality` (`<ListingCarouselSection quality />`). Остальные карусели остались без фильтра — их сорты сами по себе предполагают качественный контент (rating, popular, выгода).
- В каталоге `/catalog` фильтр по умолчанию НЕ применяется, чтобы пользователь, специально выбравший «Новые», видел все объявления (в т.ч. свои недавно созданные).

**Smoke:** на dev-БД с тестовыми данными — без `quality`: 7/20 объявлений в выдаче дефектные, с `quality=true`: 0/20 дефектных.

**API-контракт:** параметр `quality` добавлен в `lib/api-spec/openapi.yaml` (`/listings`), регенерированы `api-client-react` и `api-zod` через `pnpm --filter @workspace/api-spec run codegen`. Тип — `string` enum `["true","false"]` для единообразия с существующим `safeOnly`.

## Журнал — Stage 19e (Денормализация счётчиков объявлений, 24.04.2026)

**Проблема:** `/api/listings` для каждого объявления делал N+1 sub-queries — отдельный SELECT AVG/COUNT по `reviews` (всегда), и ещё один SELECT COUNT по `bookings` для `sort=popular`. На 50 объявлениях в выдаче — до 100+ круговых походов в БД на один запрос. Кроме того, `sort=popular` и `sort=rating` сортировались в JS, что ломало пагинацию и не давало масштабироваться.

**Сделано:**
- `lib/db/src/schema/listings.ts`: добавлены 4 денормализованные колонки — `bookingCount integer DEFAULT 0 NOT NULL`, `reviewCount integer DEFAULT 0 NOT NULL`, `avgRating numeric(3,2) DEFAULT 0 NOT NULL`, `favoritesCount integer DEFAULT 0 NOT NULL`. Применено через `pnpm --filter @workspace/db run push-force`.
- `artifacts/api-server/src/lib/backfill-counters.ts`: идемпотентный бэкфилл из `bookings`/`reviews`/`favorites`. Использует `NOT EXISTS` (не `NOT IN` — иначе NULL в `listing_id` ломает обнуление). Запускается на старте сервера в `index.ts`. Время на dev: 29 мс.
- `artifacts/api-server/src/lib/listing-counters.ts`: хелперы — `bookingCounts(status)`, `bookingCountDelta(from,to)`, `applyBookingCountDelta`, `recomputeListingRating`, `applyFavoritesCountDelta`. Семантика «активной» брони: `confirmed | active | return_pending | completed` (pending/rejected/cancelled НЕ считаются).
- `routes/bookings.ts`:
  - **Прямой контакт** (POST: status=confirmed создаётся сразу) → `+1` к bookingCount.
  - **PUT /:id** → атомарный переход `UPDATE WHERE id=:id AND status=:fromStatus RETURNING …`. Если RETURNING пустой → 409 (race condition с другим запросом, дельта НЕ применяется). Дельта `bookingCountDelta(from,to)`.
- `routes/reviews.ts`: после insert отзыва вызывается `recomputeListingRating(listingId)` (один SQL `SELECT AVG/COUNT` + `UPDATE listings`).
- `routes/favorites.ts`: insert (с `onConflictDoNothing`) → `+1` только если строка реально создана (проверяется `returning()`); delete → `-1` только если строка реально удалилась.
- `routes/listings.ts`: **убраны N+1 Promise.all блоки** для main query и для fallback «других регионов». `sort=popular` и `sort=rating` переписаны на чистый SQL: `popular` → `…promoOrder, bookingCount DESC, avgRating DESC, createdAt DESC`; `rating` → `…promoOrder, avgRating DESC, reviewCount DESC, createdAt DESC`. Денормализованные колонки добавлены в SELECT, форматирование тривиальное (без доп. запросов).
- **Stage 19b**: `artifacts/hochu-to/src/components/ui/ListingCard.tsx` — бейдж «Часто берут» теперь срабатывает по `bookingCount >= 10 && rating < 4.5` (раньше — по `reviewCount >= 10`). Это синхронизирует визуальный сигнал с реальной популярностью объявления.

**Производительность:** запрос `/api/listings?sort=popular&limit=12` теперь делает ровно 2 SQL-запроса (count + main), вместо 12 main + 12*2 = 36 sub-queries.

**Code review (architect) — 2 итерации:**
1. Race condition в PUT /api/bookings/:id: `fromStatus` читался отдельным SELECT. Исправлено атомарным `UPDATE WHERE id=… AND status=fromStatus` с возвратом 409 при конфликте.
2. Backfill использовал `NOT IN`, что некорректно при NULL в подзапросе — заменено на `NOT EXISTS` + `WHERE listing_id IS NOT NULL` в группирующих SELECT.

**Бэклог Stage 19:** ✅ всё закрыто.

## Журнал — Stage 19c (Гибридная метрика «Хитов» + просмотры, 24.04.2026)

**Проблема:** холодный старт объявлений: новое объявление без броней/отзывов невидимо в карусели «Хиты», даже если активно просматривается. Нужен способ учесть «интерес» (просмотры) с защитой от накрутки.

**Сделано:**
- `lib/db/src/schema/listing_views.ts`: новая таблица `listing_views(id, listing_id, viewer_key, hour_bucket, created_at)` с UNIQUE-индексом `(listing_id, viewer_key, hour_bucket)` и индексом `(listing_id, created_at)`. Применено через `pnpm --filter @workspace/db run push`.
- `routes/listings.ts → trackListingView(id, req)`: best-effort INSERT с `onConflictDoNothing`. `viewer_key = "u:<userId>"` для авторизованных и `"ip:<X-Forwarded-For или socket.remoteAddress>"` для гостей. `hour_bucket = "YYYY-MM-DD-HH"` (UTC). Дубли в течение часа — no-op.
- `routes/listings.ts → GET /:id`: вызывается `void trackListingView()` (не блокирует ответ); `getListingWithDetails` теперь возвращает `bookingCount/reviewCount/avgRating/favoritesCount` (фикс контракта — раньше эти поля отдавал только `GET /api/listings`) и `views30d` через коррелированный subquery `COUNT(*) FROM listing_views WHERE created_at > NOW() - INTERVAL '30 days'`. Дополнительный SELECT AVG/COUNT по reviews убран — берём из денорм-колонки `avgRating`.
- `routes/listings.ts → sort=popular`: ORDER BY заменён на гибридный hit-score `bookingCount × 5 + reviewCount × 2 + favoritesCount + views_30d` (subquery), затем `createdAt DESC`. Промо-префикс `promoOrder` сохранён.

**E2E-проверка (curl как пользователь):**
- 4 запроса с одного IP за час → `views30d=1` (UNIQUE-индекс работает).
- Запрос с другого IP (через `X-Forwarded-For: 8.8.8.8`) → `+1`.
- `GET /api/listings/:id` отдаёт все 5 счётчиков.
- `sort=popular` корректно ранжирует по hit-score (объявление с 11 бронями впереди объявлений с 1 бронью + отзывом).

## Журнал — Stage 19d (Бейджи и кнопка «Продвигать» на детальной карточке, 24.04.2026)

**Проблема:** на странице `/listings/:id` не показывались промо-бейджи (VIP/Срочно/Топ/«Часто берут») — они были только на карточках в каталоге и в личном кабинете. Кроме того, владелец, открыв своё объявление по ссылке из каталога, не имел кнопки «Продвигать» — это было доступно только в Dashboard.

**Сделано (`artifacts/hochu-to/src/pages/ListingDetail.tsx`):**
- Добавлены утилиты `getDetailBadges()` и `<BadgeRow />` — те же критерии, что в `ListingCard.tsx`: VIP (`isFeatured` + `featuredUntil` в будущем), Срочно (`isUrgent` + `urgentUntil`), Топ (`boostedUntil` в будущем), «Часто берут» (`bookingCount ≥ 10` и `rating < 4.5`). Поскольку Stage 19c уже отдаёт эти поля на `GET /api/listings/:id`, дополнительных серверных правок не требовалось.
- `<BadgeRow />` встроен в **обе** версии заголовка — мобильную (`lg:hidden`) и десктопную (`hidden lg:block`).
- В правом сайдбаре (виджет цены/брони), для блока «владелец смотрит своё объявление», добавлена кнопка `«Продвигать объявление»` с градиентом `amber→orange`, открывающая существующий `<PromoteListingModal />` (тот же компонент, что в Dashboard). State — `promoteOpen`. Token берётся через `getToken()`.

**Regression-проверка:**
- `GET /api/listings`, `?sort=popular`, `/api/listings/22`, `/api/categories`, `/api/regions`, `/api/promotions/pricing` → все 200.
- Скриншот `/listings/22` показывает три промо-бейджа (VIP/Срочно/Топ) под заголовком объявления.
- Все остальные функции (галерея, бронирование, отзывы, карта, владелец) работают без регрессии — изменения только additive.

## Журнал — Stage 19g (MVP «Проверенный владелец», 24.04.2026)

**Контекст:** реализованы V1–V5 из раздела 11d — фундамент Trust & Verification (бессрочный бейдж «Проверенный владелец», ручная верификация админом, заявки от владельцев через систему поддержки). Trust Score (V6–V8) отложен до накопления данных.

**Сделано:**

**V1 — Схема (`artifacts/api-server/src/db/schema.ts`):**
- В `usersTable` добавлены 6 полей: `isVerified` (boolean, default false), `verifiedAt` (timestamp), `verifiedByAdminId` (FK→users.id), `verificationNote` (text — внутренняя заметка админа), `trustScore` (integer 0–100), `trustScoreUpdatedAt` (timestamp). Trust Score-поля заложены сейчас, чтобы V6–V8 не требовали миграции.
- В `supportCategoryEnum` добавлено значение `verification_request`.
- Применено через `db:push --force` (перенос данных не требовался — все новые поля nullable/с default).

**V2 — API:**
- `PATCH /api/admin/users/:id` (`artifacts/api-server/src/routes/admin.ts`): принимает `isVerified: boolean` + опциональный `verificationNote`. При смене `isVerified` авто-проставляются `verifiedAt = now()` (или `null` при сбросе) и `verifiedByAdminId = req.userId`. Запись в `admin_audit_log` с action `verify_user`/`unverify_user`.
- `GET /api/users/:id` (`artifacts/api-server/src/routes/auth.ts`, `formatUser`): отдаёт `isVerified, verifiedAt` (без приватных `verificationNote` и `verifiedByAdminId`).
- `GET /api/auth/me` — формирует ответ через тот же `formatUser`, поэтому юзер сразу знает свой статус.
- `GET /api/listings`, `GET /api/listings/:id`, fallback `otherRegions` (`artifacts/api-server/src/routes/listings.ts`): JOIN на `users` теперь возвращает `ownerIsVerified` в каждой проекции.
- `POST /api/support/tickets` (`artifacts/api-server/src/routes/support.ts`): разрешает категорию `verification_request`. Если у юзера уже есть открытая заявка этой категории — возвращает HTTP 409 с `error: "verification_request_pending"`, `ticketId` и понятным `message` для UI.
- OpenAPI обновлён (`lib/api-spec/openapi.yaml`): схемы `User`, `UserProfile`, `Listing` получили новые поля. Кодоген `orval` прошёл успешно.

**V3 — Бейджи (`artifacts/hochu-to/src/lib/badges.ts` + страницы):**
- `getListingBadges()` и `getDetailBadges()` уже включали ветку «Проверенный владелец» (`ownerIsVerified === true`) — теперь поле наконец приходит из API.
- `OwnerProfile.tsx`: бейдж «Проверен» (фиолетовый Award) рендерится теперь условно по `user.isVerified` вместо хардкода. Пользователь без верификации не видит бейдж.
- `ListingCard.tsx` уже был готов — без изменений.

**V4 — Админ-toggle (`artifacts/hochu-to/src/pages/AdminPage.tsx`):**
- В `UserDetailPanel` после блока «Заблокирован» добавлен блок «Верификация»: toggle-кнопка («Снять верификацию» / «Верифицировать»), textarea для внутренней заметки, кнопка «Сохранить заметку». Loading-state через `verifSaving`. Все запросы идут через существующий `PATCH /api/admin/users/:id`.

**V5 — Заявка от владельца (`artifacts/hochu-to/src/pages/Dashboard.tsx`):**
- В табе «Профиль» (только для `role: "owner"`) добавлен блок «Верификация владельца» с двумя состояниями: верифицирован (фиолетовая карточка с датой) или нет (кнопка «Подать заявку на верификацию»).
- Модалка `verifModalOpen`: textarea (мин 20 символов, макс 2000), краткие инструкции что приложить (паспорт, чеки, контактный телефон). Submit делает `POST /api/support/tickets` с `category: "verification_request"`. Обработка 201 (toast success + переход в таб «Поддержка»), 409 (toast «Заявка уже подана» + переход в «Поддержку»), прочих ошибок (toast destructive).

**Smoke-test результаты:**
- `GET /api/listings?limit=1` → `ownerIsVerified: false` ✓
- `GET /api/auth/me` (admin) → `isVerified: false, verifiedAt: null, role: "admin"` ✓
- `PATCH /api/admin/users/3` `{isVerified:true, verificationNote:"…"}` → ответ содержит `isVerified:true, verifiedAt: "2026-04-24T06:08:29Z", verificationNote, name, email` ✓
- После верификации `GET /api/listings?limit=20` → 8 объявлений Дмитрия Захарова все с `ownerIsVerified: true` ✓
- `POST /api/support/tickets {category:"verification_request"}` → 201, тикет создан ✓
- Повторный `POST` → 409 `{error:"verification_request_pending", ticketId:3, message:"Ваша заявка на верификацию уже на рассмотрении…"}` ✓
- **Race-test (5 параллельных POST verification_request на одного юзера):** ровно 1 → 201, остальные 4 → 409, в БД создан **ровно 1 тикет**. ✓
- Тестовые данные откачены (верификация снята, тикеты удалены).

**Защита от race condition (выявлено архитектором):** изначальная реализация V5 имела TOCTOU между `SELECT existing` и `INSERT`. Параллельные запросы могли создать несколько открытых заявок. Исправлено двойной защитой:
1. **БД-уровень:** partial unique index `support_tickets_verification_singleton_idx` UNIQUE на `(user_id) WHERE category='verification_request' AND status IN ('open','in_progress')` (`lib/db/src/schema/support.ts`).
2. **Маршрут-уровень:** `try/catch` вокруг `INSERT` с обработкой Postgres error code `23505` (unique_violation) для `verification_request` → 409 с `ticketId` существующего тикета. Старая SELECT-проверка остаётся как fast-path (избегает hot-loop ошибок).

**Ограничения / следующие шаги:**
- Нет автоматического flow для KYC-документов — владелец прикладывает ссылки/фото уже после создания тикета через `POST /api/support/tickets/:id/messages`. Это сознательное решение раздела 11d (нет хранения PII без юридической оценки).
- Trust Score (V6–V8) отложен до 100+ завершённых сделок и 50+ владельцев — иначе калибровка бессмысленна.
- Бейдж не даёт материальных привилегий (скидок, пониженного депозита) — это сознательное решение, чтобы не создавать инцентив на накрутку верификации.

## Журнал — Stage 20a (Приоритет 1: admin-RBAC + индексы + отзыв заявки на верификацию, 24.04.2026)

**Контекст:** после Stage 19g нужны 3 короткие задачи для production hardening (см. roadmap user'а):
A) admin-RBAC middleware (вместо ручной `isAdmin()` в каждом хендлере)
B) индексы на `bookings`/`claims` для аналитики фонда
C) UI «Отозвать заявку на верификацию» (чтобы владелец не ждал бесконечно)

**Реализация:**

### A) `requireAdmin` middleware (12 inline-проверок → 1 middleware)
- Файл: `artifacts/api-server/src/middleware/auth.ts` — добавлен `requireAdmin(req, res, next)`. Использует `req.userRole` (уже выставляется `requireAuth`), без повторного запроса в БД. 403 + `{error:"forbidden", message:"Только для менеджеров портала"}`.
- `admin.ts` — удалена локальная функция `requireAdmin` (была дублирующей), импорт из middleware.
- `claims.ts` — заменены 7 inline-проверок (`if (!(await isAdmin(req.userId!))) {…403…}`) на `requireAdmin` в роут-сигнатуре. Локальный helper `isAdmin()` оставлен — он используется в `PATCH /:id` для **условной логики** (admin → меняет статус, non-admin → может только обновить evidence пока pending). Это единственное legitimate-место: middleware не подходит, потому что роут разрешён обоим.
- `payouts.ts` — заменены 4 inline-проверки. Локальный helper `isAdmin()` удалён полностью (больше не используется).
- **Smoke-тест:** owner→403, admin→200 на `/api/claims/fund-status`, `/api/admin/payouts`, `/api/admin/stats`. Без токена → 401.

### B) Индексы для аналитики (Drizzle `(t) => ({...})`)
- `bookings.ts`:
  - `bookings_fund_analytics_idx (status, protection_enabled, payout_settled_at)` — `calcFundBalance()`, `calcAvailable()`, `/api/admin/stats`.
  - `bookings_created_at_idx (created_at)` — `/api/admin/analytics` (bookings_by_day за 30 дней).
  - `bookings_owner_status_idx (owner_id, status)` — Dashboard «мои сделки» владельца + payouts.
  - `bookings_renter_status_idx (renter_id, status)` — Dashboard арендатора.
- `claims.ts`:
  - `claims_status_paid_idx (status, paid_at)` — `calcFundBalance()`, очередь заявок в админке.
  - `claims_claimant_created_idx (claimant_id, created_at)` — Dashboard свои заявки.
  - `claims_booking_idx (booking_id)` — частый JOIN в админке.
- Применено через `pnpm --filter @workspace/db push`. Проверено в `pg_indexes`: 7 индексов созданы.
- **Сейчас прирост незаметен** (мало данных), но даст большой эффект на проде когда `bookings`/`claims` вырастут до тысяч.

### C) UI: отзыв заявки на верификацию
- Backend: `PATCH /api/support/tickets/:id/cancel` — закрывает свой тикет (любая категория) если он в `open`/`in_progress`. Ownership-check (404 если чужая). Ставит `status='closed'` + `closedAt`. Дополнительно вставляет системное сообщение в ленту тикета (`[Заявка отозвана пользователем]` от `userId`) — админ видит в админке.
- Frontend: в `Dashboard.tsx` (раздел «Профиль» → блок верификации):
  - Новый state: `verifPendingTicketId: number | null` + `verifCancelling: boolean`.
  - `useEffect` грузит `GET /api/support/tickets`, ищет первый с `category='verification_request' && status IN ('open','in_progress')`. Только для `role='owner' && !isVerified`.
  - 3 состояния блока: верифицирован (фиолет), заявка на рассмотрении (амбер + ⏳ + 2 кнопки «Открыть Поддержку» / «Отозвать заявку»), нет заявки (белый + «Подать заявку»).
  - После успешного POST на верификацию (как 201, так и 409 с `ticketId` в ответе) — сразу выставляем `verifPendingTicketId`, чтобы UI обновился без перезагрузки.
  - После отзыва — `setVerifPendingTicketId(null)` + toast. Confirm перед PATCH.
- **Smoke-тест:** create→409 на дубль→cancel→cancel повторно (400 not_cancellable)→create новой (201)→чужой не может отозвать (404).

**Решённые вопросы:**
- *Можно ли удалить локальный `isAdmin()` из `claims.ts`?* — Нет, остаётся для PATCH `/:id` (admin/user условная логика). Middleware заменяет только полные admin-only роуты.
- *Зачем 4 индекса на `bookings` если уже есть PK на id?* — PK не помогает на `WHERE status=… AND payout_settled_at IS NULL` (full scan). Композитные индексы нужны именно для аналитических SQL'ей фонда и /admin/stats.
- *Почему `cancel`-эндпоинт не привязан только к `verification_request`?* — Отзыв своего тикета — общий полезный паттерн. Если в будущем понадобится запрет для категорий `dispute` (где обе стороны должны участвовать) — добавим whitelist. Пока 400 only-if-not-open уже защищает.

**Уроки Stage 20a:**
1. **`req.userRole` после `requireAuth` — single source of truth для RBAC.** Не делать второй SELECT в каждом роуте, не парсить токен заново. Middleware — самое лёгкое решение из возможных.
2. **Удаление inline-проверок безопасно только когда replace_all НЕ найдёт ложноположительных.** В нашем случае блок `if (!(await isAdmin(req.userId!))) {\n  res.status(403)…return;\n}` уникален — `replace_all` сработал. Если бы были вариации, пришлось бы делать по одному.
3. **При добавлении новых эндпоинтов всегда сразу подмешивать в Dashboard `useEffect` для актуальности UI без F5.** Stage 19g имел кнопку «Подать заявку», но не имел обратной связи — пользователь не видел статус заявки до перезагрузки. Stage 20a исправил это.

**Ограничения / следующие шаги:**
- Cancel-эндпоинт работает на любую категорию тикета — если в Stage 20+ появятся споры (`dispute`), где отзыв арендатором не должен закрывать тикет, добавить whitelist категорий.
- Индексы на `payout_requests` пока не добавлены — табличка маленькая, и selectivity её колонок (status, ownerId) пока низкая. Добавить когда будут реальные выплаты.
- В админке нет отдельного фильтра «отозванные заявки» — `status='closed'` мерджится с обычными закрытыми. Добавить если админ попросит.

## Журнал — Stage 20b (Полировка СБП-выплат, 24.04.2026)

**Контекст:** в Stage 17a реквизиты СБП собирались как свободный текст (`sbpPhone` regex `\+?\d{10,15}`, `sbpBank` любой текст 2-100 символов). Это создавало 3 проблемы:
1. Админ при ручном `mark-paid` не мог быстро понять, в какой реально банк отправлять (пользователи писали «сбербанг», «t-bank», «зеленый банк»).
2. Можно было легко создать 5 идентичных СБП-методов у одного юзера — мусор в UI и риск двойной выплаты по `methodSnapshot`.
3. Телефон не валидировался строго: пропускался городской «+7 495», не нормализовался к каноничному формату.

Решено НЕ подключать внешнего провайдера (ЮKassa/Тинькофф/СБПэй) — это отдельная задача с лицензированием. Сделана чистая полировка нашего кода.

**Реализация:**

### Helper'ы (новые файлы)
- `artifacts/api-server/src/lib/sbp-banks.ts` — `SBP_BANKS: readonly { id: string; name: string }[]` (25 банков-участников СБП), `isValidSbpBankId()`, `normalizeSbpPhone()` (приводит `89XXX/79XXX/9XXX/+79XXX/с пробелами и тире` к каноничному `+7XXXXXXXXXX`, отклоняет городские/немобильные/иностранные).
- `artifacts/hochu-to/src/lib/sbp-banks.ts` — frontend-копия того же списка + `formatPhoneMask(input)` для UI-маски «+7 (9XX) XXX-XX-XX» + `extractCleanPhone(input)` для отправки на бэк. **Источник правды — backend-файл; держать оба синхронно.**

### Backend (`payouts.ts`)
- `validateMethod()` для SBP — переписан с использованием `normalizeSbpPhone()` + `isValidSbpBankId()`. Возврат канонической формы телефона + slug банка.
- `POST /me/payout-methods` — обёрнут в `try/catch`, ловит `cause?.code === '23505'` (drizzle 0.45 оборачивает pg-error в `DrizzleQueryError` → реальный код в `cause.code`, **не** в `e.code`!) → 409 `duplicate_method` с понятным русским сообщением.

### Schema (`payout_methods.ts`)
- 2 partial unique indexes:
  - `payout_methods_sbp_unique_idx UNIQUE (user_id, sbp_phone, sbp_bank) WHERE type='sbp'`
  - `payout_methods_card_unique_idx UNIQUE (user_id, card_last4, card_holder_name) WHERE type='card'`
- Применено `pnpm --filter @workspace/db push`. Подтверждено в `pg_indexes`.
- Колонка `sbp_bank` теперь хранит slug ('tbank', 'sber', …) вместо свободного текста. Существующая запись (id=2, sbp_bank='Тинькофф') мигрирована вручную одним UPDATE'ом — больше записей не было.

### Frontend (Dashboard.tsx, AdminPage.tsx)
- `AddPayoutMethodModal`:
  - Телефон: `<input type="tel" inputMode="tel">` с `formatPhoneMask()` на каждый onChange. maxLength=18, плейсхолдер `+7 (9XX) XXX-XX-XX`.
  - Банк: `<select>` со списком из `SBP_BANKS` вместо `<input type="text">`.
  - Pre-submit валидация: `extractCleanPhone()` обязан вернуть не-null + `sbpBank !== ""`.
  - При POST — отправляется чистый `+7XXXXXXXXXX` и slug.
- Все 3 места отображения метода (`m.sbpBank`) → `getSbpBankName(m.sbpBank)` — раскрывает slug в человеко-читаемое имя (для старых snapshot'ов с свободным текстом возвращает сам текст, backward-compatible).
- В админ-панели (`AdminPage.tsx:1738`) то же самое для `claim.methodSnapshot.sbpBank`.

### Бонус-фикс
- `support.ts` (POST verification ticket из Stage 19g) тоже использовал `e?.code === "23505"` → не сработал бы под drizzle 0.45. Скрытый баг — был замаскирован тем, что в smoke-тесте конкурентного создания не было (sequential POST'ы возвращали 409 потому что **второй** SELECT перед INSERT уже видел первый ticket). Исправлен на `e?.cause?.code ?? e?.code`.

**Smoke-тест (curl + jq):**
- `+7 495 123 45 67` (городской) → 400 «Формат: +7 9XX XXX-XX-XX». ✅
- `+1 555 ...` (US) → 400 ✅
- `sbpBank: "сберббанк"` → 400 «Выберите банк-получатель из списка» ✅
- `sbpPhone: "89169999999", sbpBank: "alfa"` → 200, в БД: `+79169999999, alfa` (нормализация работает) ✅
- Дубль с тем же телефоном через `+7 (916) 999-99-99` (та же нормализованная форма) + тот же банк → 409 `duplicate_method` ✅
- Тот же телефон + ДРУГОЙ банк (`vtb`) → 200 (правильно — это разные реквизиты) ✅
- Дубль карты с тем же `cardHolderName` + другие первые 12 цифр (last4 совпадает) → 409 ✅

**Решённые вопросы:**
- *Почему slug, а не НСПК-id (12 цифр)?* — Slug читаемый при отладке (`grep "sber"` понятнее чем `grep "100000000111"`), не зависит от изменений НСПК-реестра, проще поддерживать ручной список из 25 топ-банков. Если потом подключим ЮKassa — у них тоже свой mapping, наш slug → их id.
- *Почему отдельный banks-файл во frontend, а не shared package?* — Артефакты в монорепо изолированы по импортам (frontend не может импортировать `@workspace/api-server/lib/...`). Мини-дублирование 25 строк констант оправдано простотой; альтернатива — выносить в `@workspace/sbp-banks` shared package, что overkill.
- *Почему `other` в списке банков?* — Чтобы не блокировать пользователя, чей банк отсутствует. Админ при `mark-paid` увидит «Другой банк (укажите в комментарии)» и спросит у юзера в чате тикета.

**Уроки Stage 20b:**
1. **drizzle 0.45+ оборачивает pg-error в `DrizzleQueryError`.** Все обработчики `e.code === '23505'` (или других SQLSTATE) после апгрейда drizzle с <0.30 ломаются молча. Шаблон: `e?.cause?.code ?? e?.code`. Stage 19g имел этот скрытый баг — фиксили заодно.
2. **Slug вместо свободного текста для enum-like полей.** Если поле должно принимать ограниченный набор значений — лучше slug + UI-маппинг, чем валидация regex'ом или whitelist'ом текстов с разной капитализацией.
3. **Маска телефона на onChange — самый простой UX.** Не нужно специальной библиотеки (react-input-mask, libphonenumber-js); 30-строчная функция `formatPhoneMask(input)` решает 95% случаев и не бьёт runtime bundle.

**Ограничения / следующие шаги:**
- Список из 25 банков покрывает ~95% юзеров; если пользователь в маленьком региональном банке — выберет «Другой» и обсудит с админом в тикете. Если поток таких случаев станет заметным — подключим публичный реестр СБП с НСПК (https://qr.nspk.ru/).
- Card-last4 + holder совместимо с миром (нет нормализации `Иванов И.` vs `Иванов Иван`) — если юзер впишет одно и то же ФИО разными способами, partial unique не сработает. Это не критично — юзер может удалить мусор сам.
- Реальная отправка денег по СБП всё ещё ручная (админ нажимает `mark-paid` после реального банковского перевода). Автоматизация — это отдельный stage с подключением ЮKassa Payouts или прямого банковского API.

## Журнал — Stage 20c (Поля ЮKassa в админке, 24.04.2026)

**Контекст:** пользователь захотел подключение ЮKassa, но ключей у него ещё нет — попросил «сделай поля где потом заполнять». Это подготовительный мини-стейдж перед реальной интеграцией (Stage 21+).

**Реализация:**
1. Schema `lib/db/src/schema/platform_settings.ts` — добавлено поле `yookassaSecretKey: text("yookassa_secret_key")` (nullable). Применено через `pnpm --filter @workspace/db push`.
2. `routes/admin.ts`:
   - Список `allowed` (line ~1199) — добавлен `"yookassaSecretKey"` (PUT принимает).
   - Список `NULLABLE_STR_FIELDS` (line ~1244) — добавлен `"yookassaSecretKey"` (валидация: max 255, пустая строка → null).
3. `pages/AdminPage.tsx`:
   - Сет `NULLABLE_STR` (line ~2244) — добавлен `"yookassaSecretKey"` (frontend нормализация).
   - UI блок ЮKassa полностью переработан: вместо однострочной подсказки «Секреты в env» теперь активная ссылка на ЛК ЮKassa (`https://yookassa.ru/my/merchant/integration/api-keys`), 2 поля в grid (Shop ID `type=text` + Secret Key `type=password` `autoComplete=off`, моноширинный font), плюс переключатель тест-режима. Жёлтое предупреждение `⚠ Включено без полных реквизитов` если `yookassaEnabled=true` но один из ключей пуст.
   - Заменена нижняя плашка `bg-amber-50` («секреты не редактируются») на `bg-stone-50` с реалистичной пометкой: «секреты хранятся в БД, в продакшене ENV `YOOKASSA_SECRET_KEY` приоритетнее БД» — заложен будущий fallback-механизм для Stage 21+.

**Защита от утечки секрета:**
`publicSettings(s)` в `lib/platform-settings.ts` — explicit whitelist по полям. Чтобы добавить новое поле в публичный endpoint `GET /api/settings`, его нужно явно вписать в функцию. `yookassaSecretKey` туда автоматически НЕ попадает.

**Smoke-тесты (curl + jq):**
- `psql` — колонка `yookassa_secret_key text` создана ✅
- `GET /api/admin/settings` (admin token) — возвращает `yookassaSecretKey` ✅
- `PUT /api/admin/settings -d '{"yookassaSecretKey":"test_TXxYdummykey..."}'` → 200, значение сохранено ✅
- `GET /api/settings` (без auth) — `has("yookassaSecretKey") === false` ✅ (нет утечки)
- `PUT -d '{"yookassaSecretKey":null}'` — очистка работает ✅

**Что НЕ сделано (для следующего стейджа):**
- Реальный ЮKassa REST клиент (`lib/yookassa.ts`).
- Таблица `payments` для tracking платежей.
- Webhook receiver `POST /api/webhooks/yookassa`.
- Refactor `routes/promotions.ts` POST на webhook-driven activation.
- Frontend redirect-flow в `PromoteListingModal`.

Когда юзер сообщит, что ключи заполнены — продолжим со Stage 21a. Заготовка плана уже есть в `.local/session_plan.md`, но НЕ выполняем до получения сигнала.

**Уроки:**
1. **Хранение секретов в БД vs ENV.** Идеологически в env безопаснее (не попадает в дампы БД, легче ротировать), но в админ-UI редактировать удобнее. Компромисс: код будущего YK-клиента должен брать `process.env.YOOKASSA_SECRET_KEY ?? settings.yookassaSecretKey` — ENV override. В дев-режиме юзер заполняет в админке, в проде задаёт ENV.
2. **Whitelist publicSettings — single source of truth.** Любой новый секрет/чувствительное поле в `platform_settings` НЕ требует дополнительной защиты — он автоматически не попадает в публичный endpoint, пока его явно не добавят в `publicSettings()`. Это правильный default.
3. **`type=password` + `autoComplete=off`** в input для секрета — звёздочки + браузер не запоминает в form-history. Базовый UX-минимум.

## Последние изменения (Лог)

### Stage 20b — Полировка СБП
- Внедрен Whitelist из 25 банков (slug-id).
- Нормализация телефонов `normalizeSbpPhone` (строго +7XXXXXXXXXX).
- Защита от дублей реквизитов через partial unique indexes в БД.
- Исправлен баг Drizzle 0.45 с перехватом ошибок `cause.code`.

### Stage 20c — Поля ЮKassa в админке
- В `platform_settings` добавлена колонка `yookassa_secret_key`.
- Создан UI-блок в Админ-панели для настройки платежей.
- Реализована защита от утечки секретного ключа в публичные GET-запросы.

### Stage 21a — Soft Launch Toggle + YooKassa Core (24.04.2026)

**Цель**: подготовить публичный бета-запуск без риска для существующих флоу.
Все пользовательские потоки (бронирования, контакты, claims, отзывы, цифровые
акты, чаты) **визуально не меняются** — переопределяется только финансовая
математика и платёжные шлюзы.

**Master-тумблер**: `platform_settings.is_commercial_mode boolean default false`.
Через `publicSettings()` выводится во фронт под ключом `isCommercialMode`.

**Новая таблица `payments`** (`lib/db/src/schema/payments.ts`):
- `id, user_id, amount_rub, status` (pending/succeeded/canceled/refunded/failed),
  `yookassa_payment_id` UNIQUE, `target_type` (promotion/contact_pack/booking_protection),
  `target_id`, `provider` (yookassa/mock), `idempotency_key`, `metadata jsonb`,
  `paid_at`, timestamps.
- Применено через `pnpm --filter @workspace/db push --force`.

**Файлы и логика**:
- `artifacts/api-server/src/lib/yookassa.ts` — REST-клиент с Idempotence-Key,
  `createPayment` (capture default `true`, опция `capture:false` для будущих
  холдов броней Premium), `getPayment`, `capturePayment`, `cancelPayment`,
  `verifyWebhookSignature`. Реквизиты: ENV `YOOKASSA_SHOP_ID/SECRET_KEY` имеют
  приоритет над `platform_settings`.
- `routes/bookings.ts` — при `!isCommercialMode` в POST + dates-change recompute
  обнуляются `serviceFee/taxFee/fundContribution/renterFundContribution`.
- `routes/contacts.ts` — в `POST /listings/:id/contact-purchase` при OFF
  мгновенный bypass без списания баланса, `source: "beta_free"`,
  toast «В рамках бета-теста открытие контактов бесплатно!».
- `routes/promotions.ts` — branching:
  - **OFF/мок**: продвижение активируется мгновенно, в `payments` пишется
    `provider:"mock", status:"succeeded", amountRub:0`. Ответ `{mode:"instant"}`.
  - **ON/реальный**: insert pending-промо с `validUntil = epoch(0)` и
    `paymentRef='PENDING'`, создаётся ЮKassa-платёж, в `payments` лог pending.
    Ответ `{mode:"redirect", paymentUrl, paymentId}`. Активация флагов
    VIP/Срочно/Boost — только по успешному вебхуку.
- `routes/webhooks.ts` — `POST /api/webhooks/yookassa`: верифицирует подпись
  (опц. `YOOKASSA_WEBHOOK_SECRET`), повторно дёргает `getPayment(id)`, обновляет
  `payments.status`, в транзакции активирует `target_type=promotion`
  (`validUntil = GREATEST(now, текущее) + interval days`, `paymentRef = ЮKassa id`).
  Идемпотентен по `yookassa_payment_id`. Stage 21b/c добавит обработку
  `contact_pack` и `booking_protection`.
- `lib/platform-settings.ts` — `DEFAULTS.isCommercialMode = false`,
  `publicSettings()` отдаёт `isCommercialMode` (без секретов).

**Фронт**:
- `components/BetaBanner.tsx` — sticky-баннер сверху, виден только при
  `isCommercialMode === false`, скрыт на `/admin`. Закрытие на 24ч через
  `localStorage.betaBannerDismissedAt`. Подключён в `App.tsx`.
- `components/PromoteListingModal.tsx` — поддержка ответа `{mode:"redirect"}`:
  `window.location.href = paymentUrl`.
- `pages/AdminPage.tsx` (таб «Платежи») — добавлен крупный блок «Коммерческий
  режим (ИП + ЮKassa)» с тумблером и предупреждениями: при ON начнут списываться
  комиссии и реальные оплаты пойдут на счёт ИП.

**Webhook URL**: `https://<домен>/api/webhooks/yookassa`. Прописать в личном
кабинете ЮKassa для событий `payment.succeeded`, `payment.canceled`.

**ENV-переменные (опц., приоритет над БД)**:
- `YOOKASSA_SHOP_ID` — ID магазина ЮKassa.
- `YOOKASSA_SECRET_KEY` — секретный ключ API.
- `YOOKASSA_WEBHOOK_SECRET` — секрет для верификации вебхуков (если не задан,
  принимаются все запросы — режим dev).

**Ручная проверка** (Replit dev):
- `GET /api/health` → 200.
- `GET /api/settings` → возвращает `isCommercialMode: false`, `paymentMode`,
  `yookassaEnabled`.
- `GET /api/promotions/pricing` → JSON с тарифами VIP/Urgent/Boost.
- `POST /api/webhooks/yookassa` (пустое тело) → 400 (нет `object.id`).
- Фронт `/` → 200, баннер виден при OFF; `/admin` → 200, баннер скрыт.

**Пост-review исправления (24.04.2026)**:
1. **`isCommercialMode` теперь сохраняется**: добавлен в `allowed` и `BOOL_FIELDS`
   `PUT /api/admin/settings` (`routes/admin.ts`). Без этого master-toggle в UI
   менялся, но не применялся в БД.
2. **Real-ветка `promotions.ts` больше не создаёт `listing_promotions` заранее**:
   при `isCommercialMode=true` пишется только pending-payment, а сама запись
   `listing_promotions` создаётся **в webhook** при `succeeded`. Это исключает
   ситуации, когда неоплаченные/failed попытки выглядят оплаченными в журнале.
3. **Сводка выручки `/api/promotions/admin`** теперь считается строго по
   `payments.status='succeeded' AND target_type='promotion' AND provider='yookassa'`
   — мок-режим (amountRub=0) и pending не учитываются.
4. **Детерминированный Idempotence-Key**: `promo-payment-${payment.id}` — при
   сетевом ретрае ЮKassa вернёт тот же платёж, дублей не будет.
5. **HMAC webhook signature**: `verifyWebhookSignature` теперь использует
   `crypto.createHmac("sha256", secret).update(rawBody)` + `timingSafeEqual`.
   В production без `YOOKASSA_WEBHOOK_SECRET` — fail-closed (401).
6. **Raw body для подписи**: `app.use(express.json({ verify }))` сохраняет
   raw bytes в `req.rawBody`, webhook использует их вместо `JSON.stringify`
   (который зависит от порядка ключей и пробелов).
7. **Anti-replay через `SELECT ... FOR UPDATE`**: вся обработка статуса
   обёрнута в транзакцию с row-level lock по `yookassa_payment_id`, что
   защищает от двойного применения при параллельных вебхуках.

**Известные ограничения**:
- В обработке webhook сейчас активируется только `target_type=promotion`. Для
  `contact_pack`/`booking_protection` будет Stage 21b/c.
- Без `YOOKASSA_WEBHOOK_SECRET` верификация подписи отключена (dev-режим). На
  проде ENV-переменная **обязательна**, иначе webhook возвращает 401.
- Поле `is_commercial_mode` — отдельный master-toggle, независимый от полей
  «ЮKassa включена» и связанных секретов из Stage 20c.
## Stage 23b — Co-Sharing UI / P2P-флоу СБП (25.04.2026)

**Backend** (`artifacts/api-server/src/routes/pools.ts`, 5 endpoints):
- `GET /api/pools` — public, фильтр `?status=funding|purchasing|active|liquidated|canceled`
  (default `funding`). Возвращает массив с агрегатом `collectedAmountRub` (SUM
  `pool_shares.amount_rub` где `payment_status IN ('creator_confirmed','escrow_held')`).
- `POST /api/pools` — auth. Бета-режим жёстко: `collection_method='p2p_direct'`,
  `procurement_strategy='self_managed'`. Zod-валидация: `title 3..200`,
  `description ≤2000`, `itemUrl` http(s) only (ftp/data/javascript отбиваются),
  `targetAmountRub > 0`, `creatorPaymentDetails` обязателен.
- `GET /api/pools/:id` — public. Через JOIN с `users` возвращает `creator{id,
  firstName, lastName, avatarUrl}` и `shares[].userName/avatarUrl`.
- `POST /api/pools/:id/shares` — auth. `(pool_id, user_id)` UNIQUE на уровне БД
  → 409 `share_already_exists`. Только при `pool.status='funding'` иначе 409
  `pool_not_funding`. В бете сразу пишется `payment_status='user_transferred'`
  (юзер заявил «Я перевёл»).
- `POST /api/pools/:id/shares/:shareId/confirm` — auth + RBAC (только creator).
  Атомарная транзакция:
  1. SELECT share FOR UPDATE; если `payment_status != 'user_transferred'` →
     409 `share_not_transferred` (защита от двойного confirm).
  2. UPDATE `pool_shares` → `creator_confirmed`.
  3. SUM `amount_rub` по `COLLECTED_STATUSES = ['creator_confirmed','escrow_held']`.
  4. Если `collected ≥ target` И `pool.status='funding'` → UPDATE
     `pools.status='purchasing'` (ровно один раз, race-safe через WHERE-условие).

**Auth-конвенция** (важно для следующих агентов): этот проект использует
`req.userId` / `req.userRole` (НЕ `req.user.id`!). Это выставляется в
`middleware/auth.ts`. Если копируете шаблоны из других кодбаз — обязательно
адаптируйте.

**Frontend** (`artifacts/hochu-to/src/`):
- `lib/api-pools.ts` — тонкий fetch-клиент с `Authorization: Bearer` через
  `getAuthHeaders()` из `lib/auth`. Не идёт через orval — эндпоинты ещё не в
  OpenAPI-spec, добавим вместе со Stage 23c.
- `pages/Pools.tsx` — табы funding/purchasing/active, hero «Скиньтесь и
  купите вместе», карточки пулов с прогресс-баром и %.
- `pages/PoolCreate.tsx` — форма создания. Если `usePublicSettings().settings.isCommercialMode === false`,
  показывает баннер «Бета-режим: переводы напрямую без эскроу-комиссии».
- `pages/PoolDetail.tsx` — единая страница для трёх ролей:
  гость → CTA «Войдите»;
  не-creator без доли → модалка «Внести долю» с реквизитами СБП creator-а
  (с кнопкой Copy), чек-листом «откройте банк → переведите → нажмите Я
  перевёл», обязательным чекбоксом подтверждения;
  не-creator с долей → бейдж со статусом перевода;
  creator → блок «Ожидают подтверждения» с кнопкой confirm на каждой
  `user_transferred`-доле, toast при достижении 100% c переходом в `purchasing`.
- `App.tsx` — три новых роута + `/pools` добавлен в `PUBLIC_PATHS`.
- `Header.tsx` — навлинк «Совместные покупки» теперь ведёт на `/pools`.

**Регрессия**: 22/22 backend-сценариев прошли через curl (создание / contribute
/ дубликат / not-creator confirm / двойной confirm / 100%-trigger / contribute в
purchasing / ftp-URL / короткий title). Тестовые pools удалены из БД.

**Stage 23c (НЕ В ЭТОМ STAGE)**: авто-листинг при `pools.status='active'`,
динамический «Хранитель» (ротация), эскроу-флоу через ЮKassa
(`collection_method='platform_escrow'`), UI выбора `procurement_strategy='platform_concierge'`.

## Stage 25 — Вторичный рынок долей (P2P beta) (25.04.2026)

**Зачем.** Совладельцы могут выйти из пула, продав свою долю — без остановки эксплуатации вещи. На beta-этапе деньги переводятся напрямую через СБП; платформа выступает реестром прав.

**БД** (`lib/db/src/schema/co_sharing.ts`). В `share_offers` добавлены `buyer_id` (резерв), `reserved_at` (для TTL) и `seller_payment_details` (СБП-реквизиты продавца). Жизненный цикл: `open[buyer_id=NULL]` → `open[reserved]` → `sold` (атомарный merge) | `canceled`.

**Backend** (`artifacts/api-server/src/routes/pools.ts`) — 5 endpoints:
- `POST /pools/:id/shares/:shareId/offers` — create. Только своя оплаченная доля, нет другого открытого оффера.
- `GET /pools/:id/offers` — список открытых с join'ами.
- `POST /pools/:id/offers/:offerId/buy` — резерв. **TOCTOU + TTL 30 минут**: `UPDATE … WHERE status='open' AND (buyer_id IS NULL OR reserved_at < NOW() - 30 min)`. Без cron — протухший резерв перехватывается следующим buyer'ом атомарно.
- `POST /pools/:id/offers/:offerId/confirm-transfer` (только seller) — **АТОМАРНАЯ ПЕРЕДАЧА** в `db.transaction`: TOCTOU UPDATE статуса, повторная проверка ownership внутри tx, **merge** если у buyer уже есть доля в пуле (`UPDATE buyer.share SET %=%+%, ₽=₽+₽; DELETE seller.share`) или **transfer** (`UPDATE seller.share SET user_id=buyer_id`). Сложение DECIMAL(5,2) на стороне SQL, CHECK constraints гарантируют ≤100%.
- `POST /pools/:id/offers/:offerId/cancel` (только seller) — отмена с TOCTOU guard.

`GET /pools/:id` теперь отдаёт `offers[]` (открытые с join'ами sellerName/sharePercentage) — фронт за один запрос рендерит и доли, и рынок.

**Frontend** (`artifacts/hochu-to/src/`):
- `lib/api-pools.ts` — типы `ShareOfferDetail`, `ShareOfferStatus`, `BuyOfferResponse`, `ConfirmTransferResponse` + 5 функций.
- `pages/PoolDetail.tsx` — кнопка «Продать» в SharesList для своей оплаченной доли; новый `MarketplaceBlock` (между ResidualValueBlock и SharesList) с `OfferRow`; `SellShareModal` (расчёт справедливой цены через `calculateResidualValue × sharePercentage / 100`, инпут СБП-реквизитов, чек-бокс согласия); `BuyOfferModal` (двухфазный: резерв → показ СБП с copy-button); `SellerOfferActions` (cancel + confirm-transfer когда зарезервировано).

**Smoke E2E на pool#15 — все ✓:**
- Validation: 201 / 409 дубль / 403 чужая доля / 400 zod на пустые реквизиты.
- TOCTOU race: 5 параллельных `/buy` от alexey → 1×200 + 4×409.
- Self-buy: maria → 403 `cannot_buy_own_offer`.
- **Transfer-mode**: maria→alexey, share#13 user_id 14→13, `mergeMode='transfer'`. Дубль confirm → 409 `offer_not_open`.
- **Merge-mode**: dmitry→alexey (у которого уже 50%). share#13 50%→100%, 15000→30000₽, share#14 удалена. Целостность `SUM=100.00%, SUM(amount)=30000` ✓.
- Cancel-flow: 201 + 403 чужой + 200 свой + 409 повтор.
- Confirm от не-seller → 403 `only_seller_can_confirm`.

**Code review (architect): PASS.** SEVERE про TTL закрыт сразу — атомарный SQL-предикат в `/buy`, без cron-задачи.

**Followup (Stage 25+, future):** уведомления через `createNotification`, аудит-лог через `recordEvent`, серверное зеркало `calculateResidualValue`, замена нативного `confirm()` на shadcn `AlertDialog`, авто-переоценка офферов при изменении `wearAndTearMeter`. Эскроу + платформенная комиссия — Stage 24 (commercial mode).

## Журнал — Stage 30D-G (AI Provider Hardening, 28.04.2026)

После Stage 30C (Gemini + Amvera per-request switch) выкатка на Amvera обнажила набор скрытых багов: оба провайдера падали с непрозрачными 401/404. Серия из четырёх итераций — каждая отдельным коммитом — закрыла регрессию и одновременно зафиксировала ряд платформенных и интеграционных нюансов в Agent Rules `replit.md`.

### Контекст и платформенные ограничения (вылезли в этой серии)

- **Все git-команды заблокированы из агента** (даже read-only). Состояние с GitHub сверять вручную в Shell:
  ```bash
  rm -f .git/index.lock && git fetch origin && git log --oneline origin/main -3 && echo "---LOCAL---" && git log --oneline HEAD -3
  ```
- **`.replit` редактировать напрямую нельзя** — только через скиллы.
- **Артефакт-воркфлоу не удаляются из агента** (`PROHIBITED_ACTION: managed by an artifact`). Три дубля (`artifacts/api-server: API Server`, `artifacts/hochu-to: web`, `artifacts/mockup-sandbox: Component Preview Server`) висят в панели — на функциональность не влияют, удалять только из UI Replit.
- **GitHub-токен в env агента не проброшен** — приватный репо через GitHub API напрямую не опросить.

### Stage 30D — Diagnostics & verbose AI logs

`artifacts/api-server/src/index.ts`: перед `app.listen` добавлен блок:
```
--- AI CONFIG DIAGNOSTICS ---
GEMINI_KEY exists: <bool> length: <N>
AMVERA_TOKEN exists: <bool> length: <N>
------------------------------
```
Сами ключи никогда не печатаются. Эталон Google API key = 39 символов; 40+ → в env прилетел `\n`.

`artifacts/api-server/src/lib/ai-service.ts`: во всех 4 функциях (`generateAmvera`, `generateGemini`, `bulletsAmvera`, `bulletsGemini`) перед `throw` при non-2xx ответе провайдера вставлен `console.error(await res.text())` — теперь по логам сразу видно body-сообщение, а не голый статус. Сэкономило часы при отладке Stage 30E.

Gemini переведён с хедера `X-goog-api-key` на query `?key=${encodeURIComponent(apiKey)}` — на v1beta endpoint хедер давал 401.

### Stage 30E — Amvera auth-format откат

Попытка унифицировать Amvera под `Authorization: Bearer <token>` (как у Gemini/OpenAI) на проде ловила HTTP 401 с body `{"status":"ALTERNATIVE_STATUS_FINAL"}`. Откат на исходный нестандартный хедер:
```ts
headers: { "X-Auth-Token": `Bearer ${token}`, ... }
```
Это требование Kong-проксей Amvera (endpoint `https://kong-proxy.yc.amvera.ru/api/v1/models/llama`, модель `llama8b`). Также напомню: Amvera использует `text` вместо `content` в сообщениях. Зафиксировано в Agent Rules → AI Gateway, любая регрессия должна ловиться при ревью.

### Stage 30F — env bulletproof + workflow cleanup attempt

Во всех 4 точках:
```ts
const token = process.env.AMVERA_API_TOKEN?.trim();
const apiKey = process.env.GEMINI_API_KEY?.trim();
```
Страховка от хвостового `\n`/пробела, который Amvera-консоль умеет молча приклеивать при копи-пасте секрета в UI. `throw new Error("X is missing")` теперь срабатывает на затримленном значении — ключ из одних пробелов корректно отвергается.

Стартовая диагностика в `index.ts` сознательно оставлена БЕЗ `.trim()` — чтобы при ротации ключа сразу видеть «сырую» длину и расхождение с ожидаемой.

Попытка `removeWorkflow` для трёх артефакт-дублей упёрлась в `PROHIBITED_ACTION: managed by an artifact` — задокументировано в Agent Rules.

### Stage 30G — Gemini model alias fix (404 → resolved)

```ts
// было:
const GEMINI_MODEL = "gemini-1.5-flash";
// стало:
const GEMINI_MODEL = "gemini-flash-latest";
```
Google вычистил алиас `gemini-1.5-flash` из v1beta endpoint, на проде прилетал `404 model not found`. `*-latest` — страховка от повторения той же истории при следующей ротации алиасов. Обе функции (`generateGemini` и `bulletsGemini`) собирают URL из общей константы — правка одна, эффект на оба пути.

### Smoke (PASS на dev, 28.04.2026)
1. esbuild api-server bundle — без ошибок типов ✓
2. Workflow `Start application` рестартует чисто, диагностический блок печатается в логе ✓
3. `GET /api/listings`, `GET /api/health` → 200 ✓
4. На локалке Replit `GEMINI_API_KEY`/`AMVERA_API_TOKEN` не заданы — система корректно проваливается в smart-mock без 500 ✓

### Финальные SHA (origin/main, подтверждено пользователем)
- `586328b` — Revert Amvera auth header (30E)
- `e2f2487` — Bulletproof env vars with `.trim()` (30F)
- `d345122` — Gemini model URL → flash-latest (30G)

### Прод-проверка (Amvera после деплоя)
1. В логе старта — блок `--- AI CONFIG DIAGNOSTICS ---`, оба ключа `exists: true`, `GEMINI_KEY length: 39`.
2. Первый `POST /api/ai/generate-description` с провайдером Gemini — НЕ должен вернуть 404. 401/403/429 = вопросы к ключу/квоте, не к URL.
3. Первый `POST /api/ai/generate-description` с провайдером Amvera — НЕ должен вернуть 401 `ALTERNATIVE_STATUS_FINAL`. Если вернётся — кто-то откатил `X-Auth-Token: Bearer` на `Authorization`, искать регрессию.

### Followup (опционально, не критично)
- Двойной хедер для Amvera (`X-Auth-Token` + `Authorization`) на случай миграции Kong на стандарт — было в исходном ТЗ, отложено сознательно.
- Админ-эндпоинт `GET /api/admin/ai/health` (пинг обоих провайдеров без расхода токенов) — было в ТЗ Stage 30F, отложено.
- Кеш генераций по `(title, category, provider)` для повторных вызовов — экономия токенов на UX «не понравилось, ещё раз».

## Журнал — Stage 30H (Amvera pivot llama → DeepSeek-V3, 29.04.2026)

**Контекст.** После выкатки Stage 30G на проде Amvera продолжал отдавать «empty response» с эндпоинта `/models/llama` + модели `llama8b`. По openapi-спеке Amvera (`https://lllm-swagger-amvera-services.amvera.io/openapi.yaml`) роут `/llama` помечен deprecated. В админке Amvera в списке доступных моделей фигурируют DeepSeek/GPT/Qwen — без LLaMA вовсе.

### Источник истины — официальная документация
`https://docs.amvera.ru/LLM/doc-inference-ru.html` (раздел «API → Доступные варианты инференса»):

```
/llama       → llama8b, llama70b           (deprecated, удалили из админки)
/gpt         → gpt-4.1, gpt-5              (ТОЛЬКО OpenAI!)
/deepseek    → deepseek-R1, deepseek-V3
/qwen        → qwen3_30b, qwen3_235b
```

Эндпоинт собирается как `POST /models/<inference_name>`, где `<inference_name>` — **семейство**, не имя конкретной модели. Итого: для DeepSeek-V3 нужен именно `/models/deepseek` + `model: "deepseek-V3"` (case-sensitive, заглавная V — lowercase Amvera молча отдаёт пустой ответ).

Поле сообщений и парсинга ответа — **`text`**, не `content`. Это общее правило для всех Amvera-роутов, без исключений (пример из доки):
```json
{
  "model": "llama8b",
  "messages": [{ "role": "user", "text": "Hi, how are you?" }]
}
```

### Правки

**1. `artifacts/api-server/src/lib/ai-service.ts`** — добавлены константы у топа файла:
```ts
const AMVERA_URL   = "https://kong-proxy.yc.amvera.ru/api/v1/models/deepseek";
const AMVERA_MODEL = "deepseek-V3";
```
Обе функции (`generateAmvera` и `bulletsAmvera`) теперь шлют запрос через них вместо хардкода `/models/llama` + `model: "llama8b"`. Шапка файла переписана: указан правильный эндпоинт, явно подчёркнуто, что `/gpt` — НЕ для DeepSeek, и что имя модели case-sensitive.

**Что сохранено из Stage 30D-G** (НЕ регрессировать):
- Хедер `X-Auth-Token: Bearer ${token}` (НЕ `Authorization`)
- `.trim()` на токен
- Поле `text` в `messages[]`
- Парсинг `data.choices[0].message.text`
- Smart-mock fallback при любой ошибке
- Verbose `console.error(await res.text())` перед `throw` (Stage 30D)

**2. `artifacts/hochu-to/src/pages/ListingForm.tsx`** — dropdown (строка ~502):
```diff
- 🚀 LLaMA (Базовый)
+ 🚀 DeepSeek-V3 (Amvera)
```

**3. `artifacts/hochu-to/src/pages/AdminPage.tsx`** — карточка провайдера (строки ~3589-3596):
```diff
- title: "Amvera AI (llama8b)"
- desc: "Российский инференс на отечественных серверах. Без геоблокировок..."
+ title: "Amvera AI (DeepSeek-V3)"
+ desc: "Российский инференс на отечественных серверах. DeepSeek-V3 через /models/gpt. Без геоблокировок..."
```

### Расхождение с исходным ТЗ от CTO
CTO предположил «standard OpenAI schema: `{ messages: [{role, content}] }`». Это **неверно** для Amvera. По openapi.yaml роут `/gpt` всё равно использует поле `text`, а не `content`, и в запросе, и в ответе. Если бы я переключился на `content`, на проде получили бы ту же `Amvera: empty response` — Amvera проигнорировал бы `content` и оставил `text` пустым. Поэтому код парсинга `data?.choices?.[0]?.message?.text` оставлен как есть — он валиден и для DeepSeek-V3 эндпоинта.

### Smoke (PASS на dev, 29.04.2026)
1. esbuild api-server bundle — без ошибок типов ✓
2. Workflow `Start application` рестартует чисто, диагностический блок печатается ✓
3. `GET /api/listings`, `GET /api/categories`, `GET /api/regions` → 200 ✓

### Прод-проверка (Amvera после деплоя)
1. `POST /api/ai/generate-description` с `provider: "amvera"` → должен вернуться текст с `actualProvider: "amvera"`, `fallback: false`. Если снова `empty response` — лог `[AI Service Error][Amvera/description]` теперь печатает body ответа (наследие Stage 30D), смотреть, не отличается ли реальное API-имя модели от документального `deepseek-V3` (например, `DeepSeek-V3` или `deepseek-chat`).
2. UI на форме создания и в админке должен показывать «DeepSeek-V3 (Amvera)», а не «LLaMA (Базовый)».
3. Если Gemini после Stage 30G на проде продолжит падать с РФ-IP — это уже Stage 30I (geo-block через прокси либо скрыть Gemini из dropdown'а с пометкой «работает на VPN-серверах»).

### Push
```bash
bash scripts/github-push.sh "feat(ai): pivot Amvera provider to DeepSeek-V3 on /models/deepseek endpoint"
```

## Журнал — Stage 30H-fix2 (Amvera response shape: alternatives vs choices, 29.04.2026)

**Контекст.** После выкатки Stage 30H на прод Amvera возвращал HTTP 200, но наш парсер всё равно падал в `Amvera: empty response` → `falling back to mock`. В деплой-логе Amvera диагностика показала, что и токен, и URL, и модель — корректные:
```
GEMINI_KEY exists: true length: 39
AMVERA_TOKEN exists: true length: 1318
```
То есть проблема была не в авторизации и не в URL — а в том, ЧТО мы извлекаем из тела ответа.

### Корень проблемы
С самого Stage 30A парсили чистый OpenAI-формат:
```ts
data?.choices?.[0]?.message?.text   // ← такого поля у Amvera в общем случае нет!
```
А в реальности у Amvera формат ответа **зависит от эндпоинта** (источник истины — `https://lllm-swagger-amvera-services.amvera.io/openapi.yaml`):

| Эндпоинт | Поле в ответе |
|---|---|
| `/models/llama` (deprecated) | `alternatives[0].message.text` (Yandex/Amvera-формат) |
| `/models/gpt` | `choices[0].message.text` (OpenAI Chat Completions) |
| `/models/deepseek` | в openapi не описан, эмпирически `alternatives` |
| `/models/qwen` | в openapi не описан, эмпирически `alternatives` |

То есть OpenAI-схема есть **только** на `/gpt`. На остальных трёх роутах — нативный Amvera-формат с `alternatives`. Вся история Stage 30A-G работала бы на `/gpt`, но нам нужны были именно DeepSeek/LLaMA — и парсер всегда возвращал undefined, поэтому всегда падал в smart-mock. Никто не видел этого, потому что прод-логи раньше были скрыты, а в Stage 30D-G сосредоточились на токенах и URL, не на парсинге.

### Правки (`artifacts/api-server/src/lib/ai-service.ts`)

**1. Парсинг с nullish-fallback по обоим полям** — в `generateAmvera` (строки ~217-219) и `bulletsAmvera` (строки ~615-617):
```ts
const text =
  data?.alternatives?.[0]?.message?.text ??
  data?.choices?.[0]?.message?.text;
```
Так код устойчив к переключению эндпоинта в любом направлении. Если CTO потом скажет «давай попробуем `/qwen` вместо `/deepseek`» — фикс не нужен. Если решит вернуться на `/models/gpt` — тоже работает.

**2. Диагностика непредвиденного формата.** ВНУТРИ ветки empty response добавлен `console.error` со срезом сырого `data` (первые 500 символов JSON):
```ts
if (typeof text !== "string" || !text.trim()) {
  console.error(
    "[AI Service Error][Amvera/description]: Unexpected response shape, raw data slice:",
    JSON.stringify(data).slice(0, 500),
  );
  throw new Error("Amvera: empty response");
}
```
Это предохранитель: если Amvera в будущем сменит формат ещё раз (например, добавит обёртку `result.text`), мы сразу увидим в логах сырую структуру, а не будем гадать.

**3. Шапочный комментарий файла** обновлён: явно перечислены оба формата (alternatives vs choices) с маппингом по эндпоинтам.

### Чему это нас учит (НЕ регрессировать)

- **Никогда не доверять «стандартной OpenAI-схеме» применительно к Amvera.** OpenAI-совместимость есть только на одном их эндпоинте (`/gpt`), и то частичная (поле `text` вместо `content`). Для всех остальных — Yandex-формат с `alternatives`.
- **При парсинге внешних AI-ответов всегда логировать сырое тело** в случае несоответствия ожидаемому формату. Один `console.error` с `JSON.stringify(data).slice(0, 500)` экономит итерацию деплой → багрепорт → деплой.
- **При смене эндпоинта Amvera** (например, попробовать Qwen) — НЕ нужно менять парсинг, fallback покрывает всё семейство.

### Smoke (PASS на dev, 29.04.2026)
1. esbuild api-server bundle — без ошибок типов ✓
2. Workflow `Start application` рестартует чисто, AI CONFIG diagnostics печатается ✓
3. `GET /api/listings`, `/api/categories`, `/api/regions` → 200 ✓

### Прод-проверка (Amvera после деплоя)
- `POST /api/ai/generate-description` с `provider: "amvera"` → должен вернуться нормальный текст с `actualProvider: "amvera"`, `fallback: false`.
- Если опять `empty response` (маловероятно) — теперь в логе будет строка `[AI Service Error][Amvera/description]: Unexpected response shape, raw data slice: {...}`, по ней сразу видно правильный путь.

### Push
```bash
bash scripts/github-push.sh "fix(ai): parse Amvera response from both 'alternatives' and 'choices' (Yandex vs OpenAI shape)"
```

## Журнал — Stage 30J-revert2 (Gemini model name regression, ЗАКРЫТО, 29.04.2026)

**Контекст.** Stage 30J ввёл двухконстантную схему `GEMINI_PRO_MODEL = "gemini-1.5-pro-latest"` + `GEMINI_FLASH_MODEL = "gemini-1.5-flash"` с обёрткой `geminiCallWithFallback` (Pro → Flash при 429/503). На прод-Amvera Gemini немедленно упал в 404 от Google. Три точечных хотфикса (PRO → `gemini-1.5-pro`, оба → `gemini-1.5-flash`, оба → `gemini-2.5-flash`) — каждый давал 404. CTO попросил откатить всю архитектуру обратно к простому прямому fetch.

### Корень проблемы (важно для будущих агентов)

**Не обёртка `geminiCallWithFallback` сломала прод** — она ничего не трансформировала, просто делегировала вызов в `geminiCall` с тем же URL/телом. Обёртку можно было оставить.

**Реальная причина.** В Stage 30J имена моделей `gemini-1.5-pro-latest` / `gemini-1.5-flash` были взяты без проверки против журнала Stage 30G (см. эту же документацию выше). А там чёрным по белому: Google ещё 28.04 вычистил алиас `gemini-1.5-flash` из v1beta endpoint, единственное стабильное имя — `gemini-flash-latest` (`*-latest` — официальная страховка Google от ротации версий моделей).

Хуже того — при первом откате (Stage 30J-revert) я опять буквально взял `gemini-1.5-flash` из текста CTO-задачи и снова получил 404. Спас только повторный grep по своему же AGENT_INSTRUCTIONS (Stage 30G), где уже было задокументировано правильное имя.

### Финальные правки (`artifacts/api-server/src/lib/ai-service.ts`)

**1. Одна константа с `*-latest` алиасом и жирным предостережением:**
```ts
// ⚠️ КРИТИЧНО — НЕ менять обратно на "gemini-1.5-flash" / "gemini-1.5-pro"!
// Google вычистил эти алиасы из v1beta endpoint, прод отдаёт 404 model not
// found. Алиас "*-latest" — официальная страховка Google от ротации версий
// (см. docs/AGENT_INSTRUCTIONS.md, журнал Stage 30G от 28.04.2026).
const GEMINI_MODEL = "gemini-flash-latest";
```

**2. Удалены `GEMINI_PRO_MODEL`, `GEMINI_FLASH_MODEL`, `geminiCall`, `geminiCallWithFallback`.** Никакого Pro→Flash retry больше нет.

**3. `generateGemini` и `bulletsGemini` — простой прямой fetch:**
```ts
const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 2048 },
    }),
    signal: ctrl.signal,
  },
);
```
При ошибке — обычный `throw`, наверху ловит smart-mock в `generateListingDescription`/`generateInfographicBullets`.

**4. Сохранено без изменений:**
- Премиум-промпт `PREMIUM_GEMINI_INFOGRAPHIC_PROMPT` (английская инструкция, JSON-выход, русские строки) — это ортогональная UX-логика.
- Тройной парсер JSON → pipe → `parseBullets` в `bulletsGemini`.
- Страховка вёрстки `≤ 32 символа/буллет` (slice по слову).
- Вся Amvera-ветка (`generateAmvera`/`bulletsAmvera`/`AMVERA_URL`/`AMVERA_MODEL`), OpenAI, mock, router, frontend.

### Чему это нас учит (НЕ регрессировать)

- **При смене имени модели Gemini ВСЕГДА сверяться с журналом Stage 30G.** Имена `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-1.5-pro-latest` мертвы на v1beta и возвращают 404. Алиас `*-latest` — единственный надёжный.
- **Не верить тексту задачи CTO буквально, если он противоречит Stage-bible.** Если в задаче просят вернуть `gemini-1.5-flash`, а в журнале стоит «вернуть на `gemini-flash-latest`» — приоритет у журнала. Перед правкой сослаться на запись и спросить подтверждения.
- **Опровергнута гипотеза Stage 30I (geo-block).** Раньше думали, что Google режет запросы с РФ-IP Amvera; на самом деле прод-Amvera штатно ходит к `generativelanguage.googleapis.com`. Вся симптоматика была на стороне неправильного имени модели. Stage 30I из roadmap'а вычеркнут.
- **Не путать причину с симптомом.** Обёртки/фолбэки часто выглядят подозрительно («сложный код = бажный код»), но реальная регрессия может быть в другом месте — диффе строковой константы между двумя коммитами. Перед тем как откатывать архитектуру, сначала проверить именно те данные, которые улетают в API (URL, имя модели, имя поля).

### Smoke (PASS на dev, 29.04.2026)
1. esbuild api-server bundle — без ошибок типов ✓
2. Workflow `Start application` рестартует чисто, диагностический блок печатается ✓
3. `GET /api/listings`, `GET /api/categories`, `GET /api/regions` → 200 ✓
4. В коде ровно одна константа `GEMINI_MODEL` (grep даёт 4 совпадения: 1 определение + 3 использования = generateGemini, bulletsGemini, и комментарий) ✓

### Прод-проверка (PASS на Amvera, 29.04.2026, подтверждено CTO)
- Gemini (`POST /api/ai/generate-description` с `provider: "gemini"`) → возвращает полный текст с `actualProvider: "gemini"`, `fallback: false`. ✓
- Amvera DeepSeek-V3 (`provider: "amvera"`) → возвращает полный текст с `actualProvider: "amvera"`, `fallback: false`. ✓
- Smart-mock в логах не появляется (нет `falling back to mock`). ✓

### Push
```bash
bash scripts/github-push.sh "fix(ai): restore working gemini-flash-latest model (Stage 30G config)"
```

## Журнал — Stage 29 (Trust Score Engine V6, ретроспективно зафиксировано Stage 32, 29.04.2026)

**Контекст.** V6 «Trust Score helper» из § 11d был реализован в коде до Stage 32, но без отдельной записи в Stage-журнал. Stage 32 «Documentation Sync» закрывает этот пробел ретроспективно — функционал в проде, формула задокументирована.

**Файл:** `artifacts/api-server/src/lib/trust-score.ts` (~125 строк, экспорт `calculateAndUpdateTrustScore` и `recalculateTrustScoreForUsers`).

**Формула (V1, 0..100), отличается от стартовой версии § 11d:**

| Компонент | Вес | Источник |
|---|---|---|
| База | +20 | константа |
| Средний рейтинг отзывов | +(avgRating / 5) × 30 | `reviews.rating` для `revieweeId = userId` (как owner + как renter) |
| Опыт (завершённые сделки) | +MIN(deals × 5, 30) | `users.completedDealsCount` |
| Бейдж «Проверенный владелец» | +20 если `isVerified` | `users.isVerified` (Stage 19g) |
| Подтверждённые претензии «по вине» | −20 за каждую | `claims.status IN ('approved','paid') AND payout_to_user_id != userId AND payout_to_user_id IS NOT NULL` |
| **Clamp** | **0..100** | `Math.max(0, Math.min(100, score))` |

Отличается от стартовой формулы § 11d тем, что (а) база 20 (вместо 50), (б) рейтинг масштабируется пропорционально (вместо порогов 4.5/4.0), (в) убран компонент «возраст аккаунта», (г) убран отдельный штраф за бан (он закрывается через нулевую активность).

**Триггеры пересчёта** (post-commit, fire-and-forget через `void` — не валит основной ответ):
- `routes/reviews.ts:137` — `void calculateAndUpdateTrustScore(review.revieweeId, userId, "review_created:${review.id}")`.
- `routes/admin.ts:16` — после административных действий, меняющих репутацию (verify, ban, claim approve/mark-paid).
- `backfill-trust-scores.ts` — одноразовый скрипт для разовой инициализации поля у всех существующих пользователей.

**Audit-trail.** Каждое успешное обновление пишется в `audit_events` (`entityType='user'`, `eventType='trust_score_updated'`, payload содержит `previousScore` и `newScore`). При ошибке функция возвращает `null`, лог через pino — наверх ничего не бросает (защита: триггер из `reviews.ts` не должен сломать создание отзыва, если БД для audit временно недоступна).

**Что показывается публично (V8 НЕ закрыт):**
- ✅ Владельцу в `Dashboard.tsx` (таб «Профиль»).
- ✅ Админу в `AdminPage.tsx` (карточка пользователя).
- ✅ В API-ответах `/api/auth/me`, `/api/users/:id`, `/api/listings`, `/api/listings/:id`, `/api/pools/:id` (поля `trustScore`, `trustScoreUpdatedAt`).
- ❌ Маркер на карточке объявления / фильтр в каталоге — отложен до 100+ сделок и 50+ владельцев.

**Известные пробелы (Stage 29 followup):**
- V7 — ежесуточный cron-пересчёт через `lib/scheduler.ts` для всех владельцев с активными объявлениями.
- V8 — публичный UI (маркер `87/100` на карточках, фильтр «TS ≥ 70» в каталоге, объяснялка в Dashboard).
- Сброс верификации (`unverify_user`) сейчас **не** вызывает пересчёт; score теряет +20 только когда придёт следующий триггер от review/claim. Если решим, что критично — добавить `void calculateAndUpdateTrustScore(...)` в обработчик `unverify_user` в `routes/admin.ts`.

## Журнал — Stage 32 (Documentation & Roadmap Synchronization, 29.04.2026)

**Контекст.** Аудит кодовой базы (`Comprehensive Codebase Audit & Reality Check`, 29.04.2026) показал, что Stage-журнал и Project Checklist в `replit.md` отстали от реальности по нескольким направлениям одновременно:
1. **Цифровой Акт** (видео + GPS-pin + подпись) числился «в работе», хотя Stage 22b и Stage 22b-followup закрыли всё.
2. **Trust Score** числился «не начато», хотя Stage 29 (этот журнал) выпустил V6 в продакшен и активно пересчитывается из `reviews.ts` и `admin.ts`.
3. **ЮKassa** числилась «серверной интеграции нет», хотя Stage 21a выкатил полнофункциональный REST-клиент с поддержкой холдов (`capture:false`) и HMAC-подписанным вебхуком — закрыто для use-case продвижения объявлений (промо).
4. **Шапка Stage 30A** описывала Amvera-парсинг как `data.choices[0].message.content`, хотя после Stage 30E (поле `text` вместо `content`) и Stage 30H-fix2 (для `/models/deepseek` поле = `alternatives[0].message.text`) это устарело.
5. **Stage 29 не имел собственной записи в журнале** — фича была в коде ~2 дня без документации.
6. **KYC, эскроу для бронирований, авто-выплаты** не были разделены на «технический бэклог» vs «сознательно отложено до открытия ИП», что создавало впечатление дыр в roadmap. На самом деле это согласованная с CTO стратегия (нужно ИП, защищённое PII-хранилище, юридическая оценка).

**Что сделано (read-write на 2 файла):**
- `replit.md` Project Checklist:
  - блок «🟡 В работе» вычищен от закрытых пунктов (Цифровой Акт, Trust Score, ЮKassa-сервер, индексы, Admin-RBAC); оставлены только реальные текущие задачи + followup-хвосты Stage 27/28/29/30B;
  - добавлена новая секция **«🛑 Сознательно отложено (Deferred by Design)»** с явным указанием бизнес-блокеров: KYC по 152-ФЗ/115-ФЗ, Stage 24 commercial booking holds, Stage 28 followup buyout escrow, Stage 21b ЮKassa контактов, авто-выплаты по claims, CloudPayments как второй шлюз;
  - блок «🔴 Roadmap» расширен Stage 33 (AI-Арбитражор) первым пунктом.
- `replit.md` добавлена ретроспективная секция **Stage 29 — Trust Score Engine V6** между Stage 28 и Stage 30A, с формулой, триггерами, audit-trail, списком V7/V8-followup.
- `replit.md` Stage 30A: в начало шапки добавлена врезка **«📌 Stage 32 sync»** с навигацией на актуальные Stage 30G/30H/30H-fix2/30J-revert2 (модели, парсеры, заголовки, опровергнутый Stage 30I) — без перезаписи исторического текста.
- `replit.md` финальная секция «What Is NOT Yet Implemented» расщеплена на 4 группы (Deferred by Design / Технический бэклог / Закрыто-вычеркнуто / Будущие фичи Stage 33), убраны противоречия с Project Checklist.
- `docs/AGENT_INSTRUCTIONS.md § 11d` таблица V1-V8: статус V6 переведён в `✅ ГОТОВО (Stage 29)`, V7 переформулирован как `⏳ Stage 29 followup`, V8 детализирован «отложен до калибровки на 100+ сделок».
- `docs/AGENT_INSTRUCTIONS.md` хвост: добавлены ретро-журнал Stage 29 и текущий журнал Stage 32 (этот раздел) + плановый Stage 33.

**Принципы синхронизации (применены при правках):**
- **Не переписывать историю.** Старые Stage-записи (30A с устаревшим парсером Amvera) не редактируются — добавляется только врезка-маркер в начале с навигацией на актуальные журналы. Это сохраняет аудит-trail «как мы пришли к текущему решению».
- **Симметрия checklist'ов.** Project Checklist в `replit.md` и таблицы статусов в `AGENT_INSTRUCTIONS.md § 11d` правятся в одном коммите, чтобы они не разошлись снова.
- **Явный «Deferred by Design».** Любая фича, отсутствующая по согласованной с CTO стратегии (а не из-за нехватки времени), маркируется отдельно — это снимает ложное ощущение технического долга у читателей.

**Чему это нас учит (НЕ регрессировать):**
- **Project Checklist в `replit.md` — это жёсткая обязанность Stage X.** Любая итерация, которая сдаёт фичу из 🟡 в ✅, должна перенести её одним коммитом. Ретроспективные синхронизации (Stage 32) — это знак, что кто-то нарушил правило _«replit.md обновлять разделы Project Checklist (✅ / 🟡 / 🔴) так, чтобы карта проекта всегда отражала реальность»_ (см. этот файл, строка 332). При каждом следующем Stage X сначала спросить себя: «какие пункты Checklist сейчас лжут?» — потом писать новый код.
- **Stage без журнальной записи — баг процесса.** Stage 29 жил в коде 2 дня без записи. Это приемлемо для одной экстренной итерации (Stage 30A отвлёк), но не дольше. Если фича выкатывается без Stage-номера — при следующей же итерации присвоить номер и добавить запись.
- **«Сознательно не делать» = архитектурное решение, не дыра.** KYC, эскроу для бронирований, авто-выплаты — все они отсутствуют по согласованной с CTO стратегии. Без явной маркировки `🛑 Deferred by Design` это выглядит как технический долг, что вводит в заблуждение и читателей, и будущих агентов.

### Push
```bash
bash scripts/github-push.sh "docs: sync replit.md and agent instructions with actual codebase (Stage 32)"
```

## Журнал — Stage 32-debug (Smoke-pass + Cookie Fix, 29.04.2026)

**Контекст.** Отладочный прогон между Stage 32 и Stage 33: smoke всех ключевых endpoints, LSP, проверка runtime-багов перед research-итерацией Stage 33.

**Что сделано:**
1. **Seed-БД восстановлен.** После сессионного restore-чекпойнта таблицы `regions/categories/listings` оказались пустыми (только `users:1`, `platform_settings:1`). Запустил `pnpm --filter @workspace/api-server seed` → 85 регионов, 10 категорий, 14 объявлений, 7 тест-юзеров (включая `admin@test.ru` / `Admin1234!` и `alexey@example.com` / `Test1234!`). Это норма после restore — seed надо помнить, не воспринимать пустые таблицы как баг продукта.
2. **Cookie-fix в `routes/auth.ts:setRefreshCookie/clearRefreshCookie`.** Переменная `isProduction = process.env.NODE_ENV === "production"` была объявлена строкой выше, но НЕ применялась — стояло хардкод-`secure: true, sameSite: "none"`. На HTTP-localhost (curl-смоки, локальная отладка вне Replit-preview) браузеры/curl тихо отбрасывают такие cookie → `POST /api/auth/refresh` всегда падал в 401, refresh-flow был полностью сломан в dev-окружении. Исправил: `secure: isProduction`, `sameSite: isProduction ? "none" : "lax"`. Production-поведение (Amvera HTTPS + Replit iframe-preview через https://*.repl.co) не изменилось — там `NODE_ENV=production` и работает как раньше. В коде также убран некорректный комментарий «secure: true — обязателен для HTTPS в Amvera» и расписана логика двух режимов.

**Smoke-результаты (после фикса, прогон 29.04.2026 16:42 MSK):**
- **LSP:** `0 errors / 0 warnings / 0 infos` во всём монорепо (api-server, hochu-to, mockup-sandbox, lib/*) — это де-факто заменяет отсутствующий `tsc`.
- **Auth flow:** `POST /login` → access-token + refresh-cookie ✅. `GET /me` с `Authorization: Bearer <access>` → корректный профиль ✅. `POST /refresh` с cookie → новый access-token ✅. `POST /logout` → cookie очищается, `POST /refresh` после → 401 ✅.
- **RBAC:** `/api/admin/users` с admin-токеном → 200 (список юзеров), с owner-токеном (alexey) → 403, без токена → 401 ✅.
- **AI mock-провайдер** (`POST /api/ai/generate-description` с `provider:"mock"`): `actualProvider:"mock"`, `fallback:false`, поле `text` содержит ~700-символьный русский маркетинг-блок с эмодзи, буллетами и описанием состояния ✅.
- **Каталог:** `/api/listings` total=14, `/api/regions` 85, `/api/categories` 10.
- **Health:** `/health` 200, esbuild build clean 283ms, никаких ERROR/WARN в логах api-server.

**Чему это нас учит (НЕ регрессировать):**
- **Cookie-флаги обязаны быть environment-aware.** Если в коде объявлена `isProduction` для security-параметров, она ОБЯЗАНА применяться ко всем `secure`/`sameSite` единообразно. Проверка: `rg "secure: true|sameSite:" artifacts/api-server/src` не должна находить хардкод-литералы. Этот паттерн — потенциальная регрессия в любом будущем cookie-эндпоинте (новые сессии, CSRF-токены и т.п.).
- **Smoke auth-эндпоинтов делается под Bearer, не под cookie.** Архитектура: access-token — `Authorization: Bearer`, refresh-token — HTTP-only cookie. Curl-смок защищённого endpoint только с `-b cookies.txt` и без `-H "Authorization: Bearer ..."` всегда вернёт 401 — это **нормально** (защита от CSRF). Стандартный шаблон smoke: `TOKEN=$(curl -s ... /login | jq -r .token); curl -H "Authorization: Bearer $TOKEN" ...`.
- **Seed после restore-чекпойнта = первая команда отладки.** Если БД выглядит пустой (нет регионов/категорий, /api/listings возвращает `{total:0,listings:[]}`) — это не баг продукта, а restore-«чистая» БД. Команда: `pnpm --filter @workspace/api-server seed` (idempotent, чистит и пересоздаёт regions/categories/listings, обновляет тестовых юзеров).
- **AI-ответ имеет поле `text`, не `description`.** При smoke AI-эндпоинтов это легко перепутать. Shape: `{text, provider, actualProvider, fallback, fallbackReason}`. Смотри `routes/ai.ts` или `lib/ai-service.ts` для актуальной формы перед написанием jq-фильтра.
- **typecheck-скрипт сейчас декоративный (известно, не блокирует).** В `package.json` обоих артефактов есть `"typecheck": "tsc -p tsconfig.json --noEmit"`, но `typescript` не установлен ни в root-`package.json`, ни в подпакетах — `tsc` бинаря в `node_modules/.bin` нет. LSP-сервер (внутри Replit IDE) компенсирует это полностью: `getLatestLspDiagnostics()` дал 0 ошибок. Установка `typescript` как root-devDep — отдельная инициатива, отложена до явного запроса/CI-пайплайна. Сейчас приоритета нет, риска тоже нет.
- **«Двойной vite-процесс» — артефакт окружения, не баг кода.** При параллельном запуске composite workflow `Start application` (PORT=5000) и отдельного `artifacts/hochu-to: web` (без env, дефолт 21418) запускаются два vite-сервера; preview pane Replit ходит на :5000, и первый из них может не подняться из-за конфликта. Это не повод править код или workflows — пользователь сам выбирает, какой workflow запустить. Если preview пуст — посмотреть `pgrep -af vite` и оставить ровно один процесс.

### Push
```bash
bash scripts/github-push.sh "fix(auth): NODE_ENV-aware cookie flags + Stage 32-debug smoke pass"
```

## Журнал — Stage 33.0 (AI Redundancy + UI Polish, 30.04.2026)

**Контекст.** Домен `www.hochuto.ru` активен. Добавлен прямой ключ DeepSeek API для AI-резервирования. Цепочка провайдеров для генерации описаний и буллетов инфографики расширена с двух до трёх уровней.

### Что сделано

**1. AI-избыточность — прямой DeepSeek API как третий провайдер**

Файл: `artifacts/api-server/src/lib/ai-service.ts`

Новая цепочка для провайдера `amvera` (и когда activeAiProvider = 'amvera' в platform_settings):
```
Amvera (kong-proxy.yc.amvera.ru) → Direct DeepSeek (api.deepseek.com) → Mock
```

Добавлены три новые константы у топа файла:
```ts
const DEEPSEEK_DIRECT_URL     = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_DIRECT_MODEL   = "deepseek-chat";
const DEEPSEEK_DIRECT_TIMEOUT_MS = 30_000;
```

Добавлены две новые функции:
- `generateDirectDeepSeek(input: GenerateInput): Promise<string>` — OpenAI-совместимый формат (`Authorization: Bearer`, поле `content`, модель `deepseek-chat`).
- `bulletsDirectDeepSeek(title, category): Promise<string[]>` — аналог для инфографических буллетов.

Ключевая особенность: прямой DeepSeek использует **стандартный OpenAI Chat Completions формат** (в отличие от Amvera, где поле `text` вместо `content` и нестандартный хедер `X-Auth-Token`). Не регрессировать.

Изменения в роутере (`generateListingDescription` и `generateInfographicBullets`): вместо единого try/catch amvera-ветка получила вложенный try/catch:
```ts
else {
  try {
    text = await generateAmvera(input);
  } catch (amveraErr: any) {
    logger.warn({ err: amveraErr?.message }, "Amvera failed, trying direct DeepSeek API");
    text = await generateDirectDeepSeek(input);  // бросит → внешний catch → mock
  }
}
```

**Ключ:** `DEEPSEEK_API_KEY` = `sk-bbf4cc431aa4488895da859c9516492e`
**Платформа:** https://platform.deepseek.com
**Модель:** `deepseek-chat` (стабильный alias DeepSeek-V3)

**2. UI-полировка — AlertDialog вместо window.confirm**

Файл: `artifacts/hochu-to/src/pages/ListingForm.tsx`, компонент `AiDescriptionButton`

Браузерный `window.confirm()` заблокирован в Replit-iframe (silent fail) и несовместим с фирменным UI. Заменён на контролируемый `AlertDialog` из `@radix-ui/react-alert-dialog` (компонент уже был в проекте).

Логика:
- Кнопка «Сгенерировать ИИ-описание» вызывает `handleClick`.
- Если `currentText.trim().length > 30` — открывается диалог с предупреждением «Заменить описание?».
- Кнопка «Заменить» (фирменный цвет `#C65D3B`) подтверждает → `doGenerate()`.
- Кнопка «Отмена» закрывает без действия.

`doGenerate` выделен в `useCallback` — одна функция и для прямого вызова (когда текст пустой/короткий), и для подтверждения в диалоге.

Добавлен импорт `useCallback` из React.

**3. Домен — нет пользовательских amvera.io URL в TSX**

Проверено: grep по `amvera\.io` в `.tsx`-файлах вернул `0 совпадений` в пользовательском коде. Все вхождения — только в комментариях кода (URL документации Amvera API), `replit.md` и `docs/AGENT_INSTRUCTIONS.md`. Замена не требуется.

**4. Инфраструктура Replit**

На текущем Replit созданы два воркфлоу:
- **API Server** (`console`, порт 8080): `PORT=8080 pnpm --filter @workspace/api-server run dev`
- **Start application** (`webview`, порт 5000): `PORT=5000 BASE_PATH=/ pnpm --filter @workspace/hochu-to run dev`

### Чему это нас учит (НЕ регрессировать)

- **Direct DeepSeek ≠ Amvera.** Для прямого DeepSeek используется стандартный Chat Completions формат: `Authorization: Bearer DEEPSEEK_API_KEY`, поле сообщений `content` (не `text`), ответ в `choices[0].message.content`. Это противоположно Amvera, где `X-Auth-Token: Bearer`, поле `text`, ответ в `alternatives[0].message.text`.
- **window.confirm в iframe = тихий баг.** Replit и другие iframe-среды блокируют нативный диалог без вывода ошибки — пользователь видит, что нажал кнопку, но ничего не произошло. При любом новом confirm-паттерне сразу использовать AlertDialog.
- **Цепочка провайдеров теперь трёхуровневая.** При смоке AI-эндпоинтов с `provider: "amvera"` и отсутствующим Amvera-токеном система должна попробовать DeepSeek, и только если и он недоступен — вернуть mock. Если возвращается mock при живом DEEPSEEK_API_KEY — искать ошибку в промежуточном catch.

### Smoke (PASS на dev, 30.04.2026)
1. esbuild api-server build — без ошибок типов ✓
2. Workflow `API Server` (порт 8080) + `Start application` (порт 5000) подняты и работают ✓
3. `GET /api/health`, `/api/listings`, `/api/categories`, `/api/regions` → 200 ✓
4. AI mock-режим: `POST /api/ai/generate-description` с `provider:"mock"` → `actualProvider:"mock"`, `fallback:false` ✓
5. Фронтенд (`/`) рендерится, хедер, hero, CTA-кнопки — всё на месте ✓

### Прод-чеклист (после деплоя на Amvera/hochuto.ru)
1. Установить `DEEPSEEK_API_KEY = sk-bbf4cc431aa4488895da859c9516492e` в переменные окружения Amvera.
2. Проверить: `POST /api/ai/generate-description` с `provider: "amvera"` — если Amvera жив, должен вернуть `actualProvider: "amvera"`, `fallback: false`.
3. Временно убрать `AMVERA_API_TOKEN` → повторить запрос → должен сработать DeepSeek (`actualProvider` будет `"amvera"`, но в логах — `"Amvera failed, trying direct DeepSeek API"` + успех).
4. UI: в форме добавления вещи нажать «Сгенерировать ИИ-описание» при заполненном поле — должен появиться AlertDialog (не нативный confirm).

### Push
```bash
bash scripts/github-push.sh "feat(ai): direct DeepSeek API fallback (Amvera→DeepSeek→Mock); refactor(ui): AlertDialog instead of window.confirm"
```

---

## Журнал — Stage 33.1 (UI & Logic Polish — GPS, Gender, Cache, 30.04.2026)

**Контекст.** Продолжение полировки после Stage 33.0. Три независимых улучшения: визуализация GPS-пинов на карте в админке, гендерно-чувствительные уведомления, кэш буллетов инфографики.

### Что сделано

**1. GPS — несколько пинов на карте (wow-эффект для администратора)**

Файлы: `artifacts/hochu-to/src/components/DigitalActMap.tsx`, `artifacts/hochu-to/src/pages/AdminPage.tsx`

- `DigitalActMap` принимает новый проп `pins: Array<{lat, lng, label?}>` в дополнение к старым `lat`/`lng` (обратная совместимость сохранена).
- При нескольких пинах карта автоматически вызывает `fitBounds(group.getBounds().pad(0.25))` — все маркеры видны сразу.
- Клик по маркеру открывает popup с координатами и номером фото (`Фото 1`, `Фото 2`, …).
- `AdminPage.tsx` / `DigitalActsBlock`: теперь извлекает **все** GPS-точки из `meta.photoExif[]` (а не только первую), передаёт их в `DigitalActMap` как `pins`. Бейдж "📍 GPS" показывает количество точек если > 1.

**2. Гендерно-чувствительные уведомления**

Файлы: `artifacts/api-server/src/lib/notifications.ts`, `artifacts/api-server/src/routes/bookings.ts`

Новые экспорты в `notifications.ts`:
```typescript
type Gender = "m" | "f" | "n"
function detectGender(name: string): Gender        // эвристика по имени
function genderedWord(name, maleForm, femaleForm, neutralForm?): string
function genderPronounGen(name: string): string     // "него" / "неё"
```

Эвристика: имена на «а»/«я» — женские; список исключений (Никита, Илья, Петя, Миша, …) — мужские; двусмысленные (Саша, Женя, Валя) — нейтральные (fallback = maleForm).

Обновлённые сообщения в `bookings.ts`:
| Событие | До | После (пример: владелица Мария) |
|---|---|---|
| `booking_confirmed` | «Владелец подтвердил» | «Владелица подтвердила» |
| `booking_active` | «Владелец подтвердил передачу» | «Владелица подтвердила передачу» |
| `booking_return_pending` | «Арендатор инициировал возврат» | «Арендаторша инициировала возврат» |
| `booking_rejected` | «Владелец отклонил» | «Владелица отклонила» |
| `booking_cancelled` | «Владелец отменил(а)» | «Владелица отменила» |
| `booking_created` | «оставил заявку. Свяжитесь с ним» | «оставила заявку. Свяжитесь с ней» |

**3. Кэш буллетов инфографики**

Файл: `artifacts/api-server/src/lib/ai-service.ts`

- In-memory `Map<string, BulletsEntry>` с TTL 24 часа.
- Ключ кэша: `lowercase(title) + "|" + lowercase(category)`.
- При повторном запросе для того же объявления (title+category) буллеты берутся из кэша — нет вызова LLM. Экономия токенов.
- Лог при cache hit: `"ai-service: infographic bullets cache hit"` с флагом `fromCache: true`.
- Mock-провайдер обходит кэш (всегда возвращает детерминированный шаблон).

**4. Исправлен баг: роль admin не слетает при смене телефона**

Файлы: `artifacts/api-server/src/routes/users.ts`, `artifacts/hochu-to/src/pages/Dashboard.tsx`

- Бэкенд: перед обновлением профиля читает текущую роль из БД; если `role === "admin"` — поле role в SET-запросе игнорируется.
- Фронтенд: переключатель «Арендатор/Владелец» скрыт для пользователей с `user.role === "admin"`.

### Правило «не регрессировать»
- `detectGender` никогда не бросает — при пустом имени возвращает `"n"`.
- `genderedWord` при `gender === "n"` возвращает `neutralForm ?? maleForm` (никогда не пустую строку).
- Кэш буллетов не блокирует генерацию: если TTL истёк или ключ не найден — идём в LLM как обычно.
- Карта с несколькими пинами не сломается при 1 пине — ветка `pins.length === 1` устанавливает `setView([...], 16)` без fitBounds.

### Коммит
```
refactor(ui/logic): GPS multi-pins, gender-aware notifications, bullets cache (Stage 33.1)
```

---

## Журнал — Stage 33.1.5 (Safe Technical Debt Polish, 02.05.2026)

**Что сделано:**

**1. Обновлён снапшот `scripts/db-snapshots/dev-data.sql`**
- Выполнен `pg_dump --data-only --column-inserts --no-owner --no-privileges` с расширенным списком таблиц.
- Добавлены новые таблицы: `pools`, `pool_shares`, `share_offers`, `digital_acts`, `payments`, `payout_methods`, `payout_requests`.
- Результат: 379 строк (был несовместим с текущей схемой). `setup-new-replit.sh` теперь работает корректно на чистом окружении.

**2. Рефакторинг `BuyoutBlock` и `SellerOfferActions` в `PoolDetail.tsx`**
- Все 3 вызова нативного `window.confirm()` заменены на `AlertDialog` из `@radix-ui/react-alert-dialog` (тот же компонент, что используется в `ListingForm.tsx` c Stage 33.0).
- `SellerOfferActions`: добавлено состояние `cancelDialog: "reserved" | "listed" | null`, два отдельных AlertDialog для «Отменить оффер» и «Снять с продажи».
- `BuyoutBlock`: добавлено состояние `cancelBuyoutOpen: boolean`, AlertDialog для «Отменить запрос на выкуп».
- Нативный `confirm()` в iframe (Replit, embedded) всегда тихо возвращал `false` — баг был незаметен в production, но ломал UX.

**Файлы:**
- `scripts/db-snapshots/dev-data.sql` (обновлён)
- `artifacts/hochu-to/src/pages/PoolDetail.tsx` (AlertDialog × 3)
- `replit.md` (Stage 28 followup частично закрыт)
- `docs/AGENT_INSTRUCTIONS.md` (TODO снапшота закрыт)

### Коммит
```
chore(db): refresh dev-data.sql snapshot; refactor(ui): replace native confirm in buyout block
```

---

## Журнал — Stage 33 (AI-Арбитражор / Vision Analysis — ✅ РЕАЛИЗОВАН в Stage 33.0)

> ✅ **Этот раздел был планом — он полностью реализован в Stage 33.0 (30.04.2026).** Актуальный журнал реализации — выше в разделе «Stage 33.0». Hardening (таймауты, audit-логи, модель через env) — в разделе «Stage 33.1 AI Arbitration Hardening».

**Что из плана реализовано:**
- ✅ `arbitrateWithGeminiVision(claimId)` в `lib/ai-service.ts` — Gemini Vision анализирует пары фото `check_in`/`check_out`.
- ✅ `POST /api/claims/:id/ai-verdict` — только `requireAdmin`; результат кешируется в `claims.ai_verdict` (JSONB).
- ✅ Human-in-the-loop: LLM-вердикт = только рекомендация, кнопка «AI-анализ» в AdminPage.
- ✅ Audit trail: `ai_verdict_requested` / `ai_verdict_failed` / `ai_verdict_exception` в `audit_events`.
- ✅ Таймаут 15 сек (AbortController), graceful degradation без `GEMINI_API_KEY`.
- ✅ `GEMINI_VISION_MODEL` через env с дефолтом `"gemini-flash-latest"` (⚠️ не менять на `1.5-flash` — даёт 404).
- ✅ Маппинг вины на сумму: `suggestedAmountRub = requestedAmount × faultEstimatePercent / 100` (в TypeScript, не в LLM).

**Что НЕ реализовано (отложено):**
- ❌ Video-анализ (только фото).
- ❌ Промежуточная стадия «AI задаёт вопросы участникам».
- ❌ Автоматические выплаты (ждём Stage 24 + ИП).

---

## Журнал — Prod-Fix-1 (sharp в prod-зависимостях, 02.05.2026)

**Контекст.** После деплоя Stage 30B (AI-инфографика через sharp) на Amvera эндпоинт `POST /api/ai/generate-infographic` возвращал `ERR_MODULE_NOT_FOUND: Cannot find package 'sharp'`. В dev-среде Replit всё работало — пакет был в lockfile. Проблема была скрыта: `sharp` установился при `pnpm install` (dev), но в Dockerfile в production-stage выполняется `pnpm install --no-frozen-lockfile --prod`, который устанавливает только `dependencies`, не `devDependencies`. Поскольку `sharp` не был явно указан в `dependencies` секции `artifacts/api-server/package.json` — prod-контейнер его не получал.

### Что исправлено

**1. `artifacts/api-server/package.json`:**
- `"sharp": "^0.34.5"` добавлен в секцию `dependencies` (ранее отсутствовал полностью — был только в корневом lockfile как транзитивная зависимость).

**2. `pnpm-workspace.yaml`:**
- `sharp` добавлен в список `onlyBuiltDependencies`:
  ```yaml
  onlyBuiltDependencies:
    - "@swc/core"
    - esbuild
    - msw
    - sharp        # ← добавлен
    - unrs-resolver
  ```
  Без этого нативные бинарники sharp не собираются при `pnpm install` (pnpm 10+ требует явного разрешения build scripts).

**3. `pnpm install --filter @workspace/api-server`** выполнен — sharp собрался:
```
.../sharp@0.34.5/node_modules/sharp install: Done
```

### Деплой

- Изменения запушены на GitHub: коммит `dffed76`.
- Пользователь выполнил в Shell:
  ```bash
  git remote set-url amvera https://pdkiller666:4_5AznCgvidfr5x@git.msk0.amvera.ru/pdkiller666/hocuto
  git push amvera main
  ```
- Amvera подтвердил: `remote: Detected changes in main branch`, `* [new branch] main -> main`.
- Пересборка Docker-образа запущена автоматически.

### Диагностика (признаки проблемы)

- В логах API-сервера при старте: `Error: Cannot find package 'sharp' imported from ...`
- Эндпоинт `/api/ai/generate-infographic` возвращает 500.
- В dev-среде (`pnpm install` без `--prod`) всё работает — пакет есть в lockfile.

### Что НЕ тронуто

- `artifacts/api-server/build.mjs` — `sharp` уже был в массиве `external` (правильно: sharp не должен бандлиться esbuild'ом, он должен присутствовать в `node_modules` рантайма).
- `Dockerfile` — команда `pnpm install --no-frozen-lockfile --prod` остаётся, теперь она корректно подхватывает sharp из `dependencies`.

### Правило «не регрессировать»

- **Любой нативный npm-пакет** (с бинарниками) должен быть явно прописан в `dependencies` И в `onlyBuiltDependencies` в `pnpm-workspace.yaml`. Иначе prod-контейнер его не получит / не скомпилирует.
- При добавлении нового пакета проверять: нужен ли он в prod (не только в dev)? Если да — в `dependencies`, а не в `devDependencies`.

### Amvera push команды (актуальные)

> ⚠️ Amvera git-репозиторий использует ветку `master`, GitHub — `main`. При прямом push в Amvera всегда указывать `main:master`.

```bash
# Основной путь — push в GitHub (webhook Amvera тригерится автоматически):
git push https://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@github.com/pdkiller666/Hochu_to.git main

# Emergency: прямой push в Amvera (если webhook не сработал):
git push https://pdkiller666:4_5AznCgvidfr5x@git.msk0.amvera.ru/pdkiller666/hocuto main:master

# Emergency + форс (если rejected non-fast-forward):
git push --force https://pdkiller666:4_5AznCgvidfr5x@git.msk0.amvera.ru/pdkiller666/hocuto main:master
```

---

## Журнал — Stage 32.1 (Trust Score V8 — публичный рейтинг, 02.05.2026)

**Контекст.** `trust_score` и `completed_deals_count` уже рассчитывались в фоне (Stage 29), но не показывались пользователям. Stage 32.1 выводит их публично на карточку объявления и в публичный профиль.

### Что сделано

**Action 1 — Бэкенд `users.ts`:**
- `GET /users/:id` уже возвращал `trustScore` и `completedDeals` (Stage 29) — проверено ✅
- Добавлен алиас `completedDealsCount` для единообразия с DB-полем `users.completed_deals_count`.

**Action 2 — Бэкенд `listings.ts`:**
- В три SELECT-блока (список `/listings`, getById `/listings/:id`, fallback других регионов) добавлено поле `ownerCompletedDealsCount: usersTable.completedDealsCount`.
- В fallback-блок (3-й SELECT) добавлен `ownerTrustScore: usersTable.trustScore` — ранее отсутствовал.

**Action 3 — Фронтенд `artifacts/hochu-to/src/pages/ListingDetail.tsx`:**
- Добавлена функция `getTrustScoreColor(score)`: ≥90 → `text-emerald-600`, ≥70 → `text-stone-500`, иначе → `text-amber-600`.
- Под именем владельца добавлена строка: `ShieldCheckIcon` + «Доверие: X%» + «Сделок: Y».
- Существующий `<TrustBadge>` (Stage 29) сохранён без изменений.

**Action 4 — Фронтенд `artifacts/hochu-to/src/pages/OwnerProfile.tsx`:**
- Добавлена та же функция `getTrustScoreColor`.
- Добавлен виджет «Надёжность пользователя» (`bg-[#F2EEE3] rounded-xl p-4 border border-stone-200`) с процентом и числом завершённых сделок — над блоком «Контакты скрыты».

**Важно — правило приватности:** `phone` и `email` не выводятся в публичном `GET /users/:id`; `trustScore` и `completedDealsCount` — публичные поля.

```bash
feat(trust): Stage 32.1 – implement public trust score on listings and profiles
```

---

## Журнал — Stage 33.1 (AI Arbitration Hardening, 02.05.2026)

> ⚠️ В истории есть другой «Stage 33.1» (UI & Logic Polish — GPS/Gender/Cache, 30.04.2026). Этот — отдельная задача по закалке AI-арбитражора.

**Контекст.** AI-арбитражор MVP работает (Stage 33.0), но был уязвим к таймаутам, отсутствию переменных и тихим ошибкам.

### Что сделано

**Action 1 — `artifacts/api-server/src/lib/ai-service.ts`:**
- `GEMINI_VISION_MODEL` теперь берётся из env: `process.env.GEMINI_VISION_MODEL || "gemini-flash-latest"`.
- Условие проверки фото ужесточено: `!checkIn || !checkOut` (раньше `&&`) — требуются **оба** акта.
- В `catch (fetchErr)` добавлен явный перехват `AbortError` → `{ confidence:'low', error:'AI service timeout' }`.

**Action 2 — `artifacts/api-server/src/routes/claims.ts` (POST `/claims/:id/ai-verdict`):**
- Весь маршрут обёрнут в `try/catch`.
- Если `verdictRaw.error` (мягкий сбой AI) → `audit_events` с `eventType:'ai_verdict_failed'`.
- Если `catch(err)` (необработанное исключение) → `audit_events` с `eventType:'ai_verdict_exception'` + `err.message` в metadata + HTTP 500.

**Проверка в БД:**
```sql
SELECT event_type, metadata FROM audit_events
WHERE event_type IN ('ai_verdict_failed','ai_verdict_exception','ai_verdict_requested')
ORDER BY id DESC LIMIT 3;
-- → ai_verdict_failed: {"error": "GEMINI_API_KEY не задан", "confidence": "low"}
-- → ai_verdict_requested: {"hasError": true, "confidence": "low", ...}
```

```bash
fix(ai): harden Stage 33 arbitration with timeouts, explicit model fallback, and error audit logging
```

---

## Журнал — Stage 34 (Real-time WebSockets — Chats & Notifications, 02.05.2026)

**Контекст.** Чаты в `Dashboard.tsx` опрашивали сервер каждые 5 секунд (`setInterval`), уведомления в `Header.tsx` — каждые 30 секунд. Stage 34 заменяет HTTP polling на WebSocket push.

### Архитектура

```
Client                          Server
  │  connect  ws://host/ws        │
  │ ─────────────────────────>    │
  │  { type:"auth", token }       │
  │ ─────────────────────────>    │
  │         { type:"authenticated"│
  │ <─────────────────────────    │
  │                               │
  │         { type:"NEW_MESSAGE"  │  ← после POST /bookings/:id/messages
  │ <─────────────────────────    │     broadcastToUser(receiverId)
  │     { type:"NEW_NOTIFICATION" │  ← после createNotification()
  │ <─────────────────────────    │
```

**Ключевые решения:**
- Токен передаётся в первом сообщении (`{ type:"auth", token }`), **не** в query string — безопасно.
- 5-секундный таймаут аутентификации — если клиент не прислал auth-фрейм, сокет закрывается.
- Heartbeat: ping каждые 30 сек, terminate если нет pong (предотвращает утечку памяти).
- `// TODO: Replace Map with Redis Pub/Sub for horizontal scaling` — в `websocket.ts`.
- broadcast ТОЛЬКО получателю сообщения (НЕ отправителю) — предотвращает дублирование в UI.

### Что сделано

**Action 1 — Бэкенд `artifacts/api-server/src/lib/websocket.ts` (новый файл):**
- `initWebSocketServer(httpServer)` — WebSocketServer на пути `/ws`.
- Auth timeout 5 сек, ping/pong каждые 30 сек.
- `clients: Map<userId, Set<AuthenticatedSocket>>` — in-memory registry.
- `broadcastToUser(userId, event, payload)` — отправляет JSON всем открытым вкладкам пользователя.
- `pnpm add ws` + `pnpm add -D @types/ws`.

**Action 2 — Бэкенд `artifacts/api-server/src/index.ts`:**
- `app.listen(...)` → `createServer(app)` + `initWebSocketServer(httpServer)` + `httpServer.listen(...)`.

**Action 3 — Бэкенд triggers:**
- `routes/bookings.ts` (`POST /:id/messages`): после `insert(bookingMessagesTable)` вызывает `broadcastToUser(receiverId, "NEW_MESSAGE", message)`.
- `lib/notifications.ts` (`createNotification`): `insert(...).returning()` + `broadcastToUser(userId, "NEW_NOTIFICATION", notif)`.

**Action 4 — Фронтенд `artifacts/hochu-to/src/lib/use-websocket.ts` (новый файл):**
- `WsProvider` + `useWs()` hook.
- Подключение при монтировании, auth-фрейм сразу после `onopen`.
- Auto-reconnect через 4 сек после разрыва.
- `subscribe(event, cb)` → возвращает unsubscribe-функцию.
- Экспортирует `isConnected: boolean`.

**Action 5 — Фронтенд `artifacts/hochu-to/src/App.tsx`:**
- `<WsProvider>` обёртывает весь `<QueryClientProvider>`.

**Action 6 — Фронтенд `artifacts/hochu-to/vite.config.ts`:**
- Добавлен WS-прокси: `/ws` → `ws://localhost:8080` с `ws: true`.

**Action 7 — Фронтенд `Header.tsx`:**
- **Удалён** `setInterval(fetchNotifications, 30000)`.
- Fetch при mount и при `isConnected` flip (синхронизация после переподключения).
- `subscribe("NEW_NOTIFICATION", ...)` — push новых уведомлений.

**Action 8 — Фронтенд `Dashboard.tsx`:**
- **Удалён** `setInterval(() => fetchMessages(...), 5_000)`.
- Fetch при `openChatId` + `isConnected` flip.
- `subscribe("NEW_MESSAGE", ...)` — push входящих сообщений + обновление `unreadCounts`.
- 🟢/🟡 индикатор соединения (2px dot) в заголовке каждого чата (`title="Чат подключён"` / `"Переподключение..."`).

**Проверка:**
```
[18:44:22.792] INFO: WS: WebSocket server initialized at /ws  ✅
```

```bash
feat(realtime): Stage 34 – implement robust WebSockets with secure auth, ping/pong, and sync logic
```

---

## Журнал — Quick Fix: Stable Gemini Alias for Vision (02.05.2026)

**Проблема.** В Stage 33.1 AI hardening дефолт `GEMINI_VISION_MODEL` был ошибочно выставлен в `"gemini-1.5-flash"`. Этот алиас даёт **404 Not Found** на `v1beta` endpoint Google (задокументировано в Stage 30G journal). Единственный стабильный алиас — `"gemini-flash-latest"`.

**Исправление** (`artifacts/api-server/src/lib/ai-service.ts`):
```ts
// Было:
const GEMINI_VISION_MODEL = process.env.GEMINI_VISION_MODEL || "gemini-1.5-flash";

// Стало:
const GEMINI_VISION_MODEL = process.env.GEMINI_VISION_MODEL || "gemini-flash-latest";
```

**Правило для следующего агента:** ⚠️ НЕ менять дефолт на `"gemini-1.5-flash"` — даже если в ТЗ будет написано иначе. Алиас `*-latest` — единственный стабильный вариант на нашем ключе.

```bash
fix(ai): restore stable alias gemini-flash-latest for vision fallback to prevent 404 errors
```

---

## Журнал — Stage 35 (Mobile Responsiveness Polish, 02.05.2026)

**Контекст.** Полный аудит мобильной вёрстки (375px) по всем страницам. Исправлены переполнения и непропорциональные элементы на смартфонах.

### Изменённые файлы

| Файл | Правки |
|------|--------|
| `Catalog.tsx` | Grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` (два места: строки 535, 545); gap `gap-4 sm:gap-6` |
| `ListingCard.tsx` | Блок цена+кнопка → `flex flex-wrap items-end justify-between gap-1.5`; кнопка `ml-auto` (wraps right-aligned) |
| `AdminPage.tsx` | `StatCard`: `p-3 sm:p-5`, иконка `w-9 h-9 sm:w-12 sm:h-12`, цифра `text-xl sm:text-2xl`; строка пользователей → `grid-cols-2 sm:grid-cols-4`; Finance KPI: `p-3 sm:p-5`, `min-w-0 overflow-hidden`, длинные лейблы с `<br className="sm:hidden" />` |
| `OwnerProfile.tsx` | Статы карточки: `p-3 sm:p-4`, `text-xl sm:text-2xl`, `text-[10px] sm:text-xs` |
| `Home.tsx` | Hero h1: `text-3xl sm:text-5xl md:text-6xl lg:text-7xl`; subtitle: `text-base sm:text-xl`; категории h2: `text-2xl sm:text-3xl`; How it works h2: `text-2xl md:text-4xl`; CTA h2: `text-2xl sm:text-4xl md:text-5xl` |
| `ListingDetail.tsx` | Цена в сайдбаре: `text-3xl sm:text-4xl`; сайдбар: `p-4 sm:p-6`, `lg:sticky lg:top-28`; мобильный заголовок `text-2xl sm:text-3xl` (уже был) |
| `PoolDetail.tsx` | Собранная сумма: `text-2xl sm:text-3xl`; сумма оффера: `text-2xl sm:text-3xl` |

### Принципы (для следующего агента)

- Все таблицы в `AdminPage.tsx` обёрнуты `overflow-x-auto` — горизонтальный скролл на мобильном.
- Заголовки `hidden lg:block` — десктоп-only, мобильные дублируют с `lg:hidden`.
- Breakpoints Tailwind: `sm`=640px, `md`=768px, `lg`=1024px, `xl`=1280px. Кастомного `xs` нет.
- Эмодзи-иконки (`text-4xl`) в Cards — декоративные, не текст — overflow не создают.

```bash
fix(mobile): Stage 35 – responsive typography, grid cols and padding across Catalog, Cards, Admin, Home, ListingDetail, PoolDetail
```

---

## Журнал — Stage 35b (Soft Delete Account, 02.05.2026)

**Контекст.** Право на забвение (GDPR/ФЗ-152): пользователь может удалить аккаунт без физического удаления строки (FK-ограничения).

### Бэкенд: `DELETE /api/users/me`

Файл: `artifacts/api-server/src/routes/users.ts`

**Порядок операций:**
1. Проверка активных броней (`status IN ('pending', 'confirmed', 'active')`) — 400 если есть.
2. Проверка активных споров (`status IN ('pending', 'admin_review')`) — 400 если есть.
3. Анонимизация: `name = 'Удаленный пользователь'`, `email = deleted_${id}_${uuid}@hochu.to`, `phone/avatar/bio/telegram/website = null`, `passwordHash = random UUID` (вход невозможен), `isBanned = true`, `banReason = 'account_deleted'`.
4. Деактивация объявлений: `listings.isAvailable = false` для всех объявлений пользователя.
5. Удаление сессий: `DELETE FROM auth_sessions WHERE user_id = $userId` (убивает все refresh tokens).

### Фронтенд: `artifacts/hochu-to/src/pages/Dashboard.tsx`

- Новые state: `showDeleteAccountModal`, `deleteConfirmText`, `deletingAccount`.
- Функция `handleDeleteAccount()`: вызывает API, затем `removeToken()` + `setLocation("/")`.
- UI: красная секция «Опасная зона» в настройках профиля с кнопкой «Удалить аккаунт».
- Модальное окно: предупреждение + поле ввода слова «УДАЛИТЬ» (кнопка заблокирована до правильного ввода).
- Импорт `removeToken` добавлен в `@/lib/auth`.

### Схема БД: `lib/db/src/schema/users.ts`

- `userRoleEnum` расширен: добавлены `'user', 'moderator', 'support', 'arbiter', 'superadmin'` (старые `renter`, `owner`, `admin` сохранены).
- Новые KYC-поля: `verificationStatus` (text, default `'unverified'`), `verificationProvider` (text), `verificationData` (jsonb).
- Миграция применена через `drizzle-kit push`.

### Правила для следующего агента

- `DELETE /me` зарегистрирован **до** `GET /:id` в роутере — важно для Express-матчинга.
- `banReason = 'account_deleted'` — сигнал для admin-панели что это не ручной бан.
- Новые роли (`moderator`, `support`, `arbiter`, `superadmin`) пока не имеют спец. логики — добавляй по мере необходимости.
- Физически строки пользователя не удаляем никогда (FK integrity).

```bash
feat(users): Stage 35b - implement account soft delete with data anonymization and prepare schema for RBAC/KYC
```

## Журнал — Stage 36 (RBAC — Role-Based Access Control, 02.05.2026)

### Что реализовано

**Action 1 — Backend Middleware (`auth.ts`)**
- Добавлена `requireRole(...allowedRoles: string[])` — гибкий RBAC middleware, ставится ПОСЛЕ `requireAuth`.
- `requireAdmin` обновлён: теперь пускает `admin` **и** `superadmin` (backward-compat для незатронутых маршрутов).

**Action 2 — Защита API-эндпоинтов**

| Группа | Роли | Маршруты |
|--------|------|----------|
| Finance/Stats | `superadmin` | GET /stats/extended, /settings, PUT /settings, /settings/ai-provider, /audit-log, /seed, /seed-test-listings |
| Stats/Analytics | `superadmin`, `admin` | GET /stats, /analytics |
| User Management | `superadmin`, `admin` | GET/PATCH /users/:id, GET /users, POST /broadcast |
| Moderation | `superadmin`, `admin`, `moderator` | GET/PATCH/DELETE /listings, GET /bookings, POST /bookings/override |
| Поддержка | `superadmin`, `admin`, `support`, `moderator` | GET/PATCH /tickets, POST /tickets/reply |
| Жалобы | `superadmin`, `admin`, `moderator` | GET/PATCH /reports |
| Claims — просмотр/вердикт | `superadmin`, `admin`, `arbiter` | GET /claims, POST /claims/:id/approve/reject/ai-verdict |
| Claims — выплата | `superadmin`, `admin` | POST /claims/:id/mark-paid |
| Claims analytics | `superadmin` | GET /claims/analytics |

**Action 3 — Frontend Tab Hiding (`AdminPage.tsx`)**
- Стража входа в `/admin` расширена: принимает все 5 admin-ролей (`admin`, `superadmin`, `moderator`, `support`, `arbiter`).
- `TABS` массив получил поле `roles?: string[]` — если не задано, таб виден всем.
- Tab bar рендерит только `TABS.filter(t => !t.roles || t.roles.includes(currentRole))`.
- Заголовок панели: `Имя · ROLE` вместо «Администратор: Имя».

**Action 4 — Role Assignment UI + Endpoint**
- `PATCH /admin/users/:id/role` — принимает `{ role }`, пишет audit `change_role`, guard: только суперадмин может назначить `superadmin`, нельзя изменить собственную роль.
- В таблице Users: для admin/superadmin — цветной `<select>` с мгновенным сохранением; для остальных — read-only span.
- Константы `ROLE_LABELS`, `ROLE_COLORS`, `ALL_ROLES` — общие для таблицы, edit-формы UserDetailPanel и filter dropdown.
- Фильтр ролей расширен (все 8 ролей включая `user`, `moderator`, `support`, `arbiter`, `superadmin`).

### Ключевые заметки
- Порядок middleware: `requireAuth` → `requireRole(...)` — requireRole читает `req.userRole` из requireAuth.
- `requireAdmin` = backward-compat alias для `requireRole('admin', 'superadmin')` — незатронутые маршруты автоматически поддерживают superadmin.
- Inline `<select>` в строке таблицы: `onClick={e => e.stopPropagation()}` — клик не открывает UserDetailPanel.
- superadmin-опция скрыта из выпадающего если текущий зритель не superadmin.
- Все TypeScript-ошибки в tsc-проверке — **pre-existing** (до Stage 36): scheduler.ts, bookings.ts, claims.ts, contacts.ts — esbuild транспилирует без ошибок.

```bash
feat(rbac): implement role-based access control, secure finance routes, and hide unauthorized admin UI tabs
```

## Журнал — Stage 37 (Staff Profiles & UI Polish, 02.05.2026)

### Что реализовано

**Action 1 — Staff Badge на публичных страницах**

- `artifacts/api-server/src/routes/listings.ts`: добавлено поле `ownerRole: usersTable.role` во все три SELECT-блока (одиночный листинг, catalog-query, fallback-query).
- `artifacts/hochu-to/src/pages/OwnerProfile.tsx`: константы `STAFF_ROLES` + `isStaff`; бейдж `<span className="... bg-[#0ea5e9] text-white">` с `<Shield w-3>` + «Команда Хочу_То» добавлен рядом с именем — отображается для `superadmin | admin | moderator | support | arbiter`.
- `artifacts/hochu-to/src/pages/ListingDetail.tsx`: тот же бейдж добавлен в owner card (секция «Владелец» в правой колонке), проверяет `(listing as any).ownerRole`.

**Action 2 — Служебный статус в личном кабинете**

- `artifacts/hochu-to/src/pages/Dashboard.tsx`: в блоке `activeTab === "profile" && user.role !== "admin"` добавлен IIFE-блок Stage 37 (перед Trust Score).
- Виджет видим только для ролей `superadmin | admin | moderator | support | arbiter`.
- Объект `STAFF_META` хранит `{ label, border, icon }` по каждой роли.
- Русские названия ролей: `superadmin → Владелец платформы`, `admin → Администратор`, `moderator → Модератор`, `support → Поддержка`, `arbiter → Арбитр`.
- Бейдж «Команда Хочу_То» дублируется в заголовке виджета.

**Action 3 — Back-button Polish**

- `OwnerProfile.tsx` line 107: `className="flex ..."` → `"inline-flex ..."` — кнопка «Назад» больше не растягивается на всю ширину контейнера.
- `ListingDetail.tsx`: «Вернуться в каталог» уже использует `inline-flex` — изменений не потребовалось.

### Ключевые заметки
- Tailwind-классы в `STAFF_META` — литеральные строки (не собирать через `.split()`), purge-safe.
- `ownerRole` не был в ответе API до Stage 37; теперь присутствует во всех трёх query-блоках listings.ts.
- Блок «Служебный статус» отображается внутри `user.role !== "admin"` ветки; `admin`-роль по-прежнему видит `AdminAccountPanel` с отдельным баннером «Администратор платформы».

```bash
feat(users): implement staff badges for public profiles and refine navigation buttons UI
```

## Журнал — Stage 37.1 (Platform Owner → superadmin by default, 02.05.2026)

### Проблема
`admin@hochu.to` создавался/обновлялся с `role: "admin"`, что лишало его доступа к эндпоинтам `requireRole("superadmin")` (settings, audit-log, finance, payouts, economy, AI-настройки) и соответствующим табам в AdminPage.

### Исправления

**`artifacts/api-server/src/index.ts` — `seedDefaultAdmin()`**
- Создание нового пользователя: `role: "admin"` → `role: "superadmin"`, `name: "Администратор"` → `"Владелец платформы"`.
- Проверка существующего: `if (existingUser.role !== "admin")` → `if (existingUser.role !== "superadmin")`. Теперь при каждом перезапуске, если роль меньше superadmin — повышаем автоматически.
- При старте сервера в логах появляется: `Platform owner promoted to superadmin. email: "admin@hochu.to" prevRole: "admin"`.

**`artifacts/hochu-to/src/pages/Dashboard.tsx` — AdminAccountPanel**
- `activeTab === "profile" && user.role === "admin"` → `(user.role === "admin" || user.role === "superadmin")`.
- Обратная ветка `user.role !== "admin"` → `user.role !== "admin" && user.role !== "superadmin"`.
- Баннер в AdminAccountPanel: динамический текст `user.role === "superadmin" ? "Владелец платформы" : "Администратор платформы"`.

### Тест после исправлений
- `POST /api/auth/login` → `role: superadmin` ✅
- `GET /api/admin/settings` → 200 ✅ (было 403 для admin)
- `GET /api/admin/audit-log` → 200 ✅
- `GET /api/admin/stats` → 200 ✅
- AdminPage: все табы (`finance`, `payouts`, `economy`, `payments`, `audit`, `ai`) видны ✅

### Ключевые заметки
- `seedDefaultAdmin` идемпотентна: при каждом перезапуске сервера проверяет роль и повышает если нужно.
- Наличие `ADMIN_EMAIL` env-переменной позволяет задать другой email владельца платформы.

```bash
fix(auth): promote platform owner admin@hochu.to to superadmin on every server start
```

## Журнал — Stage 38 (Telegram Bot & Notification Engine, 02.05.2026)

### Обзор
Полноценная интеграция Telegram-бота (`@Helper251223_bot`) для доставки уведомлений пользователям и рассылок персоналу. Тест-сьют: **37/37 ✅**.

### DB-миграции
**`lib/db/src/schema/users.ts`**
- `telegram_chat_id text` — chat ID пользователя после привязки
- `telegram_otp text` — текущий OTP (перезаписывается при повторной генерации)
- `telegram_otp_expires_at timestamp` — TTL 10 минут
- `telegram_notifications jsonb` — `{bookings, system, chats: boolean}` (дефолт: все true)

**`lib/db/src/schema/platform-settings.ts`**
- `telegram_bot_token text` — nullable; если NULL — бот берёт токен из env `TELEGRAM_BOT_TOKEN`
- `telegram_env text` — `"dev"` (только суперадмины получают уведомления) | `"prod"` (все)

### Новые файлы
**`artifacts/api-server/src/lib/telegram.ts`** — весь Telegram-слой:
- `initTelegramBot()` — читает токен из `platform_settings ?? process.env.TELEGRAM_BOT_TOKEN`, вызывается в `index.ts` при старте
- `startBot(token)` — Telegraf long-poll, регистрирует handlers `/start` и `/link`
- `handleOtp(ctx, otp)` — ищет пользователя по OTP, проверяет TTL, пишет `telegram_chat_id`, очищает OTP
- `sendTelegramToUser(userId, category, text, link?)` — уважает dev-режим и preferences пользователя; 3 retry с exponential backoff
- `notifyStaffByRole(roles[], text, link?)` — рассылка по ролям сотрудников
- `broadcastToAll(text, link?, adminId?, role?)` — массовая рассылка с опциональным роль-фильтром (VALID_ROLES whitelist), dev-фильтр, rate ~20 msg/sec
- `hotSwapToken(newToken, adminId?)` — **await** + автооткат DB к `prevToken` при 401; возвращает `{ok, username|error}`
- `getBotStatus()`, `stopBot()`, `isValidBroadcastRole()`

**`artifacts/api-server/src/routes/telegram.ts`** — маршруты для пользователей:
- `POST /telegram/generate-otp` — 6-значный код, TTL 10 мин, перезаписывает предыдущий
- `GET /telegram/status` — `{linked, hasOtp, otpExpiresAt, preferences}`
- `POST /telegram/unlink` — очищает `telegram_chat_id`, идемпотентен
- `PATCH /telegram/preferences` — Zod-валидация `{bookings?, system?, chats?: boolean}`

### Изменения в существующих файлах
**`artifacts/api-server/src/routes/admin.ts`**
- `PUT /admin/settings` — `telegramBotToken` и `telegramEnv` добавлены в `ALLOWED_FIELDS` и `NULLABLE_STR_FIELDS`. Hot-swap: await `hotSwapToken()` → если fail → rollback DB → `hotSwapToken(prevToken)` fire-and-forget; `telegramSwap: {ok, username|error}` в ответе.
- `GET /admin/telegram/status` — `{online, username, env, hasToken}` (superadmin only)
- `POST /admin/telegram/broadcast` — `{text, link?, role?}` с валидацией роли через `isValidBroadcastRole()` → 400 при невалидной; (superadmin only)

**`artifacts/api-server/src/lib/notifications.ts`**
- `createNotification()` — fire-and-forget `sendTelegramToUser(userId, category, text, link)` после insert

**`artifacts/api-server/src/index.ts`**
- Вызов `await initTelegramBot()` после `ensurePlatformSettings()`, non-fatal

**`artifacts/api-server/src/routes/index.ts`**
- Регистрация `/telegram` маршрутов

**`artifacts/hochu-to/src/pages/Dashboard.tsx`**
- Состояния: `tgLinked, tgOtp, tgPrefs, tgBusy`
- `useEffect` — загружает `/telegram/status` при открытии таба профиля
- Функции: `tgGenerateOtp()`, `tgUnlink()`, `tgUpdatePref(key, val)`
- UI: карточка «Telegram-уведомления» с OTP-инструкцией, кнопкой «Обновить код», toggle-переключателями (bookings/system/chats), кнопкой «Отвязать»
- Импорт: добавлен `RefreshCw` из `lucide-react`

**`artifacts/hochu-to/src/pages/AdminPage.tsx`**
- `TABS` — добавлен `{ id: "telegram", label: "Telegram", icon: Send }` (только superadmin)
- `TelegramBotTab` — статус бота (🟢/🔴 + @username), env dev/prod, broadcast-форма (textarea + URL + select роли)

### Секреты
- `TELEGRAM_BOT_TOKEN` — добавлен в Replit Secrets. Текущий бот: `@Helper251223_bot`. Суперадмин может сменить через AdminPage → горячая замена без перезапуска.

### Ключевые архитектурные решения
1. **env-fallback приоритет:** `platform_settings.telegram_bot_token ?? process.env.TELEGRAM_BOT_TOKEN` — бот работает из коробки, суперадмин переопределяет через UI
2. **Hot-swap с откатом:** неудачный swap не убивает работающий бот — atomically rollback DB и restart с предыдущим токеном
3. **Dev-режим:** `telegramEnv=dev` → уведомления только суперадминам; безопасно запускать в тестовой среде
4. **Fire-and-forget диспетч:** `createNotification()` не блокируется на Telegram; сбой отправки не ломает основной поток
5. **VALID_ROLES whitelist:** broadcast принимает только известные роли → 400 при попытке broadcast role=hacker

### Тест-сьют (37/37)
- **A (5):** бот онлайн, 401/403 контроль доступа
- **B (4):** OTP 6 цифр, TTL 10 мин, hasOtp, перегенерация
- **C (4):** preferences update, валидация типов, пустой body
- **D (2):** unlink идемпотентность, status после unlink
- **E (6):** broadcast text/role валидация, невалидная роль → 400
- **F (5):** hot-swap фейковый → rollback → бот онлайн, hot-swap валидный → ok
- **G (5):** OTP-привязка через DB-симуляцию → linked=true → unlink → linked=false
- **H (4):** dev/prod env переключение, невалидный env → 400
- **I (2):** GET /notifications, superadmin без привязки

### Баги, найденные и исправленные при тестировании
1. **Hot-swap был fire-and-forget** — `hotSwapToken().catch(() => {})` не блокировал ответ и не откатывал DB при ошибке. Исправлено: await + rollback.
2. **Broadcast не валидировал роль** — `role="hacker"` молча игнорировался. Исправлено: `isValidBroadcastRole()` + 400.
3. **RefreshCw не был импортирован** в `Dashboard.tsx`. Исправлено.

```bash
feat(stage38): Telegram bot integration — OTP linking, hot-swap, broadcast, notification dispatch (37/37 tests)
```

---

## Stage 39 — Fintech Core & Escrow Engine (02.05.2026) ✅

### Цель
Атомарный кошелёк-движок с эскроу-циклом (hold/release/payout), комиссией платформы, горячим переключением провайдера оплаты, и fintech-UI за флагом `isCommercialMode`.

### DB-схема (lib/db/src/schema)
| Таблица | Поля | Примечание |
|---------|------|------------|
| `wallets` | `userId, availableBalance (int4, kopek), frozenBalance, currency` | уникальный по userId, DEFAULT 0 |
| `wallet_transactions` | `userId, amount, platformCommission, type, status, referenceId, referenceType, description, metadata` | type: hold\|release\|payout\|topup; status: pending\|completed\|failed |
| `platform_settings` | +`paymentProvider text DEFAULT 'mock'` | mock\|yookassa |

### Escrow-сервис (artifacts/api-server/src/lib/escrow.ts)
- **`getOrCreateWallet(userId, tx?)`** — upsert кошелька, возвращает запись
- **`calcCommission(amount, rate)`** — `Math.ceil(amount × rate × 100) / 100` (округление в пользу платформы, до копейки)
- **`holdFunds(bookingId, renterId, amount, commissionRate, tx?)`** — SELECT FOR UPDATE + mock-топап + freeze баланса
- **`releaseFunds(bookingId, userId, tx?)`** — разморозка при отмене/отклонении
- **`payoutOwner(bookingId, ownerId, renterId, totalAmount, commissionRate, tx?)`** — split: owner ← net, platform ← commission

### API Routes (GET/POST /api/wallet/*)
| Метод | Путь | Auth | Guard |
|-------|------|------|-------|
| GET | `/wallet/balance` | user | isCommercialMode |
| GET | `/wallet/history` | user | isCommercialMode |
| GET | `/wallet/admin/users/:id/balance` | superadmin | — |
| GET | `/wallet/admin/payouts` | superadmin | — |
| GET | `/wallet/admin/stats` | superadmin | — |

`requireAuth` + `requireRole` из `../middleware/auth.js` (единственный middleware файл).

### Escrow hooks в bookings.ts (fire-and-forget с try/catch)
- `confirmed` → `holdFunds(...)` (gated by `isCommercialMode`)
- `cancelled`/`rejected` → `releaseFunds(...)`
- `completed` → `payoutOwner(...)`

### Frontend (isCommercialMode gate)
- **Dashboard.tsx**: таб "wallet" (иконка Wallet), компонент `WalletSection` — 2 карточки (доступно/заморожено) + история транзакций. Таб виден только при `isCommercialMode=true`. Beta guard через `validTabs`.
- **AdminPage.tsx → PayoutsTab**: `WalletStatsCard` — stats: walletsCount, totalAvailable, totalFrozen, totalPlatformCommission, paymentProvider, isCommercialMode. Всегда виден суперадмину.

### paymentProvider в AdminPage
- Поле добавлено в `ALLOWED_FIELDS` + валидация `mock|yookassa` + `publicSettings()`
- В Settings tab можно переключать через UI

### Баги, найденные и исправленные
1. **`requireRole` импортировался из несуществующего `../middleware/requireRole.js`** — исправлено на `../middleware/auth.js`

### Тест-сьют (security gates)
- `GET /wallet/balance` без `isCommercialMode=true` → 403 ✅
- `GET /wallet/balance` без токена → 401 ✅
- `PUT /admin/settings {paymentProvider:"invalid"}` → 400 ✅
- `GET /wallet/admin/stats` → 200 + корректные поля ✅

```bash
feat(stage39): Fintech Core & Escrow Engine — atomic wallets, escrow hold/release/payout, paymentProvider toggle, WalletSection UI, WalletStatsCard admin
```

---

## Stage UI-1 — Мобильный UX + Search + Photo Position (13.05.2026) ✅

### Цель
5 мобильных UX-улучшений (M-1..M-5) по образцу Avito/Ozon/AliExpress + поиск-дропдаун в хедере + полноэкранная подпись в Цифровом Акте + picker позиции кадра в форме объявления.

### Изменённые файлы
| Файл | Что изменено |
|------|-------------|
| `artifacts/hochu-to/src/components/BottomNav.tsx` | **НОВЫЙ** — 5-кнопочная нижняя навигация (Главная/Каталог/Избранное/Чаты/Профиль), только мобильные (`md:hidden`), активный таб подсвечивается primary-цветом, бейдж непрочитанных чатов |
| `artifacts/hochu-to/src/components/layout/Layout.tsx` | Подключён `<BottomNav>`, добавлен `pb-14 md:pb-0` для основного контента, `<Footer>` скрыт на мобильных |
| `artifacts/hochu-to/src/components/layout/Header.tsx` | Поиск-дропдаун: `HeaderSearchBar` → `DropdownItem[]` тип, fetch `/api/listings?search=&limit=5` + `/api/categories`, дебаунс 250мс, `AnimatePresence`, закрытие по Escape/click-outside. Убран `overflow-hidden` с родительского div |
| `artifacts/hochu-to/src/components/ui/ListingCard.tsx` | M-2: бейдж «Свободно» (emerald) / «Занято» (stone). M-4: кнопка «Арендовать». M-5: city-чип под названием. `parsePhotoUrl()` для `#pos=` → CSS `object-position` |
| `artifacts/hochu-to/src/components/DigitalActUpload.tsx` | `userRole` prop (`"owner" \| "renter"`), блокировка кнопки для неправильной стороны, баннер «Этот акт подписывает [другая_сторона]», fullscreen SignaturePad overlay |
| `artifacts/hochu-to/src/pages/Dashboard.tsx` | Тип `digitalActModal` расширен `userRole`, все 4 кнопки `setDigitalActModal` получили корректный `userRole`, `<DigitalActUpload userRole=…>` |
| `artifacts/hochu-to/src/pages/Home.tsx` | M-3: горизонтальный скролл категорий-пилюль (с иконками из `POPULAR_CATEGORIES`), sticky под хедером |
| `artifacts/hochu-to/src/pages/Catalog.tsx` | M-3: горизонтальный скролл категорий (API-данные с кол-вом объявлений), активная подсвечена primary, клик меняет URL `?category=` |
| `artifacts/hochu-to/src/pages/ListingForm.tsx` | `photoPositions: string[]` state + `pickerIdx` state; 3×3 picker overlay на каждом фото (↖↑↗ ←○→ ↙↓↘); позиция кодируется в URL как `#pos=top_left`; decode при загрузке существующего объявления |

### Логика `userRole` в DigitalActUpload
- `type="check_in"` + `userRole="owner"` → owner передаёт вещь → кнопка активна для него
- `type="check_in"` + `userRole="renter"` → рентер открыл не свой акт → баннер-предупреждение
- `type="check_out"` + `userRole="renter"` → рентер возвращает → кнопка активна
- `type="check_out"` + `userRole="owner"` → владелец открыл не свой акт → баннер-предупреждение

### Логика photo position
- Позиции хранятся в `photoPositions: string[]` (параллельный массив с `photos`)
- При сохранении кодируются: `url + "#pos=top_left"` (если не `"center"`)
- `parsePhotoUrl(url)` в `ListingCard.tsx`: `url.split("#pos=")` → `{ src, position }`
- CSS: `<img style={{ objectPosition: position }}>` — точный кадр фото

### Инварианты, которые нельзя нарушать
- `photos` и `photoPositions` всегда одной длины — обновляются синхронно во всех операциях (upload/remove/setMain/addByUrl)
- `#pos=` суффикс стрипается перед передачей в `<img src>` через `getPhotoSrc(url)`
- `userRole` — обязательный prop DigitalActUpload (TypeScript)

### Тест-сьют (ручная проверка)
- ✅ Каталог: категории-скролл, фильтр по категории, бейдж «Свободно», кнопка «Арендовать», city-чип
- ✅ Главная: категории-скролл sticky под хедером
- ✅ Хедер: дропдаун при вводе ≥2 символов, Escape закрывает, клик на листинг переходит
- ✅ ListingForm: кнопка ⛶ на фото → picker → позиция применяется сразу в превью
- ✅ Мобиль: BottomNav видна, Footer скрыт, pb-14 предотвращает перекрытие

```bash
feat(stage-ui1): Mobile UX M1-M5 + search dropdown + fullscreen signature + photo position picker
```
