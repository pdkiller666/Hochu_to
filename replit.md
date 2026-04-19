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

- **/** — Home: hero banner, categories, how it works, advantages, reviews
- **/catalog** — Catalog with filters (category, price, region) and listing cards
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

## Database Schema

Tables:
- `users` — User accounts (role: renter/owner/admin)
- `regions` — Russian cities/regions (10 major cities seeded)
- `categories` — Item categories (10 categories seeded)
- `listings` — Rental items
- `bookings` — Rental bookings (status: pending/confirmed/active/return_pending/rejected/completed/cancelled)
- `reviews` — Reviews for listings
- `joint_purchases` — Joint purchase requests
- `newsletter` — Newsletter subscribers
- `booking_messages` — In-app chat messages per booking (id, booking_id, sender_id, content, is_read, created_at)

## Demo Data

- 3 demo users (password: `password123` for all)
  - alex@demo.com — owner
  - maria@demo.com — renter
  - dmitry@demo.com — owner
- 10 listings across categories
- 4 reviews
- 3 joint purchase requests

## Marketing Carousels (Homepage)

Four horizontally-scrollable product carousels between the hero search bar and the category grid.

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

## Financial Model (PROJECT_BIBLE)

Full price formula implemented in `artifacts/api-server/src/routes/bookings.ts`:

```
rent = pricePerDay × days
serviceFee = rent × 0.10     (10% — платформа)
taxFee = rent × 0.06         (6% — налог самозанятого + банк)
fundContribution = marketValue × 0.005 × days  (0.5%/день — Гарантийный фонд)
totalPrice = rent + serviceFee + taxFee + fundContribution

depositAmount = marketValue × 0.10  (10% от рыночной стоимости, отдельно)
```

**Ключевые поля:**
- `listings.market_value` — рыночная стоимость вещи (для расчёта залога и фонда)
- `bookings.rent_amount` — базовая стоимость аренды
- `bookings.service_fee` — комиссия сервиса (10%)
- `bookings.tax_fee` — налог/банк (6%)
- `bookings.fund_contribution` — взнос в Гарантийный фонд
- `bookings.deposit_amount` — залог
- `bookings.protection_enabled` — тумблер защиты (всегда true в MVP)

**Если `market_value` не указан:** fund_contribution = 0, deposit = listings.deposit.

## What Is NOT Yet Implemented (roadmap)

- Цифровой Акт check-in/check-out (4 фото + видео + GPS)
- Поток оплаты через СБП/QR + загрузка чека + подтверждение админом
- Споры (dispute) с разбором категорий А/Б
- ЮKassa-интеграция (Этап 2)
- Trust Score (Этап 3)

## Future Scaling

- Dokan/WooCommerce plugin readiness — multivendor architecture via owner roles
- MotoPress Calendar integration ready (booking calendar in place)
- Payment gateway hooks ready (total_price calculated at booking)
- SEO: unique title/meta per page, Russian-language content
 