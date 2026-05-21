# Workspace — Хочу_То Rental Marketplace

## Overview 

Full-stack rental marketplace "Хочу_То" (I Want That) — a platform for renting items and joint purchases in Russia. Built as a pnpm monorepo with React+Vite frontend and Express API backend.

## Mission & Product Philosophy

**«Хочу_То»** — это финтех-платформа шеринговой экономики. Мы не просто доска объявлений, а **защищённый узел доверия**.

- **Миссия:** дать людям возможность пользоваться дорогими вещами без их покупки, убрав страх поломки, кражи или мошенничества.
- **Роль платформы:** гарант сделки, независимый арбитр и оператор внутреннего Гарантийного фонда.
- **Главный продукт:** спокойствие владельца и уверенность арендатора.

### Хостинг и соответствие
- **Hosting:** Amvera (РФ-хостинг, соблюдение ФЗ-152 о персональных данных).
- **PCI-Safe:** полные номера карт не хранятся (только last4 в `payout_requests`).
- **Secret Management:** секретный ключ ЮKassa скрыт от публичных GET-запросов (Stage 20c), хранится с повышенным уровнем защиты.
- **Idempotency:** все финансовые операции через ЮKassa защищены детерминированными Idempotence-Key (Stage 21a).

## Система безопасности APEX (Asset Protection & Escrow eXchange)

### 1. Гарантийный фонд (Модель А)
- Не страховка в юридическом смысле, а программа взаимопомощи.
- Формируется из взносов участников (`fundContribution` владельца + `renterFundContribution` арендатора, оба опт-ин).
- Расходуется на компенсацию ущерба через `claims`, если залога недостаточно.
- Лимиты анти-фрода: `fundReserveRatioPct`, `maxClaimAmountSingleRub`, `maxClaimsPerUserMonth`, `maxClaimAmountPerListingPct` (Stage 17b-limits).

### 2. Цифровой Акт (Check-in/Check-out) — Stage 22a + 22b
Сделка не считается начатой/завершённой без фиксации состояния:
- **Минимум 4 фото** с разных ракурсов (ограничение валидируется на бэке через Zod `.refine(photos.length≥4)`).
- **Whitelist URL фото** — принимаются только `/uploads/<safe-name>.{jpg,jpeg,png,webp,heic,heif}`; внешние URL, `data:`-URI и path-traversal блокируются.
- **Опциональное видео** (URL ссылка).
- **Метаданные:** EXIF + GPS извлекаются клиентом (`exifr`) и сохраняются в `metadata jsonb` для защиты от подлога.
- **Электронная подпись (22b):** обязательная PNG-подпись пальцем/мышью на адаптивном HTML5 canvas. Хранится в `metadata.signature` (data:image/png;base64), регекс + лимит 300КБ на бэке.
- **Карта в арбитраже (22b):** в админке под фото каждого акта — Leaflet-карта с пином по первой GPS-точке из EXIF (фирменный `#C65D3B`).
- **Иммутабельность:** `UNIQUE(booking_id, type)` в БД — один акт приёмки и один акт возврата на бронь, повтор → 409 `act_already_exists`.

> Статус (Stage 22a hardening 25.04.2026 + Stage 22b 25.04.2026 + Stage 22b-followup 25.04.2026): таблица `digital_acts` + endpoints `GET/POST /api/bookings/:id/digital-acts` + блокировка перехода `confirmed → active` без check_in акта (409 `digital_act_required`) + обязательная подпись (400 `signature_required`) + видео-аплоад через `POST /api/upload-video` (mp4/webm/mov, 100МБ, mime allowlist + magic-mime) с whitelist-валидацией внутренних путей и http(s) URL (400 `invalid_video_url` отбивает data:URI и path-traversal) + UI в Dashboard и AdminPage с картой, подписью и видео-плеером + scheduler за 24ч до handover/return шлёт `reminder_checkin_soon`/`reminder_checkout_soon` обеим сторонам (только если акт ещё не оформлен). Регрессия Stage 22a: 31/31, Stage 22b: 5/5 веток валидации подписи, Stage 22b-followup: 15/15 (видео + scheduler 24ч).

### 3. Ступенчатый Арбитраж
- **Категория А (визуальный ущерб):** царапины, сколы. Удерживается из залога мгновенно по фото-сравнению.
- **Категория Б (техническая поломка):** диагностика в независимом сервис-центре.
  - Вина пользователя → ремонт из Фонда + Залога.
  - Естественный износ → Фонд не выплачивает (риск владельца).

## User Journey

1. **Поиск** — прозрачный каталог с расчётом полной цены (`Rent + Service + Tax + Fund`).
2. **Выбор защиты** — «Экран последствий» при попытке отказаться от защиты (демонстрация риска).
3. **Оплата** — два режима:
   - **Бета (`is_commercial_mode=false`, по умолчанию):** комиссии и продвижение бесплатны (мок-флоу). См. Stage 21a.
   - **Коммерческий (`is_commercial_mode=true`):** ЮKassa redirect, активация по webhook. Stage 21a — продвижение, 21b/c — контакты и холд бронирований (в работе).
4. **Приёмка** — выполнение условий Цифрового Акта через мобильный интерфейс (roadmap).
5. **Аренда** — использование, чат по броне, напоминания scheduler-а.
6. **Завершение** — владелец подтверждает возврат → разморозка залога → двусторонние отзывы.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite, Tailwind CSS, Framer Motion, Wouter (routing), React Query
- **Auth**: JWT access-token (HS256, в `Authorization: Bearer`) + refresh-token cookie (`ht_refresh_token`, HttpOnly, secure/sameSite зависят от `NODE_ENV` — Stage 32-debug fix), bcryptjs для паролей

## Brand

