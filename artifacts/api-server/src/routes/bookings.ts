import { Router } from "express";
import { db, bookingsTable, listingsTable, usersTable, bookingEventsTable, bookingMessagesTable, digitalActsTable, poolSharesTable, poolsTable } from "@workspace/db";
import { eq, or, and, sql, ne, asc, desc, inArray } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { CreateBookingBody } from "@workspace/api-zod";
import { createNotification } from "../lib/notifications.js";
import { getPlatformSettings, num } from "../lib/platform-settings.js";
import { applyBookingCountDelta, bookingCountDelta, bookingCounts } from "../lib/listing-counters.js";
import { recordAuditEvent } from "../lib/audit-events.js";
import { recalcTrustScoreForUsers } from "../lib/trust-score.js";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateBookingNumber(id: number): string {
  const year = new Date().getFullYear();
  const padded = String(id).padStart(6, "0");
  return `ХТ-${year}-${padded}`;
}

// ─── Stage 23c: Co-owner pricing ────────────────────────────────────────────
// Совладелец листинга, привязанного к пулу (pool_shares в статусе оплаты),
// арендует «свою долю» по платформенному тарифу coOwnerDailyFeeRub —
// БЕЗ rentAmount владельцу (он сам себе владелец) и БЕЗ налогов/payout.
// Защитный фонд — на общих основаниях (если protectionEnabled), это страховка
// для всех участников пула, а не только для арендатора.
async function isCoOwner(userId: number, listing: { poolId: number | null }): Promise<boolean> {
  if (!listing.poolId) return false;
  const [share] = await db
    .select({ id: poolSharesTable.id })
    .from(poolSharesTable)
    .where(and(
      eq(poolSharesTable.poolId, listing.poolId),
      eq(poolSharesTable.userId, userId),
      inArray(poolSharesTable.paymentStatus, ["creator_confirmed", "escrow_held"]),
    ))
    .limit(1);
  return !!share;
}

async function recordEvent(params: {
  bookingId: number;
  bookingNumber: string;
  actorId?: number;
  actorRole?: "owner" | "renter" | "system" | "admin";
  eventType: string;
  fromStatus?: string;
  toStatus?: string;
  comment?: string;
}) {
  await db.insert(bookingEventsTable).values({
    bookingId: params.bookingId,
    bookingNumber: params.bookingNumber,
    actorId: params.actorId ?? null,
    actorRole: params.actorRole ?? null,
    eventType: params.eventType,
    fromStatus: params.fromStatus ?? null,
    toStatus: params.toStatus ?? null,
    comment: params.comment ?? null,
  });
}

const SHOW_CONTACTS_STATUSES = ["confirmed", "active", "return_pending", "completed"];

function formatBooking(
  b: typeof bookingsTable.$inferSelect,
  listing?: { title?: string | null; photos?: string[] | null },
  renter?: { name?: string | null },
  owner?: { name?: string | null; phone?: string | null; telegram?: string | null; website?: string | null },
) {
  const days = Math.max(1, Math.ceil(
    (new Date(b.endDate).getTime() - new Date(b.startDate).getTime()) / 86_400_000
  ));
  const showContacts = SHOW_CONTACTS_STATUSES.includes(b.status);
  return {
    id: b.id,
    bookingNumber: b.bookingNumber ?? undefined,
    listingId: b.listingId,
    listingTitle: listing?.title ?? undefined,
    listingPhoto: listing?.photos?.[0] ?? undefined,
    renterId: b.renterId,
    renterName: renter?.name ?? undefined,
    ownerId: b.ownerId,
    ownerName: owner?.name ?? undefined,
    ownerPhone: showContacts ? (owner?.phone ?? undefined) : undefined,
    ownerTelegram: showContacts ? (owner?.telegram ?? undefined) : undefined,
    ownerWebsite: showContacts ? (owner?.website ?? undefined) : undefined,
    startDate: b.startDate,
    endDate: b.endDate,
    totalDays: days,
    totalPrice: parseFloat(b.totalPrice as unknown as string),
    rentAmount: b.rentAmount ? parseFloat(b.rentAmount as unknown as string) : undefined,
    serviceFee: b.serviceFee ? parseFloat(b.serviceFee as unknown as string) : undefined,
    taxFee: b.taxFee ? parseFloat(b.taxFee as unknown as string) : undefined,
    fundContribution: b.fundContribution ? parseFloat(b.fundContribution as unknown as string) : undefined,
    renterFundContribution: b.renterFundContribution ? parseFloat(b.renterFundContribution as unknown as string) : undefined,
    ownerPayout: b.ownerPayout !== null && b.ownerPayout !== undefined ? parseFloat(b.ownerPayout as unknown as string) : undefined,
    depositAmount: b.depositAmount ? parseFloat(b.depositAmount as unknown as string) : undefined,
    protectionEnabled: b.protectionEnabled ?? true,
    renterProtectionEnabled: b.renterProtectionEnabled ?? false,
    status: b.status,
    message: b.message ?? undefined,
    ownerComment: b.ownerComment ?? undefined,
    createdAt: b.createdAt.toISOString(),
  };
}

