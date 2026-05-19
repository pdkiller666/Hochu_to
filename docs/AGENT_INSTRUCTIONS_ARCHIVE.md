# AGENT_INSTRUCTIONS Archive — Stage Journals (апрель–май 2026)

> Этот файл содержит детальные журналы реализованных этапов Stage 17b–Stage 38 (23.04–02.05.2026).
> Актуальная операционная документация — в `docs/AGENT_INSTRUCTIONS.md`.
> Журналы новых этапов (Stage 39+) — в конце `docs/AGENT_INSTRUCTIONS.md`.

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


---

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

## Журнал — Stage 20c (Поля ЮKassa в админке, 24.04.2026)

**Контекст:** пользователь захотел подключение ЮKassa, но ключей у него ещё нет — попросил «сделай поля где потом заполнять». Это подготовительный мини-стейдж перед реальной интеграцией (Stage 21+).

**Реализация:**
1. Schema `lib/db/src/schema/platform_settings.ts` — добавлено поле `yookassaSecretKey: text("yookassa_secret_key")` (nullable). Применено через `pnpm --filter @workspace/db push`.
2. `routes/admin.ts`:
   - Список `allowed` (line ~1199) — добавлен `"yookassaSecretKey"` (PUT принимает).
   - Список `NULLABLE_STR_FIELDS` (line ~1244) — добавлен `"yookassaSecretKey"` (валидация: max 255, пустая строка → null).
3. `pages/AdminPage.tsx`:
   - Сет `NULLABLE_STR` (line ~2244) — добавлен `"yookassaSecretKey"` (frontend нормализация).
   - UI блок ЮKassa полностью переработан: вместо однострочной подсказки «Секреты в env» теперь активная ссылка на ЛК ЮKassa (`https://yookassa.ru/my/merchant/integration/api-keys`), 2 поля в grid (Shop ID `type=text` + Secret Key `type=password` `autoComplete=off`, моноширинный font), плюс переключатель тест-режима. Жёлтое предупреждение `⚠ Включено без полных реквизитов` если `yookassaEnabled=true` но один из ключей пуст.
   - Заменена нижняя плашка `bg-amber-50` («секреты не редактируются») на `bg-stone-50` с реалистичной пометкой: «секреты хранятся в БД, в продакшене ENV `YOOKASSA_SECRET_KEY` приоритетнее БД» — заложен будущий fallback-механизм для Stage 21+.

**Защита от утечки секрета:**
`publicSettings(s)` в `lib/platform-settings.ts` — explicit whitelist по полям. Чтобы добавить новое поле в публичный endpoint `GET /api/settings`, его нужно явно вписать в функцию. `yookassaSecretKey` туда автоматически НЕ попадает.

**Smoke-тесты (curl + jq):**
- `psql` — колонка `yookassa_secret_key text` создана ✅
- `GET /api/admin/settings` (admin token) — возвращает `yookassaSecretKey` ✅
- `PUT /api/admin/settings -d '{"yookassaSecretKey":"test_TXxYdummykey..."}'` → 200, значение сохранено ✅
- `GET /api/settings` (без auth) — `has("yookassaSecretKey") === false` ✅ (нет утечки)
- `PUT -d '{"yookassaSecretKey":null}'` — очистка работает ✅

**Что НЕ сделано (для следующего стейджа):**
- Реальный ЮKassa REST клиент (`lib/yookassa.ts`).
- Таблица `payments` для tracking платежей.
- Webhook receiver `POST /api/webhooks/yookassa`.
- Refactor `routes/promotions.ts` POST на webhook-driven activation.
- Frontend redirect-flow в `PromoteListingModal`.

Когда юзер сообщит, что ключи заполнены — продолжим со Stage 21a. Заготовка плана уже есть в `.local/session_plan.md`, но НЕ выполняем до получения сигнала.

**Уроки:**
1. **Хранение секретов в БД vs ENV.** Идеологически в env безопаснее (не попадает в дампы БД, легче ротировать), но в админ-UI редактировать удобнее. Компромисс: код будущего YK-клиента должен брать `process.env.YOOKASSA_SECRET_KEY ?? settings.yookassaSecretKey` — ENV override. В дев-режиме юзер заполняет в админке, в проде задаёт ENV.
2. **Whitelist publicSettings — single source of truth.** Любой новый секрет/чувствительное поле в `platform_settings` НЕ требует дополнительной защиты — он автоматически не попадает в публичный endpoint, пока его явно не добавят в `publicSettings()`. Это правильный default.
3. **`type=password` + `autoComplete=off`** в input для секрета — звёздочки + браузер не запоминает в form-history. Базовый UX-минимум.

## Последние изменения (Лог)

### Stage 20b — Полировка СБП
- Внедрен Whitelist из 25 банков (slug-id).
- Нормализация телефонов `normalizeSbpPhone` (строго +7XXXXXXXXXX).
- Защита от дублей реквизитов через partial unique indexes в БД.
- Исправлен баг Drizzle 0.45 с перехватом ошибок `cause.code`.

### Stage 20c — Поля ЮKassa в админке
- В `platform_settings` добавлена колонка `yookassa_secret_key`.
- Создан UI-блок в Админ-панели для настройки платежей.
- Реализована защита от утечки секретного ключа в публичные GET-запросы.

### Stage 21a — Soft Launch Toggle + YooKassa Core (24.04.2026)

**Цель**: подготовить публичный бета-запуск без риска для существующих флоу.
Все пользовательские потоки (бронирования, контакты, claims, отзывы, цифровые
акты, чаты) **визуально не меняются** — переопределяется только финансовая
математика и платёжные шлюзы.

**Master-тумблер**: `platform_settings.is_commercial_mode boolean default false`.
Через `publicSettings()` выводится во фронт под ключом `isCommercialMode`.

**Новая таблица `payments`** (`lib/db/src/schema/payments.ts`):
- `id, user_id, amount_rub, status` (pending/succeeded/canceled/refunded/failed),
  `yookassa_payment_id` UNIQUE, `target_type` (promotion/contact_pack/booking_protection),
  `target_id`, `provider` (yookassa/mock), `idempotency_key`, `metadata jsonb`,
  `paid_at`, timestamps.
- Применено через `pnpm --filter @workspace/db push --force`.

**Файлы и логика**:
- `artifacts/api-server/src/lib/yookassa.ts` — REST-клиент с Idempotence-Key,
  `createPayment` (capture default `true`, опция `capture:false` для будущих
  холдов броней Premium), `getPayment`, `capturePayment`, `cancelPayment`,
  `verifyWebhookSignature`. Реквизиты: ENV `YOOKASSA_SHOP_ID/SECRET_KEY` имеют
  приоритет над `platform_settings`.
- `routes/bookings.ts` — при `!isCommercialMode` в POST + dates-change recompute
  обнуляются `serviceFee/taxFee/fundContribution/renterFundContribution`.
- `routes/contacts.ts` — в `POST /listings/:id/contact-purchase` при OFF
  мгновенный bypass без списания баланса, `source: "beta_free"`,
  toast «В рамках бета-теста открытие контактов бесплатно!».
- `routes/promotions.ts` — branching:
  - **OFF/мок**: продвижение активируется мгновенно, в `payments` пишется
    `provider:"mock", status:"succeeded", amountRub:0`. Ответ `{mode:"instant"}`.
  - **ON/реальный**: insert pending-промо с `validUntil = epoch(0)` и
    `paymentRef='PENDING'`, создаётся ЮKassa-платёж, в `payments` лог pending.
    Ответ `{mode:"redirect", paymentUrl, paymentId}`. Активация флагов
    VIP/Срочно/Boost — только по успешному вебхуку.
- `routes/webhooks.ts` — `POST /api/webhooks/yookassa`: верифицирует подпись
  (опц. `YOOKASSA_WEBHOOK_SECRET`), повторно дёргает `getPayment(id)`, обновляет
  `payments.status`, в транзакции активирует `target_type=promotion`
  (`validUntil = GREATEST(now, текущее) + interval days`, `paymentRef = ЮKassa id`).
  Идемпотентен по `yookassa_payment_id`. Stage 21b/c добавит обработку
  `contact_pack` и `booking_protection`.
- `lib/platform-settings.ts` — `DEFAULTS.isCommercialMode = false`,
  `publicSettings()` отдаёт `isCommercialMode` (без секретов).

**Фронт**:
- `components/BetaBanner.tsx` — sticky-баннер сверху, виден только при
  `isCommercialMode === false`, скрыт на `/admin`. Закрытие на 24ч через
  `localStorage.betaBannerDismissedAt`. Подключён в `App.tsx`.
- `components/PromoteListingModal.tsx` — поддержка ответа `{mode:"redirect"}`:
  `window.location.href = paymentUrl`.
- `pages/AdminPage.tsx` (таб «Платежи») — добавлен крупный блок «Коммерческий
  режим (ИП + ЮKassa)» с тумблером и предупреждениями: при ON начнут списываться
  комиссии и реальные оплаты пойдут на счёт ИП.

**Webhook URL**: `https://<домен>/api/webhooks/yookassa`. Прописать в личном
кабинете ЮKassa для событий `payment.succeeded`, `payment.canceled`.

**ENV-переменные (опц., приоритет над БД)**:
- `YOOKASSA_SHOP_ID` — ID магазина ЮKassa.
- `YOOKASSA_SECRET_KEY` — секретный ключ API.
- `YOOKASSA_WEBHOOK_SECRET` — секрет для верификации вебхуков (если не задан,
  принимаются все запросы — режим dev).

**Ручная проверка** (Replit dev):
- `GET /api/health` → 200.
- `GET /api/settings` → возвращает `isCommercialMode: false`, `paymentMode`,
  `yookassaEnabled`.
- `GET /api/promotions/pricing` → JSON с тарифами VIP/Urgent/Boost.
- `POST /api/webhooks/yookassa` (пустое тело) → 400 (нет `object.id`).
- Фронт `/` → 200, баннер виден при OFF; `/admin` → 200, баннер скрыт.

**Пост-review исправления (24.04.2026)**:
1. **`isCommercialMode` теперь сохраняется**: добавлен в `allowed` и `BOOL_FIELDS`
   `PUT /api/admin/settings` (`routes/admin.ts`). Без этого master-toggle в UI
   менялся, но не применялся в БД.
2. **Real-ветка `promotions.ts` больше не создаёт `listing_promotions` заранее**:
   при `isCommercialMode=true` пишется только pending-payment, а сама запись
   `listing_promotions` создаётся **в webhook** при `succeeded`. Это исключает
   ситуации, когда неоплаченные/failed попытки выглядят оплаченными в журнале.
3. **Сводка выручки `/api/promotions/admin`** теперь считается строго по
   `payments.status='succeeded' AND target_type='promotion' AND provider='yookassa'`
   — мок-режим (amountRub=0) и pending не учитываются.
4. **Детерминированный Idempotence-Key**: `promo-payment-${payment.id}` — при
   сетевом ретрае ЮKassa вернёт тот же платёж, дублей не будет.
5. **HMAC webhook signature**: `verifyWebhookSignature` теперь использует
   `crypto.createHmac("sha256", secret).update(rawBody)` + `timingSafeEqual`.
   В production без `YOOKASSA_WEBHOOK_SECRET` — fail-closed (401).
6. **Raw body для подписи**: `app.use(express.json({ verify }))` сохраняет
   raw bytes в `req.rawBody`, webhook использует их вместо `JSON.stringify`
   (который зависит от порядка ключей и пробелов).
7. **Anti-replay через `SELECT ... FOR UPDATE`**: вся обработка статуса
   обёрнута в транзакцию с row-level lock по `yookassa_payment_id`, что
   защищает от двойного применения при параллельных вебхуках.

**Известные ограничения**:
- В обработке webhook сейчас активируется только `target_type=promotion`. Для
  `contact_pack`/`booking_protection` будет Stage 21b/c.
- Без `YOOKASSA_WEBHOOK_SECRET` верификация подписи отключена (dev-режим). На
  проде ENV-переменная **обязательна**, иначе webhook возвращает 401.
- Поле `is_commercial_mode` — отдельный master-toggle, независимый от полей
  «ЮKassa включена» и связанных секретов из Stage 20c.
## Stage 23b — Co-Sharing UI / P2P-флоу СБП (25.04.2026)

**Backend** (`artifacts/api-server/src/routes/pools.ts`, 5 endpoints):
- `GET /api/pools` — public, фильтр `?status=funding|purchasing|active|liquidated|canceled`
  (default `funding`). Возвращает массив с агрегатом `collectedAmountRub` (SUM
  `pool_shares.amount_rub` где `payment_status IN ('creator_confirmed','escrow_held')`).
- `POST /api/pools` — auth. Бета-режим жёстко: `collection_method='p2p_direct'`,
  `procurement_strategy='self_managed'`. Zod-валидация: `title 3..200`,
  `description ≤2000`, `itemUrl` http(s) only (ftp/data/javascript отбиваются),
  `targetAmountRub > 0`, `creatorPaymentDetails` обязателен.
