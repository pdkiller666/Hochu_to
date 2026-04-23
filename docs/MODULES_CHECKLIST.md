# Хочу_То — полная карта модулей

> Срез на 23.04.2026 (после Stage 17a). Используй как справочник «что есть, что умеет, где лежит».

---

## 1. Архитектура верхнего уровня

```
┌──────────────────┐    HTTPS    ┌──────────────────┐     SQL     ┌──────────────┐
│  React + Vite    │ ◀────────▶  │  Express 5 API   │ ◀────────▶  │ PostgreSQL   │
│  (hochu-to)      │  cookies    │  (api-server)    │  Drizzle    │ 22 таблицы   │
│  port 5173       │  base64-tok │  port 8080       │  ORM        │              │
└──────────────────┘             └──────────────────┘             └──────────────┘
                                          │
                                          ├─ /uploads (статика, фото объявлений)
                                          └─ node-cron (напоминания каждые 5 мин)
```

- **Монорепо**: pnpm workspaces. Артефакты в `artifacts/`, общие либы в `lib/`.
- **TypeScript 5.9** везде. `zod/v4` + `drizzle-zod` для схем.
- **Auth**: cookie + base64 refresh-токен (без JWT-секрета). Пароли — bcryptjs.
- **Деплой**: GitHub → Amvera webhook (production). Replit — dev-окружение.
- **Brand**: `#C65D3B` (терракот), `#F2EEE3` (крем), `#4A8587` (бирюза). Шрифты Montserrat + Inter.

---

## 2. База данных (`lib/db/src/schema/`) — 22 таблицы

### Пользователи и аутентификация
| Файл | Таблица | Назначение |
|------|---------|------------|
| `users.ts` | `users` | id, email, phone, name, passwordHash, role (user/admin), avatar, городRegion, isBlocked, fundDeposit, completedDealsCount, createdAt |
| `auth_sessions.ts` | `auth_sessions` | refresh-токены: token, userId, userAgent, ip, expiresAt |
| `admin_audit_log.ts` | `admin_audit_log` | actorId, action, targetType, targetId, details jsonb — лог всех действий админов |

### Каталог
| Файл | Таблица | Назначение |
|------|---------|------------|
| `regions.ts` | `regions` | 89 регионов РФ, parentId для иерархии |
| `categories.ts` | `categories` | дерево категорий (id, parentId, name, slug, icon) |
| `listings.ts` | `listings` | объявления: title, description, pricePerDay, deposit, images jsonb, ownerId, regionId, categoryId, isPremium, protectionEnabled, status (active/blocked/draft), maxProtectionLimit, itemCategory enum |
| `favorites.ts` | `favorites` | userId + listingId (избранное) |

### Бронирования
| Файл | Таблица | Назначение |
|------|---------|------------|
| `bookings.ts` | `bookings` | основная таблица сделок: bookingNumber, ownerId, renterId, listingId, dates, totalPrice, ownerPayout, fundContribution, fundShare, status (pending/confirmed/handed_over/active/return_pending/completed/cancelled/disputed), protectionEnabled, **payoutSettledAt + payoutRequestId** (Stage 17a) |
| `booking_events.ts` | `booking_events` | timeline: confirmed/handover/return/cancelled события |
| `booking_messages.ts` | `booking_messages` | чат внутри брони |

### Финансы
| Файл | Таблица | Назначение |
|------|---------|------------|
| `contacts.ts` | `contact_balances` + `contact_purchases` + `contact_unlocks` | покупка пакетов разблокировок контактов владельца (Free-листинги) |
| `payout_methods.ts` | `payout_methods` | реквизиты владельцев: card (last4 only) или СБП |
| `payout_requests.ts` | `payout_requests` | заявки на выплату: status (pending/approved/paid/rejected), methodSnapshot, bookingIds, paymentRef |