// ─── GET /api/bookings — current user's bookings ──────────────────────────────

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const bookings = await db
    .select({
      booking: bookingsTable,
      listingTitle: listingsTable.title,
      listingPhotos: listingsTable.photos,
      listingDeposit: listingsTable.deposit,
      listingMeetingAddress: listingsTable.meetingAddress,
      renterName: sql<string>`renter.name`,
      renterAvatar: sql<string>`renter.avatar`,
      ownerName: sql<string>`owner.name`,
      ownerPhone: sql<string>`owner.phone`,
      ownerTelegram: sql<string>`owner.telegram`,
      ownerWebsite: sql<string>`owner.website`,
    })
    .from(bookingsTable)
    .leftJoin(listingsTable, eq(bookingsTable.listingId, listingsTable.id))
    .leftJoin(sql`${usersTable} AS renter`, sql`renter.id = ${bookingsTable.renterId}`)
    .leftJoin(sql`${usersTable} AS owner`, sql`owner.id = ${bookingsTable.ownerId}`)
    .where(or(eq(bookingsTable.renterId, req.userId!), eq(bookingsTable.ownerId, req.userId!)))
    .orderBy(desc(bookingsTable.createdAt));

  const showContacts = (status: string) => SHOW_CONTACTS_STATUSES.includes(status);

  res.json(bookings.map(row => ({
    id: row.booking.id,
    bookingNumber: row.booking.bookingNumber ?? undefined,
    listingId: row.booking.listingId,
    listingTitle: row.listingTitle ?? undefined,
    listingPhoto: row.listingPhotos?.[0] ?? undefined,
    renterId: row.booking.renterId,
    renterName: row.renterName ?? undefined,
    renterAvatar: row.renterAvatar ?? undefined,
    ownerId: row.booking.ownerId,
    ownerName: row.ownerName ?? undefined,
    ownerPhone: showContacts(row.booking.status) ? (row.ownerPhone ?? undefined) : undefined,
    ownerTelegram: showContacts(row.booking.status) ? (row.ownerTelegram ?? undefined) : undefined,
    ownerWebsite: showContacts(row.booking.status) ? (row.ownerWebsite ?? undefined) : undefined,
    startDate: row.booking.startDate,
    endDate: row.booking.endDate,
    totalDays: Math.max(1, Math.ceil(
      (new Date(row.booking.endDate).getTime() - new Date(row.booking.startDate).getTime()) / 86_400_000
    )),
    totalPrice: parseFloat(row.booking.totalPrice as unknown as string),
    rentAmount: row.booking.rentAmount ? parseFloat(row.booking.rentAmount as unknown as string) : undefined,
    ownerPayout: row.booking.ownerPayout != null ? parseFloat(row.booking.ownerPayout as unknown as string) : undefined,
    protectionEnabled: row.booking.protectionEnabled ?? true,
    listingDeposit: row.listingDeposit ? parseFloat(row.listingDeposit as unknown as string) : undefined,
    listingMeetingAddress: showContacts(row.booking.status) ? (row.listingMeetingAddress ?? undefined) : undefined,
    status: row.booking.status,
    message: row.booking.message ?? undefined,
    ownerComment: row.booking.ownerComment ?? undefined,
    createdAt: row.booking.createdAt.toISOString(),
  })));
});

