# Чек-лист проекта «Хочу_То» — 23 апреля 2026 (v3)

> Снимок состояния на конец сессии. Все изменения относительно v2 — в самом низу («Дельта»).

---

## ✅ РЕАЛИЗОВАНО

### 🗄️ База данных (15 таблиц)
- [x] `users` — профиль, роль, рейтинг, completed_deals_count, is_banned
- [x] `auth_sessions` — refresh-токены / активные сессии
- [x] `regions`, `categories` — справочники (10 регионов, 10 категорий)
- [x] `listings` — объявления, `itemCategory` (4 значения), `ownerProtectionEnabled`, `maxProtectionLimit`, `requiresManualVerification`
- [x] `bookings` — 7 статусов, номер `ХТ-YYYY-000000`, полный fee-набор, `protectionEnabled`
- [x] `booking_events` — аудит-лог
- [x] `booking_messages` — in-app чат
- [x] `reviews` — двусторонние (listing + renter), ответ владельца
- [x] `notifications` — с дедупликацией (bookingId + type + userId)
- [x] `favorites`, `support`, `reports`, `admin_audit_log`
- [x] `claims` — заявки на возмещение из Гарантийного фонда
- [x] `platform_settings` — singleton настроек экономики (кэш 60с)
- [x] `joint_purchases`, `contacts`, `newsletter`

### 🔌 API — Backend
- [x] Auth: register / login / logout / me / refresh / sessions
- [x] Listings: CRUD, фильтры, поиск, сортировки (`new / popular / rating / price_asc/desc / protected_first`), `safeOnly`
- [x] Listings: автоматический `maxProtectionLimit`, флаг ручной модерации при аномальной цене
- [x] Bookings: создание + смена статуса, расчёт цен из `platform_settings` (кэш), Free-тариф 0% удержаний
- [x] Bookings: апгрейд Free→Premium прямо в брони (`renter_upgraded_to_protection`), reschedule по Модели А
- [x] Reviews: двусторонние, ответ, проверка дублей, агрегаты owner/renter/combined
- [x] Messages: чат + `GET /api/messages/unread-counts`
- [x] Notifications: чтение/пометка/read-all
- [x] Scheduler: 6 правил напоминаний + авто-переходы просроченных броней (cron, 1 час)
- [x] Admin API: статистика, пользователи, объявления, бронирования, тикеты, жалобы, аудит, расширенная аналитика 4 блока (`/stats/extended`)
- [x] `GET /api/settings` (публичные ставки) и `GET/PUT /api/admin/settings` (админ + аудит)
- [x] Upload, GeoIP, Health, Joint purchases, Newsletter, Contacts form
- [x] Платные контакты: баланс, покупки, журнал раскрытий, welcome-бонус
- [x] **Claims API**: CRUD заявок на возмещение (damage / theft)

### 🖥️ Frontend — Страницы
- [x] `/` — главная: hero + 4 карусели + категории + «Как работает»
- [x] `/catalog` — каталог + фильтры + тумблер «Безопасные сделки»
- [x] `/listings/:id` — детальная карточка: галерея, бейджи, бронирование, отзывы, чат + **мотивационные тексты выгод для арендатора и владельца** (escrow / фонд / арбитраж)
- [x] `/dashboard` — кабинет: входящие/исходящие, чат, история, отзывы, избранное, баланс контактов
- [x] `/dashboard/listings/new` + `/:id/edit` — форма с переключателем Free/Premium и автозалогом
- [x] `/favorites`, `/auth`, `/owner/:id`
- [x] `/admin` — **11 вкладок**: Обзор, Аналитика, Пользователи, Объявления, Бронирования, Экономика, Платежи, Поддержка, Жалобы, Заявки фонда, Аудит
- [x] `/joint-purchases`, `/how-to-rent`, `/how-to-list`, `/guarantee-fund`, `/about`, `/contacts`, `/privacy`

### 💡 UI-компоненты
- [x] `ListingCard` — бейджи (Free 🪧 / Premium 🛡 / VIP / Срочно / Рейтинг / Новинка / Часто берут), кнопка «Подробнее»
- [x] `ListingCarouselSection` — 4 карусели на главной
- [x] `BookingCalendar`, `StarRating`, `Header` (sticky 2-row mobile), `ContactPurchaseModal`, `ReviewCard`
- [x] Eco-impact блок в кабинете

### 💰 Финансовая модель (Модель А: один Гарантийный фонд, два независимых опт-ина)
- [x] **Premium**: serviceFee 10% + taxFee 6% + fundShare max(5%×rent, 100₽) + риск-доля
- [x] **Free**: 0% удержаний, владелец получает 100% от арендатора
- [x] **Variant 3 (Free Upgrade)**: арендатор апгрейдит защиту → платит service+tax+fund, владелец получает 100% rent
- [x] Залог: опционален для Free, обязателен для Premium
- [x] **Лимиты по 4 категориям**: electronics ×50 / tools ×20 / leisure ×15 / **special_machinery ×10**
- [x] Кап для новичков (до 3 сделок — max 25 000 ₽)
- [x] Все ставки читаются из БД через кэш TTL 60с

### 🔒 Безопасность
- [x] JWT-like + bcryptjs, `requireAuth` / `requireAdmin` middleware
- [x] Серверная + клиентская валидация настроек
- [x] Секреты шлюзов — только в env, в UI не редактируются
- [x] OpenAPI enum валидация на всех слоях (zod-генерация)

### 📡 Инфраструктура
- [x] pnpm monorepo + TS 5.9 + Node 24 (локально) / Node 20 (Docker)
- [x] OpenAPI + Orval кодоген (api-zod + api-client-react)
- [x] esbuild 0.25.8 для api-server (плагин esbuild-plugin-pino требует ≤0.25.8)
- [x] Docker → Amvera через GitHub webhook
- [x] `migrate-prod.mjs`: drizzle push-force + ALTER IF NOT EXISTS + seed