### Коммуникация
| Файл | Таблица | Назначение |
|------|---------|------------|
| `notifications.ts` | `notifications` | уведомления (booking/system/reminder/message/...), isRead, link |
| `support.ts` | `support_tickets` + `support_messages` | тикеты в техподдержку с перепиской |
| `reports.ts` | `reports` | жалобы пользователей на листинги/чужих юзеров |
| `claims.ts` | `claims` | заявки в гарантийный фонд при спорах |
| `reviews.ts` | `reviews` | отзывы по бронированиям (звёзды + текст + ответ владельца) |
| `newsletter.ts` | `newsletter` | email-подписчики |
| `joint_purchases.ts` | `joint_purchases` | совместные закупки (заглушка, MVP) |

### Конфигурация
| Файл | Таблица | Назначение |
|------|---------|------------|
| `platform_settings.ts` | `platform_settings` | **сердце экономики**: 50+ полей — fundShare, contactPriceSingle, freeListingsMaxPerOwner, protMult* (множители защиты по категориям), shieldFee*/riskCoverage*, ставки ЮKassa/СБП/CloudPayments, paymentMode (НПД/УСН/ОСНО), и т.д. |

---

## 3. Backend API (`artifacts/api-server/src/routes/`) — 23 файла, ~120 эндпоинтов

| Файл | Префикс | Endpoints | Что умеет |
|------|---------|-----------|-----------|
| **admin.ts** | `/api/admin/*` | **26** | управление пользователями (block/unblock/role), модерация листингов, settings GET/PUT (всё `platform_settings`), аналитика (`/stats/extended`), broadcast-рассылки, audit-log, claims-фонд |
| **bookings.ts** | `/api/bookings` | **7** | create (Premium / Free / Variant 3), list (мои/входящие), confirm, handover, return-request, return-confirm, cancel, dispute, reschedule |
| **listings.ts** | `/api/listings` | **7** | CRUD, фильтрация (search, category, region, price, sort=protected_first), маска телефона для Free, upload фото |
| **payouts.ts** | `/api/me/payout-methods`, `/api/me/payouts`, `/api/admin/payouts` | **10** | CRUD реквизитов (last4 only), создание заявки на выплату с serializable transaction + FOR UPDATE, админская очередь (approve/mark-paid/reject) |
| **finance.ts** | `/api/me/finance` | **2** | summary (income, ownerPayout, contactSpent, **availableForPayout, inActiveRequests**), entries (timeline всех денежных событий) |
| **users.ts** | `/api/users` | **5** | профиль, обновление, аватар, список объявлений другого юзера |
| **contacts.ts** | `/api/me/contacts/*` | **4** | покупка пакетов разблокировок (single 150 ₽ / pack5 / pack10), unlock контакта владельца на Free-листинге |
| **auth.ts** | `/api/auth` | **5** | register, login, logout, refresh, me |
| **reviews.ts** | `/api/reviews` | **5** | создать отзыв по броне, ответ владельца, список по объявлению/юзеру |
| **support.ts** | `/api/support` | **4** | создать тикет, переписка, list мои/admin |
| **claims.ts** | `/api/claims` | **4** | создать заявку в фонд, статусы, admin-обработка |
| **geoip.ts** | `/api/geoip` | **1** | определение региона по IP |
| **favorites.ts** | `/api/favorites` | **4** | toggle, list, count |
| **reports.ts** | `/api/reports` | **1** | создать жалобу |
| **joint_purchases.ts** | `/api/joint-purchases` | **2** | list, get (заглушка) |
| **notifications.ts** | `/api/notifications` | **3** | list, mark-read, mark-all-read |
| **messages.ts** | `/api/messages` | **1** | сообщения внутри брони |
| **categories.ts** | `/api/categories` | **1** | дерево категорий |
| **regions.ts** | `/api/regions` | **1** | 89 регионов |
| **upload.ts** | `/api/upload` | **1** | multer → `UPLOADS_DIR` (10 МБ, jpg/png/webp) |
| **misc.ts** | `/api/*` | **3** | newsletter-subscribe, public-settings (что показывать на фронте), и т.д. |
| **health.ts** | `/api/health` | **1** | `{status: ok}` |