// ─── POST /api/bookings — create booking ──────────────────────────────────────

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const parsed = CreateBookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const { listingId, startDate: rawStart, endDate: rawEnd, message, renterProtectionEnabled = false } = parsed.data;
  // Stage 23c: protectionEnabled может быть форсирован true для co-owner (см. ниже),
  // поэтому делаем let.
  let protectionEnabled: boolean = parsed.data.protectionEnabled ?? true;

  // ── Bugfix (beta-mode): подгружаем настройки заранее, чтобы можно было
  // финально форсить protectionEnabled=false ПОСЛЕ co-owner override (см. ниже).
  // Ранний форс был бы перезатёрт co-owner блоком в true и ушёл бы в Сценарий А
  // с начислением co-owner-таксы — что нарушает инвариант beta «комиссии = 0».
  const _earlySettings = await getPlatformSettings();

  // ─── Валидация формата дат (если переданы) ──────────────────────────────
  // Принимаем строго YYYY-MM-DD, иначе 400.
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  for (const [name, val] of [["startDate", rawStart], ["endDate", rawEnd]] as const) {
    if (val !== undefined && val !== null && val !== "") {
      if (!DATE_RE.test(val) || Number.isNaN(new Date(val).getTime())) {
        res.status(400).json({ error: "invalid_date_format", message: `${name} должен быть в формате YYYY-MM-DD` });
        return;
      }
    }
  }

  // Цена открытия контакта берётся из настроек платформы (конфигурируется админом)
  const platformSettings = await getPlatformSettings();
  const CONTACT_FEE = platformSettings.contactPriceSingle;

  const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, listingId)).limit(1);
  if (!listing) {
    res.status(404).json({ error: "not_found", message: "Объявление не найдено" });
    return;
  }
  if (listing.ownerId === req.userId) {
    res.status(400).json({ error: "bad_request", message: "Нельзя арендовать свою вещь" });
    return;
  }

  // ─── Хелпер для валидации эффективных дат ───────────────────────────────
  const todayStr = new Date().toISOString().split("T")[0];
  const validateRange = (start: string, end: string): string | null => {
    if (end < start) return "Дата окончания не может быть раньше даты начала";
    if (start < todayStr) return "Нельзя забронировать на прошедшую дату";
    return null;
  };

  // ─── Stage 23c: Co-owner — ВСЕГДА через Сценарий А ────────────────────────
  // Совладелец пула не может «обойти» co-owner-таксу через protectionEnabled=false:
  // Сценарий Б (прямой контакт за contact_fee) НЕ применим к листингам, к которым
  // привязаны pool_shares — там работает фиксированная такса coOwnerDailyFeeRub.
  // Защитный фонд (renterFundContribution) — страховка для всех совладельцев,
  // поэтому форсируем protectionEnabled=true. Результат проверки переиспользуется
  // ниже для override-блока (одна БД-операция вместо двух).
  const coOwner = await isCoOwner(req.userId!, listing);
  if (coOwner) {
    protectionEnabled = true;
  }

  // ── Bugfix (beta-mode) FINAL force: применяется ПОСЛЕ co-owner override.
  // В Бета-режиме коммерция отключена для ВСЕХ пользователей, включая совладельцев
  // пула — co-owner-такса/защитный фонд тоже обнулены, поэтому уводим всех в
  // Сценарий Б, который пишет protectionEnabled=false и нулевые комиссии.
  if (_earlySettings.isCommercialMode === false) {
    protectionEnabled = false;
  }

  // ─── Сценарий Б: Прямой расчёт ───────────────────────────────────────────
  if (!protectionEnabled) {
    const startDate = rawStart ?? todayStr;
    const endDate = rawEnd ?? startDate;
    const dateErr = validateRange(startDate, endDate);
    if (dateErr) {
      res.status(400).json({ error: "invalid_dates", message: dateErr });
      return;
    }

    // Считаем фактическую стоимость аренды (арендатор платит напрямую владельцу)
    const daysB = startDate && endDate
      ? Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000))
      : 1;
    const pricePerDayB = parseFloat(listing.pricePerDay as unknown as string);
    const rentAmountB = parseFloat((daysB * pricePerDayB).toFixed(2));

    // Stage 23c: TOCTOU guard для Сценария Б — если статус совладения изменился
    // false→true между первой проверкой и INSERT, отклоняем 409. Это симметрично
    // защите Сценария А и закрывает обратное окно гонки (когда пользователь стал
    // co-owner и ожидает льготную цену, но мы уже выбрали ветку прямого контакта).
    const coOwnerNowB = await isCoOwner(req.userId!, listing);
    if (coOwnerNowB !== coOwner) {
      res.status(409).json({
        error: "co_owner_state_changed",
        message: "Статус совладения изменился, обновите страницу и попробуйте снова",
      });
      return;
    }

    // Bugfix (beta-mode): в Бета-режиме коммерция отключена — арендатор НЕ платит
    // contact_fee платформе. Сохраняем totalPrice=0 (вместо CONTACT_FEE), чтобы
    // Dashboard и уведомления не вводили в заблуждение «оплачено N₽».
    const isBetaMode = _earlySettings.isCommercialMode === false;
    const totalPriceB = isBetaMode ? 0 : CONTACT_FEE;

    const [booking] = await db.insert(bookingsTable).values({
      listingId,
      renterId: req.userId!,
      ownerId: listing.ownerId,
      startDate,
      endDate,
      totalDays: daysB,
      totalPrice: totalPriceB.toString(),
      rentAmount: rentAmountB.toString(),
      serviceFee: "0",
      taxFee: "0",
      fundContribution: "0",
      depositAmount: "0",
      protectionEnabled: false,
      status: "confirmed",
      message: message ?? null,
    }).returning();

    const bookingNumber = generateBookingNumber(booking.id);
    await db.update(bookingsTable).set({ bookingNumber }).where(eq(bookingsTable.id, booking.id));
    booking.bookingNumber = bookingNumber;

    // Прямой контакт создаётся сразу со статусом 'confirmed' → +1 к bookingCount
    if (bookingCounts(booking.status)) {
      await applyBookingCountDelta(booking.listingId, +1);
    }

    const [renterUser] = await db.select({ name: usersTable.name }).from(usersTable)
      .where(eq(usersTable.id, req.userId!)).limit(1);

    await recordEvent({
      bookingId: booking.id,
      bookingNumber,
      actorId: req.userId!,
      actorRole: "renter",
      eventType: "direct_contact_opened",
      toStatus: "confirmed",
      comment: isBetaMode
        ? `Бета-режим: заявка отправлена напрямую владельцу (без оплаты платформе)`
        : `Прямой расчёт: оплачено ${CONTACT_FEE} ₽ за открытие контактов`,
    });

    await createNotification({
      userId: listing.ownerId,
      type: "booking_created",
      title: isBetaMode
        ? `📩 Новая заявка — «${listing.title}»`
        : `📞 Прямой запрос контактов — «${listing.title}»`,
      message: isBetaMode
        ? `${renterUser?.name ?? "Пользователь"} оставил заявку на аренду. Свяжитесь с ним и договоритесь о встрече.`
        : `${renterUser?.name ?? "Пользователь"} оплатил открытие ваших контактов (${CONTACT_FEE} ₽). Ожидайте сообщения.`,
      bookingId: booking.id,
      listingTitle: listing.title ?? undefined,
    });
    await createNotification({
      userId: req.userId!,
      type: "booking_submitted",
      title: isBetaMode
        ? `📩 Заявка отправлена — «${listing.title}»`
        : `📞 Контакты открыты — «${listing.title}»`,
      message: isBetaMode
        ? `Ваша заявка отправлена владельцу. Он свяжется с вами в ближайшее время — оплата напрямую при встрече.`
        : `Вы оплатили открытие контактов владельца. Свяжитесь с ним напрямую.`,
      bookingId: booking.id,
      listingTitle: listing.title ?? undefined,
    });

    return res.status(201).json(formatBooking(booking, listing, renterUser));
  }

  // ─── Сценарий А: Безопасная сделка ───────────────────────────────────────
  if (!rawStart || !rawEnd) {
    res.status(400).json({ error: "validation_error", message: "Укажите даты аренды" });
    return;
  }
  const startDate = rawStart;
  const endDate = rawEnd;
  const dateErrA = validateRange(startDate, endDate);
  if (dateErrA) {
    res.status(400).json({ error: "invalid_dates", message: dateErrA });
    return;
  }

  const conflicts = await db.select().from(bookingsTable).where(
    and(
      eq(bookingsTable.listingId, listingId),
      sql`${bookingsTable.status} IN ('pending', 'confirmed', 'active', 'return_pending')`,
      sql`NOT (${bookingsTable.endDate} < ${startDate} OR ${bookingsTable.startDate} > ${endDate})`
    )
  ).limit(1);

  if (conflicts.length > 0) {
    res.status(400).json({ error: "conflict", message: "Выбранные даты уже заняты" });
    return;
  }

  const days = Math.max(1, Math.ceil(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000
  ));

  const pricePerDay = parseFloat(listing.pricePerDay as unknown as string);
  let rent = parseFloat((days * pricePerDay).toFixed(2));

  // Stage 23c: `coOwner` уже определён выше (до Сценария Б), переиспользуем
  // в override-блоке после стандартного расчёта Модели А.

  // ─── Модель А: Один Гарантийный фонд, две независимые подписки ─────────────
  // Каждая сторона платит долю ТОЛЬКО если сама согласилась участвовать.
  // Edge case (Variant 3): если объявление Free, а арендатор хочет защиту →
  // владелец получает 100% rent, арендатор оплачивает service+tax+свою долю фонда.
  const settings = await getPlatformSettings();
  const ownerOptedIn = listing.ownerProtectionEnabled !== false; // выбор владельца при публикации
  const renterOptedIn = renterProtectionEnabled !== false;       // выбор арендатора при бронировании
  const isFreeUpgrade = !ownerOptedIn; // в этой ветке protectionEnabled=true → апгрейд

  // Апгрейд Free→Premium доступен только если разрешён в настройках
  if (isFreeUpgrade && !settings.freeToPremiumUpgradeEnabled) {
    res.status(403).json({
      error: "upgrade_disabled",
      message: "Апгрейд защиты на бесплатных объявлениях временно отключён",
    });
    return;
  }

  // ── Stage 21a: Soft-Launch override ────────────────────────────────────
  // В бета-режиме (`is_commercial_mode = false`) UI показывает все опции защиты,
  // но математика обнуляется — ничего не списываем, ничего не удерживаем.
  const commercial = settings.isCommercialMode === true;

  // Единая формула доли фонда для обеих сторон (только в коммерч. режиме)
  const fundShare = commercial ? Math.max(
    parseFloat((rent * num(settings.shieldFeePercent) / 100).toFixed(2)),
    settings.shieldFeeMin,
  ) : 0;
  let ownerFundContrib = (commercial && ownerOptedIn) ? fundShare : 0;
  const renterFundContrib = (commercial && renterOptedIn) ? fundShare : 0;

  const serviceFeeAmt = commercial ? parseFloat((rent * num(settings.serviceFeePercent) / 100).toFixed(2)) : 0;
  const taxFeeAmt = commercial ? parseFloat((rent * num(settings.taxFeePercent) / 100).toFixed(2)) : 0;

  let serviceFee: number;
  let taxFee: number;
  let totalPrice: number;
  let ownerPayout: number;

  if (isFreeUpgrade) {
    // Variant 3: Free-объявление, арендатор апгрейдит до защищённой сделки.
    // Владелец работает «в серую» (его обещанный 100%) — все операционные расходы платформы
    // (эквайринг, эскроу, фонд) ложатся на инициатора защиты — арендатора.
    serviceFee = serviceFeeAmt;
    taxFee = taxFeeAmt;
    ownerPayout = parseFloat((rent - ownerFundContrib).toFixed(2)); // ownerFundContrib=0
    totalPrice = parseFloat((rent + serviceFee + taxFee + renterFundContrib).toFixed(2));
  } else {
    // Premium-объявление: service/tax удерживаются с владельца (стандартная схема).
    // Арендатор доплачивает только свою долю фонда (если сам опт-инул).
    serviceFee = serviceFeeAmt;
    taxFee = taxFeeAmt;
    ownerPayout = parseFloat((rent - serviceFee - taxFee - ownerFundContrib).toFixed(2));
    totalPrice = parseFloat((rent + renterFundContrib).toFixed(2));
  }

  // Stage 23c: co-owner override — после стандартного расчёта обнуляем rent
  // и payout, кладём фиксированную таксу за день в serviceFee. Защитный фонд
  // (renterFundContrib) сохраняем — это страховка для всех совладельцев.
  if (coOwner) {
    const coOwnerFee = parseFloat((days * num(settings.coOwnerDailyFeeRub)).toFixed(2));
    rent = 0;
    serviceFee = coOwnerFee;
    taxFee = 0;
    ownerPayout = 0;
    // owner fund contrib обнуляем — владелец не «зарабатывает» с самого себя.
    ownerFundContrib = 0;
    totalPrice = parseFloat((coOwnerFee + renterFundContrib).toFixed(2));
  }

  const listingDeposit = listing.deposit ? parseFloat(listing.deposit as unknown as string) : null;
  const depositAmount = listingDeposit ?? Math.max(settings.depositMin, pricePerDay * num(settings.depositMultiplier));

  // Mapping в существующие поля БД (для обратной совместимости):
  //   fundContribution        ← взнос ВЛАДЕЛЬЦА в фонд
  //   renterFundContribution  ← взнос АРЕНДАТОРА в фонд
  const fundContribution = ownerFundContrib;
  const renterFundContrib_db = renterFundContrib;

  // ─── Stage 23c: TOCTOU guard — re-check co-owner status перед записью ───────
  // Между первой проверкой `coOwner` (строка ~223) и INSERT мог пройти update
  // pool_shares.payment_status (например, share отозвана админом). Если статус
  // изменился — отказываем, клиент должен переотправить запрос с актуальной
  // ценой. Это защищает от stale-pricing атаки.
  const coOwnerNow = await isCoOwner(req.userId!, listing);
  if (coOwnerNow !== coOwner) {
    res.status(409).json({
      error: "co_owner_state_changed",
      message: "Статус совладения изменился, обновите страницу и попробуйте снова",
    });
    return;
  }

  const [booking] = await db.insert(bookingsTable).values({
    listingId,
    renterId: req.userId!,
    ownerId: listing.ownerId,
    startDate,
    endDate,
    totalDays: days,
    totalPrice: totalPrice.toString(),
    rentAmount: rent.toString(),
    serviceFee: serviceFee.toString(),
    taxFee: taxFee.toString(),
    fundContribution: fundContribution.toString(),
    renterFundContribution: renterFundContrib_db.toString(),
    depositAmount: depositAmount.toString(),
    ownerPayout: ownerPayout.toString(),
    protectionEnabled: true,
    renterProtectionEnabled: renterOptedIn,
    status: "pending",
    message: message ?? null,
  }).returning();

  // Generate and assign booking number immediately
  const bookingNumber = generateBookingNumber(booking.id);
  await db.update(bookingsTable)
    .set({ bookingNumber })
    .where(eq(bookingsTable.id, booking.id));
  booking.bookingNumber = bookingNumber;

  // Audit log: booking created
  const [renterUser] = await db.select({ name: usersTable.name }).from(usersTable)
    .where(eq(usersTable.id, req.userId!)).limit(1);

  await recordEvent({
    bookingId: booking.id,
    bookingNumber,
    actorId: req.userId!,
    actorRole: "renter",
    eventType: "created",
    toStatus: "pending",
    comment: message ?? undefined,
  });

  // Аудит и отдельное уведомление при апгрейде Free → Premium на уровне сделки
  if (isFreeUpgrade) {
    await recordEvent({
      bookingId: booking.id,
      bookingNumber,
      actorId: req.userId!,
      actorRole: "renter",
      eventType: "renter_upgraded_to_protection",
      toStatus: "pending",
      comment: `Арендатор апгрейднул Free-объявление до защищённой сделки. Взнос арендатора в Гарантийный фонд: ${renterFundContrib} ₽. Сервис и налог (${serviceFee + taxFee} ₽) оплачены арендатором — владелец получает 100% (${rent} ₽).`,
    });
  }

  // Notifications
  const upgradeNote = isFreeUpgrade
    ? ` Тип сделки изменён на «Защищённая» — действует Гарантийный фонд платформы. Вы получите ${rent} ₽ (100% аренды) — все комиссии и страховку оплатил арендатор.`
    : "";
  const msgText = `${renterUser?.name ?? "Арендатор"} хочет взять вещь на ${days} ${days === 1 ? "день" : "дней"} (${startDate} — ${endDate}).${upgradeNote}`;
  await createNotification({
    userId: listing.ownerId,
    type: "booking_created",
    title: isFreeUpgrade
      ? `🛡️ Защищённая заявка — «${listing.title}»`
      : `📬 Новая заявка — «${listing.title}»`,
    message: msgText,
    bookingId: booking.id,
    listingTitle: listing.title ?? undefined,
  });
  await createNotification({
    userId: req.userId!,
    type: "booking_submitted",
    title: `📤 Заявка отправлена — «${listing.title}»`,
    message: `Ваша заявка ${bookingNumber} на аренду отправлена владельцу. Ожидайте подтверждения.`,
    bookingId: booking.id,
    listingTitle: listing.title ?? undefined,
  });

  res.status(201).json(formatBooking(booking, listing));
});

