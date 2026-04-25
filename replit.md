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

## Система безопасности «Стальной Щит»

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

> Статус (Stage 22a hardening 25.04.2026 + Stage 22b 25.04.2026): таблица `digital_acts` + endpoints `GET/POST /api/bookings/:id/digital-acts` + блокировка перехода `confirmed → active` без check_in акта (409 `digital_act_required`) + обязательная подпись (400 `signature_required`) + UI в Dashboard и AdminPage с картой и подписью. Регрессия Stage 22a: 31/31, Stage 22b: 5/5 веток валидации подписи. Дальше: видео-аплоад, авто-предложение акта при подходе даты передачи/возврата.

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

**Обязательные секреты:**
- `SESSION_SECRET` — ≥32 символа (`openssl rand -hex 32`)
- `DATABASE_URL` — Replit ставит автоматически

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
- **Подписки владельцев** (Pro / Бизнес) — спроектированы, не реализованы
- **Цифровой Акт check-in/check-out** — Stage 22a каркас готов: блокирующий check_in перед `active`, UI в Dashboard, видимость в админке. Доделать: видео-аплоад, GPS-pin на карте, цифровая подпись сторон.
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

## Stage 21a — Soft Launch Toggle (24.04.2026)

Подготовка к публичному бета-запуску. Введён master-тумблер `is_commercial_mode`
в `platform_settings` (default `false`). Все пользовательские флоу (бронирования,
claims, отзывы, акты, чаты) **визуально не изменились**, но переопределены на уровне
финансовой математики и платёжных шлюзов:

- **Бета-режим (`isCommercialMode = false`, по умолчанию)**:
  - В `routes/bookings.ts` (создание + смена дат) `serviceFee/taxFee/fundContribution/renterFundContribution = 0`. UI продолжает показывать опции защиты, но «0 ₽».
  - В `routes/contacts.ts` (`POST /listings/:id/contact-purchase`) — мгновенный bypass-unlock с `source: "beta_free"` и сообщением «В рамках бета-теста открытие контактов бесплатно!».
  - В `routes/promotions.ts` — мок-флоу: продвижение активируется мгновенно, в `payments` записывается `provider: "mock", status: "succeeded", amountRub: 0`.
  - На фронте — глобальный sticky-баннер `BetaBanner.tsx` (закрывается на сутки через localStorage), скрыт на `/admin`.
- **Коммерческий режим (`isCommercialMode = true`)**:
  - В `routes/promotions.ts` — реальный платёж через ЮKassa: создаётся pending-промо, через `lib/yookassa.ts` вызывается `POST /v3/payments` (Idempotence-Key, Basic auth, returnUrl). Активация флагов VIP/Срочно/Boost — только по успешному webhook.
  - `POST /api/webhooks/yookassa` верифицирует событие через GET /payments/:id, обновляет `payments.status`, активирует target_type=`promotion`. Идемпотентен по `yookassa_payment_id`.
  - Реквизиты ЮKassa берутся из ENV (`YOOKASSA_SHOP_ID`/`YOOKASSA_SECRET_KEY` приоритетно) или из `platform_settings` (заполняется в админке).

Новые сущности:
- Колонка `platform_settings.is_commercial_mode boolean default false`.
- Таблица `payments` (id, user_id, amount_rub, status, yookassa_payment_id UNIQUE, target_type, target_id, provider, idempotency_key, metadata jsonb, paid_at, timestamps).
- `lib/yookassa.ts` — REST-клиент: `createPayment` (capture default `true`, опция `false` для будущих холдов броней), `getPayment`, `capturePayment`, `cancelPayment`, `verifyWebhookSignature`.
- В админке: блок «Коммерческий режим (ИП + ЮKassa)» в табе «Платежи» с предупреждениями.

## Stage 21b — Бета-дисклеймеры (24.04.2026 вечер)

Чтобы пользователи в бета-режиме (`is_commercial_mode=false`) понимали, что:
- В чекауте брони деньги не списываются: под блоком «Итого к оплате» в `ListingDetail.tsx` добавлен info-блок (читает `publicSettings.isCommercialMode`).
- Компенсации по `claims` обрабатываются вручную: warning-баннер вверху `SubmitClaimModal` в `Dashboard.tsx`.

При переключении в коммерческий режим дисклеймеры автоматически исчезают — это страховка от ситуации «пользователь думал что платит/получит выплату, а оно мок».

## Stage 23a — Co-Sharing: фундамент БД и админ-настройки (25.04.2026)

