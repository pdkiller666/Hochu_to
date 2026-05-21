# Инструкция для агента — проект «Хочу_То»

> Файл для агента из другого аккаунта Replit. Содержит все необходимые данные для работы с проектом.

---

## 0. БЫСТРЫЙ СТАРТ ДЛЯ НОВОГО АГЕНТА (02.05.2026)

> Если ты агент, который только что принял проект — прочитай этот блок первым.

### Где мы сейчас
- **Последний закрытый этап: Stage UI-2** (21.05.2026) — Mobile Header Compact + Clickable ListingCard Labels ✅
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
| `vite.config.ts`: `PORT` и `BASE_PATH` — **опциональные** с дефолтами (`"5000"` / `"/"`). **Не добавлять `throw`** при их отсутствии — Docker-сборка Amvera не передаёт эти env vars во время `vite build`, только при запуске контейнера. | `artifacts/hochu-to/vite.config.ts` |
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
- **Stage 41 — Generative Infographic (3-tier, multimodal)** (**✅ 21.05.2026, обновлён**) — AI-генерация карточек без SVG-наложений. `lib/infographic.ts`: `buildImagePrompt()` (детальный EN-промпт для профессиональной marketplace-карточки, принимает `description`+`category`) + `generateGenerativeInfographic()` + `preprocessForAI()`. 3-tier chain: **Tier 1** OpenRouter (stub, cascade) → **Tier 2** `gemini-2.0-flash-preview-image-generation` + `gemini-2.0-flash-exp` (multimodal: фото-референс как `inlineData` + текстовый промпт) → Imagen 3 text-to-image fallback → **Tier 3** graceful degradation (исходное фото resized 1080×1080, БЕЗ SVG-оверлея). `routes/ai.ts`: Tier 3 НЕ вызывает `buildMarketplaceInfographic`, `description`+`category` передаются в `generateGenerativeInfographic()`. Кэш SHA-256 24ч. Ответ содержит `generativeTier: 1|2|3`.
- **Stage UI-2b — Mobile nav + ListingForm camera** (**✅ 21.05.2026**) — (1) BottomNav: `Bell` вместо `MessageSquare`; диспетчеризует `open-mobile-notif` CustomEvent → Header открывает мобильную панель уведомлений. Мобильный хедер: убраны Heart+Bell (остался только поиск + бургер). (2) ListingForm photos carousel: `grid grid-cols-3` → `flex overflow-x-auto snap-x snap-mandatory` на мобиле (ширина карточки `w-[78vw]`), `sm:grid sm:grid-cols-4` на десктопе. Кнопка добавить фото: `sm:hidden` кнопка камеры (`capture="environment"`) рядом с "Из галереи". AI инфографика: dropdown-меню «Из галереи» / «Сфотографировать» — два hidden `<input capture="environment">` с отдельными refs.
- **CS audit + bugfix** (**✅ 21.05.2026**) — аудит Co-Sharing модуля: CS-3..CS-6 подтверждены реализованными. Исправлены 3 бага: (1) `PoolsDashboardSection` ссылка `/pools/new` → `/pools/create`; (2) `void payoutPoolShareholders(...)` → `.catch(err => console.error(...))`; (3) **CS-5 buyout liquidation**: при 100% выкупе `listingsTable.set({...})` теперь также обновляет `ownerId = reqRow.initiatorId` — до этого листинг оставался на исходном создателе пула, а выкупивший не мог им управлять из дашборда.

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


---

## Журналы этапов (архив)

Детальные журналы Stage 17b-core … Stage 38 (23.04–02.05.2026) перенесены в
[`docs/AGENT_INSTRUCTIONS_ARCHIVE.md`](AGENT_INSTRUCTIONS_ARCHIVE.md) для экономии контекста агента.

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

## Stage 40 — Wallet Pro: полный кошелёк пользователя (19.05.2026) ✅

