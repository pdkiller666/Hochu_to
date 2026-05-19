# Stage Archive — «Хочу_То» (журналы до Stage 38)

> Этот файл содержит детальные журналы реализованных этапов (24.04–02.05.2026).
> Актуальный журнал последних этапов — в `replit.md` (Stage 39, 33, 40, 30-Refactoring).
> Полная история также задокументирована в `docs/AGENT_INSTRUCTIONS.md`.

---


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

## Stage 23b — Co-Sharing UI и P2P-флоу СБП (25.04.2026)

Backend (5 endpoints в `artifacts/api-server/src/routes/pools.ts`, под `requireAuth` где нужно):
- `GET /api/pools?status=funding|purchasing|active|liquidated|canceled` — список с агрегатом `collected_amount_rub` (SUM из `pool_shares` по `creator_confirmed`+`escrow_held`).
- `POST /api/pools` — создание. Бета-режим жёстко: `collection_method='p2p_direct'`, `procurement_strategy='self_managed'`. Валидация zod: `title 3..200`, `description ≤2000`, `itemUrl` — http(s) only (ftp/data/javascript отбиваются), `targetAmountRub > 0`, `creatorPaymentDetails` обязателен.
- `GET /api/pools/:id` — public, возвращает `creator`, `shares[]` с `userName/avatarUrl` через JOIN, `collectedAmountRub`.
- `POST /api/pools/:id/shares` — внести долю. Один `(pool_id, user_id)` UNIQUE на уровне БД → 409 `share_already_exists`. В бета-режиме сразу пишется `payment_status='user_transferred'`.
- `POST /api/pools/:id/shares/:shareId/confirm` — только creator. Атомарная транзакция: `pool_shares.payment_status` `'user_transferred' → 'creator_confirmed'`, пересчёт `SUM(amount_rub)` по `COLLECTED_STATUSES = ['creator_confirmed','escrow_held']`, и при `collected ≥ target` ровно один раз `pools.status: 'funding' → 'purchasing'`. Двойной confirm → 409 `share_not_transferred`. Не-creator → 403 `only_creator_can_confirm`. Contribute в `purchasing` → 409 `pool_not_funding`.

Frontend (`/pools`, `/pools/create`, `/pools/:id`):
- `lib/api-pools.ts` — тонкий fetch-клиент с `Authorization: Bearer` из `lib/auth`. Не через orval (эндпоинты ещё не в OpenAPI).
- `pages/Pools.tsx` — hero «Скиньтесь и купите вместе», табы funding/purchasing/active, карточки с прогресс-баром, эмпти-стейты.
- `pages/PoolCreate.tsx` — форма с явным баннером «Бета-режим: переводы напрямую» (когда `isCommercialMode=false`), валидация, редирект на `/pools/:id` после создания.
- `pages/PoolDetail.tsx` — публичные данные + собственная роль:
  - Гость на `funding` → CTA «Войдите, чтобы внести долю» с redirect.
  - Авторизованный не-creator → модалка «Внести долю» с реквизитами СБП creator-а, кнопкой Copy, чек-листом «откройте банк → переведите → нажмите Я перевёл», обязательным чекбоксом подтверждения.
  - Уже внёс долю → бейдж со статусом перевода (Ожидание / Перевёл, ждёт подтверждения / Подтверждено).
  - **Creator** → отдельный блок «Ожидают подтверждения» с кнопкой «Подтвердить получение» по каждой `user_transferred`-доле; toast при достижении 100% с переходом в `purchasing`.
- `App.tsx` — три новых роута + `/pools` добавлен в `PUBLIC_PATHS` (доступ без авторизации).
- `Header.tsx` — навлинк «Совместные покупки» теперь ведёт на `/pools` (не на старый `/joint-purchases`).

ЯВНО НЕ СДЕЛАНО (Stage 23c):
- ~~Авто-листинг (создание `listings`-записи) при `pools.status='active'`.~~ — **закрыто Stage 23c**.
- ~~Динамический «Хранитель» — первый Хранитель при активации.~~ — **закрыто Stage 23c** (creator = первый custodian; ротация по ТКЗ — отдельный stage).
- Эскроу-флоу через ЮKassa (`collection_method='platform_escrow'`, capture-by-creator).
- UI выбора `procurement_strategy='platform_concierge'`.

## Stage 23c — Auto-listing из пула + co-owner pricing (25.04.2026)

Финал «совместной покупки»: после набора 100% (`pools.status='purchasing'`) creator одним действием активирует пул — мы атомарно создаём listing-черновик и переключаем статус.

**БД (`lib/db/src/schema/digital_acts.ts`):** `bookingId` теперь nullable, добавлен `poolId` (FK pools.id ON DELETE CASCADE), два partial unique-индекса (`booking_id,type` WHERE booking_id IS NOT NULL` и `pool_id,type` WHERE pool_id IS NOT NULL`), CHECK XOR `(booking_id IS NOT NULL)::int + (pool_id IS NOT NULL)::int = 1` — каждый акт привязан ровно к одному из двух родителей.

**Backend `POST /api/pools/:poolId/digital-acts` (`artifacts/api-server/src/routes/digital_acts.ts`):**
- RBAC: только creator пула, только `status='purchasing'`, только `type='check_in'`.
- Валидация — тот же hardening, что у bookings-актов: `/uploads/<uuid>.(jpg|png|webp|heic|heif)` для photos, mp4/webm/mov/m4v или http(s) для video, PNG-data-URL signature.
- Атомарная транзакция:
  1. INSERT `digital_acts(poolId, type='check_in', photos, videoUrl, metadata)` — partial unique блокирует дубль (повторное нажатие → 409 `act_already_exists`).
  2. SELECT MIN(id) FROM categories/regions как fallback (creator отредактирует в Кабинете).
  3. INSERT `listings(title=pool.title, photos=act.photos, ownerId=creatorId, custodianId=creatorId, poolId=pool.id, pricePerDay='0', isAvailable=false, ownerProtectionEnabled=pool.protectionMode)`.
  4. Условный UPDATE `pools SET status='active' WHERE id=? AND status='purchasing'` — race-safe; если 0 rows → `pool_status_race`.
- Ответ: `{ act, listing, pool, message }`.

**Backend pricing (`artifacts/api-server/src/routes/bookings.ts`):**
- Helper `isCoOwner(userId, listing) → bool` — проверяет `pool_shares.payment_status IN ('creator_confirmed','escrow_held')` для текущего пользователя на пуле listing-а.
- В `POST /api/bookings` (Сценарий А) и `PATCH /api/bookings/:id/reschedule`: после стандартного расчёта переопределяем — `rent=0`, `serviceFee = days * coOwnerDailyFeeRub`, `taxFee=0`, `ownerPayout=0`, `ownerFundContrib=0`. Защитный фонд **арендатора** (`renterFundContribution`) сохраняется — это страховка для всех совладельцев. `totalPrice = serviceFee + renterFundContrib`.
- **Pricing-обход закрыт (Stage 23c hardening, post-architect):** до Сценария Б (`!protectionEnabled`) сервер сначала вычисляет `coOwner = await isCoOwner(...)` и для co-owner принудительно ставит `protectionEnabled=true` — нельзя обойти co-owner-таксу через флаг прямого контакта.
- **TOCTOU guard:** во всех трёх write-ветках (POST Сценарий А, POST Сценарий Б, PATCH /reschedule) непосредственно перед `INSERT/UPDATE bookings` повторно вызывается `isCoOwner(...)`. Если статус `pool_shares.payment_status` изменился между первичной проверкой и записью → возвращаем 409 `co_owner_state_changed`, клиент должен перезапросить. Optimistic concurrency без блокировок — приемлемо, т.к. изменение статуса доли — редкая админ-операция.
- Тарификация co-owner живёт в `platform_settings.co_owner_daily_fee_rub` (default 100 ₽) — админ может менять без деплоя.

**Frontend (`artifacts/hochu-to/src/`):**
- `components/DigitalActUpload.tsx` — props стали `bookingId?` | `poolId?` (взаимоисключающие, runtime-чек). URL endpoint выбирается из заданного.
- `pages/PoolDetail.tsx` — новый блок `ActivatePoolBlock` («Шаг 2: Подтвердите покупку и создайте объявление») для creator при `status='purchasing'`. Кнопка открывает `DigitalActUpload` с `poolId` + `type='check_in'`. После успеха — toast, инвалидация query, редирект в `/cabinet/listings` через 800мс.
- Заодно починен пред-существующий баг GET /api/pools/:id (поля `firstName/lastName/avatarUrl` не существуют в `users` — там `name`/`avatar`, теперь сервер сам разбивает `name` на firstName/lastName для совместимости с фронтом).

**Smoke-тест на реальных юзерах:** alexey создаёт пул на 30000₽, maria/dmitry вносят по 15000₽, alexey подтверждает оба → `purchasing`, alexey шлёт genesis-акт → 201, listing#90 создан (`isAvailable=false, poolId=15, custodianId=alexey, ownerId=alexey`), pool→`active`. Forbidden (maria) → 403. Дубль (alexey ещё раз) → 409 `pool_not_purchasing`. Maria-co-owner бронирует listing на 3 дня по 500₽/день → `rent=0, serviceFee=300 (3×100), taxFee=0, ownerPayout=0, totalPrice=300` ✓.

**Что НЕ сделано (Stage 23d+):**
- Динамическая ротация Хранителя по ТКЗ (Тариф Качественного Содержания).
- Эскроу-флоу через ЮKassa (commercial mode).
- Вторичный рынок долей через UI `share_offers`.
- ~~Расчёт износа `wear_and_tear_meter` на каждой бронировке.~~ — **закрыто Stage 26**.

## Stage 26 — Wear and Tear (амортизация физических активов) (25.04.2026)

Подготовка к вторичному рынку долей: вещь стареет — доля дешевеет. Без счётчика износа продажа доли в б/у-PlayStation шла бы по цене новой → крах экономики и доверия.

**БД (`lib/db/src/schema/platform_settings.ts`):** добавлено `depreciationPerRentalPercent: integer default 1` — % падения оценочной стоимости вещи за одну успешно завершённую аренду. Default 1% означает: после 100 аренд вещь стоит минимум 10% от исходной (потолок амортизации). Поле `listings.wear_and_tear_meter` уже существовало с Stage 23a (CHECK 0..10000), используется как счётчик аренд.

**Backend trigger (`artifacts/api-server/src/routes/bookings.ts`):** в блоке `if (status === "completed")` (PUT `/api/bookings/:id`) внутрь существующего `Promise.all` (рядом с `completedDealsCount`) добавлен `UPDATE listings SET wear_and_tear_meter = wear_and_tear_meter + 1 WHERE id = booking.listingId`. Cancel/reject не доходят сюда — отменённые брони не амортизируют вещь.

