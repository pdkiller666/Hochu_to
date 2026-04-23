# Чек-лист проекта «Хочу_То» — 23 апреля 2026 (v2, новая сессия)

> Актуальное состояние на момент начала новой сессии агента.
> Все этапы 1–7 завершены и задеплоены на Amvera.

---

## ✅ РЕАЛИЗОВАНО

### 🗄️ База данных (14 таблиц)
- [x] `users` — профиль, роль (renter/owner/admin), рейтинг, completed_deals_count, is_banned
- [x] `listings` — объявления, фото, категория, регион, депозит (опционально), ownerProtectionEnabled
- [x] `bookings` — 7 статусов, номер `ХТ-YYYY-000000`, все fee-поля (rent/service/tax/shield/riskCoverage/ownerPayout), protectionEnabled
- [x] `booking_events` — полный аудит-лог каждого изменения брони
- [x] `booking_messages` — in-app чат по booking_id
- [x] `reviews` — двусторонние (listing + renter), поле ответа, привязка к completed booking
- [x] `notifications` — уведомления с дедупликацией по (bookingId + type + userId)
- [x] `favorites` — избранные объявления
- [x] `claims` — заявки на возмещение из Shield-фонда (damage/theft → pending/reviewing/approved/rejected/paid)
- [x] `auth_sessions` — refresh-токены
- [x] `platform_settings` — singleton настройки всей экономики в БД (кэш 60с)
- [x] `contact_balances` — баланс платных контактов (1 строка/пользователь)
- [x] `contact_purchases` — история покупок контактов (single/pack10/unlimited30d)
- [x] `contact_unlocks` — журнал раскрытых телефонов (unique по userId+listingId)
- [x] `joint_purchases` — совместные покупки
- [x] `audit_log` — лог действий admin через панель

### 🔌 API — Backend
- [x] Auth: register / login / logout / me / refresh
- [x] Listings: CRUD, фильтры (category/region/price/safeOnly), поиск, сортировка (new/popular/rating/price_asc/price_desc)
- [x] Listings: недоступные даты, региональный fallback поиска, поле депозита опционально
- [x] Listings: `GET /api/listings?safeOnly=true` — фильтр только Premium объявлений
- [x] Bookings: создание, смена статуса, Safe Deal / Direct Contact
- [x] Bookings: расчёт цен из platform_settings (кэш), Free-тариф = 0% удержаний
- [x] Bookings: апгрейд Free→Premium прямо в брони (`renter_upgraded_to_protection`)
- [x] Reviews: создание, ответ, проверка дублей, рейтинги owner/renter/combined
- [x] Messages: чат по booking_id, счётчик непрочитанных `GET /api/messages/unread-counts`
- [x] Notifications: создание, пометка как прочитанные, read-all
- [x] Scheduler: 6 типов напоминаний + авто-переходы просроченных броней (каждый час)
- [x] Admin API: статистика, пользователи, объявления, бронирования, тикеты, жалобы, аудит
- [x] `GET /api/settings` — публичные ставки экономики для клиента
- [x] `GET/PUT /api/admin/settings` — полные настройки с аудитом (только admin)
- [x] `GET /api/admin/stats/extended?from=&to=` — расширенная аналитика 4 блока (кэш 60с)
- [x] Upload: загрузка фото объявлений
- [x] GeoIP: определение региона по IP
- [x] Платные контакты: баланс, пополнение (стаб), покупка контакта, welcome-бонус, кэш повторного запроса
- [x] Joint purchases API, Newsletter, Contact form