- **Primary**: #C65D3B (terracotta orange)
- **Background**: #F2EEE3 (warm cream)
- **Accent**: #4A8587 (teal)
- **Text**: #2B2B2B
- **Fonts**: Montserrat (headings), Inter (body)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (port 8080)
│   ├── hochu-to/           # React+Vite frontend (port 21418, preview at /)
│   └── mockup-sandbox/     # Design sandbox
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
└── ...
```

## Pages

- **/** — Home: hero banner with 2 CTA buttons («Смотреть каталог» + «Сдать вещь в аренду»), marketing carousels, categories, how it works, advantages, reviews
- **/catalog** — Catalog with filters (category, price, region, sort) and listing cards. Search is performed via the global header search bar (URL-synced via `?search=`)
- **/listings/:id** — Listing detail with gallery, booking calendar, booking form
- **/admin** — Expanded admin panel (7 tabs): Overview with Recharts charts, Users (edit/ban/notify), Listings (edit/hide/delete), Bookings (status override), Support tickets, Reports (жалобы), Audit log
- **/auth** — Login/Register with role selection (renter/owner) and region selector
- **/dashboard** — User dashboard: orders, my items (CRUD), profile settings
- **/dashboard/listings/new** — Add new listing form
- **/dashboard/listings/:id/edit** — Edit existing listing
- **/joint-purchases** — Joint purchases page with request form
- **/how-to-rent** — Instructions for renters
- **/how-to-list** — Instructions for owners  
- **/guarantee-fund** — APEX (Asset Protection & Escrow eXchange) — полная страница Гарантийного фонда: терракотовый герой с анимацией, механика фонда (4 шага), Цифровой акт (мок-карточка), категории арбитража A/Б, ИИ-арбитраж (Gemini Vision мок), шаги подачи заявки, антифрод-лимиты, CTA. Файл: `GuaranteeFund.tsx` (отдельный, не Instructions.tsx)
- **/pools** — Каталог пулов (список + фильтры по статусу). `/joint-purchases` → redirect сюда.
- **/pools/create** — Создание нового пула (`PoolCreate.tsx`): auth-гейт для гостей, форма с URL товара, целевой суммой, реквизитами СБП
- **/pools/:id** — Детальная страница пула (`PoolDetail.tsx`): прогресс сбора, список акционеров, `ContributeBlock` (СБП-deeplink + tel: ссылка), `PoolCalendarBlock` (занятые даты из `/unavailable-dates` + текущий хранитель), `ResidualValueBlock` (остаточная стоимость), `IncomeBlock` (доходы с аренды), `MarketplaceBlock` (вторичный рынок долей), `BuyoutBlock` (выкуп)
- **/about** — About us
- **/contacts** — Contact form + social links
- **/privacy** — Privacy policy

## API Routes

All routes prefixed with `/api`:
- `GET/POST /auth/register|login|logout|me` — Authentication
- `GET /regions` — Russian cities/regions
- `GET /categories` — Item categories with count
- `GET /listings` — Listings with filters (category, region, price, search, page). Каждый листинг в ответе содержит `categorySlug` (строка, e.g. `"electronics"`) и `regionSlug` (строка, e.g. `"moscow"`) для формирования clickable-ссылок в UI без доп. запросов. Оба поля добавлены в OpenAPI spec + Orval codegen.
- `POST /listings` — Create listing (requires auth)
- `GET/PUT/DELETE /listings/:id` — Listing CRUD
- `GET /listings/:id/unavailable-dates` — Dates blocked by bookings
- `GET /listings/:id/reviews` — Reviews for listing
- `GET/POST /bookings` — User bookings
- `GET/PUT /bookings/:id` — Booking details/status update
- `GET/PUT /users/:id` — User profile
- `GET /users/:id/listings` — User's own listings
- `POST /reviews` — Create review
- `GET/POST /joint-purchases` — Joint purchase requests
- `POST /newsletter/subscribe` — Newsletter
- **Telegram (Stage 38, auth required):**
  - `POST /telegram/generate-otp` — 6-значный OTP (TTL 10 мин) для привязки к боту
  - `GET /telegram/status` — статус привязки: linked, hasOtp, otpExpiresAt, preferences
  - `POST /telegram/unlink` — отвязка (идемпотентна)
  - `PATCH /telegram/preferences` — настройка уведомлений `{bookings, system, chats: boolean}`
- **Telegram Admin (Stage 38, superadmin only):**
  - `GET /admin/telegram/status` — online, username, env, hasToken
  - `POST /admin/telegram/broadcast` — рассылка `{text, link?, role?}` всем или по роли
- `POST /contact` — Contact form
- `GET /bookings/:id/messages` — Get chat messages for a booking (requires auth, must be owner or renter)
- `POST /bookings/:id/messages` — Send a chat message (body: `{content}`)
- `GET /messages/unread-counts` — Returns unread message counts per booking `{bookingId: count}`
- `GET /me/finance` — Личный финансовый журнал (derived ledger): `{summary, entries[]}` из bookings + contact_purchases + **wallet_transactions(pool_rental)**. Тип `pool_rental_income` — доход совладельца пула с аренды (CS-6).
- `GET /admin/finance?period=today|week|month|all` — Сводка денежных потоков платформы: revenue, fund, payouts, counts, recent[50].
- **Payouts (Stage 17a)** — заявки владельцев на вывод заработка:
  - `GET/POST/PATCH/DELETE /me/payout-methods` — CRUD реквизитов (карта/СБП).
  - `GET/POST /me/payouts` — мои заявки + создание новой (с проверкой available).
  - `GET /admin/payouts` + `POST /admin/payouts/:id/approve|mark-paid|reject` — очередь админа.
- **Claims (Stage 17b-core)** — выплаты компенсаций пострадавшим из фонда:
  - `POST /claims` — создать заявку (Premium-броня, лимиты см. ниже).
  - `GET /claims/my` — мои заявки.
  - `GET /claims` + `POST /claims/:id/approve|mark-paid|reject` — админ.
  - `GET /claims/fund-status` — баланс фонда + резерв + availableForClaims.
  - `GET /claims/payout-methods/:userId` — реквизиты получателя (admin).
- **Fund analytics (Stage 17c)** — `GET /api/claims/analytics?days=7|30|90` (admin): daily inflow/outflow/balance, топ-получатели, флаги подозрительных пользователей.
- **AI-Арбитраж (Stage 33):**
  - `POST /claims/:id/ai-verdict` — запустить Gemini Vision-анализ (admin/arbiter); кэшируется в `claims.ai_verdict`.
  - `POST /claims/:id/accept-verdict` — модератор принимает ИИ-вердикт (`ai_verdict.accepted=true` + audit).
  - `POST /claims/:id/manual-review` — перевод в `admin_review` без ИИ-суммы + audit.
  - `GET /admin/claims/ai-verdicts-log` — история всех вердиктов (admin only).
- **Co-Sharing / Pools (CS-1–CS-6, 21.05.2026):**
  - `GET /pools` — список пулов (фильтр по статусу/создателю)
  - `POST /pools` — создать пул (auth required)
  - `GET /pools/mine` — мои пулы (как создатель или акционер), для Dashboard-таба
  - `GET /pools/:id` — детали пула: shares, listing, events
  - `PATCH /pools/:id` — обновить пул
  - `POST /pools/:id/contribute` — подать заявку на долю (SBP deeplink + auth gate)
  - `POST /pools/:id/confirm-share/:shareId` — создатель подтверждает платёж → `pool_share_confirmed` уведомление
  - `POST /pools/:id/activate` — активировать пул через Genesis Digital Act → `pool_active` уведомление всем акционерам
  - `GET /pools/:id/income` — история доходов совладельца с аренды
  - `GET /pools/:id/events` — аудит-лог пула
  - Buyout routes (`/buyouts`): создание запроса на выкуп доли, подтверждение, ликвидация

## Database Schema

Tables (`lib/db/src/schema/`):
- `users` — User accounts (role: renter/owner/admin), `ownerProtectionEnabled` (per-user default), rating/reviewCount. **Stage 38:** `telegram_chat_id`, `telegram_otp`, `telegram_otp_expires_at`, `telegram_notifications jsonb`. **Stage 38-UE:** `phone_verified`, `phone_otp`, `phone_otp_expires_at`.
- `auth_sessions` — Active JWT sessions (logout/revoke support)
- `regions` — Russian cities/regions (10 major cities seeded)
- `categories` — Item categories (10 catalog slugs)
- `listings` — Rental items, `itemCategory` (electronics/tools/leisure/special_machinery), `ownerProtectionEnabled`, `maxProtectionLimit`, `requiresManualVerification`
- `bookings` — Rental bookings (status: pending/confirmed/active/return_pending/rejected/completed/cancelled), full fee breakdown columns, `protectionEnabled` (renter opt-in)
- `booking_events` — Audit log per booking (status changes, manager notes)
- `booking_messages` — In-app chat per booking
- `reviews` — Two types (listing / renter), tied to completed booking
- `claims` — заявки в Гарантийный фонд (damage/theft, статусы pending→admin_review→approved|rejected→paid). Расширена в 17b-core: `payoutToUserId`, `payoutMethodId`, `methodSnapshot jsonb`, `paymentRef`, `paidAt`, `rejectionReason`.
- `payout_methods` — реквизиты пользователей для выплат (карта/СБП): `cardLast4`, `cardHolderName`, `bankName`, `sbpPhone`, `sbpBank`, `isDefault` (Stage 17a).
- `payout_requests` — заявки владельцев на вывод заработка: `ownerId`, `amountRub`, `status`, `methodSnapshot jsonb`, `bookingIds int[]`, `adminNote`, `rejectionReason`, `paymentRef`, `paidAt` (Stage 17a). На `bookings` также добавлены `payoutSettledAt`, `payoutRequestId`.
- `favorites` — Избранные объявления (renter)
- `notifications` — In-app уведомления (тип, ссылка, прочитано)
- `support` — Тикеты поддержки (категория, статус, переписка)
- `reports` — Жалобы на объявления/пользователей
- `admin_audit_log` — Действия админов (для тикетов/банов/правок настроек)
- `platform_settings` — Singleton: все ставки, цены, paymentMode, ID шлюзов. Анти-фрод фонда (Stage 17b-limits): `fundReserveRatioPct`, `maxClaimAmountSingleRub`, `maxClaimsPerUserMonth`, `maxClaimAmountPerListingPct`. **Stage 38:** `telegram_bot_token` (nullable, hot-swap), `telegram_env (dev|prod)`. **Stage 38-UE:** `sms_enabled`, `sms_provider (mts_exolve|smsc|stream_telecom)`, `sms_api_key`, `sms_api_secret`, `sms_sender_name`, `sms_api_url`.
- `joint_purchases` — Заявки на совместные закупки
- `contacts` — Заявки с формы «Контакты»
- `newsletter` — Подписчики
- **Co-Sharing (CS-1–CS-6):**
  - `pools` — пулы совместного владения: `title`, `targetAmountRub`, `status (funding|purchasing|active|liquidated|canceled)`, `collectionMethod`, `maintenanceFundBalance`, `poolFeePercent`, `wearAndTearMeter`
  - `pool_shares` — доли участников: `userId`, `poolId`, `sharePercentage`, `amountPaid`, `paymentStatus (pending|creator_confirmed|escrow_held)`, `paymentRef`
  - `pool_events` — аудит-лог событий пула
  - `buyout_requests` — запросы на выкуп доли: `poolId`, `initiatorId`, `participantId`, `status (pending|awaiting_payment|confirmed|completed|cancelled)`, `offerAmountRub`
  - `wallets` — кошельки пользователей: `availableBalance`, `frozenBalance`
  - `wallet_transactions` — транзакции кошелька: `type (payout|commission|hold|release)`, `referenceType (pool_rental|booking|...)`, `bookingNumber`, `description`
  - На `listings` добавлены: `poolId` (FK), `custodianId` (кто сейчас хранит вещь), `wearAndTearMeter` (счётчик аренд)

## Quick Setup (новый Replit-аккаунт)

```bash
bash scripts/setup-new-replit.sh
```
Накатит схему + зальёт снапшот тестовых данных (`scripts/db-snapshots/dev-data.sql`).
Подробности: `docs/AGENT_INSTRUCTIONS.md` раздел 5a.

**Обязательные секреты:**
- `SESSION_SECRET` — ≥32 символа (`openssl rand -hex 32`)
- `DATABASE_URL` — Replit ставит автоматически

**Опциональные AI-ключи (для реальной генерации описаний):**
- `GEMINI_API_KEY` — Google Gemini (рекомендуется как основной провайдер)
- `AMVERA_API_TOKEN` — Amvera DeepSeek-V3 (российский шлюз)
- `DEEPSEEK_API_KEY` — прямой DeepSeek API (api.deepseek.com), второй резерв после Amvera (Stage 33.0)

**Telegram-бот (Stage 38):**
- `TELEGRAM_BOT_TOKEN` — токен от @BotFather. Используется как fallback, если в `platform_settings.telegram_bot_token = NULL`. Суперадмин может сменить токен через AdminPage (hot-swap без перезапуска). Текущий бот: `@Helper251223_bot`.

**Опциональные (нужны только при `is_commercial_mode=true` — Stage 21a):**
- `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY` — реквизиты ИП в ЮKassa
- `YOOKASSA_WEBHOOK_SECRET` — обязателен в production (HMAC-SHA256 подпись вебхуков)

В dev-режиме без коммерческого тумблера всё работает без этих секретов — продвижение и контакты идут по бесплатному мок-флоу.

## Demo Data

- 3 seeded demo users (password: `Demo1234!` for all):
  - alexey@example.com — owner («Сдаю технику и инструменты»)
  - maria@example.com — owner («Фотограф. Профессиональное оборудование»)
  - dmitry@example.com — owner («Спортивный инвентарь»)
- 10 listings across categories
- 4 reviews
- 3 joint purchase requests

**Test accounts (local DB only):**
- test_renter@test.local / `Test5678!` (renter)
- test_owner@test.local / `Test1234!` (owner)

## Global Header (Sticky)

Marketplace-style sticky header (Avito/Wildberries pattern) — visible on all pages:

**Desktop (md+):** Logo + centered Search bar (flex-grow) + Region pill + Nav (xl+) + Auth/Profile actions on a single 64px row.

**Mobile (<md):** Single-row compact layout (~52px) — Logo icon | Search bar (flex-1, h-36px, thin border) | Burger. Heart+Bell убраны из хедера (Stage UI-2b) — теперь только в `BottomNav`. Avito/Ozon pattern. Previous 2-row layout (~114px) was removed in Stage UI-2.

**Search behavior:**
- Submitting navigates to `/catalog?search=<query>` while preserving other URL params (region, category)
- Header search input syncs with URL `?search=` on every route change (so opening `/catalog?search=дрель` pre-fills the input)
- The `HeaderSearchBar` is a stable component declared outside `Header()` so React preserves the input DOM node — mobile keyboards do NOT close after each character
- **Autocomplete dropdown (Stage UI-1):** при вводе ≥2 символов появляется выпадающий список — до 4 листингов + до 2 совпадающих категорий. Дебаунс 250мс, `AnimatePresence` анимация, закрытие по Escape/клику вовне, иконка-спиннер во время загрузки. Клик → переход на листинг или `/catalog?category=<slug>`. «Найти в каталоге» всегда последний пункт.

**Region selector:** Persists across pages via `useRegion` context. On `/catalog`, changing the region updates the URL `?region=` param.

## Marketing Carousels (Homepage)

Four horizontally-scrollable product carousels between the hero CTA section and the category grid.

### Carousels (top to bottom)
1. 🔥 **Хиты аренды** (`sort=popular`) — sorted by confirmed/active/completed booking count DESC
2. ✨ **Новинки** (`sort=new`) — sorted by `createdAt DESC` (default)
3. ⭐ **Высокий рейтинг** (`sort=rating`) — JS-sorted by avg review rating DESC
4. 💸 **Выгодные предложения** (`sort=price_asc`) — SQL `ORDER BY price_per_day ASC`

### Component: `ListingCarouselSection`
Location: `artifacts/hochu-to/src/components/ui/ListingCarouselSection.tsx`
Props: `title`, `subtitle`, `icon` (emoji), `badge` (`{label, className}`), `sort`, `catalogLink`, `limit`, `bgClassName`
Features: skeleton loading state, prev/next arrow buttons (auto-enable/disable), "Смотреть все" link, mobile-friendly

### API sort parameter
`GET /api/listings?sort=new|popular|rating|price_asc|price_desc&limit=8`
- `popular` and `rating` use JS sorting post-enrichment (all rows fetched, sorted, sliced)
- `popular` fetches booking count per listing (confirmed+active+completed)
- Ready for monetization: can add `sort=featured` or `sponsored=true` flag to listings table

## Reviews & Rating System

### Two types of reviews (both tied to completed bookings)
1. **Listing review** (`review_type = 'listing'`): Renter → reviews the listing/owner. Contributes to listing rating and owner's rating.
2. **Renter review** (`review_type = 'renter'`): Owner → reviews the renter. Contributes to renter's user rating.

### Review fields
- `booking_id` + `booking_number` — mandatory link to completed booking (enforces authenticity)
- `reviewer_role` — `renter` or `owner`
- `reviewee_id` — who is being reviewed
- `response_text` + `response_at` — response from the reviewed party
- `rating` (1–5), `text` (optional)

### API Routes
- `GET /api/reviews/can-review/:bookingId` — returns `{canReviewListing, canReviewRenter, bookingNumber}`
- `POST /api/reviews` — create review (validates completed booking, prevents duplicates)
- `POST /api/reviews/:id/response` — add response (only by reviewee, one per review)
- `GET /api/reviews/listing/:listingId` — all listing reviews with response
- `GET /api/reviews/user/:userId?type=owner|renter|all` — reviews ABOUT a user

### Listing unique numbers
Format: `ВТ-{YYYY}-{id:06d}` (e.g. `ВТ-2026-000001`). Generated on creation, shown on listing detail page.

### User ratings (real, from DB)
- Owner rating = avg of listing reviews on their items
- Renter rating = avg of renter reviews about them
- Combined = weighted avg across both types
Fields exposed in `/api/users/:id`: `rating`, `reviewCount`, `ownerRating`, `ownerReviewCount`, `renterRating`, `renterReviewCount`

### UI Components
- `StarRating` — reusable display + interactive input (size sm/md/lg, hover state)
- `ReviewCard` — shows review (author, date, booking number, stars, text, response)
- Listing detail page: aggregate rating, reviews list, form for eligible renters
- Owner profile: "Отзывы об арендодателе/арендаторе" section with real data
- Dashboard history: "Оценить вещь" (amber) / "Оценить арендатора" (blue) buttons + modal

## Booking Identification & Audit System

### Booking Numbers
Every booking gets a unique human-readable number: `ХТ-{YYYY}-{id:06d}` (e.g. `ХТ-2026-000001`).
- Generated immediately after creation, stored in `bookings.booking_number` (unique)
- Backfilled for all historical bookings
- Shown in Dashboard booking cards (both active and history) with copy-to-clipboard button
- Included in all notification messages

### Audit Trail (`booking_events` table)
Full event log for every booking action:
- `created` — booking was created (by renter)
- `status_changed` — any status transition (who, from, to, when)
- `manager_note` — admin comment for dispute resolution
Fields: `booking_id`, `booking_number`, `actor_id`, `actor_role` (owner/renter/system/admin), `event_type`, `from_status`, `to_status`, `comment`, `created_at`
Indexed on `booking_id`, `booking_number`, `actor_id`, `created_at` for fast lookups.

### Admin API (role=admin only)
- `GET /api/admin/bookings?q=ХТ-2026-000001&status=pending&page=1` — search all bookings
- `GET /api/admin/bookings/:number` — full booking detail + complete audit trail
- `POST /api/admin/bookings/:number/comment` — add manager note to audit trail
- `GET /api/admin/stats` — aggregate stats (total, pending, active, disputed)

## Booking Reminder Scheduler

Located at `artifacts/api-server/src/lib/scheduler.ts`. Runs every hour via `node-cron`. Started in `index.ts` on server boot (also runs once immediately on startup).

**Расписание (Stage 32 полировка, 02.05.2026):**
- **Каждый час:** reminders + auto-transitions + buyout-cancel + promo-cleanup
- **Ежедневно в 03:00:** trust-score-recalc

**Новые cron-функции (Stage 32):**
- `runBuyoutAutoCancel` — отменяет `buyout_requests` в статусе `pending`/`awaiting_payment`, созданные более 24ч назад; шлёт `buyout_request_cancelled` инициатору и участникам.
- `runPromoCleanup` — очищает истёкшие промо-флаги (`isFeatured`, `isUrgent`, `boostedUntil`) в таблице `listingsTable`.
- `runDailyTrustScoreRecalc` — ежесуточный пересчёт `trust_score` через `recalcTrustScoreForUsers` для всех незабаненных пользователей.

**8 reminder rules tied to booking dates:**
1. `pending` + created_at > 24h → `reminder_confirm_pending` to **owner** (+ 48h to **renter**)
2a. `confirmed` + startDate = tomorrow + нет check_in акта → `reminder_checkin_soon` to **both** (Stage 22b-followup, 24ч-предупреждение «оформите Цифровой акт»)
2. `confirmed` + startDate = today → `reminder_handover_today` to **both**
3. `confirmed` + startDate < today → `reminder_handover_overdue` to **both** (URGENT ⚠️)
4a. `active` + endDate = tomorrow + нет check_out акта → `reminder_checkout_soon` to **both** (Stage 22b-followup, 24ч-предупреждение «оформите акт возврата»)
4. `active` + endDate = today → `reminder_return_today` to **both**
5. `active` + endDate < today → `reminder_return_overdue` to **both** (URGENT 🚨)
6. `return_pending` + 48h since `booking_return_pending` notif → `reminder_return_confirm` to **both**

**Deduplication:** Before sending, checks `notifications` table for existing (bookingId + type + userId). Never sends the same reminder twice.

**Frontend integration:**
- All `reminder_*` types counted in `badgeIncoming` + `badgeOutgoing` sidebar badges
- Reminders cleared ONLY on explicit tab click (not on initial page load)
- Notification click routes to `/dashboard` for all reminder types

## Agent Rules (обязательно выполнять)

- **Язык общения**: всегда отвечать на русском
- **Git push**: после каждой успешной итерации работы ОБЯЗАТЕЛЬНО выполнять `bash scripts/github-push.sh "описание"` — проект должен быть актуален на GitHub для деплоя через Amvera
- Если `git add/commit` блокируется Replit (index.lock), скрипт всё равно пушит последний checkpoint-коммит
- Деплой: GitHub `main` → Amvera webhook → Docker build
- ⚠️ **КРИТИЧНО — `vite.config.ts`**: `PORT` и `BASE_PATH` должны быть **опциональными** с fallback-значениями (`?? "5000"` / `?? "/"`). Нельзя делать `throw new Error` при их отсутствии — Docker-сборка Amvera запускает `vite build` без этих переменных, они передаются только при старте контейнера. Dev-workflow передаёт `PORT=5000 BASE_PATH=/` явно, поэтому в разработке всё работает как прежде.
- ⚠️ **КРИТИЧНО — API Server rebuild**: воркфлоу `API Server` запускает **pre-built** `./dist/index.mjs` и НЕ пересобирает код автоматически. После ЛЮБОГО изменения в `artifacts/api-server/src/` обязательно:
  ```bash
  cd artifacts/api-server && node build.mjs
  ```
  затем `restart_workflow "API Server"`. Без этого изменения в бэкенде не вступают в силу.
- **Кодоген** (после правок `lib/api-spec/openapi.yaml`): `pnpm --filter @workspace/api-spec run codegen` → обновляет `lib/api-client-react/src/generated/` и `lib/api-zod/src/generated/`.

## SEO-хук (`useDocumentMeta`)

Создан в `artifacts/hochu-to/src/lib/use-document-meta.ts`. Устанавливает `document.title`, `<meta name="description">` и полный набор OG/Twitter-тегов для каждой страницы. Автоматически сбрасывает title при размонтировании.

**Применён к страницам (Stage 32 полировка, 02.05.2026):**
| Страница | title | noindex |
|---|---|---|
| Home | "Аренда вещей рядом с вами" | — |
| Catalog | "Каталог аренды" | — |
| ListingDetail | динамически = `listing.title` + город + цена + первое фото как og:image | — |
| About | "О нас" | — |
| Contacts | "Контакты" | — |
| How-to-rent | "Как арендовать вещь" | — |
| How-to-list | "Как сдать вещь в аренду" | — |
| Guarantee-fund | "Гарантийный фонд" | — |
| Privacy | "Политика конфиденциальности" | ✅ |
| Terms | "Пользовательское соглашение" | ✅ |

### ⚠️ КРИТИЧНО: Ветки Amvera

| Где | Ветка |
|-----|-------|
| Replit / GitHub | `main` |
| Amvera git repo (`git.msk0.amvera.ru`) | `master` |
| Amvera webhook (слушает GitHub) | `main` |

**Это разные ветки!** Amvera держит свой git-репозиторий на ветке `master`, но webhook настроен слушать GitHub `main`. При прямом push в Amvera нужно указывать `main:master`.

- **GitHub push (основной деплой):**
  ```bash
  git push "https://pdkiller666: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@github.com/pdkiller666/Hochu_to.git" main
  ```
  Amvera получает webhook от GitHub и запускает пересборку Docker.

- **Прямой push в Amvera (если webhook не сработал):**
  ```bash
  git push "https://pdkiller666:4_5AznCgvidfr5x@git.msk0.amvera.ru/pdkiller666/hocuto" main:master
  ```
- **Оба сразу** (рекомендуется):
  ```bash
  git push "https://pdkiller666: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@github.com/pdkiller666/Hochu_to.git" main && \
  git push "https://pdkiller666:4_5AznCgvidfr5x@git.msk0.amvera.ru/pdkiller666/hocuto" main:master
  ```
- **Документация — синхронно с пушем**: на каждой итерации обновлять оба файла:
  - `docs/AGENT_INSTRUCTIONS.md` — добавлять блок «Журнал — Stage X» (что сделано, какие схемы/эндпоинты/UI, какие миграции, что проверено).
  - `replit.md` — обновлять разделы `API Routes`, `Database Schema`, `Project Checklist` (✅ / 🟡 / 🔴) так, чтобы карта проекта всегда отражала реальность.
  - Эти правки идут в **тот же** коммит, что и код этапа.

### Жёсткие платформенные ограничения Replit-агента (28.04.2026)

Эти лимиты вылезли при отладке Stage 30D–30G — фиксирую, чтобы будущие итерации не упирались в них повторно:

- **Все git-команды заблокированы из агента** — даже read-only (`git status`, `git log`, `git ls-remote`). Платформа отвечает `PROHIBITED_ACTION` и упирается в `.git/index.lock`. Сверять состояние с GitHub нужно вручную в Shell:
  ```bash
  rm -f .git/index.lock && git fetch origin && git log --oneline origin/main -3 && echo "---LOCAL---" && git log --oneline HEAD -3
  ```
  Совпадение SHA в обоих блоках = всё запушено.
- **`.replit` редактировать напрямую нельзя** — платформа управляет им через скиллы (`workflows`, package management). Менять воркфлоу надо через `configureWorkflow`/`removeWorkflow` в code_execution.
- **Артефакт-воркфлоу нельзя удалить из агента** — `removeWorkflow` отвечает `PROHIBITED_ACTION: managed by an artifact`. На текущий момент висят три неудаляемых дубля (`artifacts/api-server: API Server`, `artifacts/hochu-to: web`, `artifacts/mockup-sandbox: Component Preview Server`). На функциональность не влияют — реальный dev-запуск идёт через легаси-воркфлоу `Start application` (API:8080 + фронт:5000). Удалить можно только из UI Replit вручную.
- **GitHub-токен в env агента не проброшен** — `GITHUB_TOKEN`/`GITHUB_PERSONAL_ACCESS_TOKEN` доступны только в пользовательской shell-сессии (где работает push-скрипт). Из агента нельзя дёргать GitHub API даже для чтения приватного репо.

### AI Gateway — критические нюансы (НЕ регрессировать)

Эти константы и хедеры вылезли через серию production-ошибок (Stage 30D/E/G). Любые правки в `artifacts/api-server/src/lib/ai-service.ts` обязаны их сохранять:

- **Amvera LLaMA** — endpoint `https://kong-proxy.yc.amvera.ru/api/v1/models/llama`, модель `llama8b`:
  - Хедер авторизации: `X-Auth-Token: Bearer ${token}` (НЕ стандартный `Authorization`). Попытка перейти на `Authorization` ловит HTTP 401 с `"status":"ALTERNATIVE_STATUS_FINAL"`.
  - Сообщения: поле `text` (НЕ `content`, как у OpenAI/Gemini).