// ─── GET /api/bookings/:id ────────────────────────────────────────────────────

router.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);

  if (!booking) {
    res.status(404).json({ error: "not_found", message: "Бронирование не найдено" });
    return;
  }
  if (booking.renterId !== req.userId && booking.ownerId !== req.userId) {
    res.status(403).json({ error: "forbidden", message: "Нет доступа" });
    return;
  }

  const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, booking.listingId)).limit(1);
  const [renter] = await db.select().from(usersTable).where(eq(usersTable.id, booking.renterId)).limit(1);
  const [owner] = await db.select().from(usersTable).where(eq(usersTable.id, booking.ownerId)).limit(1);

  res.json(formatBooking(booking, listing, renter, owner));
});

// ─── PUT /api/bookings/:id — update status ────────────────────────────────────

router.put("/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const { status, ownerComment } = req.body;

  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);
  if (!booking) {
    res.status(404).json({ error: "not_found", message: "Бронирование не найдено" });
    return;
  }
  if (booking.renterId !== req.userId && booking.ownerId !== req.userId) {
    res.status(403).json({ error: "forbidden", message: "Нет доступа" });
    return;
  }

  const validStatuses = ["pending", "confirmed", "active", "return_pending", "rejected", "completed", "cancelled"];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: "bad_request", message: "Недопустимый статус" });
    return;
  }

  const fromStatus = booking.status;
  const isOwner = req.userId === booking.ownerId;
  const isRenter = req.userId === booking.renterId;

  // State transition matrix
  const ownerAllowed: Record<string, string[]> = {
    pending: ["confirmed", "rejected", "cancelled"],
    confirmed: ["active", "rejected", "cancelled"],
    active: ["return_pending", "cancelled"],
    return_pending: ["completed", "cancelled"],
  };
  const renterAllowed: Record<string, string[]> = {
    pending: ["cancelled"],
    confirmed: ["cancelled"],
    active: ["return_pending"],
  };

  const allowedForActor = isOwner
    ? (ownerAllowed[fromStatus] ?? [])
    : (renterAllowed[fromStatus] ?? []);

  if (!allowedForActor.includes(status)) {
    res.status(422).json({
      error: "invalid_transition",
      message: `Переход из «${fromStatus}» в «${status}» недоступен для вашей роли`,
    });
    return;
  }

  // Stage 22a — блокируем переход confirmed → active без Цифрового акта check_in.
  // Это страховка от споров «вещь была сломана уже при передаче». Минимум 4 фото
  // обязательны (валидация в digital_acts.ts).
  if (fromStatus === "confirmed" && status === "active") {
    const [checkInAct] = await db
      .select({ id: digitalActsTable.id })
      .from(digitalActsTable)
      .where(and(eq(digitalActsTable.bookingId, id), eq(digitalActsTable.type, "check_in")))
      .limit(1);
    if (!checkInAct) {
      res.status(409).json({
        error: "digital_act_required",
        message: "Сначала создайте Цифровой акт приёмки (Check-in) — минимум 4 фото вещи.",
      });
      return;
    }
  }

  // Stage 26-B (Co-Sharing Final Polish): pre-derive признак "co-owner-броня".
  // Если эта бронь оформлена совладельцем пула, при completed мы пополним
  // pools.maintenance_fund_balance на сумму serviceFee (это фиксированная
  // co-owner-такса coOwnerDailyFeeRub × days, см. Stage 23c). Re-derive — в
  // том же запросе, что и `coOwner` в POST, но обойтись им мы не можем,
  // потому что PUT — отдельный handler.
  // ВАЖНО: расчёт ДО транзакции, чтобы не ходить в БД из критической секции.
  const [listingForCoOwner] = await db
    .select({ poolId: listingsTable.poolId })
    .from(listingsTable)
    .where(eq(listingsTable.id, booking.listingId))
    .limit(1);
  const isCoOwnerBooking = status === "completed"
    && !!listingForCoOwner?.poolId
    && (await isCoOwner(booking.renterId, { poolId: listingForCoOwner.poolId }));
  const fundDelta = isCoOwnerBooking ? Number(booking.serviceFee ?? 0) : 0;

  // Stage 19e + Stage 26: атомарный переход — UPDATE WHERE id=... AND status=fromStatus.
  // Если параллельный запрос уже сменил статус, RETURNING вернёт 0 строк, мы
  // откатываем транзакцию (через `return null`) и отдаём 409, не применяя
  // ложную дельту bookingCount.
  //
  // Stage 26: оборачиваем status update + bookingCount delta + completed
  // counters (completedDealsCount × 2 + wearAndTearMeter) в ОДНУ db.transaction.
  // Это гарантирует, что либо изменения видимы все вместе, либо ни одно из них.
  // Раньше counters летели отдельными запросами — при падении одного из них
  // (например, CHECK (0..10000) на wear meter) booking уже был помечен completed,
  // и состояние desync-ало. Notifications/audit намеренно ВНЕ транзакции — они
  // идут после commit и не должны блокировать критический flow.
  //
  // Stage 26-B: + pools.maintenance_fund_balance += booking.serviceFee
  // (только для co-owner-броней пула — см. fundDelta выше).
  const updated = await db.transaction(async (tx) => {
    const [u] = await tx.update(bookingsTable).set({
      status,
      ...(status === "rejected" && { ownerComment: ownerComment?.trim() || null }),
    }).where(and(eq(bookingsTable.id, id), eq(bookingsTable.status, fromStatus))).returning();
    if (!u) return null;

    await applyBookingCountDelta(u.listingId, bookingCountDelta(fromStatus, status), tx);

    if (status === "completed") {
      await Promise.all([
        tx.update(usersTable)
          .set({ completedDealsCount: sql`${usersTable.completedDealsCount} + 1` })
          .where(eq(usersTable.id, booking.ownerId)),
        tx.update(usersTable)
          .set({ completedDealsCount: sql`${usersTable.completedDealsCount} + 1` })
          .where(eq(usersTable.id, booking.renterId)),
        // Stage 26: каждая успешно завершённая аренда добавляет +1 к счётчику износа.
        // Cancel/reject не доходят сюда (мы внутри ветки `completed`), поэтому
        // отменённые брони не амортизируют вещь — что и требовалось.
        // CHECK (0..10000) в схеме защищает от overflow — при превышении
        // транзакция упадёт и status тоже не применится (атомарно).
        tx.update(listingsTable)
          .set({ wearAndTearMeter: sql`${listingsTable.wearAndTearMeter} + 1` })
          .where(eq(listingsTable.id, booking.listingId)),
        // Stage 26-B: пополнение фонда пула — только при isCoOwnerBooking.
        // Условный вызов оборачиваем в Promise, чтобы Promise.all всегда
        // получал валидный thenable.
        ...(fundDelta > 0 && listingForCoOwner?.poolId
          ? [tx.update(poolsTable)
              .set({ maintenanceFundBalance: sql`${poolsTable.maintenanceFundBalance} + ${fundDelta.toFixed(2)}` })
              .where(eq(poolsTable.id, listingForCoOwner.poolId))]
          : []),
      ]);
    }
    return u;
  });

  if (!updated) {
    res.status(409).json({
      error: "status_conflict",
      message: "Статус уже изменён в другом запросе. Перезагрузите страницу.",
    });
    return;
  }

  const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, updated.listingId)).limit(1);
  const [owner] = await db.select().from(usersTable).where(eq(usersTable.id, updated.ownerId)).limit(1);
  const title = listing?.title ?? "объявление";
  const bookingNumber = updated.bookingNumber ?? generateBookingNumber(updated.id);

  // Determine actor role for audit
  const actorRole: "owner" | "renter" = req.userId === updated.ownerId ? "owner" : "renter";

  // Stage 26: post-commit side effects (audit + notifications) обёрнуты в try/catch.
  // Транзакция уже зафиксирована — данные сделки консистентны. Падение
  // recordEvent/createNotification (например, БД временно недоступна) не должно
  // приводить к 5xx с уже изменённым статусом. Это вызвало бы у клиента ложный
  // retry, а второй PUT упадёт в `invalid_transition` из-за TOCTOU guard.
  // Логируем и едем дальше — клиент получит корректный ответ.
  try {
    // Audit log: status change
    await recordEvent({
      bookingId: updated.id,
      bookingNumber,
      actorId: req.userId!,
      actorRole,
      eventType: `status_changed`,
      fromStatus,
      toStatus: status,
      comment: status === "rejected" ? (ownerComment?.trim() ?? undefined) : undefined,
    });
  } catch (err) {
    console.error("[bookings PUT] post-commit recordEvent failed", { bookingId: updated.id, err });
  }

  // Stage 26-B: audit-event 'fund_accrued' для прозрачности — кто, сколько,
  // в какой пул. Best-effort, не блокирует ответ.
  if (fundDelta > 0 && listingForCoOwner?.poolId) {
    void recordAuditEvent({
      entityType: "pool",
      entityId: listingForCoOwner.poolId,
      actorId: req.userId!,
      eventType: "fund_accrued",
      metadata: {
        bookingId: updated.id,
        bookingNumber,
        renterId: updated.renterId,
        amountRub: fundDelta,
        source: "co_owner_booking_completed",
      },
    });
  }

  // Notifications (best-effort, не должны блокировать ответ при сбое БД)
  try {
  if (status === "confirmed") {
    await createNotification({
      userId: updated.renterId,
      type: "booking_confirmed",
      title: `✅ Заявка подтверждена — «${title}»`,
      message: `Владелец подтвердил вашу заявку ${bookingNumber}. Договоритесь о встрече для передачи вещи.`,
      bookingId: updated.id,
      listingTitle: title,
    });
  } else if (status === "active") {
    await createNotification({
      userId: updated.renterId,
      type: "booking_active",
      title: `🤝 Вещь передана — «${title}»`,
      message: `Владелец подтвердил передачу вещи по заявке ${bookingNumber}. Аренда началась! Когда вернёте — нажмите «Возвращаю вещь».`,
      bookingId: updated.id,
      listingTitle: title,
    });
  } else if (status === "return_pending") {
    await createNotification({
      userId: updated.ownerId,
      type: "booking_return_pending",
      title: `📦 Арендатор возвращает вещь — «${title}»`,
      message: `Арендатор инициировал возврат по заявке ${bookingNumber}. Встретьтесь и подтвердите получение вещи.`,
      bookingId: updated.id,
      listingTitle: title,
    });
  } else if (status === "rejected") {
    const reason = ownerComment?.trim();
    await createNotification({
      userId: updated.renterId,
      type: "booking_rejected",
      title: `❌ Заявка отклонена — «${title}»`,
      message: reason ? `Заявка ${bookingNumber} отклонена. Причина: ${reason}` : `Владелец отклонил заявку ${bookingNumber}. Попробуйте другие объявления.`,
      bookingId: updated.id,
      listingTitle: title,
    });
  } else if (status === "completed") {
    await createNotification({
      userId: updated.ownerId,
      type: "booking_completed",
      title: `🏆 Сделка завершена — «${title}»`,
      message: `Аренда по заявке ${bookingNumber} успешно закрыта. Сделка добавлена в историю.`,
      bookingId: updated.id,
      listingTitle: title,
    });
    await createNotification({
      userId: updated.renterId,
      type: "booking_completed",
      title: `🏆 Сделка завершена — «${title}»`,
      message: `Спасибо за аренду! Заявка ${bookingNumber} завершена и добавлена в историю.`,
      bookingId: updated.id,
      listingTitle: title,
    });
  } else if (status === "cancelled") {
    // Уведомляем ДРУГУЮ сторону (не того, кто отменил)
    const notifyUserId = actorRole === "renter" ? updated.ownerId : updated.renterId;
    const cancellerWord = actorRole === "renter" ? "Арендатор" : "Владелец";
    await createNotification({
      userId: notifyUserId,
      type: "booking_cancelled",
      title: `🚫 Аренда отменена — «${title}»`,
      message: `${cancellerWord} отменил(а) заявку ${bookingNumber}.`,
      bookingId: updated.id,
      listingTitle: title,
    });
  }
  } catch (err) {
    console.error("[bookings PUT] post-commit notification failed", { bookingId: updated.id, status, err });
  }

  // Stage 29 — Trust Score: пересчитать обоим участникам после завершения сделки.
  // Вне транзакции, не блокирует ответ. recalcTrustScoreForUsers сама ловит ошибки.
  if (status === "completed") {
    void recalcTrustScoreForUsers(
      [updated.ownerId, updated.renterId],
      req.userId ?? null,
      `booking_completed:${updated.id}`,
    );
  }

  res.json(formatBooking(updated, listing, undefined, owner));
});