### 🖥️ Frontend — Страницы (13+)
- [x] `/` — главная: hero + 4 карусели + категории + «Как работает»
- [x] `/catalog` — каталог со сворачиваемыми фильтрами, тумблер «Безопасные сделки», URL-sync
- [x] `/listings/:id` — детальная карточка, gallery, календарь, форма бронирования + error banner
- [x] `/dashboard` — кабинет: входящие/исходящие, чат, история, отзывы, избранное, баланс контактов
- [x] `/dashboard/listings/new` + `/:id/edit` — форма объявления (Free/Premium переключатель)
- [x] `/favorites` — избранные объявления
- [x] `/auth` — вход + регистрация с выбором роли и региона
- [x] `/admin` — **11 вкладок**: Обзор, **Аналитика**, Пользователи, Объявления, Бронирования, Экономика, Платежи, Поддержка, Жалобы, Заявки фонда, Аудит
- [x] `/joint-purchases`, `/how-to-rent`, `/how-to-list`, `/guarantee-fund`, `/about`, `/contacts`, `/privacy`

### 💡 Ключевые UI-компоненты
- [x] `ListingCard` — бейджи (Free🪧 / Premium🛡 / VIP / Срочно / Рейтинг / Новинка / Часто берут), кнопка «Связаться — N ₽»
- [x] `ListingCarouselSection` — 4 карусели на главной (популярные/новые/рейтинг/выгодные)
- [x] `BookingCalendar` — блокировка занятых дат
- [x] `StarRating` — интерактивный + display-режим
- [x] `Header` — sticky, 2-строчный mobile, поиск + регион (URL-synced), уведомления, избранное
- [x] `ContactPurchaseModal` — модалка покупки контакта с согласием
- [x] `ReviewCard` — с ответом владельца
- [x] Eco-impact блок — сэкономлено ₽ + CO₂ в кабинете

### 💰 Финансовая модель (Dual Shield v2 + Free-тариф)
- [x] **Premium**: serviceFee 10% + taxFee 6% + shieldFee max(5%×rent, 100₽) + riskCoverage 5%
- [x] **Free**: 0% удержаний — владелец получает 100% от арендатора
- [x] Залог: опционален для Free, обязателен для Premium
- [x] Лимиты компенсации по категориям: электроника ×50 / инструменты ×20 / отдых ×15 / спецтехника ×10
- [x] Кап для новичков (до 3 сделок — max 25 000 ₽)
- [x] Все ставки читаются из БД через кэш (меняются из админки, TTL 60с)

### 🔒 Безопасность
- [x] JWT-like токены (base64) + bcryptjs
- [x] `requireAuth` / `requireAdmin` middleware на всех защищённых маршрутах
- [x] Серверная + клиентская валидация настроек экономики
- [x] Секретные ключи шлюзов — только в env, не редактируются из UI

### 📡 Инфраструктура
- [x] pnpm monorepo + TypeScript 5.9 + Node.js 24
- [x] OpenAPI spec + Orval codegen (React Query хуки + Zod схемы)
- [x] esbuild bundle для сервера (esbuild 0.25.8 для api-server, 0.27.3 глобально)
- [x] Docker → Amvera деплой через GitHub webhook (webhook `main` → авто пересборка)
- [x] `migrate-prod.mjs`: Step 0 drizzle push-force + Step 1 ALTER IF NOT EXISTS + seed
- [x] Replit PostgreSQL в разработке, собственная БД Amvera в проде

---

## 🚧 СЛЕДУЮЩИЕ ПРИОРИТЕТЫ

### Этап 8 — ЮKassa для контактов ⭐ (рекомендую следующим)
> Нужны `YOOKASSA_SHOP_ID` и `YOOKASSA_SECRET_KEY` от пользователя

- [ ] Установка SDK `@a2seven/yoo-checkout` или `yookassa`
- [ ] `POST /api/me/contact-balance/payment` — создание платежа (single/pack10/unlimited30d)
- [ ] `POST /api/webhooks/yookassa` — webhook подтверждения (проверка подписи HMAC)
- [ ] Активация баланса после `payment.succeeded`
- [ ] UI: кнопки «Оплатить через ЮKassa» / редирект на платёжную форму
- [ ] Обработка `payment.canceled` и истёкших платежей

### Этап 9 — Продвижение объявлений (Boost/VIP/Срочно)
> Самостоятельный этап, не требует внешних ключей

