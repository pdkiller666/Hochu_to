# Workspace — Хочу_То Rental Marketplace

## Overview

Full-stack rental marketplace "Хочу_То" (I Want That) — a platform for renting items and joint purchases in Russia. Built as a pnpm monorepo with React+Vite frontend and Express API backend.

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
- **Auth**: Simple JWT-like token (base64 encoded), bcryptjs for password hashing

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
- **/guarantee-fund** — Guarantee fund / mutual aid system description
- **/about** — About us
- **/contacts** — Contact form + social links
- **/privacy** — Privacy policy

## API Routes

All routes prefixed with `/api`:
- `GET/POST /auth/register|login|logout|me` — Authentication
- `GET /regions` — Russian cities/regions
- `GET /categories` — Item categories with count
- `GET /listings` — Listings with filters (category, region, price, search, page)
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
- `POST /contact` — Contact form
- `GET /bookings/:id/messages` — Get chat messages for a booking (requires auth, must be owner or renter)
- `POST /bookings/:id/messages` — Send a chat message (body: `{content}`)
- `GET /messages/unread-counts` — Returns unread message counts per booking `{bookingId: count}`
- `GET /me/finance` — Личный финансовый журнал (derived ledger): `{summary, entries[]}` из bookings + contact_purchases. Без миграций.
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

## Database Schema

Tables (`lib/db/src/schema/`):
- `users` — User accounts (role: renter/owner/admin), `ownerProtectionEnabled` (per-user default), rating/reviewCount
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
- `platform_settings` — Singleton: все ставки, цены, paymentMode, ID шлюзов. Анти-фрод фонда (Stage 17b-limits): `fundReserveRatioPct`, `maxClaimAmountSingleRub`, `maxClaimsPerUserMonth`, `maxClaimAmountPerListingPct`.
- `joint_purchases` — Заявки на совместные закупки
- `contacts` — Заявки с формы «Контакты»
- `newsletter` — Подписчики

## Quick Setup (новый Replit-аккаунт)

```bash
bash scripts/setup-new-replit.sh
```
Накатит схему + зальёт снапшот тестовых данных (`scripts/db-snapshots/dev-data.sql`).
Подробности: `docs/AGENT_INSTRUCTIONS.md` раздел 5a.
Обязательный секрет: `SESSION_SECRET` (≥32 символов). `DATABASE_URL` — auto.

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

**Mobile (<md):** Two-row layout — row 1: Logo + Heart/Bell icons + Burger; row 2: full-width Search bar (always visible while scrolling). Total height ~114px.

**Search behavior:**
- Submitting navigates to `/catalog?search=<query>` while preserving other URL params (region, category)
- Header search input syncs with URL `?search=` on every route change (so opening `/catalog?search=дрель` pre-fills the input)
- The `HeaderSearchBar` is a stable component declared outside `Header()` so React preserves the input DOM node — mobile keyboards do NOT close after each character

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

**6 reminder rules tied to booking dates:**
1. `pending` + created_at > 24h → `reminder_confirm_pending` to **owner** (+ 48h to **renter**)
2. `confirmed` + startDate = today → `reminder_handover_today` to **both**
3. `confirmed` + startDate < today → `reminder_handover_overdue` to **both** (URGENT ⚠️)
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
- Деплой: GitHub webhook → Amvera (Docker)
- **Документация — синхронно с пушем**: на каждой итерации обновлять оба файла:
  - `docs/AGENT_INSTRUCTIONS.md` — добавлять блок «Журнал — Stage X» (что сделано, какие схемы/эндпоинты/UI, какие миграции, что проверено).
  - `replit.md` — обновлять разделы `API Routes`, `Database Schema`, `Project Checklist` (✅ / 🟡 / 🔴) так, чтобы карта проекта всегда отражала реальность.
  - Эти правки идут в **тот же** коммит, что и код этапа.

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

Карточка объявления (`ListingCard`) выводит до 3 бейджей в порядке приоритета. Логика в `getListingBadges(listing)`.

### Бейджи (приоритет сверху вниз)
| Бейдж | Иконка | Условие | Тип |
|-------|--------|---------|-----|
| **VIP** | Crown (золото) | `isFeatured && featuredUntil > now` | 💰 платный |
| **Срочно** | Zap (красный) | `isUrgent && urgentUntil > now` | 💰 платный |
| **Безопасная сделка** | ShieldCheck (зелёный) | `ownerProtectionEnabled !== false` | 🆓 базовый |
| **Высокий рейтинг** | Star (амбер) | `rating >= 4.5 && reviewCount >= 3` | 🏆 заработанный |
| **Часто берут** | Flame (оранжевый) | `reviewCount >= 10 && rating < 4.5` | 🏆 заработанный |
| **Новинка** | Sparkles (голубой) | `createdAt` ≤ 14 дней | 🏆 заработанный |
| **Проверенный владелец** | Award (фиолетовый) | `ownerVerified` (моеделирует) | 🏆 заработанный |