### Middleware и lib
- **`middleware/auth.ts`** — `requireAuth` (читает cookie, кладёт `req.userId`)
- **`lib/auth-token.ts`** — генерация base64 token (header.payload.signature)
- **`lib/refresh-token.ts`** — управление refresh-куками
- **`lib/notifications.ts`** — фабрика всех типов уведомлений
- **`lib/scheduler.ts`** — node-cron каждые 5 мин: 6 типов напоминаний по бронированиям (5 SQL-запросов на запуск, масштабируется до 100k+ броней)
- **`lib/platform-settings.ts`** — кэш `platform_settings` в памяти
- **`lib/uploadsDir.ts`** — путь к загрузкам (dev: `./uploads`, prod: `/data/uploads` Amvera persistent volume)
- **`lib/logger.ts`** — pino + pino-http

---

## 4. Frontend (`artifacts/hochu-to/src/`)

### Страницы (`pages/`) — 14 файлов

| Файл | Маршрут | Содержание |
|------|---------|-----------|
| **Dashboard.tsx** (4160 строк) | `/dashboard` | Личный кабинет: KPI-карточки, **PayoutsBlock (Stage 17a)**, мои объявления, мои брони (как владелец/как арендатор), таб «Финансы» (income/expense + entries timeline), пакеты контактов, настройки профиля |
| **AdminPage.tsx** (2831 строк) | `/admin` | Админка: 12 табов — Обзор, Аналитика, Денежные потоки, **Выплаты (Stage 17a)**, Пользователи, Объявления, Бронирования, Экономика, Платежи, Поддержка, Жалобы, Заявки фонда, Аудит. Broadcast-модалка |
| **ListingDetail.tsx** (1172 строк) | `/listings/:id` | галерея, описание, календарь (BookingCalendar), форма брони с расчётом цены (Premium/Variant 3/Free), отзывы, кнопки покупки контакта на Free |
| **ListingForm.tsx** (746 строк) | `/listings/new`, `/listings/:id/edit` | форма создания/редактирования объявления + загрузка фото |
| **Catalog.tsx** (554 строк) | `/catalog` | фильтры (категория, регион, цена, sort), карточки, пагинация |
| **OwnerProfile.tsx** | `/owners/:id` | публичный профиль владельца + его объявления + отзывы |
| **Home.tsx** | `/` | hero-баннер с 2 CTA, marketing-карусели, категории, как это работает, преимущества |
| **Favorites.tsx** | `/favorites` | избранные объявления |
| **Auth.tsx** | `/auth` | регистрация / логин (одна страница) |
| **JointPurchases.tsx** | `/joint-purchases` | заглушка совместных закупок |
| **Contacts.tsx** | `/contacts` | контакты платформы |
| **Instructions.tsx** | `/instructions` | как пользоваться |
| **About.tsx** | `/about` | о проекте |
| **Privacy.tsx** | `/privacy` | политика конфиденциальности |

### Общие компоненты
- **`components/layout/Layout.tsx`** — header (логотип + поиск + регион + аватар + бейдж уведомлений) + footer
- **`components/BookingCalendar.tsx`** — календарь с занятыми датами
- **`components/ui/`** — shadcn/ui (Button, Input, Toast, Dialog, Select, Tabs и т.д.)

### Хуки и утилиты
- **`lib/auth.ts`** — `getAuthHeaders()` для fetch
- **`lib/region-context.tsx`** — выбранный регион (persist в localStorage)
- **`lib/favorites-context.tsx`** — глобальный store избранного
- **`lib/use-public-settings.ts`** — публичные настройки платформы из БД
- **`lib/use-persisted-state.ts`** — useState + localStorage
- **`lib/utils.ts`** — `formatPrice`, `calculateTotalPrice` (Модель А Premium/Variant 3/Free) — критическая бизнес-логика
- **`hooks/use-toast.ts`** — toast-уведомления