- **Gemini** — endpoint `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`:
  - Ключ передаётся в query-параметре `?key=` (НЕ хедером `X-goog-api-key` — на v1beta даёт 401).
  - `GEMINI_MODEL = "gemini-flash-latest"` (НЕ пиннить на `gemini-1.5-flash` — Google вычистил этот алиас из v1beta, прилетит 404).
- **`.trim()` на env-ключах обязателен** во всех 4 точках (`generateAmvera`, `generateGemini`, `bulletsAmvera`, `bulletsGemini`):
  ```ts
  const token = process.env.AMVERA_API_TOKEN?.trim();
  ```
  Хвостовой `\n` в Amvera-консоли — типичная причина «загадочных» 401.
- **Smart-mock fallback** должен оставаться в каждом из 4 методов: при сбое реального провайдера сервис graceful-fallback'ит в mock и возвращает `{actualProvider:"mock", fallback:true, fallbackReason}` — это спасает от 500 на проде, когда LLM лежит.
- **Инфографика — жёсткий лимит длины буллета**: ≤ 32 символа (делится на 2 строки по ≤16). `BULLET_MAX_CHARS=16` в `image-service.ts`, парсер обрезает по слову. Любое расширение лимита сломает SVG-вёрстку 1080×1080.
- **Стартовая диагностика** в `index.ts` логирует `exists: true/false` и `length: <N>` для `GEMINI_API_KEY`/`AMVERA_API_TOKEN` — НИКОГДА не логировать сами ключи, даже частично. Эталонная длина Google API key = 39 символов; если `length: 40+` — где-то в env прилетел `\n`.