### Цель
Довести кошелёк до production-ready состояния: исправить TypeScript-ошибки, закрыть конфликты типов, проверить все API-эндпоинты, подключить уведомления.

### Что сделано
- **`notifications.ts`** — добавлены два новых NotifType: `wallet_topup`, `wallet_withdraw`. Без них `createNotification()` отказывался компилироваться.
- **`wallet.ts`** — исправлены все TS-ошибки: `type: "system"` → `"wallet_topup"` / `"wallet_withdraw"`; добавлен `return` в admin-endpoint `/admin/users/:userId/balance`; исправлен SQL-запрос в `/admin/stats` (`.rows` из Drizzle `execute` не деструктурировался).
- **`Dashboard.tsx`** — устранён конфликт имён: тип `PayoutMethod` в WalletSection переименован в `WalletPayoutMethod` (иначе Babel падал с `Identifier 'PayoutMethod' has already been declared`).
- **Тест API** — все эндпоинты прошли ручную проверку: `balance`, `history`, `topup` (mock +5000₽), `withdraw` (валидация метода), `escrow-summary`, `admin/stats`, `admin/users/:id/balance`.

### Изменённые файлы
| Файл | Что изменено |
|------|-------------|
| `artifacts/api-server/src/lib/notifications.ts` | +`wallet_topup`, `wallet_withdraw` в NotifType |
| `artifacts/api-server/src/routes/wallet.ts` | fix NotifType, fix `return`, fix SQL rows extraction |
| `artifacts/hochu-to/src/pages/Dashboard.tsx` | `PayoutMethod` → `WalletPayoutMethod` в WalletSection |

### Проверенные API (все 200)
| Метод | Путь | Результат |
|-------|------|-----------|
| GET | `/wallet/balance` | `{availableBalance:0, frozenBalance:0}` |
| POST | `/wallet/topup` | mock +5000₽, уведомление создаётся |
| POST | `/wallet/withdraw` | 400 `missing_method` без реквизитов (верно) |
| GET | `/wallet/history` | `{items:[…], hasMore, nextBefore}` |
| GET | `/wallet/escrow-summary` | `[]` |
| GET | `/wallet/admin/stats` | `{walletsCount:1, totalAvailableBalance:5000, txBreakdown:[…]}` |
| GET | `/wallet/admin/users/1/balance` | `{userId:1, availableBalance:5000, exists:true}` |

---

## Stage 30-Refactoring — OpenRouter AI Gateway (19.05.2026) ✅

### Цель
Масштабный рефакторинг AI-сервиса: замена самописного мульти-провайдерного роутера (отдельные fetch к OpenAI/Amvera/Gemini/DeepSeek) на единый SDK `openai` с `baseURL = "https://openrouter.ai/api/v1"`.

### Архитектура ДО (Stage 30A / 33.0)
```
resolveProvider()
  ├── mock           → generateMock()
  ├── openai         → fetch("api.openai.com") ← OPENAI_API_KEY
  ├── gemini         → fetch("generativelanguage.googleapis.com") ← GEMINI_API_KEY
  └── amvera         → fetch("kong-proxy.yc.amvera.ru")  ← AMVERA_API_TOKEN
                          └── fallback: fetch("api.deepseek.com") ← DEEPSEEK_API_KEY
                              └── fallback: mock
```

### Архитектура ПОСЛЕ (Stage 30-Refactoring)
```
resolveProvider()
  ├── mock           → generateMock()
  └── openrouter     → OpenAI SDK (baseURL=openrouter.ai) ← OPENROUTER_API_KEY
  └── openai         → openrouter.ai/openai/gpt-4o-mini   ← OPENROUTER_API_KEY
  └── gemini         → openrouter.ai/google/gemini-flash-1.5 ← OPENROUTER_API_KEY
  └── amvera (legacy)→ openrouter.ai/deepseek/deepseek-chat ← OPENROUTER_API_KEY
      └── fallback: fetch("api.deepseek.com") ← DEEPSEEK_API_KEY (Stage 33.0 сохранён)
          └── fallback: mock
```
Vision-арбитратор (`arbitrateWithGeminiVision`) — **не тронут**, прямой Gemini API с base64.