### Routing
- Wouter (без react-router) — определён в `App.tsx`

---

## 5. Общие либы (`lib/`)

| Либа | Назначение |
|------|------------|
| **`db/`** | Drizzle schema + `db` instance + `pg` Client. Экспортирует все таблицы и Drizzle helpers |
| **`api-spec/`** | OpenAPI YAML + Orval-конфиг для кодогенерации |
| **`api-zod/`** | Сгенерированные Zod-схемы из OpenAPI (DTO для безопасной валидации) |
| **`api-client-react/`** | Сгенерированные React Query-хуки (`useGetCurrentUser`, `useCreateBooking` и т.д.) |

> **Важно:** хуки и DTO **не покрывают все маршруты** — Stage 17a/payouts работают через прямой `fetch()`. Постепенно стоит дописывать в OpenAPI.

---

## 6. Бизнес-возможности — что система **умеет сейчас**

### Каталог и поиск
- ✅ 22 листинга, фильтры по категории/региону/цене/сортировке
- ✅ Поиск по тексту (header search bar, URL `?search=`)
- ✅ Premium-объявления выше Free (sort=protected_first)
- ✅ Маска телефона владельца на Free до покупки контакта (`free_show_owner_phone_mode = after_payment`)
- ✅ Масштабная защита (maxProtectionLimit) с множителями по категориям и капом для новичков

### Бронирование (3 модели расчёта)
- ✅ **Premium** (оба опт-инули защиту): owner и renter скидываются в фонд (fundShare%), полная защита
- ✅ **Variant 3** (Free + renter апгрейдит): renter платит fundShare/2 один — апгрейд работает
- ✅ **Free прямой расчёт**: ownerPayout = totalPrice, fundContribution = 0
- ✅ Перенос даты (reschedule) с пересчётом
- ✅ Статусы: pending → confirmed → handed_over → active → return_pending → completed
- ✅ Отмена и спор (disputed) с заявкой в фонд

### Уведомления и cron
- ✅ Push-уведомления в БД (без email/push notifications)
- ✅ 6 типов автонапоминаний каждые 5 мин: подтвердить, сегодня выдать, просрочка выдачи, сегодня возврат, просрочка возврата, подтвердить возврат

### Финансы (личный кабинет)
- ✅ KPI: общий доход, выплачено, в обработке, **доступно к выводу**, потрачено на контакты
- ✅ Timeline всех денежных событий (booking_paid, contact_purchase, **payout_request/payout_paid/payout_rejected**)
- ✅ Покупка пакетов разблокировок контактов (1/5/10)
- ✅ **Stage 17a — Заявки на выплату:** реквизиты (карта last4 / СБП), создание заявки с защитой от race-condition, отслеживание статусов

### Админка (12 табов)
- ✅ Обзор: суммарные KPI
- ✅ Аналитика: листинги/брони/контакты/юзеры за период, топ-категории
- ✅ **Денежные потоки**: совокупный финансовый отчёт по всем юзерам
- ✅ **Выплаты (Stage 17a)**: очередь заявок с approve/mark-paid/reject + просмотр снапшота реквизитов
- ✅ Пользователи: блок/разблок, смена роли, просмотр сделок
- ✅ Объявления: модерация, блок/разблок
- ✅ Бронирования: фильтры, ручное закрытие
- ✅ **Экономика**: настройки fundShare, fundDeposit, множители защиты, минимумы выплат, и т.д.
- ✅ Платежи: тумблеры ЮKassa/СБП/CloudPayments + Shop ID/Public ID
- ✅ Поддержка: тикеты + переписка
- ✅ Жалобы: модерация
- ✅ Заявки фонда: одобрить/отклонить
- ✅ Аудит: лог всех админских действий