**Backend pool detail (`artifacts/api-server/src/routes/pools.ts`):** `GET /api/pools/:id` теперь возвращает поле `listing` с `{id, wearAndTearMeter, pricePerDay, isAvailable, custodianId}` (или `null`, если пул ещё не активирован). Нужно фронту для расчёта остаточной стоимости.

**Backend public settings:** `depreciationPerRentalPercent` экспортируется в `/api/settings` для клиентского калькулятора.

**Frontend helper (`artifacts/hochu-to/src/lib/pricing.ts`):**
- `calculateResidualValue(initialPrice, meter, depreciationPercent)` — формула `initialPrice × (1 − meter × pct / 100)`, не ниже `initialPrice × 0.1` (10%-ный floor).
- `calculateDepreciationPercent(meter, pct)` — для UI-бейджа (с тем же ceiling).
- Edge cases: `initialPrice <= 0 → 0`; отрицательные значения нормализуются.

**Frontend UI (`artifacts/hochu-to/src/pages/PoolDetail.tsx`):** новый блок `ResidualValueBlock` — фиолетовая карточка «Оценочная стоимость сейчас» с крупной суммой residual, бейджем «N аренд · износ X%» (с tooltip про правила амортизации) и подписью с исходной стоимостью. Показывается только при `pool.status='active' && pool.listing` (в funding/purchasing вещи ещё нет).

**Admin form (`artifacts/hochu-to/src/pages/AdminPage.tsx`):** новое поле «Износ за одну завершённую аренду (%)» в блоке «Совместные покупки», рядом с co-owner daily fee. Step 0.1, дефолт 1%.

**Smoke:** alexey бронирует listing#43 (owner=dmitry) → status=completed (через DB-shortcut по return_pending → completed через PUT) → `wear_and_tear_meter` 0 → 1 ✓. Формула: 30000₽ + 50 аренд + 1% → 15000₽; 200 аренд → 3000₽ (floor); 0₽ → 0; отрицательное → 0 ✓.

**Stage 26 followup (post-architect):**
1. **Severe-фикс admin allowlist** — `PUT /api/admin/settings` тихо игнорировал `depreciationPerRentalPercent`, потому что поля не было в `allowed[]` и `NON_NEG_INT_FIELDS[]` (`artifacts/api-server/src/routes/admin.ts`). Добавлено. Round-trip 1 → 3 → reset 1 через реальный логин админа подтверждён.
2. **Транзакционность completed-ветки** — критическая секция `PUT /api/bookings/:id` (UPDATE booking + applyBookingCountDelta + completedDealsCount × 2 + wearAndTearMeter +1) обёрнута в одну `db.transaction(async (tx) => { ... })`. Раньше counters летели отдельными запросами — при падении одного из них (например, CHECK 0..10000 на wear meter) booking уже был помечен completed → desync. Теперь либо всё применяется, либо ничего. `applyBookingCountDelta` принимает опциональный `executor: DrizzleExecutor` (структурный тип `Pick<typeof db, "update" | "select">`, чтобы не таскать generic-параметры PgTransaction). Notifications/audit намеренно ВНЕ транзакции — после commit. **Smoke race:** 5 параллельных PUT completed на одну бронь → ровно 1 × 200, 4 × 422 (invalid_transition, потому что TOCTOU guard ловит уже-изменённый статус ДО входа в транзакцию). meter +1, не +5; counters +1, не +5 ✓.
3. **Юнит-тесты pricing.ts** — добавлен `artifacts/hochu-to/src/lib/pricing.test.ts` (24 теста), запускается через `pnpm --filter @workspace/hochu-to test`. Использует встроенный `node:test` + `--experimental-strip-types` (Node 22+, в проекте Node 24.13). Покрывает: новая вещь, частичный износ, точка floor, ниже floor (clamped), отрицательная цена/meter/pct, NaN/Infinity (включая опасный `0 × Infinity` → без санитизации был бы `NaN`), дробный meter (округление вниз), округление до копеек, ceiling 90% для % бейджа. Файл лежит рядом с исходником — Vite не подхватит, потому что на него никто не импортирует.
4. **Санитизация non-finite в pricing.ts** — `meter`/`pct` нормализуются через `Number.isFinite(...) ? Math.max(0, ...) : 0`. Старый паттерн `Math.max(0, x || 0)` НЕ ловил `Infinity` (`Infinity || 0 === Infinity`).
5. **Try/catch для post-commit side effects в bookings.ts PUT** — `recordEvent` и блок `createNotification` обёрнуты в отдельные try/catch. Транзакция уже зафиксирована, статус и счётчики консистентны; падение audit/notif (например, БД временно недоступна) не должно приводить к 5xx — иначе клиент сделает ложный retry, а второй PUT упадёт в `invalid_transition` из-за TOCTOU guard. Логируем через `console.error`, отвечаем 200.

**Что НЕ сделано (Stage 27+):**
- ~~Применение остаточной стоимости в цене доли на вторичном рынке (`share_offers`).~~ — **закрыто Stage 26-B** (server endpoint + автозаполнение в SellShareModal).
- ~~Серверное зеркало `calculateResidualValue` (когда понадобится для API-расчётов).~~ — **закрыто Stage 26-B** (`GET /api/pools/:id/shares/:shareId/suggested-price`).
- Декремент wear meter при «капитальном ремонте» / claims из фонда обслуживания.

## Stage 26-B — Co-Sharing Final Polish (Vector A) (25.04.2026, verified 27.04.2026)

Три точечных полишинга, которые превращают co-sharing из "схема в БД" в работающий продуктовый цикл: остаточная цена доли, фонд обслуживания и физическая передача вещи между совладельцами.

**Verification 27.04.2026 (новый Replit-аккаунт):** после `pnpm install` + `pnpm --filter @workspace/db run push-force` + рестарта — API Server поднят на порту 8080, `/api/admin/stats/extended` HTTP 200, `/api/pools` HTTP 200, prod-сборка фронта (3659 модулей, 1.76 MB JS) без ошибок. Все 4 воркфлоу running.

### 1. Остаточная цена доли — single source of truth (server)

**Backend (`artifacts/api-server/src/routes/pools.ts`):** новый endpoint `GET /api/pools/:id/shares/:shareId/suggested-price` — возвращает `{poolId, shareId, shareInitialRub, sharePct, wearAndTearMeter, depreciationPerRentalPercent, depreciationPercent, residualRatio, suggestedRub, currency: "RUB"}`. Формула: `residual = initial × (1 − meter × pct/100)` с floor 10%, затем `share% × residual`. Источник правды теперь сервер, а не клиент — иначе фронт мог бы тихо «обмануть» себя при изменении формулы. Возвращает 400 `bad_request` для невалидных id, 404 `share_not_found`, 422 `pool_not_active` если у пула нет привязанного listing (не из чего считать residual).

**Frontend API (`artifacts/hochu-to/src/lib/api-pools.ts`):** `getSuggestedPrice(poolId, shareId)` — простой fetcher.

**SellShareModal (`PoolDetail.tsx`):** при открытии — useEffect синхронизирует suggested-price от сервера в input «Цена в рублях». Если пользователь вручную правил поле (`priceTouched=true`) — не перезаписываем. Fallback на client-side `pricing.calculateResidualValue` при сетевой ошибке. UI-источник показывается как «офлайн-расчёт» / «загрузка…» под полем цены, чтобы пользователь понимал, что число посчитано, а не угадано.

### 2. Maintenance fund accrual при completed-броне совладельца

**Backend (`artifacts/api-server/src/routes/bookings.ts`):** в PUT `/api/bookings/:id` (transition → `completed`) — re-derive `isCoOwner` ПЕРЕД входом в транзакцию (через `listing.poolId` + `pool_shares.payment_status IN ('creator_confirmed','escrow_held')` для renter). Внутри tx (рядом с `wearAndTearMeter +1`) добавлен `UPDATE pools SET maintenance_fund_balance = maintenance_fund_balance + serviceFeeRub WHERE id = listing.poolId`. Атомарно с counter-обновлениями: если падает CHECK на `maintenance_fund_balance >= 0` (защита от отрицательных значений) — откатывается весь блок completed.

**Audit (post-commit):** `recordAuditEvent({entityType: "pool", entityId: listing.poolId, eventType: "fund_accrued", actorId: req.userId, metadata: {bookingId, serviceFeeRub, listingId}})` — намеренно ВНЕ tx (best-effort observability, не financial-ledger). Выпадение audit при temp DB-сбое не должно ронять финансовую операцию.

**Импорты:** `poolsTable` (из `@workspace/db`) + `recordAuditEvent` (из `lib/audit-events.js`) добавлены в headers `bookings.ts` — без них эта ветка падала бы с runtime ReferenceError при первом completed-broning.

### 3. Цифровой акт передачи (`pool_handover`) + смена custodian + UI