### Изменённые файлы
| Файл | Что изменено |
|------|-------------|
| `artifacts/api-server/src/lib/ai-service.ts` | Полный рефакторинг: убраны `generateOpenAi`, `generateAmvera`, `generateGemini`, `bulletsOpenAi`, `bulletsAmvera`, `bulletsGemini`; добавлены `generateViaOpenRouter`, `bulletsViaOpenRouter`, `getOpenRouterClient()`; `generateDirectDeepSeek` + `bulletsDirectDeepSeek` сохранены как промежуточный fallback |
| `artifacts/api-server/src/routes/ai.ts` | fix `return` в generate-description handler |
| `artifacts/api-server/src/routes/admin.ts` | валидация `activeAiProvider`: добавлены `"openrouter"`, `"gemini"` |
| `artifacts/hochu-to/src/pages/AdminPage.tsx` | UI: 5 карточек провайдеров вместо 3; `openrouter` с бейджем ⭐ Новый; `amvera` помечен Legacy |
| `artifacts/api-server/package.json` | +`"openai": "^6.38.0"` |

### Маппинг провайдер → OpenRouter-модель
| Значение в БД | OpenRouter-модель | Переопределяется через |
|---|---|---|
| `openrouter` | `deepseek/deepseek-chat` | `OPENROUTER_MODEL` env |
| `openai` | `openai/gpt-4o-mini` | — |
| `gemini` | `google/gemini-flash-1.5` | `OPENROUTER_GEMINI_MODEL` env |
| `amvera` | `deepseek/deepseek-chat` | — (legacy alias) |

### Переменные окружения — итог
| Переменная | Статус | Зачем |
|---|---|---|
| `OPENROUTER_API_KEY` | 🆕 **добавить** | Основной ключ всей LLM-генерации |
| `DEEPSEEK_API_KEY` | ✅ оставить | Промежуточный fallback перед mock |
| `GEMINI_API_KEY` | ✅ оставить | Vision-арбитратор (только он, прямой API) |
| `AMVERA_API_TOKEN` | ❌ **удалить** | Больше не используется |
| `OPENAI_API_KEY` | ❌ **удалить** | Больше не используется (всё через OpenRouter) |
| `OPENROUTER_MODEL` | опционально | Сменить дефолтную модель без деплоя |
| `OPENROUTER_GEMINI_MODEL` | опционально | Сменить Gemini-модель без деплоя |

### Инварианты Vision-арбитратора
- `arbitrateWithGeminiVision()` — **изолирован** от OpenRouter SDK.
- Использует прямой `fetch` к `generativelanguage.googleapis.com/v1beta`.
- Требует `GEMINI_API_KEY`. Модель `GEMINI_VISION_MODEL` env (дефолт: `gemini-flash-latest`).
- ⚠️ НЕ менять дефолт на `gemini-1.5-flash` — этот алиас мёртв на v1beta (Stage 30G).