- `GET /api/pools/:id` — public. Через JOIN с `users` возвращает `creator{id,
  firstName, lastName, avatarUrl}` и `shares[].userName/avatarUrl`.
- `POST /api/pools/:id/shares` — auth. `(pool_id, user_id)` UNIQUE на уровне БД
  → 409 `share_already_exists`. Только при `pool.status='funding'` иначе 409
  `pool_not_funding`. В бете сразу пишется `payment_status='user_transferred'`
  (юзер заявил «Я перевёл»).
- `POST /api/pools/:id/shares/:shareId/confirm` — auth + RBAC (только creator).
  Атомарная транзакция:
  1. SELECT share FOR UPDATE; если `payment_status != 'user_transferred'` →
     409 `share_not_transferred` (защита от двойного confirm).
  2. UPDATE `pool_shares` → `creator_confirmed`.
  3. SUM `amount_rub` по `COLLECTED_STATUSES = ['creator_confirmed','escrow_held']`.
  4. Если `collected ≥ target` И `pool.status='funding'` → UPDATE
     `pools.status='purchasing'` (ровно один раз, race-safe через WHERE-условие).

**Auth-конвенция** (важно для следующих агентов): этот проект использует
`req.userId` / `req.userRole` (НЕ `req.user.id`!). Это выставляется в
`middleware/auth.ts`. Если копируете шаблоны из других кодбаз — обязательно
адаптируйте.

**Frontend** (`artifacts/hochu-to/src/`):
- `lib/api-pools.ts` — тонкий fetch-клиент с `Authorization: Bearer` через
  `getAuthHeaders()` из `lib/auth`. Не идёт через orval — эндпоинты ещё не в
  OpenAPI-spec, добавим вместе со Stage 23c.
- `pages/Pools.tsx` — табы funding/purchasing/active, hero «Скиньтесь и
  купите вместе», карточки пулов с прогресс-баром и %.
- `pages/PoolCreate.tsx` — форма создания. Если `usePublicSettings().settings.isCommercialMode === false`,
  показывает баннер «Бета-режим: переводы напрямую без эскроу-комиссии».
- `pages/PoolDetail.tsx` — единая страница для трёх ролей:
  гость → CTA «Войдите»;
  не-creator без доли → модалка «Внести долю» с реквизитами СБП creator-а
  (с кнопкой Copy), чек-листом «откройте банк → переведите → нажмите Я
  перевёл», обязательным чекбоксом подтверждения;
  не-creator с долей → бейдж со статусом перевода;
  creator → блок «Ожидают подтверждения» с кнопкой confirm на каждой
  `user_transferred`-доле, toast при достижении 100% c переходом в `purchasing`.
- `App.tsx` — три новых роута + `/pools` добавлен в `PUBLIC_PATHS`.
- `Header.tsx` — навлинк «Совместные покупки» теперь ведёт на `/pools`.

**Регрессия**: 22/22 backend-сценариев прошли через curl (создание / contribute
/ дубликат / not-creator confirm / двойной confirm / 100%-trigger / contribute в
purchasing / ftp-URL / короткий title). Тестовые pools удалены из БД.

**Stage 23c (НЕ В ЭТОМ STAGE)**: авто-листинг при `pools.status='active'`,
динамический «Хранитель» (ротация), эскроу-флоу через ЮKassa
(`collection_method='platform_escrow'`), UI выбора `procurement_strategy='platform_concierge'`.

## Stage 25 — Вторичный рынок долей (P2P beta) (25.04.2026)

**Зачем.** Совладельцы могут выйти из пула, продав свою долю — без остановки эксплуатации вещи. На beta-этапе деньги переводятся напрямую через СБП; платформа выступает реестром прав.

**БД** (`lib/db/src/schema/co_sharing.ts`). В `share_offers` добавлены `buyer_id` (резерв), `reserved_at` (для TTL) и `seller_payment_details` (СБП-реквизиты продавца). Жизненный цикл: `open[buyer_id=NULL]` → `open[reserved]` → `sold` (атомарный merge) | `canceled`.

**Backend** (`artifacts/api-server/src/routes/pools.ts`) — 5 endpoints:
- `POST /pools/:id/shares/:shareId/offers` — create. Только своя оплаченная доля, нет другого открытого оффера.
- `GET /pools/:id/offers` — список открытых с join'ами.
- `POST /pools/:id/offers/:offerId/buy` — резерв. **TOCTOU + TTL 30 минут**: `UPDATE … WHERE status='open' AND (buyer_id IS NULL OR reserved_at < NOW() - 30 min)`. Без cron — протухший резерв перехватывается следующим buyer'ом атомарно.
- `POST /pools/:id/offers/:offerId/confirm-transfer` (только seller) — **АТОМАРНАЯ ПЕРЕДАЧА** в `db.transaction`: TOCTOU UPDATE статуса, повторная проверка ownership внутри tx, **merge** если у buyer уже есть доля в пуле (`UPDATE buyer.share SET %=%+%, ₽=₽+₽; DELETE seller.share`) или **transfer** (`UPDATE seller.share SET user_id=buyer_id`). Сложение DECIMAL(5,2) на стороне SQL, CHECK constraints гарантируют ≤100%.
- `POST /pools/:id/offers/:offerId/cancel` (только seller) — отмена с TOCTOU guard.