// ─── PATCH /api/bookings/:id/reschedule — change dates ───────────────────────

router.patch("/:id/reschedule", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const { startDate, endDate } = req.body as { startDate?: string; endDate?: string };

  if (!startDate || !endDate) {
    res.status(400).json({ error: "bad_request", message: "Укажите даты начала и окончания" });
    return;
  }

  const start = new Date(startDate);
  const end   = new Date(endDate);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    res.status(400).json({ error: "bad_request", message: "Неверный формат дат" });
    return;
  }
  if (start < today) {
    res.status(400).json({ error: "bad_request", message: "Дата начала не может быть в прошлом" });
    return;
  }
  if (end <= start) {
    res.status(400).json({ error: "bad_request", message: "Дата окончания должна быть позже даты начала" });
    return;
  }

  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);
  if (!booking) { res.status(404).json({ error: "not_found" }); return; }
  if (booking.renterId !== req.userId && booking.ownerId !== req.userId) {
    res.status(403).json({ error: "forbidden" }); return;
  }
  if (!["pending", "confirmed"].includes(booking.status)) {
    res.status(422).json({ error: "invalid_state", message: "Изменить даты можно только для заявок в статусе «Ожидает» или «Подтверждено»" });
    return;
  }

  const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, booking.listingId)).limit(1);
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
  const pricePerDay = Number(listing?.pricePerDay ?? 0);
  let rent = parseFloat((days * pricePerDay).toFixed(2));

  // Stage 23c: Co-owner — определяем заранее, чтобы переопределить расчёт ниже.
  const coOwnerEdit = listing ? await isCoOwner(booking.renterId, listing) : false;

  // Пересчёт по Модели А: учитываем независимый опт-ин владельца и арендатора
  let totalPrice = rent;
  let serviceFeeNew = 0;
  let taxFeeNew = 0;
  let ownerFundContribNew = 0;
  let renterFundContribNew = 0;
  let ownerPayoutNew = rent;

  if (booking.protectionEnabled) {
    const settings = await getPlatformSettings();
    const ownerOptedIn = listing?.ownerProtectionEnabled !== false;
    const renterOptedIn = booking.renterProtectionEnabled !== false;
    const isFreeUpgrade = !ownerOptedIn;
    // Stage 21a soft-launch override
    const commercial = settings.isCommercialMode === true;

    const fundShare = commercial ? Math.max(
      parseFloat((rent * num(settings.shieldFeePercent) / 100).toFixed(2)),
      settings.shieldFeeMin,
    ) : 0;
    ownerFundContribNew = (commercial && ownerOptedIn) ? fundShare : 0;
    renterFundContribNew = (commercial && renterOptedIn) ? fundShare : 0;

    const svc = commercial ? parseFloat((rent * num(settings.serviceFeePercent) / 100).toFixed(2)) : 0;
    const tax = commercial ? parseFloat((rent * num(settings.taxFeePercent) / 100).toFixed(2)) : 0;
    serviceFeeNew = svc;
    taxFeeNew = tax;

    if (isFreeUpgrade) {
      ownerPayoutNew = parseFloat((rent - ownerFundContribNew).toFixed(2));
      totalPrice = parseFloat((rent + svc + tax + renterFundContribNew).toFixed(2));
    } else {
      ownerPayoutNew = parseFloat((rent - svc - tax - ownerFundContribNew).toFixed(2));
      totalPrice = parseFloat((rent + renterFundContribNew).toFixed(2));
    }
  }

  // Stage 23c: Co-owner override — обнуляем rent/payout/налоги, кладём
  // фиксированную таксу (coOwnerDailyFeeRub × days) в serviceFee. Защитный
  // фонд арендатора (renterFundContribNew) сохраняем — это страховка для
  // всех совладельцев пула.
  if (coOwnerEdit) {
    const settings = await getPlatformSettings();
    const coOwnerFee = parseFloat((days * num(settings.coOwnerDailyFeeRub)).toFixed(2));
    rent = 0;
    serviceFeeNew = coOwnerFee;
    taxFeeNew = 0;
    ownerFundContribNew = 0;
    ownerPayoutNew = 0;
    totalPrice = parseFloat((coOwnerFee + renterFundContribNew).toFixed(2));
  }

  // Stage 23c: TOCTOU guard — re-check co-owner status перед UPDATE.
  // Между первой проверкой `coOwnerEdit` и записью могла измениться
  // pool_shares.payment_status. Если статус сменился — отклоняем 409.
  if (listing) {
    const coOwnerNow = await isCoOwner(booking.renterId, listing);
    if (coOwnerNow !== coOwnerEdit) {
      res.status(409).json({
        error: "co_owner_state_changed",
        message: "Статус совладения изменился, обновите страницу и попробуйте снова",
      });
      return;
    }
  }

  const [updated] = await db.update(bookingsTable)
    .set({
      startDate,
      endDate,
      totalDays: days,
      totalPrice: String(totalPrice),
      rentAmount: String(rent),
      // Stage 23c: для co-owner всегда сохраняем fee-поля (даже если booking
      // создавался без protection — defense in depth, фактически POST форсирует
      // protectionEnabled=true для co-owner).
      ...((booking.protectionEnabled || coOwnerEdit) && {
        serviceFee: String(serviceFeeNew),
        taxFee: String(taxFeeNew),
        fundContribution: String(ownerFundContribNew),
        renterFundContribution: String(renterFundContribNew),
        ownerPayout: String(ownerPayoutNew),
      }),
    })
    .where(eq(bookingsTable.id, id))
    .returning();

  const actorRole: "owner" | "renter" = req.userId === booking.ownerId ? "owner" : "renter";
  const bookingNumber = updated.bookingNumber ?? generateBookingNumber(id);
  const title = listing?.title ?? "объявление";
  const partnerId = actorRole === "owner" ? booking.renterId : booking.ownerId;

  await recordEvent({
    bookingId: id,
    bookingNumber,
    actorId: req.userId!,
    actorRole,
    eventType: "dates_changed",
    comment: `Даты изменены: ${startDate} — ${endDate}. Стоимость: ${totalPrice} ₽`,
  });

  const actor = actorRole === "owner" ? "Владелец" : "Арендатор";
  await createNotification({
    userId: req.userId!,
    type: "booking_confirmed",
    title: `📅 Даты изменены — «${title}»`,
    message: `Новые даты аренды: ${startDate} — ${endDate}. Стоимость пересчитана: ${totalPrice} ₽.`,
    bookingId: id,
    listingTitle: title,
  });
  await createNotification({
    userId: partnerId,
    type: "booking_confirmed",
    title: `📅 Даты бронирования изменены — «${title}»`,
    message: `${actor} изменил(а) даты: ${startDate} — ${endDate}. Новая стоимость: ${totalPrice} ₽. Пожалуйста, проверьте и свяжитесь при необходимости.`,
    bookingId: id,
    listingTitle: title,
  });

  const [owner] = await db.select().from(usersTable).where(eq(usersTable.id, updated.ownerId)).limit(1);
  res.json(formatBooking(updated, listing, undefined, owner));
});