### Git-коммиты
```
b42d303  Stage 40: wallet NotifType + PayoutMethod conflict fix
0ddc480  Stage 30-Refactoring: OpenRouter gateway + directDeepSeek fallback preserved
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

---

## Stage 40 — Wallet Pro (19.05.2026) ✅

**Контекст.** Таб «Кошелёк» добавлен в Dashboard за флагом `isCommercialMode`. Реальные выводы → `payout_requests`.

### Изменённые файлы
| Файл | Что изменено |
|------|-------------|
| `artifacts/api-server/src/routes/wallet.ts` | 7 endpoints: balance, history, topup, withdraw, admin/stats, admin/users/:id, admin/payouts |
| `artifacts/api-server/src/types/notifications.ts` | NotifType: добавлены `wallet_topup`, `wallet_withdraw` |
| `artifacts/hochu-to/src/pages/Dashboard.tsx` | `WalletSection`: таб «Кошелёк», кошелёк за флагом, демо-баннер в beta, статус-бейджи, withdraw→payout_requests |
| `artifacts/hochu-to/src/pages/AdminPage.tsx` | `WalletStatsCard` в PayoutsTab |

### TS-fixes
- `WalletPayoutMethod` — переименован (конфликт с `PayoutMethod` из schema)
- `return` добавлен в admin-endpoint после `res.json()`
- SQL `rows` → `result.rows` в `/admin/stats`

```bash
b42d303  Stage 40: wallet NotifType + PayoutMethod conflict fix
```

---

## Stage 30-Refactoring — OpenRouter AI Gateway (19.05.2026) ✅

**Контекст.** Единый OpenRouter SDK вместо 4 разных fetch-провайдеров. Vision-арбитратор изолирован (прямой Gemini API).

### Архитектура ПОСЛЕ
```
resolveProvider()
  ├── mock           → generateMock()
  └── openrouter     → OpenAI SDK (baseURL=openrouter.ai) ← OPENROUTER_API_KEY
  └── openai         → openrouter.ai/openai/gpt-4o-mini
  └── gemini         → openrouter.ai/google/gemini-flash-1.5
  └── amvera (legacy)→ openrouter.ai/deepseek/deepseek-chat
      └── fallback: fetch("api.deepseek.com") ← DEEPSEEK_API_KEY
          └── fallback: mock