## Financial Model — Dual Shield (v2)

Реализована в `artifacts/hochu-to/src/lib/utils.ts` и `artifacts/api-server/src/routes/bookings.ts`:

### Категории и множители защиты
| Категория | Множитель (market value) |
|-----------|--------------------------|
| electronics | ×50 |
| tools | ×20 |
| leisure | ×15 |
| special_machinery | ×10 |

### Формулы (на весь период аренды)
```
rent         = pricePerDay × days
shieldFee    = max(5% × rent, 100₽)   // Shield взнос арендатора
serviceFee   = rent × 0.10            // 10% платформа
taxFee       = rent × 0.06            // 6% налог самозанятого
riskCoverage = max(5% × rent, 100₽)   // резерв риска (из выручки владельца)

totalPrice   = rent + shieldFee       // арендатор платит это
ownerPayout  = rent - serviceFee - taxFee - riskCoverage  // владелец получает
depositAmount = pricePerDay × 10      // возвратный залог
maxProtectionLimit = pricePerDay × multiplier  // лимит компенсации
```

### Прямой расчёт (без Shield)
Арендатор платит только 150 ₽ за раскрытие контактов владельца.

### DB-поля (bookings)
- `rent_amount`, `service_fee`, `tax_fee` — комиссии
- `fund_contribution` → riskCoverage (из выручки владельца)
- `renter_fund_contribution` → shieldFee (плата арендатора)
- `owner_payout` — чистая выплата арендодателю (новое поле)
- `deposit_amount`, `protection_enabled`

### Claims (заявки на возмещение, таблица `claims`)
- Тип: `damage` | `theft`
- Статус: `pending → reviewing → approved | rejected → paid`
- Управление: вкладка «Заявки Shield» в AdminPage

## Listing Badges System

Карточка объявления (`ListingCard`) выводит до 3 бейджей в порядке приоритета. Логика в `getListingBadges(listing)`. Те же бейджи (без лимита 3) показываются на детальной странице `/listings/:id` через `getDetailBadges()` + `<BadgeRow />` (Stage 19f).

