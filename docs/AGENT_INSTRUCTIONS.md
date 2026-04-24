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

### Workflow деплоя:
```
git push → GitHub → Amvera webhook → Docker build (Kaniko) → запуск контейнера
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
| `GITHUB_TOKEN` | для пуша на GitHub (опционально) | Тот же `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` (см. раздел 2) или новый PAT |

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

## 11. Дорожная карта (актуально на 24.04.2026 вечер)

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

### 🚧 Следующие приоритеты

#### ЮKassa для платежей
- [ ] SDK + webhook
- [ ] Создание платежа на покупку контакта / промо / Premium-брони
- [ ] Подтверждение и активация баланса
> Требует `YOOKASSA_SHOP_ID` и `YOOKASSA_SECRET_KEY` в Replit Secrets и на Amvera.

#### Реальные банковские выплаты
- [ ] Замена ручного `mark-paid` на автомат через ЮKassa Payouts / банковский API
- [ ] Применимо к `payout_requests` (выплаты владельцам) и `claims` (компенсации фонда)

#### Подписки владельцев
- [ ] Pro / Бизнес тарифы с пониженной комиссией
- [ ] DB-таблица `subscriptions` + `POST /api/subscriptions/checkout`

### 📦 Бэклог
- 🧾 Цифровой Акт check-in/check-out (фото + видео + GPS + подпись)
- 🤝 Партнёрские договоры с юрлицами (бейдж «Партнёр платформы», 5% комиссии)
- 📊 Trust Score (рейтинг доверия пользователю, на основе истории сделок и отзывов)
- 🔔 `showFormatBadges` → фронтовый переключатель в админке
- 📊 `minPremiumShareInResults` → логика «буфера Premium» в пагинации
- 🗂️ Admin-RBAC через middleware `requireAdmin` (сейчас в каждом хендлере ручной `await isAdmin()`)
- 🚀 Индексы для аналитики на проде: `bookings(status, protection_enabled, payout_settled_at)`, `claims(status, paid_at)`, `claims(claimant_id, created_at)`

---

## 11a. Инвентаризация проекта (24.04.2026)

> Состояние реальной кодовой базы (а не «по доке»). Источники: 24 модуля API (~6850 строк), 15 страниц фронта, 26 таблиц БД, `platform_settings` (40+ полей).

### ✅ Что РЕАЛЬНО работает (подтверждено в коде)
- **Auth**: register/login/refresh/logout/me, JWT, bcrypt, сессии в БД (`auth_sessions`).
- **Каталог + сортировки**: 5 веток (`default/new/price_asc/price_desc/protected_first/rating/popular`), `?quality=true` для «Новинок» (`array_length(photos)≥1` + `char_length(description)≥50`), promo-префикс во всех ветках (Stage 19a).
- **Объявления (CRUD)**: 4 категории, до 10 фото, `listingNumber` БТ-YYYY-NNNNNN, авто-модерация при аномальной цене.
- **Бронирования**: pending→confirmed→active→return_pending→completed, отмены/перенос (`reschedule`), нумерация `ХТ-YYYY-NNNNNN`, аудит (`booking_events`), атомарный счётчик с защитой от race conditions.
- **Чат по броне**: `booking_messages` + unread-counts.
- **Двусторонние отзывы**: listing-review + renter-review с привязкой к завершённой броне, ответ от рецензируемой стороны, `recomputeListingRating()` после insert.
- **Избранное** (`favorites`) с денорм-счётчиком.
- **Финансовая модель Dual Shield**: множители категорий, Shield Fee, риск-резерв, ownerPayout — все ставки в `platform_settings` (кэш 60с).
- **Payout Requests** (Stage 17a): реквизиты карты/СБП, очередь заявок владельцев, ручной `mark-paid` админом.
- **Compensation Payouts / Claims** (Stage 17b): claims с реквизитами, поток approve→mark-paid→reject, лимиты анти-фрода фонда.
- **Аналитика фонда** (Stage 17c): `GET /api/claims/analytics`, LineChart баланса, топ-получатели, флаги паттернов.
- **Платное продвижение** (Stage 18 + 19a/19f): VIP/Срочно/Топ + журнал `listing_promotions`, продление поверх активного, бейджи в каталоге и на детальной, кнопка «Продвигать» в Dashboard и сайдбаре `/listings/:id`.
- **Денормализация счётчиков** (Stage 19e): `bookingCount/reviewCount/avgRating/favoritesCount` + idempotent backfill, убраны N+1 sub-queries.
- **Защищённые просмотры** (Stage 19c): `listing_views` UNIQUE по часу-бакету, hit-score `bookingCount × 5 + reviewCount × 2 + favoritesCount + views_30d` для `sort=popular`.
- **Контакты (платная разблокировка телефона)**: `contact_balances/unlocks/purchases`, 3 тарифа (49/299/699 ₽), модалка `ContactPurchaseModal`. **Оплата — заглушка** (моментально начисляет баланс).
- **Уведомления + Scheduler** (`node-cron`, `lib/scheduler.ts`): 6 правил напоминаний (confirm_pending / handover_today / handover_overdue / return_today / return_overdue / return_confirm), производительный (5 SQL за прогон).
- **Админка (10+ вкладок)**: Обзор, Аналитика, Пользователи, Объявления, Бронирования, Поддержка, Жалобы, Аудит, Экономика, Платежи, Заявки Shield. Сидер `POST /admin/seed-test-listings` (150 объявлений, идемпотентно).
- **Поддержка** (`support_tickets/messages`), **Жалобы** (`reports`), **GeoIP** для авто-региона.
- **Деплой**: GitHub → Amvera webhook (Docker).

### 🟡 Заявлено как фича, но реализовано поверхностно

**Совместные покупки** — *доска объявлений без коллективной механики*:
- Таблица `joint_purchases` есть; **API только GET+POST** (создать без авторизации); UI `pages/JointPurchases.tsx` — `handleParticipate()` показывает toast «Скоро!».
- НЕТ: участия, инкремента `collectedAmount`, модерации, оплаты пая, эскроу до сбора, закрытия/возврата при недосборе, админки.
- Настройка `joint_purchase_fee_percent=3` в БД **никогда не применяется в коде**.
- Реальное наполнение БД: 1 тестовая запись от 23.04.2026.

**Платежи (ЮKassa / СБП / CloudPayments)** — *настройки есть, кода нет*:
- `platform_settings`: `yookassa_enabled`, `yookassa_shop_id`, `yookassa_test_mode`, `sbp_enabled`, `sbp_merchant_id`, `cloudpayments_enabled`. UI вкладки «Платежи» рисует эти поля.
- НЕТ ни одной строки SDK / webhook / создания платежа / активации баланса. Все «оплаты» = ручной mark-paid админом или симуляция.
- `payment_mode='self_employed'` (default) влияет только на тексты UI.

**Подписки владельцев (Pro / Бизнес)** — *цены лежат, реализации нет*:
- В `platform_settings`: `subscription_pro_monthly=499`, `subscription_business_monthly=1990`, `subscription_business_commission_percent=5`.
- НЕТ таблицы `subscriptions/owner_subscriptions`, нет роутов `/api/subscriptions`, нет UI оформления, нет логики применения пониженной комиссии.

**Trust Score / KYC / верификация** — *0 строк*. Бейдж «Проверенный владелец» в `getListingBadges` **не реализован** (нет поля `is_verified` в `users`, нет ветки в badge-функции, нет API). Дизайн — в разделе 11d.

### 🔴 Бэклог — точно не начато
- Цифровой Акт check-in/check-out (фото + видео + GPS + подпись).
- Партнёрские договоры с юрлицами (бейдж «Партнёр платформы», 5% комиссии).
- `minPremiumShareInResults=60` (настройка есть) — буфер Premium в пагинации не реализован.
- `showFormatBadges` — фронтового переключателя нет.
- Индексы для аналитики на проде (см. 11. Дорожная карта).

### Самые критичные пробелы (приоритезация для запуска)
1. **ЮKassa** — без неё все платные фичи (промо, контакты, Premium-брони) работают «на доверии». Блокер реальной монетизации.
2. **Совместные покупки** — нужен полноценный дизайн (паи + эскроу + закрытие/возврат), либо честно убрать со страницы пометку «Скоро» и не путать пользователя.
3. **Подписки** — *сначала надо ответить на вопрос: нужны ли вообще* (см. ниже раздел 11b).

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
| **V6 — Trust Score helper** | `lib/trust-score.ts` с формулой + unit-тесты на стартовых данных | 1 файл | ⏳ отложено |
| **V7 — Cron + админ-кнопка «Пересчитать»** | Ежесуточный пересчёт + ручной trigger в админке | 2 файла | ⏳ отложено |
| **V8 — Публичный показ Trust Score** | Маркер на карточке + фильтр в каталоге + блок в Dashboard | 3-4 файла | ⏳ отложено |

**MVP «Проверенный владелец» (V1–V5) выпущен в Stage 19g 24.04.2026.**
V6–V8 — Trust Score, делается после накопления данных (минимум 100 завершённых сделок и 50 владельцев — иначе калибровка бессмысленна).

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

## 13. Команда для пуша после каждой итерации

```bash
GITHUB_TOKEN=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 bash scripts/github-push.sh "Stage X: краткое описание"
```

> **Почему агент не пушит сам:** Replit на main-агенте блокирует `git add/commit`.
> Чекпойнт создаётся автоматически, но залить его на GitHub может только пользователь из Shell.
> Если скрипт зависает из-за `.git/index.lock` — запустить напрямую:
> ```bash
> git push "https://pdkiller666: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@github.com/pdkiller666/Hochu_to.git" main
> ```

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