```

Vision-арбитратор (`arbitrateWithGeminiVision`) — **не тронут**, прямой Gemini API с base64.

```bash
0ddc480  Stage 30-Refactoring: OpenRouter gateway + directDeepSeek fallback preserved
```

---

## Stage 33 — AI-Arbitration Full Implementation + Hardening (19.05.2026) ✅

**Контекст.** AI-арбитражор был реализован в Stage 33.0 (30.04.2026), но заблокирован отсутствием `GEMINI_API_KEY`. 19.05.2026 — полная разблокировка + hardening.

### 33-A: Разблокировка и стабилизация (`ai-service.ts`)
- `GEMINI_API_KEY` добавлен в Replit Secrets.
- `sharp` (`pnpm add sharp --filter @workspace/api-server`): resize 1280×1280 JPEG 80%.
- `GEMINI_VISION_TIMEOUT_MS`: 15_000 → 40_000.
- Retry + fallback-цепочка моделей (4 модели × 3 попытки): `gemini-flash-latest` → `gemini-1.5-flash-latest` → `gemini-2.0-flash-lite` → `gemini-2.0-flash`. Backoff: `3000 + attempt*2000` мс при 503/429.
- `maxOutputTokens`: 512 → 1024.
- Устойчивый JSON-парсер: `try JSON.parse()`, `catch` → regex-fallback по ключевым полям.
- `logger.info({ rawLen, rawSnippet })` для дебага raw-ответов.

### 33-B: Photo Consistency Check (`ai-service.ts`)
- **Промпт v2** — двухшаговый:
  - STEP 1 (обязательный): проверить, что обе группы фото показывают **один и тот же предмет**.
  - STEP 2: анализ повреждений (только при `photoConsistency='ok'`).
- Новое поле ответа `photoConsistency: "ok" | "incompatible" | "unreadable"`.
- Если `incompatible` или `unreadable` → `faultEstimatePercent` принудительно = 0, `confidence` = "low".
- `AiVerdictResult` интерфейс: добавлено `photoConsistency?: "ok" | "incompatible" | "unreadable"`.
- Regex-fallback парсер: добавлено извлечение `photoConsistency`.

### 33-C: Новые endpoints (`claims.ts`)
| Endpoint | Доступ | Описание |
|---|---|---|
| `GET /admin/claims/ai-verdicts-log` | superadmin, admin | История всех вердиктов (claims WHERE ai_verdict IS NOT NULL) |
| `POST /claims/:id/accept-verdict` | superadmin, admin, arbiter | `ai_verdict.accepted=true` + `acceptedAt` + `acceptedBy`; audit `ai_verdict_accepted` |
| `POST /claims/:id/manual-review` | superadmin, admin, arbiter | `status='admin_review'`; audit `status_changed (reason: manual_review_override)` |

### 33-D: Admin UI (`AdminPage.tsx`)
- `ClaimDigitalActsPhotos` — новый компонент (над блоком AI): side-by-side 3×3 сетки фото check_in / check_out; fetch из `GET /api/bookings/:id/digital-acts`; `onError` скрывает битые img.
- `ClaimAiVerdictBlock` расширен:
  - Spinner: «Анализируем фото… (до 40 сек)».
  - 3 варианта предупреждения: `incompatible` → 🚨 красный баннер; `unreadable` → ⚠️ янтарный; generic low-conf → нейтральный.
  - Кнопки «✓ Принять вердикт» (green) + «✎ Пересмотреть вручную» (stone); показываются только при `canAct`.
  - Badge `✓ Принят` при `verdict.accepted`.
  - `actionDone` state: feedback-баннеры после действия.

### Инварианты
- Кнопки Accept/Manual-Review видны только при `status ∈ {pending, admin_review}` и `!actionDone`.
- `faultEstimatePercent` **никогда не может быть > 0** при `photoConsistency !== 'ok'` — принудительно в бэке.
- Кэш: повторный `POST /claims/:id/ai-verdict` при заполненном `claims.ai_verdict` → 200 без перезапроса к Gemini.

### Тесты (ручные)
- ✅ Одинаковые фото → `confidence: high`, `photoConsistency: ok`, `faultEstimate: 0%`, вердикт на русском.
- ✅ Разные фото (разные предметы каталога) → `photoConsistency: incompatible`, `faultEstimate: 0%`, цитаты с объяснением.
- ✅ Новые endpoints: accept-verdict (200, `accepted: true` в БД), manual-review (200, `status: admin_review` в БД).

### Git-коммиты
```
035cb45  Stage 33 hardening: photo consistency check, prompt v2, UI warnings
8652775  Stage 33: sharp resize, retry/fallback models, side-by-side photos UI, new endpoints
22d2862  Stage 33: increase AI analysis timeout, secure API key
```

---

## Stage UI-2 — Mobile Header Compact + Clickable ListingCard Labels (21.05.2026) ✅

### Цель
Три независимых UI-улучшения: компактный однострочный мобильный хедер, устранение перекрытия элементов на карточке объявления и кликабельные лейблы категории/города/региона.

### 1. Компактный мобильный хедер (`Header.tsx`)

**Было:** 2-строчный мобильный хедер (~114px) — строка 1: Logo + иконки; строка 2: поиск.

**Стало:** Однострочный compact layout (~52px, как Avito/Ozon): `Logo icon | Search bar (flex-1, h-9, border) | Heart+Bell (p-2, icon size-[18px]) | Burger`.

Ключевые изменения:
- Родительский `div` мобильного ряда: убрана вертикальная stack-компоновка, всё в одном flex-row
- Поисковая строка `HeaderSearchBar` встроена inline с `flex-1`
- Иконки Heart/Bell/Burger: `p-2` вместо `p-3`, иконки `size-[18px]` вместо `size-5`
- Каталог (`Catalog.tsx`): sticky sidebar `top-[114px]` → `top-[52px]`

### 2. Устранение перекрытия на `ListingCard.tsx`

**Было:** Бейдж «Свободно» (availability) мог перекрывать кнопку сердца; лейбл категории при длинном названии выходил за пределы карточки.

**Стало:**
- Бейдж «Свободно» / «Занято» **удалён** (дублировал информацию из других элементов и мешал вёрстке)
- Лейбл категории: `max-w-[calc(100%-40px)]` — гарантированно не перекрывает кнопку избранного

### 3. Кликабельные лейблы категории / города / региона (`ListingCard.tsx`)

Все три лейбла теперь — `<button>` с `e.stopPropagation()` (чтобы клик не открывал карточку) + `navigate(url)`:

| Лейбл | URL при клике |
|-------|--------------|
| Категория (иконка + текст) | `/catalog?category=<categorySlug>` |
| City-чип (MapPin + city) | `/catalog?city=<city>` |
| Регион | `/catalog?region=<regionSlug>` |

### 4. API: новые поля `categorySlug` и `regionSlug` (`routes/listings.ts`)

Добавлены в **все 3 SELECT-блока** файла:
1. Основной список (`GET /listings`)
2. Fallback «другие регионы»
3. Детальная карточка (`GET /listings/:id`)

```ts
// Пример join-а в основном SELECT:
categories.slug.as("categorySlug"),
regions.slug.as("regionSlug"),
```

OpenAPI spec (`lib/api-spec/openapi.yaml`) — добавлены поля в схему `Listing`:
```yaml
categorySlug:
  type: string
  description: Slug категории для URL-навигации