### Бейджи (приоритет сверху вниз)
| Бейдж | Иконка | Условие | Тип |
|-------|--------|---------|-----|
| **VIP** | Crown (золото) | `isFeatured && featuredUntil > now` | 💰 платный (Stage 18) |
| **Срочно** | Zap (красный) | `isUrgent && urgentUntil > now` | 💰 платный (Stage 18) |
| **Топ** | Sparkles (оранжевый) | `boostedUntil > now` | 💰 платный (Stage 18, только на детальной) |
| **Безопасная сделка** | ShieldCheck (зелёный) | `ownerProtectionEnabled !== false` | 🆓 базовый |
| **Высокий рейтинг** | Star (амбер) | `rating >= 4.5 && reviewCount >= 3` | 🏆 заработанный |
| **Часто берут** | Flame (оранжевый) | `bookingCount >= 10 && rating < 4.5` | 🏆 заработанный (Stage 19b — раньше было `reviewCount >= 10`) |
| **Новинка** | Sparkles (голубой) | `createdAt` ≤ 14 дней | 🏆 заработанный |
| **Проверенный владелец** | Award (фиолетовый) | `ownerIsVerified` | 🏆 заработанный (Stage 19g — ручная верификация админом, бессрочно, без материальных привилегий) |

Поля промо (`is_featured`, `featured_until`, `is_urgent`, `urgent_until`, `boosted_until`) добавлены в `listings` в Stage 18. Денорм-счётчики (`bookingCount`, `reviewCount`, `avgRating`, `favoritesCount`) — в Stage 19e и поддерживаются автоматически (см. ниже).

## Monetization Roadmap (по аналогии с Avito)

### Этап 1 — Платные бейджи (Quick Win)
DB поля в `listings`: `is_featured` (bool), `featured_until` (timestamp), `is_urgent` (bool), `urgent_until` (timestamp).
- **VIP-объявление** — золотой бейдж + приоритет в выдаче на 7/14/30 дней (≈ 199/349/599 ₽)
- **Срочно** — красный бейдж + цвет фона карточки на 3/7 дней (≈ 99/199 ₽)
- Подключается из «Кабинет → Мои объявления → ⚡ Продвинуть»

### Этап 2 — Поднятие в поиске (Boost)
DB поле `boosted_until` (timestamp). Сортировка `?sort=new` уже есть — добавить вторичный ключ `ORDER BY boosted_until DESC NULLS LAST, created_at DESC`.
- **Поднять сейчас** — переносит объявление на 1-ю страницу на 24 часа (≈ 49 ₽)
- **Автоподнятие** — каждые 3 дня в течение 7/14/30 дней
- Эффект: +5–7× просмотров в первые сутки

### Этап 3 — Подписки для владельцев
Таблица `owner_subscriptions`: tier (basic/pro/business), expires_at.
- **Pro** (≈ 499 ₽/мес) — 5 поднятий, 1 VIP, статистика просмотров
- **Бизнес** (≈ 1990 ₽/мес) — безлимит поднятий, 5 VIP, API, баннер «Магазин владельца»

### Этап 4 — Комиссия + Гарантийный фонд
Уже реализовано: 10% сервис + 6% налог + 5% риск-резерв из выручки владельца. Это базовая выручка платформы независимо от продвижения.

### Этап 5 — Партнёрские бейджи
- **Проверенный владелец** — после 5+ закрытых сделок без жалоб (бесплатно, авто)
- **Партнёр платформы** — для юрлиц, договор + комиссия 5% (вместо 10%) + золотой значок

### Управление экономикой и платежами (DONE)
- Таблица `platform_settings` (singleton) — все ставки/цены/настройки шлюзов в БД.
- Сервис `lib/platform-settings.ts` — кэш 60с + write-through инвалидация.
- Публичный `GET /api/settings` (флаги/проценты для клиента) и админский `GET/PUT /api/admin/settings` (полный объект, аудит).
- `routes/bookings.ts` читает ставки из БД при каждом расчёте (через кэш).
- Client `lib/utils.ts` — все функции расчёта принимают опциональный `FeeRates` override (defaults сохранены).
- Admin UI вкладки: **Экономика** (комиссии, Shield, залог, лимиты, продвижение, подписки) и **Платежи** (paymentMode, ЮKassa/СБП/CloudPayments — публичные ID и флаги; секреты только в env).
- Серверная и клиентская валидация: целые ≥0, проценты 0–100, decimals ≥0, enum paymentMode, nullable строки. Изменения применяются глобально в течение TTL.

### Технический план интеграции
1. Миграция: добавить колонки `is_featured`, `featured_until`, `is_urgent`, `urgent_until`, `boosted_until` в `listings`.
2. Серилизатор `routes/listings.ts` отдаёт эти поля.
3. Сортировка `GET /listings` учитывает `featured_until DESC, boosted_until DESC, created_at DESC`.
4. Эндпоинт `POST /listings/:id/promote` с типом услуги — ставит флаг + дату.
5. Заглушка оплаты → ЮKassa интеграция в Этапе 2 общего роадмапа.
6. Админка: вкладка «Продвижение» — список активных VIP/срочных + ручная активация.

## Project Checklist (актуальное состояние)