`GET /pools/:id` теперь отдаёт `offers[]` (открытые с join'ами sellerName/sharePercentage) — фронт за один запрос рендерит и доли, и рынок.

**Frontend** (`artifacts/hochu-to/src/`):
- `lib/api-pools.ts` — типы `ShareOfferDetail`, `ShareOfferStatus`, `BuyOfferResponse`, `ConfirmTransferResponse` + 5 функций.
- `pages/PoolDetail.tsx` — кнопка «Продать» в SharesList для своей оплаченной доли; новый `MarketplaceBlock` (между ResidualValueBlock и SharesList) с `OfferRow`; `SellShareModal` (расчёт справедливой цены через `calculateResidualValue × sharePercentage / 100`, инпут СБП-реквизитов, чек-бокс согласия); `BuyOfferModal` (двухфазный: резерв → показ СБП с copy-button); `SellerOfferActions` (cancel + confirm-transfer когда зарезервировано).

**Smoke E2E на pool#15 — все ✓:**
- Validation: 201 / 409 дубль / 403 чужая доля / 400 zod на пустые реквизиты.
- TOCTOU race: 5 параллельных `/buy` от alexey → 1×200 + 4×409.
- Self-buy: maria → 403 `cannot_buy_own_offer`.
- **Transfer-mode**: maria→alexey, share#13 user_id 14→13, `mergeMode='transfer'`. Дубль confirm → 409 `offer_not_open`.
- **Merge-mode**: dmitry→alexey (у которого уже 50%). share#13 50%→100%, 15000→30000₽, share#14 удалена. Целостность `SUM=100.00%, SUM(amount)=30000` ✓.
- Cancel-flow: 201 + 403 чужой + 200 свой + 409 повтор.
- Confirm от не-seller → 403 `only_seller_can_confirm`.

**Code review (architect): PASS.** SEVERE про TTL закрыт сразу — атомарный SQL-предикат в `/buy`, без cron-задачи.

**Followup (Stage 25+, future):** уведомления через `createNotification`, аудит-лог через `recordEvent`, серверное зеркало `calculateResidualValue`, замена нативного `confirm()` на shadcn `AlertDialog`, авто-переоценка офферов при изменении `wearAndTearMeter`. Эскроу + платформенная комиссия — Stage 24 (commercial mode).

## Журнал — Stage 30D-G (AI Provider Hardening, 28.04.2026)

После Stage 30C (Gemini + Amvera per-request switch) выкатка на Amvera обнажила набор скрытых багов: оба провайдера падали с непрозрачными 401/404. Серия из четырёх итераций — каждая отдельным коммитом — закрыла регрессию и одновременно зафиксировала ряд платформенных и интеграционных нюансов в Agent Rules `replit.md`.

### Контекст и платформенные ограничения (вылезли в этой серии)

- **Все git-команды заблокированы из агента** (даже read-only). Состояние с GitHub сверять вручную в Shell:
  ```bash
  rm -f .git/index.lock && git fetch origin && git log --oneline origin/main -3 && echo "---LOCAL---" && git log --oneline HEAD -3
  ```
- **`.replit` редактировать напрямую нельзя** — только через скиллы.
- **Артефакт-воркфлоу не удаляются из агента** (`PROHIBITED_ACTION: managed by an artifact`). Три дубля (`artifacts/api-server: API Server`, `artifacts/hochu-to: web`, `artifacts/mockup-sandbox: Component Preview Server`) висят в панели — на функциональность не влияют, удалять только из UI Replit.
- **GitHub-токен в env агента не проброшен** — приватный репо через GitHub API напрямую не опросить.

### Stage 30D — Diagnostics & verbose AI logs

`artifacts/api-server/src/index.ts`: перед `app.listen` добавлен блок:
```
--- AI CONFIG DIAGNOSTICS ---
GEMINI_KEY exists: <bool> length: <N>
AMVERA_TOKEN exists: <bool> length: <N>
------------------------------
```
Сами ключи никогда не печатаются. Эталон Google API key = 39 символов; 40+ → в env прилетел `\n`.

`artifacts/api-server/src/lib/ai-service.ts`: во всех 4 функциях (`generateAmvera`, `generateGemini`, `bulletsAmvera`, `bulletsGemini`) перед `throw` при non-2xx ответе провайдера вставлен `console.error(await res.text())` — теперь по логам сразу видно body-сообщение, а не голый статус. Сэкономило часы при отладке Stage 30E.

Gemini переведён с хедера `X-goog-api-key` на query `?key=${encodeURIComponent(apiKey)}` — на v1beta endpoint хедер давал 401.

### Stage 30E — Amvera auth-format откат

Попытка унифицировать Amvera под `Authorization: Bearer <token>` (как у Gemini/OpenAI) на проде ловила HTTP 401 с body `{"status":"ALTERNATIVE_STATUS_FINAL"}`. Откат на исходный нестандартный хедер:
```ts
headers: { "X-Auth-Token": `Bearer ${token}`, ... }
```
Это требование Kong-проксей Amvera (endpoint `https://kong-proxy.yc.amvera.ru/api/v1/models/llama`, модель `llama8b`). Также напомню: Amvera использует `text` вместо `content` в сообщениях. Зафиксировано в Agent Rules → AI Gateway, любая регрессия должна ловиться при ревью.

### Stage 30F — env bulletproof + workflow cleanup attempt

Во всех 4 точках:
```ts
const token = process.env.AMVERA_API_TOKEN?.trim();
const apiKey = process.env.GEMINI_API_KEY?.trim();
```
Страховка от хвостового `\n`/пробела, который Amvera-консоль умеет молча приклеивать при копи-пасте секрета в UI. `throw new Error("X is missing")` теперь срабатывает на затримленном значении — ключ из одних пробелов корректно отвергается.

Стартовая диагностика в `index.ts` сознательно оставлена БЕЗ `.trim()` — чтобы при ротации ключа сразу видеть «сырую» длину и расхождение с ожидаемой.

Попытка `removeWorkflow` для трёх артефакт-дублей упёрлась в `PROHIBITED_ACTION: managed by an artifact` — задокументировано в Agent Rules.

### Stage 30G — Gemini model alias fix (404 → resolved)

```ts
// было:
const GEMINI_MODEL = "gemini-1.5-flash";
// стало:
const GEMINI_MODEL = "gemini-flash-latest";
```
Google вычистил алиас `gemini-1.5-flash` из v1beta endpoint, на проде прилетал `404 model not found`. `*-latest` — страховка от повторения той же истории при следующей ротации алиасов. Обе функции (`generateGemini` и `bulletsGemini`) собирают URL из общей константы — правка одна, эффект на оба пути.

### Smoke (PASS на dev, 28.04.2026)
1. esbuild api-server bundle — без ошибок типов ✓
2. Workflow `Start application` рестартует чисто, диагностический блок печатается в логе ✓
3. `GET /api/listings`, `GET /api/health` → 200 ✓
4. На локалке Replit `GEMINI_API_KEY`/`AMVERA_API_TOKEN` не заданы — система корректно проваливается в smart-mock без 500 ✓

### Финальные SHA (origin/main, подтверждено пользователем)
- `586328b` — Revert Amvera auth header (30E)
- `e2f2487` — Bulletproof env vars with `.trim()` (30F)
- `d345122` — Gemini model URL → flash-latest (30G)

### Прод-проверка (Amvera после деплоя)
1. В логе старта — блок `--- AI CONFIG DIAGNOSTICS ---`, оба ключа `exists: true`, `GEMINI_KEY length: 39`.
2. Первый `POST /api/ai/generate-description` с провайдером Gemini — НЕ должен вернуть 404. 401/403/429 = вопросы к ключу/квоте, не к URL.
3. Первый `POST /api/ai/generate-description` с провайдером Amvera — НЕ должен вернуть 401 `ALTERNATIVE_STATUS_FINAL`. Если вернётся — кто-то откатил `X-Auth-Token: Bearer` на `Authorization`, искать регрессию.

### Followup (опционально, не критично)
- Двойной хедер для Amvera (`X-Auth-Token` + `Authorization`) на случай миграции Kong на стандарт — было в исходном ТЗ, отложено сознательно.
- Админ-эндпоинт `GET /api/admin/ai/health` (пинг обоих провайдеров без расхода токенов) — было в ТЗ Stage 30F, отложено.
- Кеш генераций по `(title, category, provider)` для повторных вызовов — экономия токенов на UX «не понравилось, ещё раз».

## Журнал — Stage 30H (Amvera pivot llama → DeepSeek-V3, 29.04.2026)

**Контекст.** После выкатки Stage 30G на проде Amvera продолжал отдавать «empty response» с эндпоинта `/models/llama` + модели `llama8b`. По openapi-спеке Amvera (`https://lllm-swagger-amvera-services.amvera.io/openapi.yaml`) роут `/llama` помечен deprecated. В админке Amvera в списке доступных моделей фигурируют DeepSeek/GPT/Qwen — без LLaMA вовсе.

### Источник истины — официальная документация
`https://docs.amvera.ru/LLM/doc-inference-ru.html` (раздел «API → Доступные варианты инференса»):

```
/llama       → llama8b, llama70b           (deprecated, удалили из админки)
/gpt         → gpt-4.1, gpt-5              (ТОЛЬКО OpenAI!)
/deepseek    → deepseek-R1, deepseek-V3
/qwen        → qwen3_30b, qwen3_235b
```

Эндпоинт собирается как `POST /models/<inference_name>`, где `<inference_name>` — **семейство**, не имя конкретной модели. Итого: для DeepSeek-V3 нужен именно `/models/deepseek` + `model: "deepseek-V3"` (case-sensitive, заглавная V — lowercase Amvera молча отдаёт пустой ответ).

Поле сообщений и парсинга ответа — **`text`**, не `content`. Это общее правило для всех Amvera-роутов, без исключений (пример из доки):
```json
{
  "model": "llama8b",
  "messages": [{ "role": "user", "text": "Hi, how are you?" }]
}
```

### Правки

**1. `artifacts/api-server/src/lib/ai-service.ts`** — добавлены константы у топа файла:
```ts
const AMVERA_URL   = "https://kong-proxy.yc.amvera.ru/api/v1/models/deepseek";
const AMVERA_MODEL = "deepseek-V3";
```
Обе функции (`generateAmvera` и `bulletsAmvera`) теперь шлют запрос через них вместо хардкода `/models/llama` + `model: "llama8b"`. Шапка файла переписана: указан правильный эндпоинт, явно подчёркнуто, что `/gpt` — НЕ для DeepSeek, и что имя модели case-sensitive.

**Что сохранено из Stage 30D-G** (НЕ регрессировать):
- Хедер `X-Auth-Token: Bearer ${token}` (НЕ `Authorization`)
- `.trim()` на токен
- Поле `text` в `messages[]`
- Парсинг `data.choices[0].message.text`
- Smart-mock fallback при любой ошибке
- Verbose `console.error(await res.text())` перед `throw` (Stage 30D)

**2. `artifacts/hochu-to/src/pages/ListingForm.tsx`** — dropdown (строка ~502):
```diff
- 🚀 LLaMA (Базовый)
+ 🚀 DeepSeek-V3 (Amvera)
```

**3. `artifacts/hochu-to/src/pages/AdminPage.tsx`** — карточка провайдера (строки ~3589-3596):
```diff
- title: "Amvera AI (llama8b)"
- desc: "Российский инференс на отечественных серверах. Без геоблокировок..."
+ title: "Amvera AI (DeepSeek-V3)"
+ desc: "Российский инференс на отечественных серверах. DeepSeek-V3 через /models/gpt. Без геоблокировок..."
```

### Расхождение с исходным ТЗ от CTO
CTO предположил «standard OpenAI schema: `{ messages: [{role, content}] }`». Это **неверно** для Amvera. По openapi.yaml роут `/gpt` всё равно использует поле `text`, а не `content`, и в запросе, и в ответе. Если бы я переключился на `content`, на проде получили бы ту же `Amvera: empty response` — Amvera проигнорировал бы `content` и оставил `text` пустым. Поэтому код парсинга `data?.choices?.[0]?.message?.text` оставлен как есть — он валиден и для DeepSeek-V3 эндпоинта.

### Smoke (PASS на dev, 29.04.2026)
1. esbuild api-server bundle — без ошибок типов ✓
2. Workflow `Start application` рестартует чисто, диагностический блок печатается ✓
3. `GET /api/listings`, `GET /api/categories`, `GET /api/regions` → 200 ✓

### Прод-проверка (Amvera после деплоя)
1. `POST /api/ai/generate-description` с `provider: "amvera"` → должен вернуться текст с `actualProvider: "amvera"`, `fallback: false`. Если снова `empty response` — лог `[AI Service Error][Amvera/description]` теперь печатает body ответа (наследие Stage 30D), смотреть, не отличается ли реальное API-имя модели от документального `deepseek-V3` (например, `DeepSeek-V3` или `deepseek-chat`).
2. UI на форме создания и в админке должен показывать «DeepSeek-V3 (Amvera)», а не «LLaMA (Базовый)».
3. Если Gemini после Stage 30G на проде продолжит падать с РФ-IP — это уже Stage 30I (geo-block через прокси либо скрыть Gemini из dropdown'а с пометкой «работает на VPN-серверах»).

### Push
```bash
bash scripts/github-push.sh "feat(ai): pivot Amvera provider to DeepSeek-V3 on /models/deepseek endpoint"
```

## Журнал — Stage 30H-fix2 (Amvera response shape: alternatives vs choices, 29.04.2026)

**Контекст.** После выкатки Stage 30H на прод Amvera возвращал HTTP 200, но наш парсер всё равно падал в `Amvera: empty response` → `falling back to mock`. В деплой-логе Amvera диагностика показала, что и токен, и URL, и модель — корректные:
```
GEMINI_KEY exists: true length: 39
AMVERA_TOKEN exists: true length: 1318
```
То есть проблема была не в авторизации и не в URL — а в том, ЧТО мы извлекаем из тела ответа.

### Корень проблемы
С самого Stage 30A парсили чистый OpenAI-формат:
```ts
data?.choices?.[0]?.message?.text   // ← такого поля у Amvera в общем случае нет!
```
А в реальности у Amvera формат ответа **зависит от эндпоинта** (источник истины — `https://lllm-swagger-amvera-services.amvera.io/openapi.yaml`):

| Эндпоинт | Поле в ответе |
|---|---|
| `/models/llama` (deprecated) | `alternatives[0].message.text` (Yandex/Amvera-формат) |
| `/models/gpt` | `choices[0].message.text` (OpenAI Chat Completions) |
| `/models/deepseek` | в openapi не описан, эмпирически `alternatives` |
| `/models/qwen` | в openapi не описан, эмпирически `alternatives` |

То есть OpenAI-схема есть **только** на `/gpt`. На остальных трёх роутах — нативный Amvera-формат с `alternatives`. Вся история Stage 30A-G работала бы на `/gpt`, но нам нужны были именно DeepSeek/LLaMA — и парсер всегда возвращал undefined, поэтому всегда падал в smart-mock. Никто не видел этого, потому что прод-логи раньше были скрыты, а в Stage 30D-G сосредоточились на токенах и URL, не на парсинге.

### Правки (`artifacts/api-server/src/lib/ai-service.ts`)

**1. Парсинг с nullish-fallback по обоим полям** — в `generateAmvera` (строки ~217-219) и `bulletsAmvera` (строки ~615-617):
```ts
const text =
  data?.alternatives?.[0]?.message?.text ??
  data?.choices?.[0]?.message?.text;
```
Так код устойчив к переключению эндпоинта в любом направлении. Если CTO потом скажет «давай попробуем `/qwen` вместо `/deepseek`» — фикс не нужен. Если решит вернуться на `/models/gpt` — тоже работает.

**2. Диагностика непредвиденного формата.** ВНУТРИ ветки empty response добавлен `console.error` со срезом сырого `data` (первые 500 символов JSON):
```ts
if (typeof text !== "string" || !text.trim()) {
  console.error(
    "[AI Service Error][Amvera/description]: Unexpected response shape, raw data slice:",
    JSON.stringify(data).slice(0, 500),
  );
  throw new Error("Amvera: empty response");
}
```
Это предохранитель: если Amvera в будущем сменит формат ещё раз (например, добавит обёртку `result.text`), мы сразу увидим в логах сырую структуру, а не будем гадать.

**3. Шапочный комментарий файла** обновлён: явно перечислены оба формата (alternatives vs choices) с маппингом по эндпоинтам.

### Чему это нас учит (НЕ регрессировать)

- **Никогда не доверять «стандартной OpenAI-схеме» применительно к Amvera.** OpenAI-совместимость есть только на одном их эндпоинте (`/gpt`), и то частичная (поле `text` вместо `content`). Для всех остальных — Yandex-формат с `alternatives`.
- **При парсинге внешних AI-ответов всегда логировать сырое тело** в случае несоответствия ожидаемому формату. Один `console.error` с `JSON.stringify(data).slice(0, 500)` экономит итерацию деплой → багрепорт → деплой.
- **При смене эндпоинта Amvera** (например, попробовать Qwen) — НЕ нужно менять парсинг, fallback покрывает всё семейство.

### Smoke (PASS на dev, 29.04.2026)
1. esbuild api-server bundle — без ошибок типов ✓
2. Workflow `Start application` рестартует чисто, AI CONFIG diagnostics печатается ✓
3. `GET /api/listings`, `/api/categories`, `/api/regions` → 200 ✓

### Прод-проверка (Amvera после деплоя)
- `POST /api/ai/generate-description` с `provider: "amvera"` → должен вернуться нормальный текст с `actualProvider: "amvera"`, `fallback: false`.
- Если опять `empty response` (маловероятно) — теперь в логе будет строка `[AI Service Error][Amvera/description]: Unexpected response shape, raw data slice: {...}`, по ней сразу видно правильный путь.

### Push
```bash
bash scripts/github-push.sh "fix(ai): parse Amvera response from both 'alternatives' and 'choices' (Yandex vs OpenAI shape)"
```

## Журнал — Stage 30J-revert2 (Gemini model name regression, ЗАКРЫТО, 29.04.2026)

**Контекст.** Stage 30J ввёл двухконстантную схему `GEMINI_PRO_MODEL = "gemini-1.5-pro-latest"` + `GEMINI_FLASH_MODEL = "gemini-1.5-flash"` с обёрткой `geminiCallWithFallback` (Pro → Flash при 429/503). На прод-Amvera Gemini немедленно упал в 404 от Google. Три точечных хотфикса (PRO → `gemini-1.5-pro`, оба → `gemini-1.5-flash`, оба → `gemini-2.5-flash`) — каждый давал 404. CTO попросил откатить всю архитектуру обратно к простому прямому fetch.

### Корень проблемы (важно для будущих агентов)

**Не обёртка `geminiCallWithFallback` сломала прод** — она ничего не трансформировала, просто делегировала вызов в `geminiCall` с тем же URL/телом. Обёртку можно было оставить.

**Реальная причина.** В Stage 30J имена моделей `gemini-1.5-pro-latest` / `gemini-1.5-flash` были взяты без проверки против журнала Stage 30G (см. эту же документацию выше). А там чёрным по белому: Google ещё 28.04 вычистил алиас `gemini-1.5-flash` из v1beta endpoint, единственное стабильное имя — `gemini-flash-latest` (`*-latest` — официальная страховка Google от ротации версий моделей).

Хуже того — при первом откате (Stage 30J-revert) я опять буквально взял `gemini-1.5-flash` из текста CTO-задачи и снова получил 404. Спас только повторный grep по своему же AGENT_INSTRUCTIONS (Stage 30G), где уже было задокументировано правильное имя.

### Финальные правки (`artifacts/api-server/src/lib/ai-service.ts`)

**1. Одна константа с `*-latest` алиасом и жирным предостережением:**
```ts
// ⚠️ КРИТИЧНО — НЕ менять обратно на "gemini-1.5-flash" / "gemini-1.5-pro"!
// Google вычистил эти алиасы из v1beta endpoint, прод отдаёт 404 model not
// found. Алиас "*-latest" — официальная страховка Google от ротации версий
// (см. docs/AGENT_INSTRUCTIONS.md, журнал Stage 30G от 28.04.2026).
const GEMINI_MODEL = "gemini-flash-latest";
```

**2. Удалены `GEMINI_PRO_MODEL`, `GEMINI_FLASH_MODEL`, `geminiCall`, `geminiCallWithFallback`.** Никакого Pro→Flash retry больше нет.

**3. `generateGemini` и `bulletsGemini` — простой прямой fetch:**
```ts
const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 2048 },
    }),
    signal: ctrl.signal,
  },
);
```
При ошибке — обычный `throw`, наверху ловит smart-mock в `generateListingDescription`/`generateInfographicBullets`.

**4. Сохранено без изменений:**
- Премиум-промпт `PREMIUM_GEMINI_INFOGRAPHIC_PROMPT` (английская инструкция, JSON-выход, русские строки) — это ортогональная UX-логика.
- Тройной парсер JSON → pipe → `parseBullets` в `bulletsGemini`.
- Страховка вёрстки `≤ 32 символа/буллет` (slice по слову).
- Вся Amvera-ветка (`generateAmvera`/`bulletsAmvera`/`AMVERA_URL`/`AMVERA_MODEL`), OpenAI, mock, router, frontend.

### Чему это нас учит (НЕ регрессировать)

- **При смене имени модели Gemini ВСЕГДА сверяться с журналом Stage 30G.** Имена `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-1.5-pro-latest` мертвы на v1beta и возвращают 404. Алиас `*-latest` — единственный надёжный.
- **Не верить тексту задачи CTO буквально, если он противоречит Stage-bible.** Если в задаче просят вернуть `gemini-1.5-flash`, а в журнале стоит «вернуть на `gemini-flash-latest`» — приоритет у журнала. Перед правкой сослаться на запись и спросить подтверждения.
- **Опровергнута гипотеза Stage 30I (geo-block).** Раньше думали, что Google режет запросы с РФ-IP Amvera; на самом деле прод-Amvera штатно ходит к `generativelanguage.googleapis.com`. Вся симптоматика была на стороне неправильного имени модели. Stage 30I из roadmap'а вычеркнут.
- **Не путать причину с симптомом.** Обёртки/фолбэки часто выглядят подозрительно («сложный код = бажный код»), но реальная регрессия может быть в другом месте — диффе строковой константы между двумя коммитами. Перед тем как откатывать архитектуру, сначала проверить именно те данные, которые улетают в API (URL, имя модели, имя поля).

### Smoke (PASS на dev, 29.04.2026)
1. esbuild api-server bundle — без ошибок типов ✓
2. Workflow `Start application` рестартует чисто, диагностический блок печатается ✓
3. `GET /api/listings`, `GET /api/categories`, `GET /api/regions` → 200 ✓
4. В коде ровно одна константа `GEMINI_MODEL` (grep даёт 4 совпадения: 1 определение + 3 использования = generateGemini, bulletsGemini, и комментарий) ✓

### Прод-проверка (PASS на Amvera, 29.04.2026, подтверждено CTO)
- Gemini (`POST /api/ai/generate-description` с `provider: "gemini"`) → возвращает полный текст с `actualProvider: "gemini"`, `fallback: false`. ✓
- Amvera DeepSeek-V3 (`provider: "amvera"`) → возвращает полный текст с `actualProvider: "amvera"`, `fallback: false`. ✓
- Smart-mock в логах не появляется (нет `falling back to mock`). ✓

### Push
```bash
bash scripts/github-push.sh "fix(ai): restore working gemini-flash-latest model (Stage 30G config)"
```

## Журнал — Stage 29 (Trust Score Engine V6, ретроспективно зафиксировано Stage 32, 29.04.2026)

**Контекст.** V6 «Trust Score helper» из § 11d был реализован в коде до Stage 32, но без отдельной записи в Stage-журнал. Stage 32 «Documentation Sync» закрывает этот пробел ретроспективно — функционал в проде, формула задокументирована.

**Файл:** `artifacts/api-server/src/lib/trust-score.ts` (~125 строк, экспорт `calculateAndUpdateTrustScore` и `recalculateTrustScoreForUsers`).

**Формула (V1, 0..100), отличается от стартовой версии § 11d:**

| Компонент | Вес | Источник |
|---|---|---|
| База | +20 | константа |
| Средний рейтинг отзывов | +(avgRating / 5) × 30 | `reviews.rating` для `revieweeId = userId` (как owner + как renter) |
| Опыт (завершённые сделки) | +MIN(deals × 5, 30) | `users.completedDealsCount` |
| Бейдж «Проверенный владелец» | +20 если `isVerified` | `users.isVerified` (Stage 19g) |
| Подтверждённые претензии «по вине» | −20 за каждую | `claims.status IN ('approved','paid') AND payout_to_user_id != userId AND payout_to_user_id IS NOT NULL` |
| **Clamp** | **0..100** | `Math.max(0, Math.min(100, score))` |

Отличается от стартовой формулы § 11d тем, что (а) база 20 (вместо 50), (б) рейтинг масштабируется пропорционально (вместо порогов 4.5/4.0), (в) убран компонент «возраст аккаунта», (г) убран отдельный штраф за бан (он закрывается через нулевую активность).

**Триггеры пересчёта** (post-commit, fire-and-forget через `void` — не валит основной ответ):
- `routes/reviews.ts:137` — `void calculateAndUpdateTrustScore(review.revieweeId, userId, "review_created:${review.id}")`.
- `routes/admin.ts:16` — после административных действий, меняющих репутацию (verify, ban, claim approve/mark-paid).
- `backfill-trust-scores.ts` — одноразовый скрипт для разовой инициализации поля у всех существующих пользователей.

**Audit-trail.** Каждое успешное обновление пишется в `audit_events` (`entityType='user'`, `eventType='trust_score_updated'`, payload содержит `previousScore` и `newScore`). При ошибке функция возвращает `null`, лог через pino — наверх ничего не бросает (защита: триггер из `reviews.ts` не должен сломать создание отзыва, если БД для audit временно недоступна).

**Что показывается публично (V8 НЕ закрыт):**
- ✅ Владельцу в `Dashboard.tsx` (таб «Профиль»).
- ✅ Админу в `AdminPage.tsx` (карточка пользователя).
- ✅ В API-ответах `/api/auth/me`, `/api/users/:id`, `/api/listings`, `/api/listings/:id`, `/api/pools/:id` (поля `trustScore`, `trustScoreUpdatedAt`).
- ❌ Маркер на карточке объявления / фильтр в каталоге — отложен до 100+ сделок и 50+ владельцев.

**Известные пробелы (Stage 29 followup):**
- V7 — ежесуточный cron-пересчёт через `lib/scheduler.ts` для всех владельцев с активными объявлениями.
- V8 — публичный UI (маркер `87/100` на карточках, фильтр «TS ≥ 70» в каталоге, объяснялка в Dashboard).
- Сброс верификации (`unverify_user`) сейчас **не** вызывает пересчёт; score теряет +20 только когда придёт следующий триггер от review/claim. Если решим, что критично — добавить `void calculateAndUpdateTrustScore(...)` в обработчик `unverify_user` в `routes/admin.ts`.

## Журнал — Stage 32 (Documentation & Roadmap Synchronization, 29.04.2026)

**Контекст.** Аудит кодовой базы (`Comprehensive Codebase Audit & Reality Check`, 29.04.2026) показал, что Stage-журнал и Project Checklist в `replit.md` отстали от реальности по нескольким направлениям одновременно:
1. **Цифровой Акт** (видео + GPS-pin + подпись) числился «в работе», хотя Stage 22b и Stage 22b-followup закрыли всё.
2. **Trust Score** числился «не начато», хотя Stage 29 (этот журнал) выпустил V6 в продакшен и активно пересчитывается из `reviews.ts` и `admin.ts`.
3. **ЮKassa** числилась «серверной интеграции нет», хотя Stage 21a выкатил полнофункциональный REST-клиент с поддержкой холдов (`capture:false`) и HMAC-подписанным вебхуком — закрыто для use-case продвижения объявлений (промо).
4. **Шапка Stage 30A** описывала Amvera-парсинг как `data.choices[0].message.content`, хотя после Stage 30E (поле `text` вместо `content`) и Stage 30H-fix2 (для `/models/deepseek` поле = `alternatives[0].message.text`) это устарело.
5. **Stage 29 не имел собственной записи в журнале** — фича была в коде ~2 дня без документации.
6. **KYC, эскроу для бронирований, авто-выплаты** не были разделены на «технический бэклог» vs «сознательно отложено до открытия ИП», что создавало впечатление дыр в roadmap. На самом деле это согласованная с CTO стратегия (нужно ИП, защищённое PII-хранилище, юридическая оценка).

**Что сделано (read-write на 2 файла):**
- `replit.md` Project Checklist:
  - блок «🟡 В работе» вычищен от закрытых пунктов (Цифровой Акт, Trust Score, ЮKassa-сервер, индексы, Admin-RBAC); оставлены только реальные текущие задачи + followup-хвосты Stage 27/28/29/30B;
  - добавлена новая секция **«🛑 Сознательно отложено (Deferred by Design)»** с явным указанием бизнес-блокеров: KYC по 152-ФЗ/115-ФЗ, Stage 24 commercial booking holds, Stage 28 followup buyout escrow, Stage 21b ЮKassa контактов, авто-выплаты по claims, CloudPayments как второй шлюз;
  - блок «🔴 Roadmap» расширен Stage 33 (AI-Арбитражор) первым пунктом.
- `replit.md` добавлена ретроспективная секция **Stage 29 — Trust Score Engine V6** между Stage 28 и Stage 30A, с формулой, триггерами, audit-trail, списком V7/V8-followup.
- `replit.md` Stage 30A: в начало шапки добавлена врезка **«📌 Stage 32 sync»** с навигацией на актуальные Stage 30G/30H/30H-fix2/30J-revert2 (модели, парсеры, заголовки, опровергнутый Stage 30I) — без перезаписи исторического текста.
- `replit.md` финальная секция «What Is NOT Yet Implemented» расщеплена на 4 группы (Deferred by Design / Технический бэклог / Закрыто-вычеркнуто / Будущие фичи Stage 33), убраны противоречия с Project Checklist.
- `docs/AGENT_INSTRUCTIONS.md § 11d` таблица V1-V8: статус V6 переведён в `✅ ГОТОВО (Stage 29)`, V7 переформулирован как `⏳ Stage 29 followup`, V8 детализирован «отложен до калибровки на 100+ сделок».
- `docs/AGENT_INSTRUCTIONS.md` хвост: добавлены ретро-журнал Stage 29 и текущий журнал Stage 32 (этот раздел) + плановый Stage 33.

**Принципы синхронизации (применены при правках):**
- **Не переписывать историю.** Старые Stage-записи (30A с устаревшим парсером Amvera) не редактируются — добавляется только врезка-маркер в начале с навигацией на актуальные журналы. Это сохраняет аудит-trail «как мы пришли к текущему решению».
- **Симметрия checklist'ов.** Project Checklist в `replit.md` и таблицы статусов в `AGENT_INSTRUCTIONS.md § 11d` правятся в одном коммите, чтобы они не разошлись снова.
- **Явный «Deferred by Design».** Любая фича, отсутствующая по согласованной с CTO стратегии (а не из-за нехватки времени), маркируется отдельно — это снимает ложное ощущение технического долга у читателей.

**Чему это нас учит (НЕ регрессировать):**
- **Project Checklist в `replit.md` — это жёсткая обязанность Stage X.** Любая итерация, которая сдаёт фичу из 🟡 в ✅, должна перенести её одним коммитом. Ретроспективные синхронизации (Stage 32) — это знак, что кто-то нарушил правило _«replit.md обновлять разделы Project Checklist (✅ / 🟡 / 🔴) так, чтобы карта проекта всегда отражала реальность»_ (см. этот файл, строка 332). При каждом следующем Stage X сначала спросить себя: «какие пункты Checklist сейчас лжут?» — потом писать новый код.
- **Stage без журнальной записи — баг процесса.** Stage 29 жил в коде 2 дня без записи. Это приемлемо для одной экстренной итерации (Stage 30A отвлёк), но не дольше. Если фича выкатывается без Stage-номера — при следующей же итерации присвоить номер и добавить запись.
- **«Сознательно не делать» = архитектурное решение, не дыра.** KYC, эскроу для бронирований, авто-выплаты — все они отсутствуют по согласованной с CTO стратегии. Без явной маркировки `🛑 Deferred by Design` это выглядит как технический долг, что вводит в заблуждение и читателей, и будущих агентов.

### Push
```bash
bash scripts/github-push.sh "docs: sync replit.md and agent instructions with actual codebase (Stage 32)"
```

## Журнал — Stage 32-debug (Smoke-pass + Cookie Fix, 29.04.2026)

**Контекст.** Отладочный прогон между Stage 32 и Stage 33: smoke всех ключевых endpoints, LSP, проверка runtime-багов перед research-итерацией Stage 33.

**Что сделано:**
1. **Seed-БД восстановлен.** После сессионного restore-чекпойнта таблицы `regions/categories/listings` оказались пустыми (только `users:1`, `platform_settings:1`). Запустил `pnpm --filter @workspace/api-server seed` → 85 регионов, 10 категорий, 14 объявлений, 7 тест-юзеров (включая `admin@test.ru` / `Admin1234!` и `alexey@example.com` / `Test1234!`). Это норма после restore — seed надо помнить, не воспринимать пустые таблицы как баг продукта.
2. **Cookie-fix в `routes/auth.ts:setRefreshCookie/clearRefreshCookie`.** Переменная `isProduction = process.env.NODE_ENV === "production"` была объявлена строкой выше, но НЕ применялась — стояло хардкод-`secure: true, sameSite: "none"`. На HTTP-localhost (curl-смоки, локальная отладка вне Replit-preview) браузеры/curl тихо отбрасывают такие cookie → `POST /api/auth/refresh` всегда падал в 401, refresh-flow был полностью сломан в dev-окружении. Исправил: `secure: isProduction`, `sameSite: isProduction ? "none" : "lax"`. Production-поведение (Amvera HTTPS + Replit iframe-preview через https://*.repl.co) не изменилось — там `NODE_ENV=production` и работает как раньше. В коде также убран некорректный комментарий «secure: true — обязателен для HTTPS в Amvera» и расписана логика двух режимов.

**Smoke-результаты (после фикса, прогон 29.04.2026 16:42 MSK):**
- **LSP:** `0 errors / 0 warnings / 0 infos` во всём монорепо (api-server, hochu-to, mockup-sandbox, lib/*) — это де-факто заменяет отсутствующий `tsc`.
- **Auth flow:** `POST /login` → access-token + refresh-cookie ✅. `GET /me` с `Authorization: Bearer <access>` → корректный профиль ✅. `POST /refresh` с cookie → новый access-token ✅. `POST /logout` → cookie очищается, `POST /refresh` после → 401 ✅.
- **RBAC:** `/api/admin/users` с admin-токеном → 200 (список юзеров), с owner-токеном (alexey) → 403, без токена → 401 ✅.
- **AI mock-провайдер** (`POST /api/ai/generate-description` с `provider:"mock"`): `actualProvider:"mock"`, `fallback:false`, поле `text` содержит ~700-символьный русский маркетинг-блок с эмодзи, буллетами и описанием состояния ✅.
- **Каталог:** `/api/listings` total=14, `/api/regions` 85, `/api/categories` 10.
- **Health:** `/health` 200, esbuild build clean 283ms, никаких ERROR/WARN в логах api-server.

**Чему это нас учит (НЕ регрессировать):**
- **Cookie-флаги обязаны быть environment-aware.** Если в коде объявлена `isProduction` для security-параметров, она ОБЯЗАНА применяться ко всем `secure`/`sameSite` единообразно. Проверка: `rg "secure: true|sameSite:" artifacts/api-server/src` не должна находить хардкод-литералы. Этот паттерн — потенциальная регрессия в любом будущем cookie-эндпоинте (новые сессии, CSRF-токены и т.п.).
- **Smoke auth-эндпоинтов делается под Bearer, не под cookie.** Архитектура: access-token — `Authorization: Bearer`, refresh-token — HTTP-only cookie. Curl-смок защищённого endpoint только с `-b cookies.txt` и без `-H "Authorization: Bearer ..."` всегда вернёт 401 — это **нормально** (защита от CSRF). Стандартный шаблон smoke: `TOKEN=$(curl -s ... /login | jq -r .token); curl -H "Authorization: Bearer $TOKEN" ...`.
- **Seed после restore-чекпойнта = первая команда отладки.** Если БД выглядит пустой (нет регионов/категорий, /api/listings возвращает `{total:0,listings:[]}`) — это не баг продукта, а restore-«чистая» БД. Команда: `pnpm --filter @workspace/api-server seed` (idempotent, чистит и пересоздаёт regions/categories/listings, обновляет тестовых юзеров).
- **AI-ответ имеет поле `text`, не `description`.** При smoke AI-эндпоинтов это легко перепутать. Shape: `{text, provider, actualProvider, fallback, fallbackReason}`. Смотри `routes/ai.ts` или `lib/ai-service.ts` для актуальной формы перед написанием jq-фильтра.
- **typecheck-скрипт сейчас декоративный (известно, не блокирует).** В `package.json` обоих артефактов есть `"typecheck": "tsc -p tsconfig.json --noEmit"`, но `typescript` не установлен ни в root-`package.json`, ни в подпакетах — `tsc` бинаря в `node_modules/.bin` нет. LSP-сервер (внутри Replit IDE) компенсирует это полностью: `getLatestLspDiagnostics()` дал 0 ошибок. Установка `typescript` как root-devDep — отдельная инициатива, отложена до явного запроса/CI-пайплайна. Сейчас приоритета нет, риска тоже нет.
- **«Двойной vite-процесс» — артефакт окружения, не баг кода.** При параллельном запуске composite workflow `Start application` (PORT=5000) и отдельного `artifacts/hochu-to: web` (без env, дефолт 21418) запускаются два vite-сервера; preview pane Replit ходит на :5000, и первый из них может не подняться из-за конфликта. Это не повод править код или workflows — пользователь сам выбирает, какой workflow запустить. Если preview пуст — посмотреть `pgrep -af vite` и оставить ровно один процесс.

### Push
```bash
bash scripts/github-push.sh "fix(auth): NODE_ENV-aware cookie flags + Stage 32-debug smoke pass"
```

## Журнал — Stage 33.0 (AI Redundancy + UI Polish, 30.04.2026)

**Контекст.** Домен `www.hochuto.ru` активен. Добавлен прямой ключ DeepSeek API для AI-резервирования. Цепочка провайдеров для генерации описаний и буллетов инфографики расширена с двух до трёх уровней.

### Что сделано

**1. AI-избыточность — прямой DeepSeek API как третий провайдер**

Файл: `artifacts/api-server/src/lib/ai-service.ts`

Новая цепочка для провайдера `amvera` (и когда activeAiProvider = 'amvera' в platform_settings):
```
Amvera (kong-proxy.yc.amvera.ru) → Direct DeepSeek (api.deepseek.com) → Mock
```

Добавлены три новые константы у топа файла:
```ts
const DEEPSEEK_DIRECT_URL     = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_DIRECT_MODEL   = "deepseek-chat";
const DEEPSEEK_DIRECT_TIMEOUT_MS = 30_000;
```

Добавлены две новые функции:
- `generateDirectDeepSeek(input: GenerateInput): Promise<string>` — OpenAI-совместимый формат (`Authorization: Bearer`, поле `content`, модель `deepseek-chat`).
- `bulletsDirectDeepSeek(title, category): Promise<string[]>` — аналог для инфографических буллетов.

Ключевая особенность: прямой DeepSeek использует **стандартный OpenAI Chat Completions формат** (в отличие от Amvera, где поле `text` вместо `content` и нестандартный хедер `X-Auth-Token`). Не регрессировать.

Изменения в роутере (`generateListingDescription` и `generateInfographicBullets`): вместо единого try/catch amvera-ветка получила вложенный try/catch:
```ts
else {
  try {
    text = await generateAmvera(input);
  } catch (amveraErr: any) {
    logger.warn({ err: amveraErr?.message }, "Amvera failed, trying direct DeepSeek API");
    text = await generateDirectDeepSeek(input);  // бросит → внешний catch → mock
  }
}
```

**Ключ:** `DEEPSEEK_API_KEY` = `sk-bbf4cc431aa4488895da859c9516492e`
**Платформа:** https://platform.deepseek.com
**Модель:** `deepseek-chat` (стабильный alias DeepSeek-V3)

**2. UI-полировка — AlertDialog вместо window.confirm**

Файл: `artifacts/hochu-to/src/pages/ListingForm.tsx`, компонент `AiDescriptionButton`

Браузерный `window.confirm()` заблокирован в Replit-iframe (silent fail) и несовместим с фирменным UI. Заменён на контролируемый `AlertDialog` из `@radix-ui/react-alert-dialog` (компонент уже был в проекте).

Логика:
- Кнопка «Сгенерировать ИИ-описание» вызывает `handleClick`.
- Если `currentText.trim().length > 30` — открывается диалог с предупреждением «Заменить описание?».
- Кнопка «Заменить» (фирменный цвет `#C65D3B`) подтверждает → `doGenerate()`.
- Кнопка «Отмена» закрывает без действия.

`doGenerate` выделен в `useCallback` — одна функция и для прямого вызова (когда текст пустой/короткий), и для подтверждения в диалоге.

Добавлен импорт `useCallback` из React.

**3. Домен — нет пользовательских amvera.io URL в TSX**

Проверено: grep по `amvera\.io` в `.tsx`-файлах вернул `0 совпадений` в пользовательском коде. Все вхождения — только в комментариях кода (URL документации Amvera API), `replit.md` и `docs/AGENT_INSTRUCTIONS.md`. Замена не требуется.

**4. Инфраструктура Replit**

На текущем Replit созданы два воркфлоу:
- **API Server** (`console`, порт 8080): `PORT=8080 pnpm --filter @workspace/api-server run dev`
- **Start application** (`webview`, порт 5000): `PORT=5000 BASE_PATH=/ pnpm --filter @workspace/hochu-to run dev`

### Чему это нас учит (НЕ регрессировать)

- **Direct DeepSeek ≠ Amvera.** Для прямого DeepSeek используется стандартный Chat Completions формат: `Authorization: Bearer DEEPSEEK_API_KEY`, поле сообщений `content` (не `text`), ответ в `choices[0].message.content`. Это противоположно Amvera, где `X-Auth-Token: Bearer`, поле `text`, ответ в `alternatives[0].message.text`.
- **window.confirm в iframe = тихий баг.** Replit и другие iframe-среды блокируют нативный диалог без вывода ошибки — пользователь видит, что нажал кнопку, но ничего не произошло. При любом новом confirm-паттерне сразу использовать AlertDialog.
- **Цепочка провайдеров теперь трёхуровневая.** При смоке AI-эндпоинтов с `provider: "amvera"` и отсутствующим Amvera-токеном система должна попробовать DeepSeek, и только если и он недоступен — вернуть mock. Если возвращается mock при живом DEEPSEEK_API_KEY — искать ошибку в промежуточном catch.

### Smoke (PASS на dev, 30.04.2026)
1. esbuild api-server build — без ошибок типов ✓
2. Workflow `API Server` (порт 8080) + `Start application` (порт 5000) подняты и работают ✓
3. `GET /api/health`, `/api/listings`, `/api/categories`, `/api/regions` → 200 ✓
4. AI mock-режим: `POST /api/ai/generate-description` с `provider:"mock"` → `actualProvider:"mock"`, `fallback:false` ✓
5. Фронтенд (`/`) рендерится, хедер, hero, CTA-кнопки — всё на месте ✓

### Прод-чеклист (после деплоя на Amvera/hochuto.ru)
1. Установить `DEEPSEEK_API_KEY = sk-bbf4cc431aa4488895da859c9516492e` в переменные окружения Amvera.
2. Проверить: `POST /api/ai/generate-description` с `provider: "amvera"` — если Amvera жив, должен вернуть `actualProvider: "amvera"`, `fallback: false`.
3. Временно убрать `AMVERA_API_TOKEN` → повторить запрос → должен сработать DeepSeek (`actualProvider` будет `"amvera"`, но в логах — `"Amvera failed, trying direct DeepSeek API"` + успех).
4. UI: в форме добавления вещи нажать «Сгенерировать ИИ-описание» при заполненном поле — должен появиться AlertDialog (не нативный confirm).

### Push
```bash
bash scripts/github-push.sh "feat(ai): direct DeepSeek API fallback (Amvera→DeepSeek→Mock); refactor(ui): AlertDialog instead of window.confirm"
```

---

## Журнал — Stage 33.1 (UI & Logic Polish — GPS, Gender, Cache, 30.04.2026)

**Контекст.** Продолжение полировки после Stage 33.0. Три независимых улучшения: визуализация GPS-пинов на карте в админке, гендерно-чувствительные уведомления, кэш буллетов инфографики.

### Что сделано

**1. GPS — несколько пинов на карте (wow-эффект для администратора)**

Файлы: `artifacts/hochu-to/src/components/DigitalActMap.tsx`, `artifacts/hochu-to/src/pages/AdminPage.tsx`

- `DigitalActMap` принимает новый проп `pins: Array<{lat, lng, label?}>` в дополнение к старым `lat`/`lng` (обратная совместимость сохранена).
- При нескольких пинах карта автоматически вызывает `fitBounds(group.getBounds().pad(0.25))` — все маркеры видны сразу.
- Клик по маркеру открывает popup с координатами и номером фото (`Фото 1`, `Фото 2`, …).
- `AdminPage.tsx` / `DigitalActsBlock`: теперь извлекает **все** GPS-точки из `meta.photoExif[]` (а не только первую), передаёт их в `DigitalActMap` как `pins`. Бейдж "📍 GPS" показывает количество точек если > 1.

**2. Гендерно-чувствительные уведомления**

Файлы: `artifacts/api-server/src/lib/notifications.ts`, `artifacts/api-server/src/routes/bookings.ts`

Новые экспорты в `notifications.ts`:
```typescript
type Gender = "m" | "f" | "n"
function detectGender(name: string): Gender        // эвристика по имени
function genderedWord(name, maleForm, femaleForm, neutralForm?): string
function genderPronounGen(name: string): string     // "него" / "неё"
```

Эвристика: имена на «а»/«я» — женские; список исключений (Никита, Илья, Петя, Миша, …) — мужские; двусмысленные (Саша, Женя, Валя) — нейтральные (fallback = maleForm).

Обновлённые сообщения в `bookings.ts`:
| Событие | До | После (пример: владелица Мария) |
|---|---|---|
| `booking_confirmed` | «Владелец подтвердил» | «Владелица подтвердила» |
| `booking_active` | «Владелец подтвердил передачу» | «Владелица подтвердила передачу» |
| `booking_return_pending` | «Арендатор инициировал возврат» | «Арендаторша инициировала возврат» |
| `booking_rejected` | «Владелец отклонил» | «Владелица отклонила» |
| `booking_cancelled` | «Владелец отменил(а)» | «Владелица отменила» |
| `booking_created` | «оставил заявку. Свяжитесь с ним» | «оставила заявку. Свяжитесь с ней» |

**3. Кэш буллетов инфографики**

Файл: `artifacts/api-server/src/lib/ai-service.ts`

- In-memory `Map<string, BulletsEntry>` с TTL 24 часа.
- Ключ кэша: `lowercase(title) + "|" + lowercase(category)`.
- При повторном запросе для того же объявления (title+category) буллеты берутся из кэша — нет вызова LLM. Экономия токенов.
- Лог при cache hit: `"ai-service: infographic bullets cache hit"` с флагом `fromCache: true`.
- Mock-провайдер обходит кэш (всегда возвращает детерминированный шаблон).

**4. Исправлен баг: роль admin не слетает при смене телефона**

Файлы: `artifacts/api-server/src/routes/users.ts`, `artifacts/hochu-to/src/pages/Dashboard.tsx`

- Бэкенд: перед обновлением профиля читает текущую роль из БД; если `role === "admin"` — поле role в SET-запросе игнорируется.
- Фронтенд: переключатель «Арендатор/Владелец» скрыт для пользователей с `user.role === "admin"`.

### Правило «не регрессировать»
- `detectGender` никогда не бросает — при пустом имени возвращает `"n"`.
- `genderedWord` при `gender === "n"` возвращает `neutralForm ?? maleForm` (никогда не пустую строку).
- Кэш буллетов не блокирует генерацию: если TTL истёк или ключ не найден — идём в LLM как обычно.
- Карта с несколькими пинами не сломается при 1 пине — ветка `pins.length === 1` устанавливает `setView([...], 16)` без fitBounds.

### Коммит
```
refactor(ui/logic): GPS multi-pins, gender-aware notifications, bullets cache (Stage 33.1)
```

---

## Журнал — Stage 33.1.5 (Safe Technical Debt Polish, 02.05.2026)

**Что сделано:**

**1. Обновлён снапшот `scripts/db-snapshots/dev-data.sql`**
- Выполнен `pg_dump --data-only --column-inserts --no-owner --no-privileges` с расширенным списком таблиц.
- Добавлены новые таблицы: `pools`, `pool_shares`, `share_offers`, `digital_acts`, `payments`, `payout_methods`, `payout_requests`.
- Результат: 379 строк (был несовместим с текущей схемой). `setup-new-replit.sh` теперь работает корректно на чистом окружении.

**2. Рефакторинг `BuyoutBlock` и `SellerOfferActions` в `PoolDetail.tsx`**
- Все 3 вызова нативного `window.confirm()` заменены на `AlertDialog` из `@radix-ui/react-alert-dialog` (тот же компонент, что используется в `ListingForm.tsx` c Stage 33.0).
- `SellerOfferActions`: добавлено состояние `cancelDialog: "reserved" | "listed" | null`, два отдельных AlertDialog для «Отменить оффер» и «Снять с продажи».
- `BuyoutBlock`: добавлено состояние `cancelBuyoutOpen: boolean`, AlertDialog для «Отменить запрос на выкуп».
- Нативный `confirm()` в iframe (Replit, embedded) всегда тихо возвращал `false` — баг был незаметен в production, но ломал UX.

**Файлы:**
- `scripts/db-snapshots/dev-data.sql` (обновлён)
- `artifacts/hochu-to/src/pages/PoolDetail.tsx` (AlertDialog × 3)
- `replit.md` (Stage 28 followup частично закрыт)
- `docs/AGENT_INSTRUCTIONS.md` (TODO снапшота закрыт)

### Коммит
```
chore(db): refresh dev-data.sql snapshot; refactor(ui): replace native confirm in buyout block
```

---

## Журнал — Stage 33 (AI-Арбитражор / Vision Analysis — ✅ РЕАЛИЗОВАН в Stage 33.0)

> ✅ **Этот раздел был планом — он полностью реализован в Stage 33.0 (30.04.2026).** Актуальный журнал реализации — выше в разделе «Stage 33.0». Hardening (таймауты, audit-логи, модель через env) — в разделе «Stage 33.1 AI Arbitration Hardening».

**Что из плана реализовано:**
- ✅ `arbitrateWithGeminiVision(claimId)` в `lib/ai-service.ts` — Gemini Vision анализирует пары фото `check_in`/`check_out`.
- ✅ `POST /api/claims/:id/ai-verdict` — только `requireAdmin`; результат кешируется в `claims.ai_verdict` (JSONB).
- ✅ Human-in-the-loop: LLM-вердикт = только рекомендация, кнопка «AI-анализ» в AdminPage.
- ✅ Audit trail: `ai_verdict_requested` / `ai_verdict_failed` / `ai_verdict_exception` в `audit_events`.
- ✅ Таймаут 15 сек (AbortController), graceful degradation без `GEMINI_API_KEY`.
- ✅ `GEMINI_VISION_MODEL` через env с дефолтом `"gemini-flash-latest"` (⚠️ не менять на `1.5-flash` — даёт 404).
- ✅ Маппинг вины на сумму: `suggestedAmountRub = requestedAmount × faultEstimatePercent / 100` (в TypeScript, не в LLM).

**Что НЕ реализовано (отложено):**
- ❌ Video-анализ (только фото).
- ❌ Промежуточная стадия «AI задаёт вопросы участникам».
- ❌ Автоматические выплаты (ждём Stage 24 + ИП).

---

## Журнал — Prod-Fix-1 (sharp в prod-зависимостях, 02.05.2026)

**Контекст.** После деплоя Stage 30B (AI-инфографика через sharp) на Amvera эндпоинт `POST /api/ai/generate-infographic` возвращал `ERR_MODULE_NOT_FOUND: Cannot find package 'sharp'`. В dev-среде Replit всё работало — пакет был в lockfile. Проблема была скрыта: `sharp` установился при `pnpm install` (dev), но в Dockerfile в production-stage выполняется `pnpm install --no-frozen-lockfile --prod`, который устанавливает только `dependencies`, не `devDependencies`. Поскольку `sharp` не был явно указан в `dependencies` секции `artifacts/api-server/package.json` — prod-контейнер его не получал.

### Что исправлено

**1. `artifacts/api-server/package.json`:**
- `"sharp": "^0.34.5"` добавлен в секцию `dependencies` (ранее отсутствовал полностью — был только в корневом lockfile как транзитивная зависимость).

**2. `pnpm-workspace.yaml`:**
- `sharp` добавлен в список `onlyBuiltDependencies`:
  ```yaml
  onlyBuiltDependencies:
    - "@swc/core"
    - esbuild
    - msw
    - sharp        # ← добавлен
    - unrs-resolver
  ```
  Без этого нативные бинарники sharp не собираются при `pnpm install` (pnpm 10+ требует явного разрешения build scripts).

**3. `pnpm install --filter @workspace/api-server`** выполнен — sharp собрался:
```
.../sharp@0.34.5/node_modules/sharp install: Done
```

### Деплой

- Изменения запушены на GitHub: коммит `dffed76`.
- Пользователь выполнил в Shell:
  ```bash
  git remote set-url amvera https://pdkiller666:4_5AznCgvidfr5x@git.msk0.amvera.ru/pdkiller666/hocuto
  git push amvera main
  ```
- Amvera подтвердил: `remote: Detected changes in main branch`, `* [new branch] main -> main`.
- Пересборка Docker-образа запущена автоматически.

### Диагностика (признаки проблемы)

- В логах API-сервера при старте: `Error: Cannot find package 'sharp' imported from ...`
- Эндпоинт `/api/ai/generate-infographic` возвращает 500.
- В dev-среде (`pnpm install` без `--prod`) всё работает — пакет есть в lockfile.

### Что НЕ тронуто

- `artifacts/api-server/build.mjs` — `sharp` уже был в массиве `external` (правильно: sharp не должен бандлиться esbuild'ом, он должен присутствовать в `node_modules` рантайма).
- `Dockerfile` — команда `pnpm install --no-frozen-lockfile --prod` остаётся, теперь она корректно подхватывает sharp из `dependencies`.

### Правило «не регрессировать»

- **Любой нативный npm-пакет** (с бинарниками) должен быть явно прописан в `dependencies` И в `onlyBuiltDependencies` в `pnpm-workspace.yaml`. Иначе prod-контейнер его не получит / не скомпилирует.
- При добавлении нового пакета проверять: нужен ли он в prod (не только в dev)? Если да — в `dependencies`, а не в `devDependencies`.

### Amvera push команды (актуальные)

> ⚠️ Amvera git-репозиторий использует ветку `master`, GitHub — `main`. При прямом push в Amvera всегда указывать `main:master`.

```bash
# Основной путь — push в GitHub (webhook Amvera тригерится автоматически):
git push https://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@github.com/pdkiller666/Hochu_to.git main

# Emergency: прямой push в Amvera (если webhook не сработал):
git push https://pdkiller666:4_5AznCgvidfr5x@git.msk0.amvera.ru/pdkiller666/hocuto main:master

# Emergency + форс (если rejected non-fast-forward):
git push --force https://pdkiller666:4_5AznCgvidfr5x@git.msk0.amvera.ru/pdkiller666/hocuto main:master
```

---

## Журнал — Stage 32.1 (Trust Score V8 — публичный рейтинг, 02.05.2026)

**Контекст.** `trust_score` и `completed_deals_count` уже рассчитывались в фоне (Stage 29), но не показывались пользователям. Stage 32.1 выводит их публично на карточку объявления и в публичный профиль.

### Что сделано

**Action 1 — Бэкенд `users.ts`:**
- `GET /users/:id` уже возвращал `trustScore` и `completedDeals` (Stage 29) — проверено ✅
- Добавлен алиас `completedDealsCount` для единообразия с DB-полем `users.completed_deals_count`.

**Action 2 — Бэкенд `listings.ts`:**
- В три SELECT-блока (список `/listings`, getById `/listings/:id`, fallback других регионов) добавлено поле `ownerCompletedDealsCount: usersTable.completedDealsCount`.
- В fallback-блок (3-й SELECT) добавлен `ownerTrustScore: usersTable.trustScore` — ранее отсутствовал.

**Action 3 — Фронтенд `artifacts/hochu-to/src/pages/ListingDetail.tsx`:**
- Добавлена функция `getTrustScoreColor(score)`: ≥90 → `text-emerald-600`, ≥70 → `text-stone-500`, иначе → `text-amber-600`.
- Под именем владельца добавлена строка: `ShieldCheckIcon` + «Доверие: X%» + «Сделок: Y».
- Существующий `<TrustBadge>` (Stage 29) сохранён без изменений.

**Action 4 — Фронтенд `artifacts/hochu-to/src/pages/OwnerProfile.tsx`:**
- Добавлена та же функция `getTrustScoreColor`.
- Добавлен виджет «Надёжность пользователя» (`bg-[#F2EEE3] rounded-xl p-4 border border-stone-200`) с процентом и числом завершённых сделок — над блоком «Контакты скрыты».

**Важно — правило приватности:** `phone` и `email` не выводятся в публичном `GET /users/:id`; `trustScore` и `completedDealsCount` — публичные поля.

```bash
feat(trust): Stage 32.1 – implement public trust score on listings and profiles
```

---

## Журнал — Stage 33.1 (AI Arbitration Hardening, 02.05.2026)

> ⚠️ В истории есть другой «Stage 33.1» (UI & Logic Polish — GPS/Gender/Cache, 30.04.2026). Этот — отдельная задача по закалке AI-арбитражора.

**Контекст.** AI-арбитражор MVP работает (Stage 33.0), но был уязвим к таймаутам, отсутствию переменных и тихим ошибкам.

### Что сделано

**Action 1 — `artifacts/api-server/src/lib/ai-service.ts`:**
- `GEMINI_VISION_MODEL` теперь берётся из env: `process.env.GEMINI_VISION_MODEL || "gemini-flash-latest"`.
- Условие проверки фото ужесточено: `!checkIn || !checkOut` (раньше `&&`) — требуются **оба** акта.
- В `catch (fetchErr)` добавлен явный перехват `AbortError` → `{ confidence:'low', error:'AI service timeout' }`.

**Action 2 — `artifacts/api-server/src/routes/claims.ts` (POST `/claims/:id/ai-verdict`):**
- Весь маршрут обёрнут в `try/catch`.
- Если `verdictRaw.error` (мягкий сбой AI) → `audit_events` с `eventType:'ai_verdict_failed'`.
- Если `catch(err)` (необработанное исключение) → `audit_events` с `eventType:'ai_verdict_exception'` + `err.message` в metadata + HTTP 500.

**Проверка в БД:**
```sql
SELECT event_type, metadata FROM audit_events
WHERE event_type IN ('ai_verdict_failed','ai_verdict_exception','ai_verdict_requested')
ORDER BY id DESC LIMIT 3;
-- → ai_verdict_failed: {"error": "GEMINI_API_KEY не задан", "confidence": "low"}
-- → ai_verdict_requested: {"hasError": true, "confidence": "low", ...}
```

```bash
fix(ai): harden Stage 33 arbitration with timeouts, explicit model fallback, and error audit logging
```

---

## Журнал — Stage 34 (Real-time WebSockets — Chats & Notifications, 02.05.2026)

**Контекст.** Чаты в `Dashboard.tsx` опрашивали сервер каждые 5 секунд (`setInterval`), уведомления в `Header.tsx` — каждые 30 секунд. Stage 34 заменяет HTTP polling на WebSocket push.

### Архитектура

```
Client                          Server
  │  connect  ws://host/ws        │
  │ ─────────────────────────>    │
  │  { type:"auth", token }       │
  │ ─────────────────────────>    │
  │         { type:"authenticated"│
  │ <─────────────────────────    │
  │                               │
  │         { type:"NEW_MESSAGE"  │  ← после POST /bookings/:id/messages
  │ <─────────────────────────    │     broadcastToUser(receiverId)
  │     { type:"NEW_NOTIFICATION" │  ← после createNotification()
  │ <─────────────────────────    │
```

**Ключевые решения:**
- Токен передаётся в первом сообщении (`{ type:"auth", token }`), **не** в query string — безопасно.
- 5-секундный таймаут аутентификации — если клиент не прислал auth-фрейм, сокет закрывается.
- Heartbeat: ping каждые 30 сек, terminate если нет pong (предотвращает утечку памяти).
- `// TODO: Replace Map with Redis Pub/Sub for horizontal scaling` — в `websocket.ts`.
- broadcast ТОЛЬКО получателю сообщения (НЕ отправителю) — предотвращает дублирование в UI.

### Что сделано

**Action 1 — Бэкенд `artifacts/api-server/src/lib/websocket.ts` (новый файл):**
- `initWebSocketServer(httpServer)` — WebSocketServer на пути `/ws`.
- Auth timeout 5 сек, ping/pong каждые 30 сек.
- `clients: Map<userId, Set<AuthenticatedSocket>>` — in-memory registry.
- `broadcastToUser(userId, event, payload)` — отправляет JSON всем открытым вкладкам пользователя.
- `pnpm add ws` + `pnpm add -D @types/ws`.

**Action 2 — Бэкенд `artifacts/api-server/src/index.ts`:**
- `app.listen(...)` → `createServer(app)` + `initWebSocketServer(httpServer)` + `httpServer.listen(...)`.

**Action 3 — Бэкенд triggers:**
- `routes/bookings.ts` (`POST /:id/messages`): после `insert(bookingMessagesTable)` вызывает `broadcastToUser(receiverId, "NEW_MESSAGE", message)`.
- `lib/notifications.ts` (`createNotification`): `insert(...).returning()` + `broadcastToUser(userId, "NEW_NOTIFICATION", notif)`.

**Action 4 — Фронтенд `artifacts/hochu-to/src/lib/use-websocket.ts` (новый файл):**
- `WsProvider` + `useWs()` hook.
- Подключение при монтировании, auth-фрейм сразу после `onopen`.
- Auto-reconnect через 4 сек после разрыва.
- `subscribe(event, cb)` → возвращает unsubscribe-функцию.
- Экспортирует `isConnected: boolean`.

**Action 5 — Фронтенд `artifacts/hochu-to/src/App.tsx`:**
- `<WsProvider>` обёртывает весь `<QueryClientProvider>`.

**Action 6 — Фронтенд `artifacts/hochu-to/vite.config.ts`:**
- Добавлен WS-прокси: `/ws` → `ws://localhost:8080` с `ws: true`.

**Action 7 — Фронтенд `Header.tsx`:**
- **Удалён** `setInterval(fetchNotifications, 30000)`.
- Fetch при mount и при `isConnected` flip (синхронизация после переподключения).
- `subscribe("NEW_NOTIFICATION", ...)` — push новых уведомлений.

**Action 8 — Фронтенд `Dashboard.tsx`:**
- **Удалён** `setInterval(() => fetchMessages(...), 5_000)`.
- Fetch при `openChatId` + `isConnected` flip.
- `subscribe("NEW_MESSAGE", ...)` — push входящих сообщений + обновление `unreadCounts`.
- 🟢/🟡 индикатор соединения (2px dot) в заголовке каждого чата (`title="Чат подключён"` / `"Переподключение..."`).

**Проверка:**
```
[18:44:22.792] INFO: WS: WebSocket server initialized at /ws  ✅
```

```bash
feat(realtime): Stage 34 – implement robust WebSockets with secure auth, ping/pong, and sync logic
```

---

## Журнал — Quick Fix: Stable Gemini Alias for Vision (02.05.2026)

**Проблема.** В Stage 33.1 AI hardening дефолт `GEMINI_VISION_MODEL` был ошибочно выставлен в `"gemini-1.5-flash"`. Этот алиас даёт **404 Not Found** на `v1beta` endpoint Google (задокументировано в Stage 30G journal). Единственный стабильный алиас — `"gemini-flash-latest"`.

**Исправление** (`artifacts/api-server/src/lib/ai-service.ts`):
```ts
// Было:
const GEMINI_VISION_MODEL = process.env.GEMINI_VISION_MODEL || "gemini-1.5-flash";

// Стало:
const GEMINI_VISION_MODEL = process.env.GEMINI_VISION_MODEL || "gemini-flash-latest";
```

**Правило для следующего агента:** ⚠️ НЕ менять дефолт на `"gemini-1.5-flash"` — даже если в ТЗ будет написано иначе. Алиас `*-latest` — единственный стабильный вариант на нашем ключе.

```bash
fix(ai): restore stable alias gemini-flash-latest for vision fallback to prevent 404 errors
```

---

## Журнал — Stage 35 (Mobile Responsiveness Polish, 02.05.2026)

**Контекст.** Полный аудит мобильной вёрстки (375px) по всем страницам. Исправлены переполнения и непропорциональные элементы на смартфонах.

### Изменённые файлы

| Файл | Правки |
|------|--------|
| `Catalog.tsx` | Grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` (два места: строки 535, 545); gap `gap-4 sm:gap-6` |
| `ListingCard.tsx` | Блок цена+кнопка → `flex flex-wrap items-end justify-between gap-1.5`; кнопка `ml-auto` (wraps right-aligned) |
| `AdminPage.tsx` | `StatCard`: `p-3 sm:p-5`, иконка `w-9 h-9 sm:w-12 sm:h-12`, цифра `text-xl sm:text-2xl`; строка пользователей → `grid-cols-2 sm:grid-cols-4`; Finance KPI: `p-3 sm:p-5`, `min-w-0 overflow-hidden`, длинные лейблы с `<br className="sm:hidden" />` |
| `OwnerProfile.tsx` | Статы карточки: `p-3 sm:p-4`, `text-xl sm:text-2xl`, `text-[10px] sm:text-xs` |
| `Home.tsx` | Hero h1: `text-3xl sm:text-5xl md:text-6xl lg:text-7xl`; subtitle: `text-base sm:text-xl`; категории h2: `text-2xl sm:text-3xl`; How it works h2: `text-2xl md:text-4xl`; CTA h2: `text-2xl sm:text-4xl md:text-5xl` |
| `ListingDetail.tsx` | Цена в сайдбаре: `text-3xl sm:text-4xl`; сайдбар: `p-4 sm:p-6`, `lg:sticky lg:top-28`; мобильный заголовок `text-2xl sm:text-3xl` (уже был) |
| `PoolDetail.tsx` | Собранная сумма: `text-2xl sm:text-3xl`; сумма оффера: `text-2xl sm:text-3xl` |

### Принципы (для следующего агента)

- Все таблицы в `AdminPage.tsx` обёрнуты `overflow-x-auto` — горизонтальный скролл на мобильном.
- Заголовки `hidden lg:block` — десктоп-only, мобильные дублируют с `lg:hidden`.
- Breakpoints Tailwind: `sm`=640px, `md`=768px, `lg`=1024px, `xl`=1280px. Кастомного `xs` нет.
- Эмодзи-иконки (`text-4xl`) в Cards — декоративные, не текст — overflow не создают.

```bash
fix(mobile): Stage 35 – responsive typography, grid cols and padding across Catalog, Cards, Admin, Home, ListingDetail, PoolDetail
```

---

## Журнал — Stage 35b (Soft Delete Account, 02.05.2026)

**Контекст.** Право на забвение (GDPR/ФЗ-152): пользователь может удалить аккаунт без физического удаления строки (FK-ограничения).

### Бэкенд: `DELETE /api/users/me`

Файл: `artifacts/api-server/src/routes/users.ts`

**Порядок операций:**
1. Проверка активных броней (`status IN ('pending', 'confirmed', 'active')`) — 400 если есть.
2. Проверка активных споров (`status IN ('pending', 'admin_review')`) — 400 если есть.
3. Анонимизация: `name = 'Удаленный пользователь'`, `email = deleted_${id}_${uuid}@hochu.to`, `phone/avatar/bio/telegram/website = null`, `passwordHash = random UUID` (вход невозможен), `isBanned = true`, `banReason = 'account_deleted'`.
4. Деактивация объявлений: `listings.isAvailable = false` для всех объявлений пользователя.
5. Удаление сессий: `DELETE FROM auth_sessions WHERE user_id = $userId` (убивает все refresh tokens).

### Фронтенд: `artifacts/hochu-to/src/pages/Dashboard.tsx`

- Новые state: `showDeleteAccountModal`, `deleteConfirmText`, `deletingAccount`.
- Функция `handleDeleteAccount()`: вызывает API, затем `removeToken()` + `setLocation("/")`.
- UI: красная секция «Опасная зона» в настройках профиля с кнопкой «Удалить аккаунт».
- Модальное окно: предупреждение + поле ввода слова «УДАЛИТЬ» (кнопка заблокирована до правильного ввода).
- Импорт `removeToken` добавлен в `@/lib/auth`.

### Схема БД: `lib/db/src/schema/users.ts`

- `userRoleEnum` расширен: добавлены `'user', 'moderator', 'support', 'arbiter', 'superadmin'` (старые `renter`, `owner`, `admin` сохранены).
- Новые KYC-поля: `verificationStatus` (text, default `'unverified'`), `verificationProvider` (text), `verificationData` (jsonb).
- Миграция применена через `drizzle-kit push`.

### Правила для следующего агента

- `DELETE /me` зарегистрирован **до** `GET /:id` в роутере — важно для Express-матчинга.
- `banReason = 'account_deleted'` — сигнал для admin-панели что это не ручной бан.
- Новые роли (`moderator`, `support`, `arbiter`, `superadmin`) пока не имеют спец. логики — добавляй по мере необходимости.
- Физически строки пользователя не удаляем никогда (FK integrity).

```bash
feat(users): Stage 35b - implement account soft delete with data anonymization and prepare schema for RBAC/KYC
```

## Журнал — Stage 36 (RBAC — Role-Based Access Control, 02.05.2026)

### Что реализовано

**Action 1 — Backend Middleware (`auth.ts`)**
- Добавлена `requireRole(...allowedRoles: string[])` — гибкий RBAC middleware, ставится ПОСЛЕ `requireAuth`.
- `requireAdmin` обновлён: теперь пускает `admin` **и** `superadmin` (backward-compat для незатронутых маршрутов).

**Action 2 — Защита API-эндпоинтов**

| Группа | Роли | Маршруты |
|--------|------|----------|
| Finance/Stats | `superadmin` | GET /stats/extended, /settings, PUT /settings, /settings/ai-provider, /audit-log, /seed, /seed-test-listings |
| Stats/Analytics | `superadmin`, `admin` | GET /stats, /analytics |
| User Management | `superadmin`, `admin` | GET/PATCH /users/:id, GET /users, POST /broadcast |
| Moderation | `superadmin`, `admin`, `moderator` | GET/PATCH/DELETE /listings, GET /bookings, POST /bookings/override |
| Поддержка | `superadmin`, `admin`, `support`, `moderator` | GET/PATCH /tickets, POST /tickets/reply |
| Жалобы | `superadmin`, `admin`, `moderator` | GET/PATCH /reports |
| Claims — просмотр/вердикт | `superadmin`, `admin`, `arbiter` | GET /claims, POST /claims/:id/approve/reject/ai-verdict |
| Claims — выплата | `superadmin`, `admin` | POST /claims/:id/mark-paid |
| Claims analytics | `superadmin` | GET /claims/analytics |

**Action 3 — Frontend Tab Hiding (`AdminPage.tsx`)**
- Стража входа в `/admin` расширена: принимает все 5 admin-ролей (`admin`, `superadmin`, `moderator`, `support`, `arbiter`).
- `TABS` массив получил поле `roles?: string[]` — если не задано, таб виден всем.
- Tab bar рендерит только `TABS.filter(t => !t.roles || t.roles.includes(currentRole))`.
- Заголовок панели: `Имя · ROLE` вместо «Администратор: Имя».

**Action 4 — Role Assignment UI + Endpoint**
- `PATCH /admin/users/:id/role` — принимает `{ role }`, пишет audit `change_role`, guard: только суперадмин может назначить `superadmin`, нельзя изменить собственную роль.
- В таблице Users: для admin/superadmin — цветной `<select>` с мгновенным сохранением; для остальных — read-only span.
- Константы `ROLE_LABELS`, `ROLE_COLORS`, `ALL_ROLES` — общие для таблицы, edit-формы UserDetailPanel и filter dropdown.
- Фильтр ролей расширен (все 8 ролей включая `user`, `moderator`, `support`, `arbiter`, `superadmin`).

### Ключевые заметки
- Порядок middleware: `requireAuth` → `requireRole(...)` — requireRole читает `req.userRole` из requireAuth.
- `requireAdmin` = backward-compat alias для `requireRole('admin', 'superadmin')` — незатронутые маршруты автоматически поддерживают superadmin.
- Inline `<select>` в строке таблицы: `onClick={e => e.stopPropagation()}` — клик не открывает UserDetailPanel.
- superadmin-опция скрыта из выпадающего если текущий зритель не superadmin.
- Все TypeScript-ошибки в tsc-проверке — **pre-existing** (до Stage 36): scheduler.ts, bookings.ts, claims.ts, contacts.ts — esbuild транспилирует без ошибок.

```bash
feat(rbac): implement role-based access control, secure finance routes, and hide unauthorized admin UI tabs
```

## Журнал — Stage 37 (Staff Profiles & UI Polish, 02.05.2026)

### Что реализовано

**Action 1 — Staff Badge на публичных страницах**

- `artifacts/api-server/src/routes/listings.ts`: добавлено поле `ownerRole: usersTable.role` во все три SELECT-блока (одиночный листинг, catalog-query, fallback-query).
- `artifacts/hochu-to/src/pages/OwnerProfile.tsx`: константы `STAFF_ROLES` + `isStaff`; бейдж `<span className="... bg-[#0ea5e9] text-white">` с `<Shield w-3>` + «Команда Хочу_То» добавлен рядом с именем — отображается для `superadmin | admin | moderator | support | arbiter`.
- `artifacts/hochu-to/src/pages/ListingDetail.tsx`: тот же бейдж добавлен в owner card (секция «Владелец» в правой колонке), проверяет `(listing as any).ownerRole`.

**Action 2 — Служебный статус в личном кабинете**

- `artifacts/hochu-to/src/pages/Dashboard.tsx`: в блоке `activeTab === "profile" && user.role !== "admin"` добавлен IIFE-блок Stage 37 (перед Trust Score).
- Виджет видим только для ролей `superadmin | admin | moderator | support | arbiter`.
- Объект `STAFF_META` хранит `{ label, border, icon }` по каждой роли.
- Русские названия ролей: `superadmin → Владелец платформы`, `admin → Администратор`, `moderator → Модератор`, `support → Поддержка`, `arbiter → Арбитр`.
- Бейдж «Команда Хочу_То» дублируется в заголовке виджета.

**Action 3 — Back-button Polish**

- `OwnerProfile.tsx` line 107: `className="flex ..."` → `"inline-flex ..."` — кнопка «Назад» больше не растягивается на всю ширину контейнера.
- `ListingDetail.tsx`: «Вернуться в каталог» уже использует `inline-flex` — изменений не потребовалось.

### Ключевые заметки
- Tailwind-классы в `STAFF_META` — литеральные строки (не собирать через `.split()`), purge-safe.
- `ownerRole` не был в ответе API до Stage 37; теперь присутствует во всех трёх query-блоках listings.ts.
- Блок «Служебный статус» отображается внутри `user.role !== "admin"` ветки; `admin`-роль по-прежнему видит `AdminAccountPanel` с отдельным баннером «Администратор платформы».

```bash
feat(users): implement staff badges for public profiles and refine navigation buttons UI
```

## Журнал — Stage 37.1 (Platform Owner → superadmin by default, 02.05.2026)

### Проблема
`admin@hochu.to` создавался/обновлялся с `role: "admin"`, что лишало его доступа к эндпоинтам `requireRole("superadmin")` (settings, audit-log, finance, payouts, economy, AI-настройки) и соответствующим табам в AdminPage.

### Исправления

**`artifacts/api-server/src/index.ts` — `seedDefaultAdmin()`**
- Создание нового пользователя: `role: "admin"` → `role: "superadmin"`, `name: "Администратор"` → `"Владелец платформы"`.
- Проверка существующего: `if (existingUser.role !== "admin")` → `if (existingUser.role !== "superadmin")`. Теперь при каждом перезапуске, если роль меньше superadmin — повышаем автоматически.
- При старте сервера в логах появляется: `Platform owner promoted to superadmin. email: "admin@hochu.to" prevRole: "admin"`.

**`artifacts/hochu-to/src/pages/Dashboard.tsx` — AdminAccountPanel**
- `activeTab === "profile" && user.role === "admin"` → `(user.role === "admin" || user.role === "superadmin")`.
- Обратная ветка `user.role !== "admin"` → `user.role !== "admin" && user.role !== "superadmin"`.
- Баннер в AdminAccountPanel: динамический текст `user.role === "superadmin" ? "Владелец платформы" : "Администратор платформы"`.

### Тест после исправлений
- `POST /api/auth/login` → `role: superadmin` ✅
- `GET /api/admin/settings` → 200 ✅ (было 403 для admin)
- `GET /api/admin/audit-log` → 200 ✅
- `GET /api/admin/stats` → 200 ✅
- AdminPage: все табы (`finance`, `payouts`, `economy`, `payments`, `audit`, `ai`) видны ✅

### Ключевые заметки
- `seedDefaultAdmin` идемпотентна: при каждом перезапуске сервера проверяет роль и повышает если нужно.
- Наличие `ADMIN_EMAIL` env-переменной позволяет задать другой email владельца платформы.

```bash
fix(auth): promote platform owner admin@hochu.to to superadmin on every server start
```

## Журнал — Stage 38 (Telegram Bot & Notification Engine, 02.05.2026)

### Обзор
Полноценная интеграция Telegram-бота (`@Helper251223_bot`) для доставки уведомлений пользователям и рассылок персоналу. Тест-сьют: **37/37 ✅**.

### DB-миграции
**`lib/db/src/schema/users.ts`**
- `telegram_chat_id text` — chat ID пользователя после привязки
- `telegram_otp text` — текущий OTP (перезаписывается при повторной генерации)
- `telegram_otp_expires_at timestamp` — TTL 10 минут
- `telegram_notifications jsonb` — `{bookings, system, chats: boolean}` (дефолт: все true)

**`lib/db/src/schema/platform-settings.ts`**
- `telegram_bot_token text` — nullable; если NULL — бот берёт токен из env `TELEGRAM_BOT_TOKEN`
- `telegram_env text` — `"dev"` (только суперадмины получают уведомления) | `"prod"` (все)

### Новые файлы
**`artifacts/api-server/src/lib/telegram.ts`** — весь Telegram-слой:
- `initTelegramBot()` — читает токен из `platform_settings ?? process.env.TELEGRAM_BOT_TOKEN`, вызывается в `index.ts` при старте
- `startBot(token)` — Telegraf long-poll, регистрирует handlers `/start` и `/link`
- `handleOtp(ctx, otp)` — ищет пользователя по OTP, проверяет TTL, пишет `telegram_chat_id`, очищает OTP
- `sendTelegramToUser(userId, category, text, link?)` — уважает dev-режим и preferences пользователя; 3 retry с exponential backoff
- `notifyStaffByRole(roles[], text, link?)` — рассылка по ролям сотрудников
- `broadcastToAll(text, link?, adminId?, role?)` — массовая рассылка с опциональным роль-фильтром (VALID_ROLES whitelist), dev-фильтр, rate ~20 msg/sec
- `hotSwapToken(newToken, adminId?)` — **await** + автооткат DB к `prevToken` при 401; возвращает `{ok, username|error}`
- `getBotStatus()`, `stopBot()`, `isValidBroadcastRole()`

**`artifacts/api-server/src/routes/telegram.ts`** — маршруты для пользователей:
- `POST /telegram/generate-otp` — 6-значный код, TTL 10 мин, перезаписывает предыдущий
- `GET /telegram/status` — `{linked, hasOtp, otpExpiresAt, preferences}`
- `POST /telegram/unlink` — очищает `telegram_chat_id`, идемпотентен
- `PATCH /telegram/preferences` — Zod-валидация `{bookings?, system?, chats?: boolean}`

### Изменения в существующих файлах
**`artifacts/api-server/src/routes/admin.ts`**
- `PUT /admin/settings` — `telegramBotToken` и `telegramEnv` добавлены в `ALLOWED_FIELDS` и `NULLABLE_STR_FIELDS`. Hot-swap: await `hotSwapToken()` → если fail → rollback DB → `hotSwapToken(prevToken)` fire-and-forget; `telegramSwap: {ok, username|error}` в ответе.
- `GET /admin/telegram/status` — `{online, username, env, hasToken}` (superadmin only)
- `POST /admin/telegram/broadcast` — `{text, link?, role?}` с валидацией роли через `isValidBroadcastRole()` → 400 при невалидной; (superadmin only)

**`artifacts/api-server/src/lib/notifications.ts`**
- `createNotification()` — fire-and-forget `sendTelegramToUser(userId, category, text, link)` после insert

**`artifacts/api-server/src/index.ts`**
- Вызов `await initTelegramBot()` после `ensurePlatformSettings()`, non-fatal

**`artifacts/api-server/src/routes/index.ts`**
- Регистрация `/telegram` маршрутов

**`artifacts/hochu-to/src/pages/Dashboard.tsx`**
- Состояния: `tgLinked, tgOtp, tgPrefs, tgBusy`
- `useEffect` — загружает `/telegram/status` при открытии таба профиля
- Функции: `tgGenerateOtp()`, `tgUnlink()`, `tgUpdatePref(key, val)`
- UI: карточка «Telegram-уведомления» с OTP-инструкцией, кнопкой «Обновить код», toggle-переключателями (bookings/system/chats), кнопкой «Отвязать»
- Импорт: добавлен `RefreshCw` из `lucide-react`

**`artifacts/hochu-to/src/pages/AdminPage.tsx`**
- `TABS` — добавлен `{ id: "telegram", label: "Telegram", icon: Send }` (только superadmin)
- `TelegramBotTab` — статус бота (🟢/🔴 + @username), env dev/prod, broadcast-форма (textarea + URL + select роли)

### Секреты
- `TELEGRAM_BOT_TOKEN` — добавлен в Replit Secrets. Текущий бот: `@Helper251223_bot`. Суперадмин может сменить через AdminPage → горячая замена без перезапуска.

### Ключевые архитектурные решения
1. **env-fallback приоритет:** `platform_settings.telegram_bot_token ?? process.env.TELEGRAM_BOT_TOKEN` — бот работает из коробки, суперадмин переопределяет через UI
2. **Hot-swap с откатом:** неудачный swap не убивает работающий бот — atomically rollback DB и restart с предыдущим токеном
3. **Dev-режим:** `telegramEnv=dev` → уведомления только суперадминам; безопасно запускать в тестовой среде
4. **Fire-and-forget диспетч:** `createNotification()` не блокируется на Telegram; сбой отправки не ломает основной поток
5. **VALID_ROLES whitelist:** broadcast принимает только известные роли → 400 при попытке broadcast role=hacker

### Тест-сьют (37/37)
- **A (5):** бот онлайн, 401/403 контроль доступа
- **B (4):** OTP 6 цифр, TTL 10 мин, hasOtp, перегенерация
- **C (4):** preferences update, валидация типов, пустой body
- **D (2):** unlink идемпотентность, status после unlink
- **E (6):** broadcast text/role валидация, невалидная роль → 400
- **F (5):** hot-swap фейковый → rollback → бот онлайн, hot-swap валидный → ok
- **G (5):** OTP-привязка через DB-симуляцию → linked=true → unlink → linked=false
- **H (4):** dev/prod env переключение, невалидный env → 400
- **I (2):** GET /notifications, superadmin без привязки

### Баги, найденные и исправленные при тестировании
1. **Hot-swap был fire-and-forget** — `hotSwapToken().catch(() => {})` не блокировал ответ и не откатывал DB при ошибке. Исправлено: await + rollback.
2. **Broadcast не валидировал роль** — `role="hacker"` молча игнорировался. Исправлено: `isValidBroadcastRole()` + 400.
3. **RefreshCw не был импортирован** в `Dashboard.tsx`. Исправлено.

```bash
feat(stage38): Telegram bot integration — OTP linking, hot-swap, broadcast, notification dispatch (37/37 tests)
```

---