regionSlug:
  type: string
  description: Slug региона для URL-навигации
```

После правок spec выполнен кодоген:
```bash
pnpm --filter @workspace/api-spec run codegen
```
→ обновлены `lib/api-client-react/src/generated/` и `lib/api-zod/src/generated/`

После правок бэкенда выполнена пересборка:
```bash
cd artifacts/api-server && node build.mjs
```
→ рестарт воркфлоу `API Server`

### ⚠️ ИНВАРИАНТ — API Server rebuild

Воркфлоу `API Server` запускает **pre-built** `dist/index.mjs` и **никогда не пересобирается сам**. Любое изменение в `artifacts/api-server/src/` **ТРЕБУЕТ** ручного:
```bash
cd artifacts/api-server && node build.mjs && # restart_workflow "API Server"
```
Этот инвариант не задокументирован явно нигде в предыдущих stage-блоках — фиксируется здесь.

### Изменённые файлы
| Файл | Что изменено |
|------|-------------|
| `artifacts/hochu-to/src/components/layout/Header.tsx` | Мобильный блок: single-row, `flex-1` search, `p-2`/`size-[18px]` иконки |
| `artifacts/hochu-to/src/components/ui/ListingCard.tsx` | Удалён бейдж availability; `max-w-[calc(100%-40px)]` на лейбл категории; category/city/region → `<button>` с navigate |
| `artifacts/hochu-to/src/pages/Catalog.tsx` | Sticky sidebar: `top-[114px]` → `top-[52px]` |
| `artifacts/api-server/src/routes/listings.ts` | `categorySlug` + `regionSlug` в 3 SELECT-блоках |
| `lib/api-spec/openapi.yaml` | `categorySlug` + `regionSlug` в схеме `Listing` |
| `lib/api-client-react/src/generated/` | Авто-обновлено Orval кодогеном |
| `lib/api-zod/src/generated/` | Авто-обновлено Orval кодогеном |
| `artifacts/api-server/dist/index.mjs` | Пересобрано `node build.mjs` |

### Тест-сьют (ручная проверка)
- ✅ Мобиль: хедер занимает ~52px, поиск inline, иконки компактные
- ✅ Desktop: хедер не изменился (~64px)
- ✅ Каталог: sticky sidebar не прилипает за хедером
- ✅ ListingCard: нет бейджа availability, лейбл категории не перекрывает сердце
- ✅ Клик на категорию → `/catalog?category=electronics` (и др.)
- ✅ Клик на city-чип → `/catalog?city=Москва`
- ✅ Клик на регион → `/catalog?region=moscow`
- ✅ API `/api/listings` возвращает `categorySlug` и `regionSlug` в каждом объекте