- [ ] DB: поля `is_featured`, `featured_until`, `is_urgent`, `urgent_until`, `boosted_until` в `listings`
- [ ] Миграция схемы (`pnpm --filter @workspace/db run push-force`)
- [ ] API: `GET /listings` учитывает `featured_until DESC, boosted_until DESC, created_at DESC`
- [ ] API: `POST /listings/:id/promote` — установка флага + даты (тип: featured/urgent/boost)
- [ ] UI: кнопка «⚡ Продвинуть» в кабинете → модалка с тарифами
- [ ] Admin: вкладка «Продвижение» — список активных VIP/Срочных + ручная активация
- [ ] Цены продвижения из `platform_settings` (уже есть поля для этого)

### Этап 10 — Подписки владельцев (Pro/Business)
- [ ] Таблица `owner_subscriptions` (tier: basic/pro/business, expires_at, auto_renew)
- [ ] Pro 499 ₽/мес: 5 поднятий + 1 VIP + аналитика просмотров
- [ ] Business 1990 ₽/мес: безлимит + API-доступ + баннер «Магазин владельца»
- [ ] Пониженная комиссия для Business (меняется из platform_settings)
- [ ] UI: страница тарифов в кабинете

---

## 📦 БЭКЛОГ (по убыванию приоритета)

### 💳 Оплата Premium-броней
- [ ] ЮKassa для бронирований Premium (аналогично Этапу 8, но для broней)
- [ ] СБП-платёж: QR-код + загрузка скрина чека + подтверждение оператором
- [ ] CloudPayments: холдирование депозита на время аренды
- [ ] Автовыплата владельцу после `completed` статуса + возврат залога

### 🧾 Цифровой акт (check-in / check-out)
- [ ] Форма передачи: до 4 фото + видео + GPS + подпись сторон
- [ ] Объектное хранилище для медиафайлов акта (Replit App Storage или S3)
- [ ] Связка акта с `booking_events` (event_type: `checkin_act` / `checkout_act`)
- [ ] Кнопка в кабинете при переходе `confirmed→active` и `active→return_pending`

### 🛡️ Shield-фонд — реальные выплаты
- [ ] Реальное списание из фонда по одобренной заявке Claims
- [ ] Баланс фонда в Admin Обзоре (сумма всех `riskCoverage` за period)
- [ ] История выплат из фонда

### 📊 Аналитика и доверие
- [ ] Trust Score пользователей (авто: сделки / отзывы / жалобы / срок на платформе)
- [ ] Статистика просмотров объявлений (для Pro-подписки)
- [ ] Финансовый P&L платформы в реальном времени

### 🐛 Известные баги / технический долг
- [x] `regions?.find is not a function` — **исправлено**: добавлен Vite proxy `/api → localhost:8080`, теперь фронтенд корректно получает данные в dev-режиме
- [x] Нет `/api/health` эндпоинта — **исправлено**: добавлен `GET /api/health` в `app.ts` (отдаёт `{status:"ok", ts}`)
- [ ] Dockerfile использует `node:20-slim`, а локально Node.js 24 — возможна несовместимость при появлении 24-специфичных API

---

## 🔧 ТЕХНИЧЕСКИЙ СТАТУС (23.04.2026, новая сессия)

| Компонент | Статус |
|-----------|--------|
| БД схема | ✅ применена (`push-force`) |
| Seed данные | ✅ залиты (85 регионов, 10 категорий, 14 объявлений, тестовые пользователи) |
| API-сервер | ✅ запущен на порту 8080 |
| Фронтенд | ✅ запущен на порту 5173 |
| GitHub | нужен пуш после изменений |
| Amvera | последний деплой — хотфиксы 23.04 |

### Тестовые аккаунты:
| Email | Пароль | Роль |
|-------|--------|------|
| `alexey@example.com` | `Test1234!` | owner |
| `maria@example.com` | `Test1234!` | owner |
| `admin@test.ru` | `Admin1234!` | admin |

---

*Версия: MVP v1 + Free-тариф + Монетизация (этапы 1–7) + Расширенная аналитика*
*Дата: 23 апреля 2026. Сессия: новый агент.*