Поля `isFeatured`, `featuredUntil`, `isUrgent`, `urgentUntil`, `ownerVerified` ещё не в схеме — будут добавлены вместе с монетизацией.

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
- **Админка (7+ вкладок)**: Обзор+аналитика, Пользователи, Объявления, Бронирования, Поддержка, Жалобы, Аудит, **Экономика** (множители фонда, комиссии, Shield), **Платежи** (paymentMode, шлюзы), **Заявки Shield** (claims)
- **Отзывы (двусторонние)**: listing-review + renter-review с привязкой к завершённой брони, ответ от рецензируемой стороны
- **Чат по бронированию** (`booking_messages`): уведомления о новых сообщениях, бейджи unread
- **Уведомления**: in-app + sсheduler с 6 правилами напоминаний (cron каждый час)
- **Аудит-trail брони** (`booking_events`) с поиском админа по номеру `ХТ-…`
- **Маркетинговые карусели на главной** (4 шт: хиты / новинки / рейтинг / выгодные)
- **Бейджи объявлений** (VIP / Срочно / Безопасная сделка / Высокий рейтинг / Часто берут / Новинка / Проверенный)
- **Избранное** (`favorites`)
- **Поддержка** (тикеты с категорией и перепиской)
- **Жалобы** (reports) — на объявления и пользователей
- **Совместные закупки** (заявки + страница)
- **GeoIP** для авто-выбора региона
- **Health endpoint + Vite proxy** для dev
- **Деплой**: GitHub → Amvera webhook (Docker), пуш через `bash scripts/github-push.sh`
- **Stage 17a — Payout Requests**: реквизиты карты/СБП, очередь заявок владельцев на вывод, ручной mark-paid с проставлением `payoutSettledAt` на бронях.
- **Stage 17b-core — Compensation Payouts**: claims расширены реквизитами получателя, админский поток approve→mark-paid→reject, кнопка «Подать претензию» на завершённой Premium-броне в Dashboard.
- **Stage 17b-limits — Анти-фрод фонда**: настройки `fundReserveRatioPct/maxClaimAmountSingleRub/maxClaimsPerUserMonth/maxClaimAmountPerListingPct`, проверки на POST/approve/mark-paid, расширенные KPI-карточки (Поступило/Выплачено/Баланс/Резерв/К выплате).
- **Stage 17c — Аналитика фонда**: `GET /api/claims/analytics`, в админке lazy-блок с LineChart баланса по дням, топ-получателями и флагами подозрительных паттернов.
- **Stage 17d — E2E-отладка перед деплоем**: 67 сценариев за все роли, RBAC по 6 admin-эндпоинтам, полный цикл брони, бан/анбан, лимиты claims. Исправлен P0-баг: analytics-SQL ссылался на несуществующее `bookings.updatedAt` → заменено на `COALESCE(payout_settled_at, created_at)`.

### 🟡 В работе / частично
- **Платное продвижение**: схема бейджей готова, но колонки `is_featured / featured_until / is_urgent / urgent_until / boosted_until` ещё не в `listings`
- **Подписки владельцев** (Pro / Бизнес) — спроектированы, не реализованы
- **Цифровой Акт check-in/check-out** (фото + видео + GPS) — не начато
- **СБП/QR + загрузка чека + подтверждение админом** — `paymentMode` есть, потока нет
- **ЮKassa / CloudPayments интеграция** — публичные ID настраиваются в админке, серверной интеграции нет
- **Trust Score** — не начато
- **Реальные банковские выплаты по claims/payout_requests** — пока mark-paid вручную админом (запись `paymentRef`); автомат через банковский API/ЮKassa Payouts не реализован
- **Индексы для аналитики**: рекомендуется добавить `bookings(status, protection_enabled, payout_settled_at)`, `claims(status, paid_at)`, `claims(claimant_id, created_at)` — не критично на текущем объёме, но даст ощутимый эффект на проде.
- **Admin-RBAC через middleware**: сейчас в каждом admin-хендлере ручной `await isAdmin(req.userId)`; стоит вынести в `requireAdmin` middleware.

### 🔴 Roadmap (не начато)
- Партнёрские договоры с юрлицами (бейдж «Партнёр платформы», 5% комиссии)
- Dokan/WooCommerce multivendor шлюз
- API для бизнес-подписки

## What Is NOT Yet Implemented (roadmap)

- Цифровой Акт check-in/check-out (4 фото + видео + GPS)
- Поток оплаты через СБП/QR + загрузка чека + подтверждение админом
- Реальные выплаты из Shield-фонда (сейчас только статус)
- ЮKassa-интеграция (Этап 2)
- Trust Score (Этап 3)

## Future Scaling

- Dokan/WooCommerce plugin readiness — multivendor architecture via owner roles
- MotoPress Calendar integration ready (booking calendar in place)
- Payment gateway hooks ready (total_price calculated at booking)
- SEO: unique title/meta per page, Russian-language content
 