### ✅ Готово и работает
- **Каркас монорепо** (pnpm + TS + esbuild), артефакты `api-server` + `hochu-to`
- **OpenAPI → Orval кодоген** — единый источник типов (`lib/api-spec` → `api-zod` + `api-client-react`); enum `itemCategory` синхронен на всех слоях (4 категории)
- **Аутентификация**: register/login/logout/me, JWT-like, bcrypt, сессии в БД
- **Роли**: renter / owner / admin; переключение ренты↔владельца в профиле
- **Каталог + поиск**: фильтры (категория/регион/цена/sort), URL-синхронизация, мобильный sticky search
- **Карточка объявления (ListingDetail)**: галерея, бейджи, бронирование, отзывы, чат, мотивационные тексты выгод для арендатора и владельца (escrow / фонд / арбитраж)
- **Создание/редактирование объявлений** с автоматическим расчётом `maxProtectionLimit`, флагом ручной модерации (аномальная цена)
- **Бронирования**: полный поток pending→confirmed→active→return_pending→completed, отмены/отказы, история, нумерация `ХТ-YYYY-NNNNNN`
- **Финансовая модель Dual Shield** (см. ниже): множители, Shield Fee, риск-резерв, ownerPayout — все ставки в `platform_settings`, кэш 60с
- **Админка (7+ вкладок)**: Обзор+аналитика, Пользователи, Объявления, Бронирования, Поддержка, Жалобы, Аудит, **Экономика** (множители фонда, комиссии, Shield), **Платежи** (paymentMode, шлюзы), **Заявки Shield** (claims), **Telegram** (статус бота, env, broadcast — Stage 38)
- **Отзывы (двусторонние)**: listing-review + renter-review с привязкой к завершённой брони, ответ от рецензируемой стороны
- **Чат по бронированию** (`booking_messages`): уведомления о новых сообщениях, бейджи unread
- **Уведомления**: in-app + scheduler с 6 правилами напоминаний (cron каждый час) + **Telegram-диспетч (Stage 38)**: `createNotification()` fire-and-forget отправляет в Telegram по категории (bookings/system/chats), с учётом preferences пользователя и dev-фильтра
- **Аудит-trail брони** (`booking_events`) с поиском админа по номеру `ХТ-…`
- **Маркетинговые карусели на главной** (4 шт: хиты / новинки / рейтинг / выгодные)
- **Бейджи объявлений** (VIP / Срочно / Безопасная сделка / Высокий рейтинг / Часто берут / Новинка / Проверенный)
- **Избранное** (`favorites`)
- **Поддержка** (тикеты с категорией и перепиской)
- **Жалобы** (reports) — на объявления и пользователей
- **Совместные закупки** (заявки + страница)
- **Co-Sharing / Pools (CS-1–CS-6, 21.05.2026):** полный модуль совместного владения вещами. CS-1: SBP-deeplink в ContributeBlock, auth-гейт в PoolCreate, UI-полировка. CS-2: уведомления `pool_share_confirmed` + `pool_active`. CS-3: таб «Мои пулы» в Dashboard (GET /pools/mine + PoolsDashboardSection). CS-4: `PoolCalendarBlock` в PoolDetail — занятые даты из `/unavailable-dates` + имя хранителя. CS-5: при ликвидации пула устанавливается `isAvailable=true` для листинга. CS-6: `payoutPoolShareholders` гейтован `isCommercialMode=true`; тип `pool_rental_income` добавлен в `/me/finance` journal из `wallet_transactions`.
- **GeoIP** для авто-выбора региона
- **Health endpoint + Vite proxy** для dev
- **Деплой**: GitHub → Amvera (прямой git push), пуш через `bash scripts/github-push.sh` + `git push amvera main`
- **Prod-Fix-1 (02.05.2026) — sharp в prod-зависимостях**: `sharp` добавлен в `artifacts/api-server/package.json` `dependencies` (ранее был только в lockfile → при `pnpm install --prod` в Dockerfile не устанавливался → `ERR_MODULE_NOT_FOUND` на эндпоинте `/api/ai/generate-infographic`). `sharp` добавлен в `onlyBuiltDependencies` в `pnpm-workspace.yaml` (нативные бинарники собираются при install). Задеплоено на Amvera 02.05.2026.
- **Stage 17a — Payout Requests**: реквизиты карты/СБП, очередь заявок владельцев на вывод, ручной mark-paid с проставлением `payoutSettledAt` на бронях.
- **Stage 17b-core — Compensation Payouts**: claims расширены реквизитами получателя, админский поток approve→mark-paid→reject, кнопка «Подать претензию» на завершённой Premium-броне в Dashboard.
- **Stage 17b-limits — Анти-фрод фонда**: настройки `fundReserveRatioPct/maxClaimAmountSingleRub/maxClaimsPerUserMonth/maxClaimAmountPerListingPct`, проверки на POST/approve/mark-paid, расширенные KPI-карточки (Поступило/Выплачено/Баланс/Резерв/К выплате).
- **Stage 17c — Аналитика фонда**: `GET /api/claims/analytics`, в админке lazy-блок с LineChart баланса по дням, топ-получателями и флагами подозрительных паттернов.
- **Stage 17d — E2E-отладка перед деплоем**: 67 сценариев за все роли, RBAC по 6 admin-эндпоинтам, полный цикл брони, бан/анбан, лимиты claims. Исправлен P0-баг: analytics-SQL ссылался на несуществующее `bookings.updatedAt` → заменено на `COALESCE(payout_settled_at, created_at)`.
- **Тестовые данные для обкатки**: `POST /api/admin/seed-test-listings` (admin) — доливает по 15 объявлений в каждую из 10 категорий с фото-ссылками picsum.photos (детерминированные seed). Идемпотентно: пометка `[seed-test]` в описании; повторный вызов не дублирует. Для прода скрипт `scripts/seed-test-listings-amvera.sh https://домен.amvera.io [N]`.
- **Stage 18 — Платное продвижение**: добавлены колонки `is_featured/featured_until/is_urgent/urgent_until/boosted_until` в `listings` + таблица `listing_promotions` (журнал покупок). Маршруты `/api/promotions/pricing|listings/:id|me|admin`, цены берутся из `platform_settings` (VIP 199/349/599₽, Срочно 99/199₽, Boost 49₽). Каталог `/api/listings` сортируется VIP→Срочно→Boost→createdAt; продление включено (если *Until > now — добавляем дни поверх). UI: модалка `PromoteListingModal` + кнопка «Продвигать» на карточках Dashboard, бейджи VIP/Срочно/Топ. E2E: 12/13 ранее + 11/11 после фикса полей в API-выдаче.
- **Stage 19a — Промо во всех каруселях**: префикс `promoOrder = [VIP активный DESC, Срочно активный DESC, Boost активный DESC]` добавлен **во все** ветки сортировки `/api/listings`: `new`, `price_asc`, `price_desc`, `protected_first`, дефолт. Для JS-сортировок `rating` и `popular` добавлен `promoTier(l)` (3=VIP/2=Срочно/1=Boost/0=обычный) — компаратор сначала сравнивает тир, потом обычные критерии. В итоге оплаченное продвижение поднимается в топ блоков «Хиты», «Новинки», «Высокий рейтинг», «Выгодные предложения» — а не только в дефолтной выдаче. Smoke: VIP+Срочно объявление (rating=0) поднимается выше объявлений с rating=5 при `sort=popular`.
- **Stage 19d — Порог качества «Новинок»**: `/api/listings` принимает `?quality=true` — добавляет в WHERE `array_length(photos)≥1` и `char_length(description)≥50`. Карусель «Новинки» на главной передаёт `quality` (через `<ListingCarouselSection quality />`); каталог по умолчанию не фильтрует, чтобы пользователь видел всё. Проверка: без флага 7/20 «новинок» дефектные (нет фото или короткое описание), с флагом — 0/20.
- **Stage 19e — Денормализация счётчиков объявлений**: в `listings` добавлены 4 колонки — `bookingCount`, `reviewCount`, `avgRating numeric(3,2)`, `favoritesCount`. Заполняются идемпотентным backfill-ом на старте (через `NOT EXISTS`, безопасно к NULL). Поддерживаются в коде: bookings — атомарным `UPDATE WHERE id AND status` + `bookingCountDelta(from,to)` (защита от race conditions с 409); reviews — `recomputeListingRating()` после insert; favorites — `applyFavoritesCountDelta()` только когда строка реально создалась/удалилась. **Убраны N+1 sub-queries** в `/api/listings` (main query и fallback «других регионов»), `sort=popular`/`rating` переписаны на чистый SQL: `popular` → `…promoOrder, bookingCount DESC, avgRating DESC`; `rating` → `…promoOrder, avgRating DESC, reviewCount DESC`. Запрос `/api/listings?sort=popular&limit=12` теперь делает 2 SQL вместо 1 + 12*2 = 25.
- **Stage 19b — Бейдж «Часто берут» по броням**: `ListingCard.tsx` теперь использует `bookingCount >= 10 && rating < 4.5` вместо `reviewCount >= 10` — визуальный сигнал синхронизирован с реальной популярностью, а не с активностью отзывов.
- **Stage 19f — Бейджи и кнопка «Продвигать» на детальной карточке**: страница `/listings/:id` теперь показывает те же промо-бейджи, что и каталог (VIP/Срочно/Топ/«Часто берут») в обеих версиях заголовка (мобильной и десктопной). Владелец, открывший своё объявление по ссылке из каталога, видит в правом сайдбаре кнопку «Продвигать объявление», которая открывает существующий `<PromoteListingModal />` (тот же, что в Dashboard). Серверных правок не потребовалось — Stage 19c уже отдаёт `isFeatured/isUrgent/boostedUntil/bookingCount` на детальном эндпоинте.
- **Stage 19g — MVP «Проверенный владелец» (Trust & Verification V1–V5)**: ручная верификация админом, бессрочно, без материальных привилегий. Схема — 6 новых полей в `users` (`is_verified`, `verified_at`, `verified_by_admin_id`, `verification_note`, `trust_score`, `trust_score_updated_at`); поля Trust Score заложены сейчас, чтобы V6–V8 не требовали миграций. API — `PATCH /api/admin/users/:id` принимает `isVerified+verificationNote` (auto-set `verifiedAt` и `verifiedByAdminId`, audit `verify_user`/`unverify_user`); `GET /api/listings`, `/api/listings/:id` и fallback `otherRegions` отдают `ownerIsVerified` (JOIN); `formatUser` отдаёт `isVerified+verifiedAt`; `POST /api/support/tickets` разрешает категорию `verification_request` + 409 если уже есть открытая заявка. **Race-protection:** partial unique index `support_tickets_verification_singleton_idx` UNIQUE на `(user_id) WHERE category='verification_request' AND status IN ('open','in_progress')` + обработка `23505` в маршруте — гарантирует, что 5 параллельных POST создадут ровно 1 тикет (проверено). UI — бейдж «Проверен» (Award/violet) теперь рендерится по `ownerIsVerified` в `ListingCard`/`ListingDetail`/`OwnerProfile`; админ-toggle в `AdminPage` (UserDetailPanel); владелец в Dashboard (таб «Профиль») видит блок верификации с кнопкой «Подать заявку» и модалкой (textarea + инструкции что приложить). Trust Score (V6–V8) отложен до 100+ сделок и 50+ владельцев.
- **Stage 20c — Поля ЮKassa в админке (подготовка к подключению)**: добавлено поле `yookassa_secret_key text` в `platform_settings` (колонка nullable, ENV `YOOKASSA_SECRET_KEY` будет иметь приоритет в коде клиента ЮKassa когда подключим). PUT `/api/admin/settings` принимает `yookassaSecretKey` (через `NULLABLE_STR_FIELDS`, длина ≤ 255, пустая строка → null). UI на вкладке «Платежи» — блок ЮKassa расширен: ссылка на личный кабинет ЮKassa с инструкцией где взять ключи (Магазины → Интеграция → API ключи), `Shop ID` (text, плейсхолдер «123456»), новый `Secret Key` (`type=password`, моноширинный, autoComplete=off, плейсхолдер `test_…`), переключатель «Тестовый режим». Жёлтое предупреждение «⚠ Включено без полных реквизитов — оплаты не пройдут», если `yookassaEnabled=true` но один из ключей пуст. Старая плашка «Секреты не редактируются» заменена на стоун-блок с пометкой «в продакшене ENV приоритетнее БД». **Защита от утечки**: `publicSettings(s)` явно whitelist'ит поля → `yookassaSecretKey` не попадает в `GET /api/settings` (без auth). Smoke: GET admin → видит ключ, PUT admin → сохраняет, GET public → `leak: false`.
- **Stage 20b — Полировка СБП-выплат**: без подключения внешних провайдеров. Создан `lib/sbp-banks.ts` (одинаковый на бэке и фронте) — `SBP_BANKS` whitelist (25 банков с slug-id `tbank/sber/vtb/...`), `normalizeSbpPhone()` (89XX/79XX/+79XX/с пробелами → каноничный `+7XXXXXXXXXX`, только мобильные 9XX), `getSbpBankName()` (slug → читаемое имя, backward-compat для старых snapshot'ов). `validateMethod()` в `payouts.ts` для SBP теперь использует helper'ы — городские/иностранные номера отвергаются с 400. `POST /me/payout-methods` ловит `cause?.code === '23505'` (drizzle 0.45 оборачивает pg-error в `DrizzleQueryError` → реальный код в `cause.code`!) → 409 `duplicate_method` с русским сообщением. Schema — 2 partial unique indexes: `payout_methods_sbp_unique_idx (user_id, sbp_phone, sbp_bank) WHERE type='sbp'` и `payout_methods_card_unique_idx (user_id, card_last4, card_holder_name) WHERE type='card'` — защита от race на дубль реквизита у одного user'а. Frontend — модалка `AddPayoutMethodModal` теперь имеет маску телефона `+7 (9XX) XXX-XX-XX` (formatPhoneMask на onChange), `<select>` банков вместо текстового поля, pre-submit валидация. Все 3 места отображения `m.sbpBank` (Dashboard) + 1 место (AdminPage `claim.methodSnapshot.sbpBank`) обёрнуты в `getSbpBankName()`. **Бонус-фикс**: `support.ts` (Stage 19g) тоже использовал `e?.code` без `cause` — скрытый баг под drizzle 0.45, исправлен заодно. Existing record (id=2, `sbp_bank='Тинькофф'`) одноразово мигрирован UPDATE'ом в slug `tbank`. Smoke: городской 495→400, US→400, фейковый банк→400, нормализация 89XX→+79XX→200, дубль через разные форматы того же телефона→409, тот же телефон+другой банк→200 (НЕ дубль), дубль карты по last4+holder→409.
- **Stage 20a — Production hardening (admin-RBAC + индексы + отзыв заявки)**: 3 короткие задачи приоритета 1. (A) Вынес `requireAdmin` в `middleware/auth.ts` — использует `req.userRole` (без повторного SELECT'а), заменил 12 inline-проверок `if (!(await isAdmin(...)))` на middleware в `claims.ts` (7) и `payouts.ts` (4). В `claims.ts` оставлен локальный `isAdmin()` только для `PATCH /:id` (условная admin/user логика). Smoke: owner→403, admin→200. (B) 7 композитных индексов через `pgTable("…", {}, (t) => ({...}))`: `bookings_fund_analytics_idx (status, protection_enabled, payout_settled_at)` для `calcFundBalance`, `bookings_created_at_idx`, `bookings_owner_status_idx`, `bookings_renter_status_idx`, `claims_status_paid_idx`, `claims_claimant_created_idx`, `claims_booking_idx` — применены через `db push`. (C) `PATCH /api/support/tickets/:id/cancel` — владелец тикета может закрыть свой `open`/`in_progress` тикет (ownership-check, 404 чужому, 400 already_closed). Системное сообщение `[Заявка отозвана пользователем]` вставляется в ленту тикета — админ видит в админке. В `Dashboard.tsx` блок верификации стал 3-state (верифицирован/на рассмотрении/нет заявки): `useEffect` грузит pending verification ticket; кнопки «Открыть Поддержку» и «Отозвать заявку» в state «на рассмотрении»; после успешного POST на верификацию (201 или 409) ticketId сразу пишется в state — UI обновляется без F5.
- **Stage 19c — Гибридная метрика «Хитов» + просмотры**: новая таблица `listing_views(listing_id, viewer_key, hour_bucket, created_at)` с UNIQUE-индексом по часу-бакету (защита от накрутки). `viewer_key` — `u:<userId>` для авторизованных, `ip:<X-Forwarded-For>` для гостей; INSERT с `onConflictDoNothing` при каждом GET `/api/listings/:id` (best-effort, не блокирует ответ). `sort=popular` теперь использует hit-score `bookingCount × 5 + reviewCount × 2 + favoritesCount + views_30d` (subquery), что закрывает «холодный старт» для свежих объявлений с просмотрами но без броней. `GET /api/listings/:id` теперь отдаёт все денорм-счётчики (`bookingCount/favoritesCount/avgRating/reviewCount`) + `views30d` — раньше эти поля отдавал только список `/api/listings`. E2E: 4 запроса с одного IP за час → views30d=1 (UNIQUE сработал), запрос с другого IP → +1.

### 🟡 В работе / частично

> 📌 **Stage 32 sync (29.04.2026):** блок очищен от закрытых пунктов. Цифровой Акт (видео/подпись/GPS) полностью закрыт Stage 22b + Stage 22b-followup. Trust Score V6 (формула + триггеры + audit) закрыт Stage 29. ЮKassa-сервер закрыт Stage 21a (для промо). Индексы и Admin-RBAC закрыты Stage 20a. См. секцию «🛑 Сознательно отложено» ниже для всего, что зависит от открытия ИП.

- **Подписки владельцев** (Pro / Бизнес) — спроектированы, не реализованы.
- **СБП/QR-потоки для бронирований** — `paymentMode` есть в `platform_settings`, чекаут-флоу с загрузкой чека и ручным подтверждением админом не собран (бета-режим обходит платежи целиком, см. Stage 21b/21a).
- **Stage 27 followup** — WebSocket/SSE вместо polling для notifications/audit-trail; унификация `bookings`/`claims` через `audit_events`; гендерное склонение в нотификациях.
- **Stage 28 followup** — ~~замена нативного `confirm()` на `AlertDialog` в `BuyoutBlock`~~ (**✅ Stage 33.1.5**); явная кнопка «Отказаться» у participant'а с уведомлением инициатору; авто-cancel зависших buyout-запросов через cron.
- **Stage 29 followup** — ~~V7 (ежесуточный cron-пересчёт TrustScore через `lib/scheduler.ts`)~~ (**✅ Stage 29**); ~~V8 (публичный показ score на карточках/в каталоге)~~ (**✅ Stage 32.1** — `ListingDetail.tsx` и `OwnerProfile.tsx`).
- **Stage 30B followup** — кеш инфографик по `(photoHash, bulletsHash)`, embedded Montserrat/Inter в SVG, шаблоны 1200×630 / 1080×1920, опц. watermark «Хочу_То».

### 🛑 Сознательно отложено (Deferred by Design)

> **Эти треки намеренно не реализуются** до открытия ИП и юридической готовности. Отсутствие кода — не баг и не дыра в roadmap; это архитектурное решение, зафиксированное в `docs/AGENT_INSTRUCTIONS.md § 11d` и в журналах Stage 17a/17b/21a/28.

- **KYC по 152-ФЗ + 115-ФЗ** (паспорт / ОГРН / селфи через сайт) — отложен до открытия ИП и появления защищённого PII-хранилища с шифрованием. Текущая верификация = ручная: пользователь создаёт `support_ticket` с категорией `verification_request`, документы пересылает админу в переписке тикета. Хранение PII в нашей БД сознательно избегается. См. § 11d, пункт «Что НЕ входит в MVP».
- **Stage 24 — Commercial Booking Holds** (двухэтапный платёж ЮKassa с `capture:false` для бронирований и пулов) — отложен до открытия ИП. Серверный клиент уже готов (`lib/yookassa.ts` поддерживает `capture:false`), схема готова (`pool_shares.payment_status='escrow_held'`, `pools.collection_method='platform_escrow'` в `co_sharing.ts`), но `routes/bookings.ts` и `routes/pools.ts` жёстко форсируют бесплатный p2p-СБП в бета-режиме. Активация = переключить `platform_settings.is_commercial_mode=true` после открытия ИП и вынести `// TODO: contact_pack / booking_protection` из `routes/webhooks.ts`.
- **Stage 28 followup — Buyout Escrow** (холд в ЮKassa вместо СБП p2p при выкупе пула + авто-релиз при ликвидации) — зависит от Stage 24.
- **Stage 21b — ЮKassa для покупки контактов** (single / pack10 / unlimited30d) — серверная инфраструктура (вебхук, REST-клиент) готова; подключение зависит от Stage 24.
- **Автоматические выплаты по claims / payout_requests** через ЮKassa Payouts API — нужно ИП. Сейчас админ ставит mark-paid вручную (запись `paymentRef`), Stage 17a/17b закрыли только UI и DB-схему очереди.
- **CloudPayments как второй платёжный шлюз** — поля в `platform_settings` (`cloudpayments_enabled`, `cloudpayments_public_id`) зарезервированы (Stage 20c-style задел), серверной интеграции нет до Stage 24.

### 🔴 Roadmap (не начато)

- Партнёрские договоры с юрлицами (бейдж «Партнёр платформы», 5% комиссии вместо 10%).
- Dokan/WooCommerce multivendor шлюз.
- API для бизнес-подписки.
- **Stage 33.x — AI Video-анализ споров** — следующий этап AI-арбитражора. Видео ≤100МБ из `digital_acts` + промежуточная стадия «AI задаёт уточняющие вопросы участникам» (отложено от Stage 33.0).

### ✅ Закрытые этапы (последние)

- **Co-Sharing CS-1–CS-6** (**✅ 21.05.2026**) — полный аудит и дореализация модуля совместного владения. CS-1: SBP tel:-deeplink + auth-гейт PoolCreate + UI-чипы. CS-2: уведомления `pool_share_confirmed`/`pool_active` в бэкенде. CS-3: GET /pools/mine + Dashboard-таб «Мои пулы» (PoolsDashboardSection). CS-4: PoolCalendarBlock с /unavailable-dates + custodian-индикатор. CS-5: ликвидация пула выставляет `isAvailable=true`. CS-6: phantom-credit гейт (`isCommercialMode`) + `pool_rental_income` в /me/finance.

- **Telegram prod-fix** (**✅ 13.05.2026**) — Отладка Telegram на деплое Amvera. 4 бага: (1) добавлен `.trim()` к токену в `initTelegramBot()` (env с `\n` → 401), (2) `launch({ dropPendingUpdates: true })` + retry 15s при 409 Conflict при рестарте контейнера, (3) исправлен field mismatch в `GET /admin/telegram/status` (`env` → `telegramEnv`), (4) добавлен `botUsername` в `GET /api/telegram/status` — Dashboard показывает кликабельную ссылку `@username` в OTP-инструкциях. Обновлены инварианты в AGENT_INSTRUCTIONS.md. **После деплоя**: задать `TELEGRAM_BOT_TOKEN` в Amvera Variables + AdminPage → Telegram-бот → переключить env Dev → Prod.

- **Stage 38-UE — Universal SMS Adapter** (**✅ 02.05.2026**) — Горячесменный SMS-адаптер с circuit breaker и верификацией телефона.
  - **DB:** `platform_settings` +6 SMS-полей (`sms_enabled`, `sms_provider`, `sms_api_key`, `sms_api_secret`, `sms_sender_name`, `sms_api_url`). `users` +3 полей (`phone_verified`, `phone_otp`, `phone_otp_expires_at`).
  - **SMS Library (`lib/sms/`):** `types.ts` (SmsProvider интерфейс), `mts-exolve.ts` (Bearer-токен, REST), `smsc.ts` (логин/пароль, GET), `stream-telecom.ts` (Basic Auth, REST), `factory.ts` (singleton `initSmsProvider`/`hotSwapSmsProvider`/`getSmsProvider`, `PROVIDER_LABELS`, `PROVIDER_FIELDS` для динамического UI).
  - **Circuit Breaker в `notifications.ts`:** `createNotification()` оборачивает `sendTelegramToUser` в `Promise.race([..., timeout 60s])` — при timeout или ошибке → SMS-fallback на верифицированный телефон пользователя (fire-and-forget).
  - **API `/sms` (auth required):** `POST /send-phone-otp` (OTP 6 цифр, TTL 5 мин, maskedPhone в ответе), `POST /verify-phone-otp` (ставит `phone_verified=true`, очищает OTP), `POST /send-financial-otp` (требует `phone_verified`, операция в тексте SMS), `POST /verify-financial-otp` (однократное использование), `GET /status` (hasPhone, phoneVerified, smsEnabled, hasOtp, otpExpiresAt).
  - **API `/admin/sms` (superadmin):** `GET /status` (smsEnabled, provider, hasApiKey, providerReady), `POST /test-send` (phone → тестовое SMS, аудит-лог).
  - **Hot-swap без перезапуска:** `PUT /admin/settings` с любым из SMS-полей → после сохранения в DB → `hotSwapSmsProvider(key, cfg)` мгновенно применяет новый провайдер.
  - **UI AdminPage — таб «Интеграции»:** toggle smsEnabled, selector провайдера (3 кнопки), динамические поля из `PROVIDER_FIELDS` (eye-toggle для секретов), кнопка «Сохранить и применить», секция тестовой отправки с маскированием телефона.
  - **UI Dashboard:** блок «Верификация телефона (SMS)» — виден только когда `smsEnabled=true`; показывает статус верификации (зелёный бейдж / форма OTP / кнопка отправки). Код вводится в большое mono-поле.
  - **Инициализация при старте:** `index.ts` после Telegram init → читает `ensurePlatformSettings()` → если `smsEnabled && smsApiKey` → `initSmsProvider(providerKey, cfg)`.

- **Stage 38 — Telegram Bot & Notification Engine** (**✅ 02.05.2026, tested 37/37**) — Полноценный Telegram-бот (`@Helper251223_bot`) на Telegraf 4.x.
  - **DB:** `users.telegram_chat_id / telegram_otp / telegram_otp_expires_at / telegram_notifications jsonb`; `platform_settings.telegram_bot_token / telegram_env (dev|prod)`.
  - **Секрет по умолчанию:** `TELEGRAM_BOT_TOKEN` (env) → используется как fallback, если `platform_settings.telegram_bot_token = NULL`. Суперадмин может переопределить токен в AdminPage без перезапуска сервера.
  - **Сервис `lib/telegram.ts`:** `initTelegramBot()` (env-fallback), `startBot()` (Telegraf long-poll + handlers), `handleOtp()` (привязка через `/start <OTP>` или `/link <OTP>`), `sendTelegramToUser()` (с dev-фильтром и preferences), `notifyStaffByRole()`, `broadcastToAll(text, link?, adminId?, role?)` (роль-фильтр, VALID_ROLES whitelist), `getBotStatus()`, `stopBot()`, `hotSwapToken()` (await + автооткат DB при 401), `isValidBroadcastRole()`.
  - **API `/telegram` (auth required):** `POST /generate-otp` (6-цифр, TTL 10 мин, перезаписывает предыдущий), `GET /status` (linked, hasOtp, otpExpiresAt, preferences), `POST /unlink` (идемпотентен), `PATCH /preferences` (Zod-валидация boolean-полей bookings/system/chats).
  - **API `/admin/telegram` (superadmin):** `GET /status` (online, username, env, hasToken), `POST /broadcast` (text, link?, role? — валидация VALID_ROLES → 400 при невалидной роли).
  - **Hot-swap с автооткатом:** `PUT /admin/settings` с новым `telegramBotToken` → await `hotSwapToken()` → если 401 → rollback DB к prevToken → restart с fallback-токеном; `telegramSwap: {ok, username|error}` в ответе API.
  - **Dev-режим (`telegramEnv=dev`):** `sendTelegramToUser` и `broadcastToAll` доставляют сообщения только суперадминам — безопасно для тестовых окружений. Переключается через `PUT /admin/settings {telegramEnv:"prod"}`.
  - **`notifications.ts`:** `createNotification()` теперь fire-and-forget диспетч в Telegram по категории уведомления.
  - **UI Dashboard:** карточка «Telegram-уведомления» — OTP-код с кнопкой «Обновить код», инструкция отправить боту, toggle-переключатели предпочтений, кнопка «Отвязать».
  - **UI AdminPage:** таб «Telegram» — статус бота (🟢/🔴 + @username), env dev/prod, broadcast-форма (текст + опциональный URL + фильтр по роли).
  - **Тест-сьют 37/37 ✅:** контроль доступа (401/403), OTP-цикл, preferences-валидация, unlink-идемпотентность, broadcast-валидация (невалидная роль → 400), hot-swap с откатом, dev-режим, OTP-привязка через DB-симуляцию.
- **Stage 37.1 — Platform Owner Fix** (**✅ 02.05.2026**) — `seedDefaultAdmin()` теперь создаёт/обновляет `admin@hochu.to` с ролью `superadmin` (ранее `admin`). Dashboard `AdminAccountPanel` показывается для `admin || superadmin`. Баннер: «Владелец платформы» для superadmin, «Администратор платформы» для admin.
- **Stage 37 — Staff Profiles & UI Polish** (**✅ 02.05.2026**) — Бейдж «Команда Хочу_То» (sky-500) на публичном профиле владельца и карточке объявления для staff-ролей. Виджет «Служебный статус» в Настройках: роль переведена на рус. (Владелец платформы / Модератор / Арбитр …), цветная граница по роли. Кнопка «Назад» в OwnerProfile: `flex` → `inline-flex` (больше не растягивается на всю ширину). Поле `ownerRole` добавлено в 3 SELECT-блока API listings.
- **Stage 36 — RBAC (Role-Based Access Control)** (**✅ 02.05.2026**) — `requireRole(...allowedRoles)` middleware в `auth.ts`. Гранулярная защита 40+ эндпоинтов: суперадмин (stats/settings/audit/seed), admin+superadmin (users/broadcast), moderator+admin+superadmin (listings/bookings/reports), support+moderator+admin+superadmin (tickets), arbiter+admin+superadmin (claims). Новый `PATCH /admin/users/:id/role` (guard: только суперадмин может назначить роль superadmin). UI: фильтрация табов по роли, цветные бейджи всех 8 ролей, inline `<select>` смены роли в таблице Users, расширенный фильтр ролей.
- **Stage 35b — Soft Delete Account** (**✅ 02.05.2026**) — `DELETE /api/users/me`: проверка активных броней/споров, анонимизация данных, деактивация объявлений, удаление всех сессий. UI: «Опасная зона» в Настройках + модал с подтверждением словом «УДАЛИТЬ». Схема: `userRoleEnum` + KYC-поля.
- **Stage 35 — Mobile Responsiveness Polish** (**✅ 02.05.2026**) — полный аудит мобильной вёрстки. Каталог: `grid-cols-1 sm:…`; ListingCard: `flex-wrap` price+button; AdminPage StatCard responsive; Home hero `text-3xl sm:text-5xl md:…`; ListingDetail sidebar price `text-3xl sm:text-4xl`; PoolDetail amounts responsive.
- **Stage 34 — Real-time WebSockets** (**✅ 02.05.2026**) — `lib/websocket.ts` (WS-сервер, auth timeout 5s, ping/pong 30s, `broadcastToUser`), фронт `use-websocket.ts` (WsProvider, auto-reconnect 4s, `isConnected`). Polling удалён из `Header.tsx` и `Dashboard.tsx`. Индикатор 🟢/🟡 в заголовке чата.
- **Stage 33.0 — AI-Арбитражор (Vision Analysis)** (**✅ 30.04.2026**) — `POST /api/claims/:id/ai-verdict`, Gemini Vision, human-in-the-loop, audit trail в `audit_events`.
- **Stage 33.1 — AI Arbitration Hardening** (**✅ 02.05.2026**) — `GEMINI_VISION_MODEL` через env (дефолт `gemini-flash-latest`), AbortController 15 сек, `ai_verdict_failed`/`ai_verdict_exception` audit-логи.
- **Stage 32.1 — Trust Score V8 публичный** (**✅ 02.05.2026**) — `ownerTrustScore`/`ownerCompletedDealsCount` в `/listings`; виджет в `ListingDetail.tsx` и `OwnerProfile.tsx`.
- **Stage UI-2 — Mobile Header + Clickable Labels** (**✅ 21.05.2026**) — Мобильный хедер переделан с 2-строчного (~114px) на compact single-row (~52px): Logo | Search (flex-1) | Heart+Bell | Burger. Каталог: sticky sidebar сдвинут с `top-[114px]` → `top-[52px]`. `ListingCard`: удалён дублирующий бейдж «Свободно», лейбл категории кликабелен (`/catalog?category=<slug>`), city-чип кликабелен (`/catalog?city=<city>`), регион кликабелен (`/catalog?region=<slug>`). API: добавлены поля `categorySlug` + `regionSlug` во все 3 SELECT-блока `routes/listings.ts`, OpenAPI spec обновлён + codegen перезапущен.


## Журналы этапов (архив)

Детальные журналы этапов 21a–40 (24.04–21.05.2026) перенесены в
[`docs/STAGE_ARCHIVE.md`](docs/STAGE_ARCHIVE.md) для экономии контекста агента.