Юридическая база: «Договор простого товарищества» (ГК РФ). Пользователи покупают **Доли** в физическом имуществе, а не ценные бумаги — платформа выступает IT-агентом. Stage 23a даёт **только** скелет БД и админ-настройки; user-facing UI пулов будет в Stage 23b.

**Новые таблицы (`lib/db/src/schema/co_sharing.ts`):**
- **`pools`** — кампания сбора. Поля: `creator_id`, `title`, `item_url`, `target_amount_rub`, `actual_purchase_price_rub`, `maintenance_fund_balance` (касса излишков сбора + 10% с внешних аренд + ежедневный сбор совладельцев), `collection_method` (`p2p_direct` для бета через СБП | `platform_escrow` для commercial через ЮKassa), `creator_payment_details`, `procurement_strategy` (`self_managed` | `platform_concierge` — VIP с штрих-кодом из DNS/Ozon), `status` (`funding` → `purchasing` → `active` → `liquidated`/`canceled`), `protection_mode`, `expires_at`.
- **`pool_shares`** — доли. `pool_id`, `user_id`, `share_percentage` (0–100, два знака), `amount_rub`, `payment_status` (`pending` → `user_transferred` → `creator_confirmed` для СБП **или** `escrow_held` для эскроу).
- **`share_offers`** — вторичный рынок долей. `share_id`, `seller_id`, `price_rub`, `status` (`open`/`sold`/`canceled`).

**Расширение `listings`:**
- `pool_id` — если объявление создано из пула (`NULL` для обычных).
- `custodian_id` — текущий **Хранитель** физической вещи (динамически меняется при Цифровом Акте передачи).
- `wear_and_tear_meter` — счётчик износа (нужен для честной цены продажи доли через `share_offers`).

**Новые поля `platform_settings` + UI «Совместные покупки (Co-Sharing)» в админке:**
- `pool_fee_self_managed_percent` (default **5%**) — самостоятельная покупка с реимбурсиментом.
- `pool_fee_concierge_percent` (default **12%**) — VIP консьерж-сервис.
- `co_owner_daily_fee_rub` (default **100₽**) — ежедневный тех-сбор с совладельца за личное использование.

**Защита БД (после code-review):** все FK реальные через `references()` — `creator_id`/`user_id`/`seller_id` с `RESTRICT` (нельзя удалить юзера с активной долей), `pool_id`/`share_id` с `CASCADE` (удалили пул → автоматически снесло доли и оффера), `listings.pool_id`/`custodian_id` с `SET NULL` (history-friendly). State-поля сделаны `pgEnum` (5 штук) — БД не пустит мусорные значения вроде `status='wrong_status'`. CHECK constraints: `target_amount > 0`, `share_percentage между 0.01 и 100`, `amount/price >= 0`, `wear_and_tear_meter 0..10000` (bp). `UNIQUE(pool_id, user_id)` — один пользователь = одна строка-доля на пул. Индексы на горячих путях: `pools(status, expires_at)`, `pool_shares(pool_id)`, `pool_shares(user_id)`, `share_offers(share_id, status)`, `listings(pool_id)`, `listings(custodian_id)`.

Старая таблица `joint_purchases` остаётся как legacy-трекер (помечен в админке) — нельзя ломать существующие сборы. Новый модуль живёт параллельно.

**Что это даёт сейчас:** платформа умеет регистрировать пулы, доли и предложения о продаже долей. Админ управляет 4 источниками монетизации (комиссия сбора, 10% с внешних аренд + фонд, ежедневный сбор совладельцев, вторичный рынок). Готов фундамент для Stage 23b — UI пулов, флоу СБП-перевода, динамический Хранитель через Цифровой Акт.

## Stage 22b — Карта арбитража и электронная подпись (25.04.2026)

Завершающий слой Цифрового Акта — визуализация GPS и юридическая фиксация согласия сторон.