### Безопасность и качество
- ✅ Cookie + httpOnly + secure (production)
- ✅ Bcrypt-хеши паролей
- ✅ PCI-safe: полный номер карты НЕ хранится (last4 only)
- ✅ Serializable transactions с FOR UPDATE на критичных операциях (payouts)
- ✅ Audit log для админских действий
- ✅ Rate-limiting через `express`-настройки (cookie/CORS правильно настроены)

---

## 7. Чего **нет** (открытые пробелы)

| Область | Что отсутствует |
|---------|-----------------|
| **Эквайринг** | ЮKassa/СБП — есть только настройки в админке, реальной интеграции нет. Все «оплаты» — заглушки на стороне фронта |
| **Реальные выплаты** | Сейчас только реестр заявок — деньги переводит админ вручную через банк. Автоматического трансфера нет |
| **KYC** | Нет проверки личности владельцев (требует 115-ФЗ при работе с платежами) |
| **Налоги** | Нет автосписания НПД/УСН с самозанятых; админка только хранит `paymentMode` |
| **Email** | `newsletter` — только подписки в БД; реальной отправки писем нет |
| **Push** | Нет web-push / mobile-push, всё в БД |
| **Совместные закупки** | Только заглушка |
| **Mobile app** | Нет (Expo пока не подключён) |
| **Cron на возврат депозита** | Нет автоматического возврата `fundDeposit` после N успешных сделок |

---

## 8. DevOps

### Repl-окружение
- **Workflow «Start application»**: `PORT=8080 pnpm --filter @workspace/api-server dev & PORT=5173 BASE_PATH=/ pnpm --filter @workspace/hochu-to dev`
- **DB**: PostgreSQL 16 (auto-provisioned)
- **Файлы**: `artifacts/api-server/uploads/` (10 МБ, в git)

### Продакшн (Amvera)
- **Билд**: esbuild (CJS bundle для api-server)
- **Деплой**: GitHub webhook → Amvera автоматически
- **Persistent volume**: `/data/uploads` для фото
- **Env**: только `DATABASE_URL` + `NODE_ENV=production`

### Скрипты (`scripts/`)
- **`github-push.sh`** — git add/commit/push с GITHUB_TOKEN
- **`setup-new-replit.sh`** — полное развёртывание на новом аккаунте
- **`post-merge.sh`** — реконсиляция после merge задач (drizzle push + restart)
- **`seed-amvera.sh`** — заливка снапшота на prod-БД
- **`db-snapshots/dev-data.sql`** — актуальный дамп тестовых данных (586 строк, 22 таблицы)

### Тестовые аккаунты (после restore)
- `admin@example.com` / `admin123` — админ
- `owner1@example.com`, `owner2@example.com` / `owner123` — владельцы (есть Premium-брони → доступны выплаты)
- `renter1@example.com`, `renter2@example.com` / `renter123` — арендаторы

---

## 9. История итераций (краткий индекс)

См. `docs/AGENT_INSTRUCTIONS.md` — полный журнал по датам.

| Этап | Что появилось |
|------|---------------|
| 1–6 | MVP: каталог, листинги, брони, чат, отзывы, фонд |
| 7 | Расширенная аналитика админки |
| 8–13 | Уведомления, cron, support, reports, claims |
| 14 | Контакты-разблокировки (монетизация Free) |
| 15 | Гарантийный фонд (claims-обработка) |
| 16 | Категории-множители защиты |
| 17 | Аудит экономики, подключение «фантомных» настроек |
| **17a** | **Payout Requests (заявки на выплату)** ← последняя |

### Следующие шаги (бэклог)
1. Stage 17b — депозит в фонд (`fundDeposit` от новичков)
2. Stage 17c — автовозврат депозита после N сделок
3. Stage 18 — реальная интеграция ЮKassa
4. Stage 19 — KYC для самозанятых