// ─── GET /api/bookings/:id/messages ──────────────────────────────────────────
router.get("/:id/messages", requireAuth, async (req: AuthRequest, res) => {
  const bookingId = parseInt(req.params.id as string);
  if (isNaN(bookingId)) {
    res.status(400).json({ error: "bad_request", message: "Неверный ID" });
    return;
  }

  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);
  if (!booking || (booking.ownerId !== req.userId && booking.renterId !== req.userId)) {
    res.status(403).json({ error: "forbidden", message: "Нет доступа" });
    return;
  }

  // Mark incoming messages as read
  await db
    .update(bookingMessagesTable)
    .set({ isRead: true })
    .where(
      and(
        eq(bookingMessagesTable.bookingId, bookingId),
        ne(bookingMessagesTable.senderId, req.userId!),
        eq(bookingMessagesTable.isRead, false),
      ),
    );

  const messages = await db
    .select()
    .from(bookingMessagesTable)
    .where(eq(bookingMessagesTable.bookingId, bookingId))
    .orderBy(asc(bookingMessagesTable.createdAt));

  res.json(messages);
});

// ─── POST /api/bookings/:id/messages ─────────────────────────────────────────
router.post("/:id/messages", requireAuth, async (req: AuthRequest, res) => {
  const bookingId = parseInt(req.params.id as string);
  if (isNaN(bookingId)) {
    res.status(400).json({ error: "bad_request", message: "Неверный ID" });
    return;
  }

  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);
  if (!booking || (booking.ownerId !== req.userId && booking.renterId !== req.userId)) {
    res.status(403).json({ error: "forbidden", message: "Нет доступа" });
    return;
  }

  const content = (req.body.content ?? "").trim();
  if (!content) {
    res.status(400).json({ error: "bad_request", message: "Сообщение не может быть пустым" });
    return;
  }
  if (content.length > 2000) {
    res.status(400).json({ error: "bad_request", message: "Сообщение слишком длинное (макс. 2000 символов)" });
    return;
  }

  const [message] = await db
    .insert(bookingMessagesTable)
    .values({ bookingId, senderId: req.userId!, content })
    .returning();

  res.status(201).json(message);
});

export default router;
