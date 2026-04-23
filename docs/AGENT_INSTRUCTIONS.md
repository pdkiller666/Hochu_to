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

## 11. Дорожная карта (актуально на 23.04.2026 вечер)

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

### 🚧 Следующие приоритеты

#### Этап 8 — Расширенная статистика в админке
- [ ] `GET /api/admin/stats?from=&to=` с агрегациями
- [ ] Блок «Объявления»: всего Free/Premium, конверсия Free→Premium, ТОП категорий
- [ ] Блок «Сделки»: брони за период, средний чек, % завершённых
- [ ] Блок «Контакты»: куплено за период, ARPU, конверсия
- [ ] Блок «Пользователи»: регистрации, DAU/MAU

#### Этап 9 — ЮKassa для контактов
- [ ] SDK + webhook
- [ ] Создание платежа на покупку контакта
- [ ] Подтверждение и активация баланса
> Требует `YOOKASSA_SHOP_ID` и `YOOKASSA_SECRET_KEY` в Replit Secrets и на Amvera.

### 📦 Бэклог
- 💳 Реальная оплата для Premium-броней (ЮKassa, СБП, CloudPayments-холд депозита)
- 🏷️ Продвижение объявлений: VIP/Boost/Срочно + `POST /listings/:id/promote`
- 📋 Подписки владельцев: basic/pro/business + пониженная комиссия
- 🧾 Цифровой акт check-in/check-out: фото + GPS + подпись
- 🛡️ Реальные выплаты из Гарантийного фонда + баланс фонда в Admin
- 📊 Trust Score, статистика просмотров (для Pro), финансовый P&L
- 🔔 `showFormatBadges` → фронтовый переключатель
- 📊 `minPremiumShareInResults` → логика «буфера Premium» в пагинации

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