**Schema (`lib/db/src/schema/digital_acts.ts`):**
- Расширен Zod-enum типов `digital_act_type`: `check_in | check_out | pool_handover`.
- Partial unique `digital_acts_pool_type_uniq` сужен с `WHERE pool_id IS NOT NULL` до `WHERE pool_id IS NOT NULL AND type = 'check_in'`. Иначе вторая «передача» (handover #2) того же пула роняла бы unique violation, потому что `(pool_id, 'pool_handover')` повторяется при каждой смене custodian. Только genesis-акт `check_in` уникален по пулу.

**Production migration (`lib/db/migrate-prod.mjs`):** добавлен идемпотентный SQL `DROP INDEX IF EXISTS digital_acts_pool_type_uniq; CREATE UNIQUE INDEX ... WHERE pool_id IS NOT NULL AND type = 'check_in'`. Drizzle-kit push не пересоздаёт WHERE-условие partial unique автоматически — только этот явный DROP+CREATE гарантирует, что production-БД получит правильное условие.

**Backend (`artifacts/api-server/src/routes/digital_acts.ts`):** новый endpoint `POST /api/pools/:poolId/handovers`. Внутри одной `db.transaction`:
1. Загружаем `pool` + `listing` (по `pool.id`). Если listing нет → 422 `no_listing`.
2. **TOCTOU-guard:** проверяем `listing.custodian_id === req.userId` (только current custodian оформляет передачу — это безопаснее, чем receiver-инициатива, потому что у sender в руках вещь).
3. **Self-handover:** `toUserId === req.userId` → 400 `self_handover`.
4. **Receiver — co-owner с paid share:** проверяем `pool.creator_id === toUserId` (creator-by-default) ИЛИ есть `pool_shares` с `payment_status IN ('creator_confirmed','escrow_held')`. Иначе 400 `receiver_not_co_owner`.
5. INSERT `digital_acts` с `type='pool_handover'`, `pool_id`, `metadata={fromUserId, toUserId, signature, ...}`, `photos[≥4]`.
6. **Atomic UPDATE:** `UPDATE listings SET custodian_id = toUserId WHERE id = listing.id AND custodian_id = req.userId` (TOCTOU re-check — если за время транзакции custodian уже сменился, returning будет пустой → откат).

**Audit (post-commit):** `custodian_changed` (entityType=`pool`, entityId=poolId, metadata={fromUserId, toUserId, listingId, actId}).

**Notification:** новый тип `pool_custodian_received` в `lib/notifications.ts` — отправляется новому custodian: «Вещь передана вам — {listing.title}. {fromUser.name} оформил Цифровой акт передачи. Теперь вы — Хранитель этой вещи.»

**Frontend API (`api-pools.ts`):** `handoverPool(poolId, body)`, расширен `PoolEventType` для `custodian_changed`.

**DigitalActUpload (`components/DigitalActUpload.tsx`):** поддержка `mode: "booking" | "pool_handover"` с props `toUserId / toUserName` для последнего. Динамический endpoint (`/api/bookings/:id/digital-acts` vs `/api/pools/:poolId/handovers`) и body-shape, остальная логика (фото≥4, подпись, EXIF, валидация) переиспользуется. UI-копирайтинг адаптивный: «Подписать акт передачи → {toUserName}».

**PoolDetail.tsx — handover-блок в SharesList:**
- **Если ты — current custodian** (`listing.custodianId === me.id`): emerald-карточка «Вы — Хранитель» + кнопки «Передать → {userName}» для каждого co-owner. Список получателей = paid shares (без меня) ∪ creator-by-default (если creator не в shares и не я). Дедупликация по userId. Без paid shares и creator → «Других совладельцев пока нет — передавать некому».
- **Если ты — co-owner, но не custodian:** stone-карточка «Хранитель сейчас: {custodianName}. Чтобы принять вещь, попросите его оформить Цифровой акт передачи.»
- **Не co-owner и не custodian:** блок не показывается.

### Smoke (live, port 8080)
- `GET /api/pools/15/shares/13/suggested-price` → `{suggestedRub: 30000, sharePct: 100, residualRatio: 1}` ✓
- `404 share_not_found` для неизвестного share_id ✓
- `400 bad_request` для `pool_id=0` ✓
- `POST /pools/15/handovers` без auth → 401 ✓
- `self_handover` (alexey→alexey) → 400 ✓
- `not_current_custodian` (maria без прав) → 403 с `currentCustodianId=13` ✓
- `receiver_not_co_owner` → 400 ✓
- e2e #1 alexey→maria: создан `digital_act #16 pool_handover`, `listings.custodian_id 13→14`, audit `custodian_changed#10`, notification `pool_custodian_received` доставлена ✓
- e2e #2 maria→alexey (повторная передача): создан `digital_act #18 pool_handover`, `listings.custodian_id 14→13`, audit `custodian_changed#11` ✓ (это и был тест на partial unique — без `type='check_in'` сужения вторая запись падала с `internal_error`).

## Stage 25 — Вторичный рынок долей (P2P beta) (25.04.2026)

Превращаем платформу в мини-биржу: совладельцы могут продавать свои доли через `share_offers`. На beta-этапе деньги переводятся напрямую через СБП (платформа = реестр прав), commercial-режим (Stage 24) добавит эскроу через ЮKassa.

**БД (`lib/db/src/schema/co_sharing.ts`):** в `share_offers` добавлены 3 nullable-поля:
- `buyer_id` integer FK→users — кто зарезервировал оффер. NULL = свободно.
- `reserved_at` timestamp — момент резервации (TTL опционально, пока не использован).
- `seller_payment_details` text — СБП-реквизиты продавца, показываются buyer'у после `/buy`.

Жизненный цикл оффера: `open + buyer_id=NULL` → `open + buyer_id=X (reserved)` → `sold` (атомарный merge) | `canceled`.

**Backend (`artifacts/api-server/src/routes/pools.ts`)** — 5 новых endpoints:
1. `POST /api/pools/:id/shares/:shareId/offers` (auth) — создать оффер. Валидация: ownership, `paymentStatus ∈ {creator_confirmed, escrow_held}` (нельзя продавать неоплаченную долю — иначе можно «продать» фейк), нет другого открытого оффера на эту долю.
2. `GET /api/pools/:id/offers` — список открытых офферов с join'ами `pool_shares` (sharePercentage, amountRub) и `users` (sellerName, sellerAvatar).
3. `POST /api/pools/:id/offers/:offerId/buy` (auth) — резервация. **TOCTOU:** атомарный `UPDATE … WHERE status='open' AND buyer_id IS NULL RETURNING` — при параллельных «Купить» победит ровно один. Self-check: `cannot_buy_own_offer`.
4. `POST /api/pools/:id/offers/:offerId/confirm-transfer` (auth, только seller) — **АТОМАРНАЯ ПЕРЕДАЧА ВЛАДЕНИЯ**. Внутри `db.transaction`:
   - TOCTOU `UPDATE share_offers SET status='sold' WHERE id=? AND status='open' AND seller_id=?` — защита от двойного confirm.
   - SELECT свежей доли продавца внутри tx; повторная проверка `seller_id == userId` (защита от race с предыдущим merge).
   - **Merge logic:** если у buyer уже есть `pool_shares` запись для этого `pool_id` (UNIQUE(pool_id, user_id)) → `UPDATE buyer.share SET sharePercentage += seller.percentage, amountRub += seller.amount` + `DELETE seller.share`. Иначе → `UPDATE seller.share SET user_id = buyer_id` (transfer ownership).
   - Sum проценты на стороне SQL через `sql\`${sharePercentage} + ${seller.sharePercentage}\`` — DECIMAL(5,2) точность сохраняется, CHECK (>0 AND <=100) валидирует.
5. `POST /api/pools/:id/offers/:offerId/cancel` (auth, только seller) — отмена с TOCTOU guard, сбрасывает `buyer_id` и `reserved_at`.

`GET /api/pools/:id` теперь дополнительно отдаёт `offers[]` (открытые) — фронт за один запрос рендерит и доли, и рынок.

**Frontend (`artifacts/hochu-to/src/lib/api-pools.ts`):** новые типы (`ShareOfferDetail`, `BuyOfferResponse`, `ConfirmTransferResponse`) и функции (`createShareOffer`, `listOffers`, `buyShareOffer`, `confirmShareTransfer`, `cancelShareOffer`).

**Frontend (`artifacts/hochu-to/src/pages/PoolDetail.tsx`):**
- В `SharesList` для своей оплаченной доли (без открытого оффера) — кнопка «Продать» (icon `Tag`). Если оффер уже стоит — бейдж «На продаже».
- Новый `MarketplaceBlock` (блок «Рынок долей», между ResidualValueBlock и SharesList): список открытых офферов с `OfferRow`. Для buyer'а — кнопка «Купить»; для seller'а — `SellerOfferActions` (cancel или, если зарезервировано, «Подтвердить получение и передать долю» + cancel); для buyer'а который уже зарезервировал — текст «Переведите по СБП и ждите подтверждения».
- `SellShareModal`: расчёт справедливой цены = `calculateResidualValue(targetAmount, listing.wearAndTearMeter, depPercent) × sharePercentage / 100`. Если listing нет — по номиналу. Показывает блок-tip с residual + износ %, инпут цены с кнопкой «Сбросить к справедливой», инпут СБП-реквизитов, чек-бокс согласия.
- `BuyOfferModal`: двухфазный (зарезервировать → показать СБП-реквизиты с copy-button + инструкции).

**Smoke-тест end-to-end (на pool#15, 30000₽, 2 совладельца maria + dmitry):**
- Validation: создание (201), дубль (409 `offer_already_open`), чужая доля (403 `not_share_owner`), пустые реквизиты (400 zod).
- TOCTOU race: 5 параллельных POST `/buy` от alexey → ровно 1×200 + 4×409 `offer_unavailable`.
- Self-check: maria → 403 `cannot_buy_own_offer`.
- **Transfer-mode** (alexey не имел доли): maria → alexey, share#13 user_id 14→13, `mergeMode='transfer'`. Дубль confirm → 409 `offer_not_open`.
- **Merge-mode** (у alexey уже 50% после A): dmitry продаёт → alexey. Result: share#13 sharePercentage 50→100, amountRub 15000→30000, share#14 удалена. **Целостность:** `SUM(sharePercentage)=100.00`, `SUM(amount)=30000` ✓.
- Cancel-flow: create + 403 чужой cancel + 200 свой cancel + 409 повтор.
- Negative auth: confirm-transfer от не-seller → 403 `only_seller_can_confirm`.

**Что НЕ сделано (Stage 25 followup, future):**
- TTL для зарезервированных офферов (если buyer не платит — авто-сброс buyer_id через cron).
- ~~Уведомления (`createNotification` в seller/buyer о ключевых событиях).~~ — **закрыто Stage 27**.
- ~~Аудит-лог (`recordEvent` для history/forensics).~~ — **закрыто Stage 27**.
- Комиссия платформы при продаже (Stage 24+ с эскроу).
- Авто-переоценка существующих офферов при изменении wearAndTearMeter (сейчас цена «замораживается» на момент создания).

## Stage 27 — Co-Sharing Transparency: Notifications + Audit Log (25.04.2026)

Закрытие технического долга Stage 25: P2P-режим работает на доверии (СБП-переводы), но без уведомлений участники узнают о действиях друг друга только при перезагрузке страницы. Stage 27 добавляет реактивную прозрачность.

**Архитектурное решение по audit storage:**
Промт изначально требовал использовать только существующие таблицы. Но `booking_events.booking_id` — NOT NULL FK, нельзя писать туда события пулов; `admin_audit_log.admin_id` — NOT NULL и admin-only. Решение: **новая универсальная таблица `audit_events`** (`entity_type`, `entity_id`, `actor_id` nullable, `event_type`, `metadata jsonb`) — обобщение паттерна `booking_events`, рассчитанное на любые будущие сущности (offers, payouts, claims) без зоопарка зеркал. `actor_id` ON DELETE SET NULL — история переживает удаление аккаунта.

**Изменения в схеме (`lib/db/src/schema/audit_events.ts`):**
- Новая таблица `audit_events` с двумя индексами: `(entity_type, entity_id, created_at)` для timeline-выборки и `(actor_id)` для будущих экранов «моя активность».
- НЕТ FK на entity_id — события переживают удаление сущности (например, удалили pool — история операций сохранится для ретроспективы).

**Backend hooks (`artifacts/api-server/src/lib/audit-events.ts` + `routes/pools.ts`):**
- Helper `recordAuditEvent` — никогда не бросает наружу (try/catch внутри). Вызывается через `void` после `res.json()`, чтобы аудит не блокировал ответ клиенту.
- 8 event types в pools.ts:
  - `pool_created` (POST /api/pools)
  - `share_contributed` (POST /:id/shares)
  - `share_confirmed` (POST /:id/shares/:shareId/confirm)
  - `pool_purchasing` — system event (actor_id=NULL), при переходе funding→purchasing
  - `offer_created` (POST /:id/shares/:shareId/offers)
  - `offer_reserved` (POST /:id/offers/:offerId/buy)
  - `share_transferred` (POST /:id/offers/:offerId/confirm-transfer)
  - `offer_canceled` (POST /:id/offers/:offerId/cancel)

**Push-уведомления (4 NotifType расширения в `lib/notifications.ts`):**
- `pool_share_received_funds` → creator: «X перевёл средства за долю»
- `pool_purchasing` → ВСЕМ участникам + creator: «Сбор завершён, начало закупки»
- `pool_offer_reserved` → seller: «X хочет выкупить вашу долю»
- `pool_share_received` → buyer: «Доля перешла к вам!»

Все вызовы `createNotification` обёрнуты в отдельный try/catch — падение нотификации не должно ломать основной поток.

**Frontend (`PoolDetail.tsx` — `TimelineBlock`):**
- Новый блок «История событий» в самом низу карточки пула.
- Использует `listPoolEvents(poolId)` (новый endpoint `GET /api/pools/:id/events`, public).
- `refetchInterval: 30_000` — лёгкий polling, без необходимости в WS на этапе беты.
- Empty state: «Здесь появятся события пула» — для свежесозданных пулов.
- Каждое событие = иконка (Sparkles/Banknote/Handshake/etc) + одна строка человекочитаемого описания + локальное время.
- Метаданные (priceRub, sharePercentage, mergeMode, ownerId) форматируются через `describeEvent()`.

**Smoke-тест Stage 27 (PASS, 25.04.2026):**
1. alexey создаёт пул → событие `pool_created`.
2. maria вносит 9000 → `share_contributed` + push alexey'ю.
3. alexey подтверждает → `share_confirmed`.
4. dmitry вносит 6000 → `share_contributed` + push alexey'ю.
5. alexey подтверждает → `share_confirmed` + sum=15000 ≥ target → `pool_purchasing` (actor=NULL) + 3 push'а (alexey, maria, dmitry).
6. dmitry выставляет долю → `offer_created`.
7. maria резервирует → `offer_reserved` + push dmitry.
8. dmitry confirms transfer → `share_transferred` (mergeMode=merge — у maria уже была доля) + push maria.
9. GET /events → **9 событий** в правильном хронологическом порядке, все metadata валидны.
10. Notifications: alexey=3, maria=2, dmitry=2 — итого 7 push'ей в правильных адресатах. ✓

**Что НЕ сделано (Stage 27 followup, future):**
- WebSocket/SSE вместо polling (когда понадобится sub-second latency).
- Audit-trail для bookings/claims переехать на `audit_events` (унификация с `booking_events`/`admin_audit_log` — разовая миграция).
- Cleanup audit_events при cascade delete пула (сейчас остаются как «история призраков»; либо триггер, либо ON DELETE soft через периодический GC).
- Гендерное склонение в текстах уведомлений («перевёл/перевела»).

## Stage 28 — Co-Sharing Full Buyout: полный выкуп пула одним совладельцем (27.04.2026)

Финал жизненного цикла пула. До Stage 28 совладельцы могли продавать доли только по одной через Stage 25 marketplace; не было способа атомарно «выкупить всех → ликвидировать пул → стать единственным владельцем вещи». Это блокировало естественный сценарий «не хочу больше делить — заберу себе».

**Архитектура:**

- 2 новые таблицы (`lib/db/src/schema/co_sharing.ts`):
  - `buyout_requests` (id, pool_id, initiator_id, status enum `pending/completed/canceled`) с **partial unique index** `(pool_id) WHERE status='pending'` — гарантия одного активного выкупа на пул.
  - `buyout_participants` (id, buyout_request_id, user_id, share_id, sharePercentage/shareAmountRub/priceRub snapshot, status enum `pending_approval/user_transferred/confirmed`) — по одной строке на каждого не-инициаторного совладельца.
- 5 endpoints в `routes/buyouts.ts` (~620 LOC). Все мутации идут через `requireAuth`. Helper `calculateResidualRatio(poolId)` — точное зеркало формулы Stage 26-B (`max(0.1, 1 − meter × depPct/100)`), используется при создании запроса для расчёта payout = `share.amountRub × residualRatio`.
- 5 новых `NotifType` (`pool_buyout_*`) в `lib/notifications.ts`.
- Frontend: компонент `BuyoutBlock` в `PoolDetail.tsx` (~330 LOC), вставлен между `MarketplaceBlock` и `SharesList`. Polling `15s`. Три ветки UI (initiator / participant / observer).

**Атомарный confirm (главная транзакция):**
1. TOCTOU `UPDATE buyout_participants SET status='confirmed' WHERE id=? AND user_id=? AND status='user_transferred'` — защита от double-click.
2. SELECT живой доли participant'а (по pool_id + user_id).
3. SELECT доли инициатора.
4. UPDATE доли инициатора: `+= participant.sharePercentage, += participant.amountRub`.
5. DELETE доли participant'а.
6. Если новый процент инициатора `>= 99.99` (запас по DECIMAL): `pool.status='liquidated'`, `listing.pool_id=NULL`, `listing.custodian_id=initiator`, `buyout_request.status='completed'`.

`recordAuditEvent` + `createNotification` — post-commit, void-обёрнуты, не валят ответ клиенту.

**Step A «Согласиться» — UI-only.** Enum имеет ровно 3 значения, каждое — фактический бизнес-state. Согласие участника без действия не имеет юридического веса, поэтому хранится только в локальном `useState<Set<number>>`, управляющем раскрытием СБП-реквизитов инициатора.

**E2E smoke (PASS, 27.04.2026):**
Иван (60%) + Пётр (40%), пул #1, listing нет (residual=1.0).
1. POST /pools/1/buyout (Иван) → request #1, participant #1 (Петр, priceRub=40000).
2. POST /participants/1/confirm (Пётр) без mark → 409 `participant_not_in_transferred_state` ✓
3. POST /participants/1/mark-transferred (Пётр) → 403 `only_initiator_can_mark_transferred` ✓
4. POST /participants/1/mark-transferred (Иван) → status=`user_transferred` ✓
5. POST /participants/1/mark-transferred (Иван повторно) → 409 `invalid_transition` ✓
6. POST /participants/1/confirm (Иван) → 403 `only_participant_can_confirm` ✓
7. POST /participants/1/confirm (Пётр) → атомарный merge: Иван 100%/100000₽, Петр доля удалена, pool=`liquidated`, request=`completed`, participant=`confirmed`, `poolLiquidated:true` ✓

**Что НЕ сделано (Stage 28 followup):**
- Замена нативного `confirm()` на shadcn `AlertDialog`.
- Эскроу для buyout (Stage 24 commercial mode): холд в ЮKassa вместо СБП p2p, авто-релиз при ликвидации.
- Частичный выкуп (Иван покупает только Петра, не всех) — сейчас «всё или ничего».
- Авто-cancel зависших запросов через cron.
- Явная кнопка «Отказаться» у participant'а с уведомлением инициатору (сейчас отказ = молчаливый игнор + `cancel` инициатора).
- Гендерное склонение в нотификациях.

## Stage 32.1 — Trust Score V8: публичный рейтинг (02.05.2026)

`trust_score` и `completed_deals_count` уже рассчитывались в фоне (Stage 29), но не отображались пользователям. Stage 32.1 выводит их публично.

**Бэкенд:**
- `GET /users/:id` — добавлен алиас `completedDealsCount` (рядом с `completedDeals`).
- `GET /listings`, `/listings/:id`, fallback-регионы — добавлено `ownerCompletedDealsCount: usersTable.completedDealsCount`; в fallback-блок добавлен `ownerTrustScore` (ранее отсутствовал).

**Фронтенд:**
- `ListingDetail.tsx` — функция `getTrustScoreColor()` (≥90 emerald, ≥70 stone, иначе amber) + строка «Доверие: X% • Сделок: Y» под именем владельца.
- `OwnerProfile.tsx` — та же функция + виджет «Надёжность пользователя» (`bg-[#F2EEE3]`) с процентом и числом завершённых сделок над блоком «Контакты скрыты».

**Безопасность:** алгоритм `lib/trust-score.ts` не тронут; новых endpoint-ов не добавлено.

---

## Stage 29 — Trust Score Engine V6 (реализован в коде, ретро-журнал Stage 32, 29.04.2026)

Реализация V6 «Trust Score helper» из раздела `docs/AGENT_INSTRUCTIONS.md § 11d`. До Stage 32 «Documentation Sync» функционал жил в коде без отдельной записи в журнал — этот пробел закрыт ретроспективно.

**Файл:** `artifacts/api-server/src/lib/trust-score.ts` (~125 строк, экспорт `calculateAndUpdateTrustScore` и `recalculateTrustScoreForUsers`).

**Формула (V1, 0..100), отличается от стартовой версии § 11d:**

```
base                     = 20
+ (avgRating / 5) * 30   — средний рейтинг отзывов о пользователе (как owner + как renter)
+ MIN(deals * 5, 30)     — опыт (число завершённых сделок, кап 30)
+ (isVerified ? 20 : 0)  — бейдж «Проверенный владелец» (Stage 19g)
- claimsAtFault * 20     — подтверждённые претензии, где пользователь виноват
─────────────────────────
clamp(0, 100)
```

Отличается от первоначальной идеи § 11d тем, что (а) база 20 вместо 50, (б) рейтинг масштабируется пропорционально, а не по порогам 4.5/4.0, (в) убраны компоненты «возраст аккаунта» и «бан-история» (закрываются через нулевую активность).

**Семантика «виновности»** (`claimsAtFault`): учитываются `claims.status IN ('approved','paid')`, где пользователь был стороной брони (`booking.owner_id = userId OR booking.renter_id = userId`), но НЕ получателем выплаты (`payout_to_user_id != userId AND payout_to_user_id IS NOT NULL`). То есть фонд закрыл ущерб контрагенту — значит ответственность за инцидент на этом пользователе. Pending/admin_review/rejected не учитываются.

**Триггеры пересчёта** (post-commit, fire-and-forget через `void` — не валит основной ответ):
- `routes/reviews.ts:137` — после создания каждого отзыва: `void calculateAndUpdateTrustScore(review.revieweeId, userId, "review_created:${review.id}")`.
- `routes/admin.ts:16` — после административных действий (verify/unverify, ban, claim approve/mark-paid).
- `backfill-trust-scores.ts` — одноразовый скрипт для разовой инициализации поля у всех существующих пользователей.

**Audit-trail.** Каждое успешное обновление пишется в `audit_events` (`entityType='user'`, `eventType='trust_score_updated'`, payload содержит `previousScore` и `newScore`). При ошибке функция возвращает `null`, лог через pino — наверх ничего не бросает (защита: триггер из `reviews.ts` не должен сломать создание отзыва, если БД для audit временно недоступна).

**Где видно:**
- ✅ **Владельцу** — в собственном `Dashboard.tsx` (таб «Профиль»).
- ✅ **Админу** — в `AdminPage.tsx`, карточке пользователя.
- ✅ В API-ответах: `/api/auth/me`, `/api/users/:id`, `/api/listings`, `/api/listings/:id`, `/api/pools/:id` (поля `trustScore`, `trustScoreUpdatedAt`).
- ❌ **Публично на карточках объявлений и в каталоге** — отложено до калибровки на 100+ завершённых сделках и 50+ владельцах. На малой выборке формула даёт «псевдо-точные» цифры с большим шумом (см. § 11d, пункт «Что НЕ делать сейчас»).

**Что НЕ закрыто (Stage 29 followup):**
- **V7** — ежесуточный cron-пересчёт через `lib/scheduler.ts` для всех владельцев с активными объявлениями (сейчас score освежается только по событиям review/admin).
- **V8** — публичный UI: цветной маркер `87/100` на карточках объявлений, фильтр «TS ≥ 70» в каталоге, объяснялка «Что повысит ваш score» в Dashboard.
- Сброс верификации (`unverify_user`) сейчас **не вызывает** пересчёт TrustScore автоматически: пользователь теряет +20 только когда придёт следующий триггер от review/claim. Если CTO решит, что это критично — добавить `void calculateAndUpdateTrustScore(...)` в обработчик `unverify_user` в `routes/admin.ts`.

## Stage 30A — Multi-Provider AI Gateway & Magic Description (27.04.2026)

> 📌 **Stage 32 sync (29.04.2026):** описание ниже отражает первоначальную архитектуру Stage 30A. Актуальная конфигурация AI-провайдеров после Stage 30C-30J — см. соответствующие журналы:
> - **Gemini:** модель `gemini-flash-latest` (Stage 30G, подтверждён Stage 30J-revert2; CTO подтвердил работу в проде 29.04.2026). НЕ менять обратно на `gemini-1.5-flash` / `gemini-1.5-pro` — они мертвы на v1beta endpoint и возвращают 404. Алиас `*-latest` — единственный надёжный.
> - **Amvera DeepSeek:** URL `https://kong-proxy.yc.amvera.ru/api/v1/models/deepseek` (Stage 30H), модель `deepseek-V3` **case-sensitive** (заглавная V обязательна!), парсинг ответа через `data.alternatives[0].message.text` (Stage 30H-fix2, 29.04.2026). Старая шапка ниже указывает `data.choices[0].message.content` — это было корректно только для эндпоинта `/models/gpt`; для `/models/deepseek` и `/models/llama|qwen` Amvera возвращает `alternatives[]`, а не `choices[]`.
> - **Заголовок Amvera:** `X-Auth-Token: Bearer <token>` (Stage 30E — НЕ `Authorization`, иначе 401 `ALTERNATIVE_STATUS_FINAL`).
> - **Поле сообщений Amvera:** `text` (НЕ `content`, общее правило для всех Amvera-роутов).
> - **Geo-block гипотеза (Stage 30I):** опровергнута Stage 30J-revert2. Прод-Amvera штатно ходит к `generativelanguage.googleapis.com`.

Архитектура «AI Gateway»: единая точка входа для генерации продающих описаний объявлений с возможностью переключать провайдера из админки без перезагрузки сервера. Цель — не зависеть от одного вендора и иметь fallback на отечественный российский инференс (Amvera AI), чтобы избежать рисков геоблокировок при коммерческом запуске.

**Архитектура:**

- **Schema (`platform_settings.activeAiProvider: text default "mock"`)** — провайдер хранится в существующей singleton-таблице, а не в новой k/v (консистентно с `isCommercialMode`, `paymentMode` и т.п.).
- **`lib/ai-service.ts`** — роутер с тремя имплементациями:
  - `mock` — задержка 1.5s + шаблонный русский текст с эмодзи и буллитами (без сети, без расходов; default).
  - `openai` — `POST https://api.openai.com/v1/chat/completions`, модель `gpt-4o-mini`, ключ `OPENAI_API_KEY`, парсинг `data.choices[0].message.content`.
  - `amvera` — **критические отличия** от OpenAI:
    - URL: `https://kong-proxy.yc.amvera.ru/api/v1/models/llama`
    - Заголовок: `X-Auth-Token: Bearer <token>` (НЕ `Authorization`)
    - Поле сообщения: `text` (НЕ `content`)
    - Парсинг: `data.choices[0].message.text`
    - Ключ: `AMVERA_API_TOKEN`
- **Graceful fallback**: при любой ошибке/отсутствии ключа реальный провайдер мягко падает в `mock`, ответ включает `fallback: true` + `fallbackReason`. Pino логирует на уровне `error`.
- **`routes/ai.ts`** — `POST /api/ai/generate-description`, `requireAuth`, in-memory token-bucket rate-limit **10 req/min/user**, валидация `title` (1..200 chars), `category`/`condition` ≤ 100. GC бакетов раз в 5 мин (`unref()` чтобы не держать процесс).
- **Admin UI** — новая вкладка «Настройки ИИ» (`AiSettingsTab` в `AdminPage.tsx`):
  - Радио-карточки трёх провайдеров с описанием, бейджами («Бесплатно», «Зарубежный», «🇷🇺 Россия») и подсказкой нужного env-секрета.
  - Sticky action bar при изменении.
  - Кнопка «🧪 Проверить генерацию» — отправляет тестовый запрос «Дрель Bosch» и показывает результат + флаг fallback. Заблокирована при unsaved changes (чтобы не путать).
  - Endpoint: `PUT /api/admin/settings/ai-provider` (выделенный, помимо общего `PUT /admin/settings`) — пишет в audit_log как `ai_provider:<value>`.
- **User UI** — компонент `AiDescriptionButton` в `ListingForm.tsx`:
  - Кнопка с градиентом `#C65D3B → #a04829` справа от лейбла «Описание».
  - Loading state: «Нейросеть пишет текст… 🪄» + спиннер.
  - Если в текстарии уже >30 символов — `window.confirm` перед перезаписью.
  - Если `title` пустой — toast-ошибка «Сначала введите название».
  - При `fallback: true` — toast «Сгенерировано (fallback)» с пояснением.
  - Категория автоматически подтягивается из выбранного `categoryId`.

**E2E smoke (PASS, 27.04.2026):**
1. Default `mock` → корректный русский текст с эмодзи. ✓
2. Switch via `PUT /admin/settings/ai-provider {amvera}` → 200 `{activeAiProvider:"amvera"}`. ✓
3. Generate с amvera без `AMVERA_API_TOKEN` → `provider:"amvera", actualProvider:"mock", fallback:true, fallbackReason:"AMVERA_API_TOKEN is not set"`. ✓
4. Invalid value `{hackerprovider}` → 400 `{error:"invalid_value", message:"Допустимо: mock | openai | amvera"}`. ✓
5. Switch back to mock → 200 ✓.

**Что нужно для боевого режима Amvera:**
Запросить у пользователя секрет `AMVERA_API_TOKEN` (получается в ЛК Amvera), переключить провайдера в админке.

**Что НЕ сделано (Stage 30A followup):**
- Persistence rate-limit (сейчас in-memory; при рестарте лимиты сбрасываются — приемлемо для MVP).
- Streaming (SSE) ответа для длинных описаний.
- Сохранение «истории генераций» (можно для Pro-подписки).
- A/B-метрики качества: какие описания арендаторы дочитывают/конвертят в бронь.
- Регенерация по фидбеку («сделай короче / добавь юмора»).
- AI-описание для Co-Sharing-пулов (Stage 23a) и совместных закупок (`joint_purchases`).

## Stage 31 — PromoHub /promo (28.04.2026)

Публичный лендинг-витрина «Что мы умеем» по адресу `/promo`. Цель — единая точка для рекламных кампаний, чтобы один UTM-линк вёл на страницу со всеми ключевыми преимуществами платформы (Стальной Щит, Цифровой Акт, Совместное владение, Trust Score, AI-помощник и т.д.), а не на главную с шумом каруселей.

**Что сделано:**
- Маршрут `/promo` в `App.tsx` → новая страница `pages/PromoHub.tsx` (282 строки, framer-motion `whileInView` для секций).
- Структура страницы: Hero с двумя CTA («Смотреть каталог» + «Опубликовать вещь»), 6 фич-секций (Щит / Акт / Co-Sharing / Trust / AI / Подписки) с иконками `lucide-react`, финальный CTA-блок.
- Брендовая палитра выдержана: фон `#F2EEE3` cream, акценты `#C65D3B` terracotta + `#4A8587` teal.
- Mobile audit (Playwright @ 375px): ✓ нет горизонтального скролла, ✓ все CTA-кнопки ≥44px (ширина) для пальца, ✓ декоративные `w-96` blur-круги корректно клипаются `overflow-x-hidden` на `<main>`.

## Stage 30C — Multi-Provider AI: Gemini + Amvera per-request switch (28.04.2026)

Пользователь теперь сам выбирает LLM-движок для каждой генерации (описание + инфографика). По умолчанию — Gemini 1.5 Flash (быстрый, лучше на русском); опционально — Amvera LLaMA 8B (бюджетный отечественный proxy).

**Архитектура:**

- **`lib/ai-service.ts`** — расширены типы и роутер:
  - `type AiProvider = "mock" | "openai" | "amvera" | "gemini"` (+ `isValidProvider`).
  - `generateGemini(input)` и `bulletsGemini(title, category)` — прямой `fetch` на `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`. Хедеры: `X-goog-api-key: process.env.GEMINI_API_KEY`. Body: `{contents:[{parts:[{text}]}], generationConfig}`. Таймаут 25 с через `AbortController` (как у Amvera).
  - **Критично для верстки инфографики:** `bulletsGemini` использует `STRICT_GEMINI_INFOGRAPHIC_PROMPT` поверх базового — требует pipe-формат `буллет1|буллет2|буллет3` и явно ограничивает «макс 32 символа на буллет, делится на 2 строки по ≤16». Парсер сначала пробует `split("|")`, потом fallback на построчный `parseBullets`. Любой буллет >32 символов жёстко обрезается по слову — это страховка от того, что Gemini проигнорирует промпт и сломает SVG (BULLET_MAX_CHARS=16 в `image-service.ts`).
  - `resolveProvider(requested?)` — новая ось разрешения провайдера. Логика: (1) если в DB `activeAiProvider='mock'` → форсим mock независимо от запроса (admin kill-switch для контроля расходов на LLM); (2) иначе если запрос содержит валидного реального провайдера — берём его; (3) иначе — DB-настройка; (4) финальный дефолт `'amvera'`.
  - `generateListingDescription(input, requestedProvider?)` и `generateInfographicBullets(title, category, requestedProvider?)` — добавлен опциональный второй/третий аргумент. Graceful fallback в mock при сбое реального провайдера сохранён.

- **`routes/ai.ts`** — оба эндпоинта (`/generate-description` JSON и `/generate-infographic` multipart) парсят `provider` из тела/формы (нормализуют через `.trim().toLowerCase()`), передают вниз в сервис. Невалидные значения молча игнорируются — сервис подставит дефолт.

- **`pages/ListingForm.tsx`** — Shadcn `<Select>` рядом с кнопкой «✨ Сгенерировать ИИ-описание»: «🧠 Gemini Pro (Премиум)» / «🚀 LLaMA (Базовый)». State `aiProvider` (default `'gemini'`) лежит на уровне формы и применяется к обеим фичам — описание и инфографика. Подпись «Модель ИИ применяется и к генерации описания, и к буллетам инфографики» под селектом. `provider` уходит JSON-полем в `/api/ai/generate-description` и form-полем в `/api/ai/generate-infographic`.

**Безопасность и совместимость:**
- `GEMINI_API_KEY` читается из env только внутри `generateGemini`/`bulletsGemini`; отсутствие → понятная ошибка → graceful fallback в mock без 500.
- Старый kill-switch админа через `platform_settings.activeAiProvider='mock'` сохранён и имеет приоритет над выбором клиента — это сознательно: если админ выключил реальные LLM (сломанный API, исчерпанный лимит), пользовательский Select не сможет это обойти.
- Обратная совместимость: если фронт не пришлёт `provider` (старый клиент), сервис возьмёт DB-настройку как раньше.

**Smoke (PASS, 28.04.2026):**
1. esbuild api-server bundle: `dist/index.mjs 3.4mb`, без ошибок типов ✓
2. Vite ready 1393 ms, фронт-перезапуск без жалоб ✓
3. `GET /api/listings` 200, базовые роуты живы ✓

**Что нужно от админа на проде:** выставить `GEMINI_API_KEY` в Amvera env и перезапустить контейнер. После этого Gemini заработает; Amvera уже работает.

## Stage 30B — AI Visual Magic / Infographic Generator (28.04.2026)

Превращает обычное фото вещи в маркетплейс-инфографику 1080×1080 с тремя AI-извлечёнными буллетами-преимуществами в фирменных цветах. Реализация на стороне сервера через `sharp` + SVG-композит (без внешних image-API), переиспользует Stage 30A AI Gateway для текста.

**Архитектура:**

- **`lib/ai-service.ts` → `generateInfographicBullets(title, category?)`** — новая функция поверх существующего multi-provider router (`mock` / `openai` / `amvera`). Промпт: «РОВНО 3 буллета по 2–5 слов на русском, без эмодзи и нумерации». Парсер `parseBullets()` снимает префиксы `1.`/`-`/`•`, обрезает до 5 слов на буллет. При ошибке/отсутствии ключа — graceful fallback в mock с тремя статичными буллетами на основе названия (`Готово к работе` / `Идеально для <категория>` / `Полный комплект`).
- **`lib/image-service.ts` → `buildInfographicImage(buf, bullets)`** — sharp-пайплайн:
  1. Базовый кремовый холст 1080×1080 (`#F2EEE3`, RGBA).
  2. Фото пользователя: `rotate()` (EXIF auto-rotate), `resize(560×840, fit:cover)`, скруглённые углы (radius 36) через SVG-маску `composite({blend: "dest-in"})`.
  3. Текстовый SVG-оверлей 380×840 на левой стороне: плашка бренда «Хочу_То» с акцентом `#C65D3B`, тэглайн «МАРКЕТПЛЕЙС АРЕНДЫ», 3 буллета с круглыми галочками (`circle r=34 fill=#C65D3B` + белая `path` 6px stroke), нижняя терракотовая линия. Длинные буллеты переносятся на 2 строки через `wrapBullet()` (≤24 симв.). XML-инъекции защищены `escapeXml()`.
  4. Финальный композит → `webp({quality: 88})` ≈ 16–80 КБ.
- **`routes/ai.ts` → `POST /api/ai/generate-infographic`** — multipart/form-data: `photo` (single, 10 МБ лимит, image/* mime) + `title` + опц. `category`. `requireAuth` + общий с описаниями rate-limit 10/min/user (оба эндпоинта бьют один LLM-кошелёк). Multer с `memoryStorage()` (без лишнего I/O), результат сохраняется в `UPLOADS_DIR` как `<uuid>.webp`. Ответ: `{url, bullets, provider, actualProvider, fallback?, fallbackReason?}` — фронт получает обычный `/uploads/...` URL и просто добавляет в галерею.
- **`pages/ListingForm.tsx` → кнопка «🪄 Создать инфографику»** — рядом с «По ссылке» / «Добавить фото» в шапке секции «Фотографии». Градиент `#C65D3B → #a04829`, иконка `Sparkles`. Скрытый `<input type="file">` открывается по клику. Перед открытием file-picker'а — guard'ы: пустой `title` → toast «Сначала введите название», `photos.length ≥ 10` → toast лимита. Категория автоматически подтягивается из выбранного `categoryId` для качественных буллетов. Loading state «Готовим…» + спиннер. На успехе — toast с буллетами или предупреждение про fallback.

**Зависимости и инфра:**
- `sharp` (npm) — добавлен через `installLanguagePackages`, уже в `build.mjs` externals (поэтому корректно остаётся требованием рантайма, не бандлится esbuild'ом).
- `dejavu_fonts` (NixOS system dep) — DejaVu Sans для рендеринга кириллицы в SVG. Без него `sans-serif` мог бы упасть в Western-only fallback.

**Smoke (PASS, 28.04.2026):**
1. `installLanguagePackages sharp` → success ✓
2. Esbuild bundle: `dist/index.mjs 3.4mb`, без жалоб на missing modules ✓
3. Standalone test (`node`, синтетическое 800×600 фото + 3 кириллических буллета) → 1080×1080 webp 16 КБ ✓
4. `POST /api/ai/generate-infographic` без auth → 401 «Требуется авторизация» ✓
5. Health-check `/api/health` → 200 ✓

**Что НЕ сделано (Stage 30B followup):**
- Замена системного `sans-serif` на embedded Montserrat/Inter через `@font-face` в SVG (для пиксельной точности с фронтом — сейчас фронт Montserrat, картинка DejaVu).
- Live-превью инфографики до сохранения (сейчас фото сразу попадает в галерею; UX «не понравилось — удали и сделай заново»).
- Выбор шаблона (горизонтальный 1200×630 для соцсетей, сторис 1080×1920).
- Watermark «Хочу_То» опционально для бесплатного тарифа (сейчас плашка бренда — встроена в дизайн).
- Кеш инфографик по `(photoHash, bulletsHash)` — повторная генерация всегда тратит токены LLM.

## Stage 30D–30G — AI Provider Hardening: prod-debug & retries (28.04.2026)

После выкатки Stage 30C на Amvera всплыли скрытые баги интеграции с обоими провайдерами — этот блок собирает все четыре итерации в один. Все правки изолированы в `artifacts/api-server/src/lib/ai-service.ts` (4 функции: `generateAmvera`, `generateGemini`, `bulletsAmvera`, `bulletsGemini`) + стартовый блок в `artifacts/api-server/src/index.ts`.

**Stage 30D — диагностика и verbose-логи:**
- В `index.ts` перед `app.listen` добавлен блок `--- AI CONFIG DIAGNOSTICS ---`, который при старте печатает `exists: true/false` и `length: <N>` для `GEMINI_API_KEY` и `AMVERA_API_TOKEN`. Сами ключи никогда не логируются (даже частично). Длина 39 = эталонный Google API key; 40+ → в env прилетел `\n`.
- Все 4 AI-функции получили `console.error(await res.text())` ПЕРЕД `throw` при non-2xx ответе провайдера — теперь по логам Amvera сразу видно body-сообщение, а не только статус.
- Gemini переведён на формат ключа в URL (`?key=${encodeURIComponent(apiKey)}`) — раньше был хедер `X-goog-api-key`, который v1beta endpoint отдавал как 401.

**Stage 30E — Amvera auth-format откат:**
- Попытка унифицировать Amvera под `Authorization: Bearer <token>` (как у Gemini/OpenAI) дала на проде HTTP 401 с body `{"status":"ALTERNATIVE_STATUS_FINAL"}`. Откат на `X-Auth-Token: Bearer <token>` — это нестандартное требование Kong-проксей Amvera (зафиксировано в Agent Rules → AI Gateway).

**Stage 30F — env bulletproof + workflow cleanup:**
- `process.env.AMVERA_API_TOKEN?.trim()` и `process.env.GEMINI_API_KEY?.trim()` во всех 4 точках. Это страховка от хвостового `\n`/пробела, которые Amvera-консоль умеет молча приклеивать при копи-пасте секрета в UI.
- `throw new Error("X is missing")` теперь срабатывает уже на затримленном значении — ключ из одних пробелов корректно отвергается.
- Стартовая диагностика в `index.ts` сознательно оставлена БЕЗ `.trim()` — чтобы при ротации ключа сразу видеть «сырую» длину и расхождение с ожидаемой.
- Попытка удалить три артефакт-воркфлоу через `removeWorkflow` упёрлась в `PROHIBITED_ACTION: managed by an artifact` — задокументировано в Agent Rules как ограничение платформы.

**Stage 30G — Gemini model alias fix:**
- Константа `GEMINI_MODEL = "gemini-1.5-flash"` → `"gemini-flash-latest"`. Google вычистил алиас `gemini-1.5-flash` из v1beta endpoint, на проде прилетал `404 model not found`. `*-latest` — страховка от повторения той же истории при следующей ротации алиасов. Обе функции (`generateGemini` и `bulletsGemini`) собирают URL из общей константы, поэтому правка одна.

**Smoke (PASS на dev, 28.04.2026):**
1. esbuild api-server bundle — без ошибок типов ✓
2. Workflow `Start application` рестартует чисто, диагностический блок печатается в логе ✓
3. `GET /api/listings`, `GET /api/health` → 200 ✓
4. На локалке Replit `GEMINI_API_KEY`/`AMVERA_API_TOKEN` не заданы — система корректно проваливается в smart-mock без 500 ✓

**Финальные SHA в GitHub (origin/main подтверждено пользователем):**
- `586328b` — Revert Amvera auth header (30E)
- `e2f2487` — Bulletproof env vars with .trim() (30F)
- `d345122` — Gemini model URL → flash-latest (30G)

**Прод-проверка (на Amvera после деплоя):**
1. В логе старта — блок `--- AI CONFIG DIAGNOSTICS ---`, оба ключа `exists: true`, `GEMINI_KEY length: 39`.
2. Первый `POST /api/ai/generate-description` с провайдером Gemini — НЕ должен вернуть 404. Если вернётся 401/403/429 — это уже про сам ключ или квоту, не про URL/модель.
3. Первый `POST /api/ai/generate-description` с провайдером Amvera — НЕ должен вернуть 401 `ALTERNATIVE_STATUS_FINAL`. Если вернётся — значит `X-Auth-Token: Bearer` где-то откатили на `Authorization`, искать регрессию.

## Stage 30H — Amvera pivot: llama → DeepSeek-V3 (29.04.2026)

После Stage 30D-G на проде Amvera упорно отдавал «empty response» с прежнего эндпоинта `/models/llama` + модели `llama8b`. По openapi-спеке Amvera (`https://lllm-swagger-amvera-services.amvera.io/openapi.yaml`) роут `/llama` помечен deprecated, а в админке Amvera в списке доступных моделей фигурируют DeepSeek/GPT/Qwen без LLaMA.

**Диагностика по официальной документации** (`https://docs.amvera.ru/LLM/doc-inference-ru.html`):
- Эндпоинт собирается как `POST /models/<inference_name>`, где `<inference_name>` — **семейство**, а не имя конкретной модели:
  - `/llama` → `llama8b`, `llama70b`
  - `/gpt` → `gpt-4.1`, `gpt-5` (только OpenAI-модели!)
  - `/deepseek` → `deepseek-R1`, `deepseek-V3`
  - `/qwen` → `qwen3_30b`, `qwen3_235b`
- Имя модели **case-sensitive**: `deepseek-V3` с заглавной V (lowercase Amvera молча отдаёт пустой ответ).
- Поле сообщений и ответа — `text`, не `content` (общее правило для всех Amvera-роутов, без исключений; в openapi.yaml: `messages[].text` и `choices[].message.text`).

**Правки** (всё строго в `artifacts/api-server/src/lib/ai-service.ts` + UI-надписи на двух экранах):
- Добавлены константы:
  ```ts
  const AMVERA_URL   = "https://kong-proxy.yc.amvera.ru/api/v1/models/deepseek";
  const AMVERA_MODEL = "deepseek-V3";
  ```
- Обе функции (`generateAmvera` и `bulletsAmvera`) собирают URL и `model: AMVERA_MODEL` из этих констант — нет дублирования, при следующей ротации модели правка будет в одной строке.
- Шапка файла переписана: указан правильный эндпоинт, явно подчёркнуто, что `/gpt` — НЕ для DeepSeek, и что имя модели case-sensitive.
- Хедер `X-Auth-Token: Bearer ${token}`, `.trim()` на токен, поле `text`, парсинг `data.choices[0].message.text`, smart-mock fallback, verbose `console.error(await res.text())` перед `throw` — всё сохранено из Stage 30D-G.
- `artifacts/hochu-to/src/pages/ListingForm.tsx` — dropdown: `🚀 LLaMA (Базовый)` → `🚀 DeepSeek-V3 (Amvera)`.
- `artifacts/hochu-to/src/pages/AdminPage.tsx` — карточка провайдера в админке: заголовок `Amvera AI (DeepSeek-V3)` + описание про инференс через `/models/deepseek`.

**Smoke (PASS на dev, 29.04.2026):**
1. esbuild api-server bundle — без ошибок типов ✓
2. Workflow `Start application` рестартует чисто, диагностический блок печатается ✓
3. `GET /api/listings`, `GET /api/categories`, `GET /api/regions` → 200 ✓

**Прод-проверка (на Amvera после деплоя):**
1. `POST /api/ai/generate-description` с `provider: "amvera"` → должен вернуться нормальный текст с `actualProvider: "amvera"`, `fallback: false`. Если снова `empty response` — лог `[AI Service Error][Amvera/description]` теперь печатает body (Stage 30D), скорее всего модель называется в API чуть иначе (например, `DeepSeek-V3` всё-таки с заглавных D и V, или Amvera поменял name между админкой и API). Документация утверждает `deepseek-V3`.
2. UI на форме создания и в админке должен показывать «DeepSeek-V3 (Amvera)», а не «LLaMA (Базовый)».
3. Если Gemini (Stage 30G) на проде продолжит падать с РФ-IP — это уже Stage 30I (geo-block геофикс через прокси либо скрытие Gemini из dropdown'а с пометкой «работает на VPN-серверах»).

## Stage 30J — Gemini Pro→Flash fallback + UX form polish (29.04.2026)

Делится на две ортогональные части. Backend трогает только `artifacts/api-server/src/lib/ai-service.ts`, frontend — только `artifacts/hochu-to/src/pages/ListingForm.tsx`. Amvera-ветка (`generateAmvera`/`bulletsAmvera`/AMVERA_URL/AMVERA_MODEL) **не трогалась** — все правки Stage 30H/30H-fix2/30K сохранены.

**A. Backend — премиум-Gemini c graceful деградацией:**
- Удалён общий `GEMINI_MODEL`, заведены два константы: `GEMINI_PRO_MODEL = "gemini-1.5-pro-latest"` (основная, премиум-качество) и `GEMINI_FLASH_MODEL = "gemini-1.5-flash"` (fallback при перегрузке Pro).
- Вынесены два хелпера: `geminiCall(apiKey, model, prompt, generationConfig, signal)` — сырой POST на v1beta `:generateContent?key=…`, и `geminiCallWithFallback(apiKey, prompt, generationConfig, signal, context)` — пробует Pro, при 429/503 silent retry на Flash, при любой другой ошибке throw (наверху ловит smart-mock).
- `generateGemini` теперь использует `geminiCallWithFallback`. **Важно:** `maxOutputTokens` поднят с `800` → `2048`. Старое значение обрезало описание на середине списка преимуществ — пользователь жаловался, что Gemini-текст «недоделанный». 2048 хватает на полное описание (~1500-1700 русских символов с эмодзи).
- `bulletsGemini` тоже использует `geminiCallWithFallback`, но с обновлённым промптом по ТЗ: английская инструкция «top-tier marketing copywriter, exactly 3 selling points, max 3-5 words, 1 emoji at start, return ONLY valid JSON array of strings, strings in Russian», + пример. Парсер с тройным fallback'ом: (1) `JSON.parse` после снятия `\`\`\`json…\`\`\`` обёртки, (2) pipe-формат (наследие 30C), (3) построчный `parseBullets`. Жёсткая страховка вёрстки `≤ 32 символа/буллет` (режем по слову) сохранена — иначе SVG инфографики ломается.
- **Внимание для прод-Amvera:** наш fallback покрывает только 429/503. Если Google вернёт 403 «country not supported» (Stage 30I — Gemini до сих пор режется на РФ-IP), оба запроса упадут до smart-mock. Это допустимое поведение, поскольку Stage 30I в roadmap'е и решается отдельно (VPN-proxy / скрытие Gemini из dropdown).

**B. Frontend — сворачиваемые секции формы + расширяемое поле «Описание»:**
- 3 заголовка (`Основная информация`, `Цена и условия`, `Фотографии`) превращены в кликабельные кнопки `<button>` с иконкой `ChevronUp/ChevronDown` справа. State: `openSections: Record<"basic"|"price"|"photos", boolean>`.
- **Дефолт зависит от режима:** при создании (`!isEditing`) все секции открыты — чтобы пользователь не пропустил обязательные поля. При редактировании (`isEditing`) — все секции свёрнуты по умолчанию, чтобы владелец видел структуру целиком и точечно открывал нужное (типичный сценарий — поправить только цену).
- Test-id'ы: `section-toggle-basic`, `section-toggle-price`, `section-toggle-photos`, `button-toggle-description-expand`.
- Поле «Описание»: дефолтная высота поднята с `min-h-[120px]` → `min-h-[180px] md:min-h-[220px]` (на мобильном 120px было слишком тесно для AI-текста). Рядом с кнопкой генерации — новая кнопка «Развернуть»/«Свернуть» (Maximize2/Minimize2), которая раздувает textarea до `min-h-[480px] md:min-h-[600px]`. Состояние локальное (`descriptionExpanded`), сбрасывается при размонтировании формы.

**Smoke-проверка:**
- esbuild api-server bundle — без ошибок ✓
- vite production-build фронта (`PORT=5000 BASE_PATH=/ pnpm --filter @workspace/hochu-to build`) — `✓ built in 18.03s`, JSX валиден ✓
- HMR на `/dashboard/listings/new` после правок — 6 итераций без ошибок ✓
- Доступ к `/dashboard/listings/new` без логина — корректный редирект на `/auth` (страница защищена) ✓

**Прод-проверка после деплоя:**
1. Открыть форму создания — увидеть 3 свёрнутые шапки секций (если в режиме редактирования) или развёрнутые (если в режиме создания).
2. На клик по шапке — раскрытие/сворачивание плавное, ChevronUp ↔ ChevronDown.
3. Кнопка «Развернуть» рядом с «Сгенерировать» — textarea вырастает в ~3 раза.
4. Сгенерировать описание через Gemini Pro — должен вернуться полный текст без обрыва на середине. В логе при перегрузке `[AI Service Warn][Gemini/description]: Pro returned 429, falling back to Flash`.
5. Сгенерировать инфографику через Gemini — буллеты приходят как JSON-массив `["⚡ …","🧰 …","🏗 …"]`, по 3-5 слов, с эмодзи.

## Stage 30J-revert2 — откат Pro→Flash, возврат к Stage 30G конфигу (29.04.2026, ЗАКРЫТО)

**Контекст.** После деплоя Stage 30J на прод Gemini выдавал 404: эксперимент с `gemini-1.5-pro-latest` → `gemini-1.5-flash` через хелпер `geminiCallWithFallback` сломал работающую конфигурацию Stage 30G. Три попытки точечного хотфикса (`774abae` поменял PRO на `gemini-1.5-pro`, `896072d` оба на `gemini-1.5-flash`, `3dffd57` оба на `gemini-2.5-flash`) — каждая давала 404 от Google с разной причиной. CTO попросил откатить всю архитектуру назад к простому прямому fetch.

**Корень проблемы.** Был не в обёртке `geminiCallWithFallback` (она ничего не трансформировала, просто делегировала вызов), а в том, что в Stage 30J я взял имена моделей `gemini-1.5-pro-latest` / `gemini-1.5-flash` без проверки против журнала Stage 30G. А там чёрным по белому: Google вычистил алиас `gemini-1.5-flash` из v1beta endpoint ещё 28.04, и единственное рабочее имя — `gemini-flash-latest` (`*-latest` — официальная страховка Google от ротации версий). При первом откате я опять буквально взял `gemini-1.5-flash` из текста задачи и снова получил 404.

**Финальная конфигурация в `artifacts/api-server/src/lib/ai-service.ts`:**
- Одна константа `const GEMINI_MODEL = "gemini-flash-latest"` с жирным `⚠️ КРИТИЧНО`-комментарием со ссылкой на Stage 30G — чтобы никто (включая будущего меня) опять не поставил `gemini-1.5-*`.
- Удалены `GEMINI_PRO_MODEL`, `GEMINI_FLASH_MODEL`, `geminiCall`, `geminiCallWithFallback`.
- `generateGemini` и `bulletsGemini` — простой прямой `fetch` к `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=…`. При ошибке — обычный `throw`, наверху ловит smart-mock.
- Премиум-промпт `PREMIUM_GEMINI_INFOGRAPHIC_PROMPT` сохранён, тройной парсер JSON→pipe→parseBullets и страховка `≤ 32 символа/буллет` сохранены — это ортогональная UX-логика, к проблеме модели отношения не имела.
- Amvera-ветка (`generateAmvera`/`bulletsAmvera`/AMVERA_URL/AMVERA_MODEL), OpenAI, mock, router, frontend — **НЕ тронуты**.

**Прод-проверка (PASS, 29.04.2026, подтверждено CTO).** Gemini и Amvera DeepSeek-V3 оба возвращают полные описания и буллеты с `actualProvider: "gemini"|"amvera"`, `fallback: false`. Smart-mock в логах не появляется.

**Чему это нас учит (НЕ регрессировать):**
- **При смене имени модели Gemini ВСЕГДА сверяться с журналом Stage 30G.** Имена `gemini-1.5-flash`/`gemini-1.5-pro`/`gemini-1.5-pro-latest` мертвы на v1beta. Алиас `*-latest` — единственный надёжный.
- **Опровергнута гипотеза Stage 30I (geo-block).** Раньше думали, что Google режет запросы с РФ-IP Amvera; на самом деле прод-Amvera успешно ходит к `generativelanguage.googleapis.com` — вся симптоматика была на стороне неправильного имени модели, а не геофильтра. Stage 30I из roadmap'а вычеркнут.
- **Не верить тексту задачи буквально, если он противоречит Stage-bible.** Если в задаче CTO просит вернуть `gemini-1.5-flash`, а в журнале Stage 30G стоит «вернуть на `gemini-flash-latest`» — приоритет у журнала. Перед правкой такого рода предупредить пользователя и сослаться на запись.

### Push
```bash
bash scripts/github-push.sh "fix(ai): restore working gemini-flash-latest model (Stage 30G config)"
```

## Stage 30H-fix2 — Amvera response shape (alternatives vs choices) (29.04.2026)

После деплоя Stage 30H на проде Amvera возвращал HTTP 200, но наш парсер всё равно падал в `Amvera: empty response`. Причина — мы с самого Stage 30A парсили **OpenAI-формат** ответа (`data.choices[0].message.text`), а Amvera для большинства эндпоинтов отдаёт **Yandex/Amvera-формат** (`data.alternatives[0].message.text`).

**Источник истины** — openapi.yaml (`https://lllm-swagger-amvera-services.amvera.io/openapi.yaml`):

| Эндпоинт | Поле в ответе |
|---|---|
| `/models/llama` (deprecated) | `alternatives[0].message.text` |
| `/models/gpt` | `choices[0].message.text` (имитация OpenAI) |
| `/models/deepseek` | в спеке не описан, эмпирически `alternatives` |
| `/models/qwen` | в спеке не описан, эмпирически `alternatives` |

То есть OpenAI-схема есть **только** на `/gpt`, а на трёх других эндпоинтах — нативный Amvera-формат с `alternatives`.

**Правки** (`artifacts/api-server/src/lib/ai-service.ts`):
- В `generateAmvera` и `bulletsAmvera` парсинг заменён на nullish-fallback по обоим полям:
  ```ts
  const text =
    data?.alternatives?.[0]?.message?.text ??
    data?.choices?.[0]?.message?.text;
  ```
  Так код устойчив к переключению эндпоинта в любом направлении (если CTO когда-нибудь решит вернуться на `/models/gpt` или попробовать Qwen — фикс не нужен).
- Добавлен диагностический `console.error("...Unexpected response shape, raw data slice:", JSON.stringify(data).slice(0, 500))` ВНУТРИ ветки empty response — чтобы при следующей мутации формата ответа сразу было видно сырую структуру в логах Amvera, а не гадать.
- Шапочный комментарий файла переписан: явно перечислены оба формата с указанием, на каких эндпоинтах какой используется.

**Smoke (PASS на dev, 29.04.2026):**
- esbuild api-server bundle — без ошибок типов ✓
- Workflow `Start application` рестартует чисто ✓

**Прод-проверка:**
- После деплоя `POST /api/ai/generate-description` с `provider: "amvera"` должен вернуться нормальный текст. Если опять `empty response` — теперь в логе будет строка `[AI Service Error][Amvera/description]: Unexpected response shape, raw data slice: {...}` со срезом сырого JSON-ответа. С этим уже можно прицельно фиксить путь.

## What Is NOT Yet Implemented (roadmap)

> 📌 **Stage 32 sync (29.04.2026):** список вычищен от закрытых пунктов и расщеплён на 4 категории. Полный актуальный чеклист — в разделе **Project Checklist** выше (✅ / 🟡 / 🛑 / 🔴). Этот раздел теперь — навигация для исторических ссылок.

### Сознательно отложено до открытия ИП (Deferred by Design)

См. подробности в Project Checklist → 🛑 «Сознательно отложено».

- **Stage 21b — ЮKassa для покупки контактов** (single / pack10 / unlimited30d). Серверная инфраструктура готова; подключение зависит от Stage 24.
- **Stage 21c / Stage 24 — ЮKassa-холд** (`capture:false`) для бронирований Premium с защитой и для пулов (`pool_shares.payment_status='escrow_held'`).
- **Реальные выплаты из Shield-фонда** через ЮKassa Payouts API — сейчас только ручной mark-paid админом (Stage 17a/17b).
- **KYC через сайт (152-ФЗ + 115-ФЗ)** — паспорт/ОГРН/селфи. Текущая верификация = ручная через `support_ticket category='verification_request'`. См. `AGENT_INSTRUCTIONS.md § 11d`.

### Технический бэклог (можно делать сейчас)

- **Stage 27 followup** — WebSocket/SSE вместо polling, гендерное склонение в нотификациях. ~~Унификация audit-trail bookings через `audit_events`~~ — закрыто **Stage 32-B** (02.05.2026): `recordEvent()` в bookings.ts → `recordAuditEvent(entityType="booking")`; admin.ts audit trail читает из `auditEventsTable`; scheduler auto-transitions → audit_events. `booking_events` сохранена как read-only (легаси данные).
- **Stage 28 followup** — `AlertDialog` вместо нативного `confirm()` в `BuyoutBlock`, кнопка «Отказаться» у participant выкупа, авто-cancel зависших buyout через cron.
- **Stage 29 followup** — V7 (ежесуточный cron-пересчёт TrustScore), V8 (публичный UI score после калибровки на 100+ сделок и 50+ владельцах).
- ~~**Stage 30B followup**~~ — закрыто **Stage 32-B** (02.05.2026): disk-кэш инфографик 24ч по SHA-256(photo+bullets) в `/tmp/infographic-cache/`; Montserrat-Bold + Inter-Regular base64-embedded в SVG через `@font-face`; шаблон 1200×630 (`buildHorizontalImage`) + endpoint параметр `?format=horizontal`.
- **Stage 30L (опц.)** — кеш AI-генераций по `(title, category, provider)`. Экономия токенов на UX «не понравилось — давай ещё раз», особенно актуально на платных провайдерах.

### Закрыто (вычеркнуто из roadmap)

- ~~**Видео в Цифровом Акте**~~ — закрыто **Stage 22b-followup** (`POST /api/upload-video`, multer 100МБ, magic-byte sniff `ftyp`/`EBML`, whitelist `/uploads/<uuid>.(mp4|webm|mov|m4v)`).
- ~~**GPS-pin на карте в админке**~~ — закрыто **Stage 22b** (`DigitalActMap.tsx`, Leaflet read-only с фирменным пином `#C65D3B`).
- ~~**Цифровая подпись сторон**~~ — закрыто **Stage 22b** (`SignaturePad.tsx`, server-side `validateSignature()` regex + лимит 300КБ + PNG-magic байты, обязательна для сохранения акта → 400 `signature_required`).
- ~~**Trust Score (Этап 3)**~~ — V1-V6 закрыты **Stage 19g + Stage 29**. V7-V8 в техническом бэклоге выше.
- ~~**ЮKassa интеграция (серверная)**~~ — закрыто **Stage 21a** для use-case промо. Закрытие для бронирований/пулов = Stage 24 (см. 🛑 Deferred by Design).
- ~~**Stage 30I — Gemini geo-block с РФ-IP**~~ — гипотеза опровергнута Stage 30J-revert2 (29.04.2026). Симптомы «Gemini не работает на проде» были вызваны исключительно мёртвым алиасом `gemini-1.5-flash`; после возврата к `gemini-flash-latest` Gemini работает с Amvera штатно, подтверждено CTO.

### Будущие фичи (Roadmap, не начато)

- **Stage 33.0 (30.04.2026)** — AI-избыточность + UI-полировка: прямой DeepSeek API (`api.deepseek.com`) как второй резерв (Amvera → Direct DeepSeek → Mock); `window.confirm()` заменён на кастомный AlertDialog в `ListingForm.tsx`; секрет `DEEPSEEK_API_KEY` добавлен.
- **Stage 33 — AI-Арбитражор (Vision Analysis)** — следующий research stage. Мультимодальный LLM-вердикт по спорам, human-in-the-loop. Перед стартом нужен design discovery с CTO по 5 открытым вопросам (см. журнал Stage 33 в `docs/AGENT_INSTRUCTIONS.md`).
- Партнёрские бейджи для юрлиц (5% комиссии вместо 10%).

## Future Scaling

- Dokan/WooCommerce plugin readiness — multivendor architecture via owner roles
- MotoPress Calendar integration ready (booking calendar in place)
- Payment gateway hooks ready (total_price calculated at booking)
- SEO: unique title/meta per page, Russian-language content
 