---

## 🆕 ДЕЛЬТА ОТ v2 (что сделано в этой сессии)

### Bug fix — несогласованность категорий
- [x] OpenAPI `itemCategory` enum: добавлен 4-й элемент `special_machinery` (раньше был только electronics/tools/leisure)
- [x] Регенерация `lib/api-zod` и `lib/api-client-react` через Orval
- [x] Серверные касты в `routes/listings.ts` (POST + PATCH) расширены до 4 значений; `categoryAvg` теперь содержит `special_machinery: 5000`
- [x] Клиентский каст в `ListingForm.tsx` расширен
- [x] Подчищен устаревший комментарий в `lib/db/src/schema/listings.ts`
- [x] Проверено smoke-тестом: POST `/api/listings` с `itemCategory:"special_machinery"` → 200, `maxProtectionLimit` рассчитан через `protMultSpecialMachinery`

### UX — карточка объявления
- [x] Цена-заголовок: показывается `pricePerDay`, не «накрученный» итог
- [x] PC: главное фото уменьшено (`lg:aspect-[16/10] lg:max-h-[420px]`)
- [x] Free-объявление: убран Phone/ContactPurchaseModal с карточки, теперь стандартная кнопка «Подробнее»
- [x] **Тексты мотивации (выгоды вместо затрат)**:
  - Арендатор: «Безопасная сделка через эскроу» + «Защита Гарантийным фондом» (в пределах лимита, по решению арбитража); итоговая фраза «Сравните: личная встреча с незнакомцем, наличные, риск залогом. Здесь — карта, защита и поддержка за X на всю сделку»
  - Владелец: зелёный блок «На карту: X с суток — чистыми» + объяснение «Эквайринг, чек, эскроу, поддержка при споре — на нас»; в OFF-режиме формулировка смягчена, чтобы не вводить в заблуждение
  - Блок «Гарантийный фонд подключён» расширен до 3 пунктов-выгод (компенсация до лимита, +просмотры 2× чаще, нейтральный арбитраж)

---

## 🚧 СЛЕДУЮЩИЕ ПРИОРИТЕТЫ

### Этап 8 — ЮKassa для контактов ⭐
> Нужны `YOOKASSA_SHOP_ID` и `YOOKASSA_SECRET_KEY`
- [ ] SDK `@a2seven/yoo-checkout`
- [ ] `POST /api/me/contact-balance/payment` — создание платежа (single/pack10/unlimited30d)
- [ ] `POST /api/webhooks/yookassa` — HMAC-проверка подписи
- [ ] Активация баланса после `payment.succeeded`
- [ ] UI редирект на платёжную форму

### Этап 9 — Продвижение объявлений (Boost / VIP / Срочно)
- [ ] DB: `is_featured`, `featured_until`, `is_urgent`, `urgent_until`, `boosted_until` в `listings`
- [ ] Сортировка `featured_until DESC, boosted_until DESC, created_at DESC`
- [ ] `POST /listings/:id/promote` (тип услуги: featured/urgent/boost)
- [ ] UI кнопка «⚡ Продвинуть» в кабинете → модалка тарифов
- [ ] Admin: вкладка «Продвижение»
- [ ] Цены — из существующих полей `vipPrice* / urgentPrice* / boostPrice*` в `platform_settings`

### Этап 10 — Подписки владельцев
- [ ] Таблица `owner_subscriptions` (tier, expires_at, auto_renew)
- [ ] Pro 499 ₽/мес: 5 поднятий + 1 VIP + аналитика
- [ ] Business 1990 ₽/мес: безлимит + API + баннер «Магазин»
- [ ] Пониженная комиссия для Business

---

## 📦 БЭКЛОГ
- 💳 ЮKassa / СБП-QR / CloudPayments-холд для Premium-броней
- 🧾 Цифровой акт check-in/check-out (4 фото + видео + GPS + подпись)
- 🛡️ Реальные выплаты из Гарантийного фонда + баланс фонда в Admin Обзоре
- 📊 Trust Score, статистика просмотров (для Pro), финансовый P&L
- 🔔 `showFormatBadges` → переключатель отображения бейджей
- 📊 `minPremiumShareInResults` → буфер Premium в пагинации
- 🤝 Партнёрские договоры с юрлицами (бейдж «Партнёр», 5% комиссии)

---

## 🐛 Известные техдолги
- [x] `regions?.find is not a function` — исправлено (Vite proxy `/api → 8080`)
- [x] Нет `/api/health` — добавлен
- [x] Несогласованный enum категорий — исправлен
- [ ] Dockerfile использует `node:20-slim`, локально Node.js 24

---

## 🔧 ТЕХНИЧЕСКИЙ СТАТУС (23.04.2026, конец сессии)

| Компонент | Статус |
|-----------|--------|
| БД схема | ✅ применена |
| API-сервер | ✅ 8080 |
| Фронтенд | ✅ 5173 |
| GitHub | требует пуш |
| Amvera | предыдущий деплой — хотфиксы 23.04 утро |

### Тестовые аккаунты
| Email | Пароль | Роль |
|-------|--------|------|
| `alexey@example.com` | `Test1234!` | owner |
| `maria@example.com` | `Test1234!` | renter |
| `admin@test.ru` | `Admin1234!` | admin |

---

*Версия: MVP v1 + Free-тариф + Монетизация (этапы 1–7) + Расширенная аналитика + Bug fix категорий + UX мотивация ListingDetail*
*Дата: 23 апреля 2026 (v3, конец сессии).*