- **`SignaturePad.tsx`** — новый адаптивный HTML5 canvas с PointerEvents (мышь/палец/стилус), кнопка «Очистить», retina-aware (`devicePixelRatio`), снимок отдаётся через `ref.toDataURL()` (минимум ререндеров). Никаких новых зависимостей.
- **`DigitalActMap.tsx`** — компактная Leaflet-карта (read-only, scrollWheelZoom off), один пин фирменного `#C65D3B`. Используется в админке.
- **`DigitalActUpload`** получил финальный шаг: подпись обязательна, кнопка «Сохранить акт» disabled пока холст пуст.
- **Backend `digital_acts.ts`**: новая ручная валидация `validateSignature()` — regex `/^data:image\/png;base64,[A-Za-z0-9+/=]+$/` + лимит 300КБ. Без `zod/v4` (этот пакет не резолвится в bundle api-server). 400 `signature_required` с понятным сообщением.
- **Админка (`DigitalActsBlock`)**: для каждого акта — бейджи 📍 GPS / ✍️ Подпись, карта по первой GPS-точке из `metadata.photoExif`, отображение PNG-подписи. Так админ видит полный пакет: фото → локация → роспись.

Что это даёт:
- **Админу** — для арбитража: фото + карта города с точкой передачи + реальная роспись участника. Это резко повышает разрешимость споров и режет фрод.
- **Пользователю** — психология «это серьёзный договор»: расписался пальцем — относится к вещи бережнее.

## Stage 22a — Цифровой Акт (каркас, 24.04.2026 вечер; hardening 25.04.2026)

Реализован минимально-жизнеспособный каркас «Стального Щита #2»:
- **Schema** `digital_acts(id, booking_id FK, type 'check_in'|'check_out', photos jsonb≥4, video_url?, metadata jsonb, created_by_user_id FK, created_at)` + **`UNIQUE(booking_id, type)`** — один акт каждого типа на бронь, дубликаты отбиваются на уровне БД.
- **Endpoints** `GET/POST /api/bookings/:id/digital-acts` — auth, проверка участника, Zod-валидация (`photos.length>=4`), photo URL whitelist (regex `SAFE_UPLOAD_RE = /^\/uploads\/[A-Za-z0-9._-]+\.(jpe?g|png|webp|heic|heif)$/i`) — блокирует внешние URL, `data:`-URI и path-traversal. Postgres ошибка `23505` маппится в **HTTP 409 `act_already_exists`**.
- **Блокирующий гард** в `PUT /api/bookings/:id`: переход `confirmed → active` проверяет существование `check_in` акта. Нет акта → **HTTP 409 `digital_act_required`** с русским сообщением. Это означает: бронь физически невозможно перевести в активную фазу без зафиксированного состояния вещи.
- **Frontend** `DigitalActUpload.tsx` — модалка с file input multi, preview-сеткой, EXIF+GPS через `exifr`. Использует существующий `/api/upload` для фото и POST на digital-acts с метаданными.
- **Dashboard** — кнопки «🛡️ Цифровой акт приёмки» (`confirmed`, обе стороны) и «🛡️ Цифровой акт возврата» (`active`, обе стороны). `handleStatusChange` детектит 409 через `ApiError.status === 409` (а не парсит сообщение) и авто-открывает модалку.
- **AdminPage** — `DigitalActsBlock` в `BookingOverrideModal`: список актов с бейджами Check-in/Check-out, GPS-маркером, сеткой превью 4-в-ряд для арбитража.

**Регрессия (25.04.2026):** скрипт `/tmp/test-stage22a-v2.sh` — 31/31 сценариев на реальных юзерах из снапшота (3 owner + 3 renter + admin + stranger). Покрыты: блок confirmed→active, RBAC всех 4 ролей, форджи URL/path-traversal/data:-URI, валидация <4 фото, неверный type, дубликат через UNIQUE, переход с актом, check_out, public-settings.

Дальнейший roadmap: видео-апплоад, GPS-pin на карте, цифровая подпись сторон, авто-предложение акта при подходе даты передачи/возврата.

## What Is NOT Yet Implemented (roadmap)

- Видео в Цифровом Акте (сейчас только `videoUrl` поле, апплоад не реализован)
- GPS-pin на карте в админке (координаты есть в metadata, визуализации нет)
- Цифровая подпись сторон (renterSignature/ownerSignature)
- Поток оплаты через СБП/QR + загрузка чека + подтверждение админом
- Реальные выплаты из Shield-фонда (сейчас только статус)
- Stage 21b — ЮKassa для покупки контактов (single/pack10/unlimited30d)
- Stage 21c — ЮKassa-холд (capture:false) для бронирований Premium с защитой
- Trust Score (Этап 3)

## Future Scaling

- Dokan/WooCommerce plugin readiness — multivendor architecture via owner roles
- MotoPress Calendar integration ready (booking calendar in place)
- Payment gateway hooks ready (total_price calculated at booking)
- SEO: unique title/meta per page, Russian-language content
 