import { Router } from "express";
import { db, bookingsTable, listingsTable, usersTable, bookingEventsTable, bookingMessagesTable } from "@workspace/db";
import { eq, or, and, sql, ne, asc, desc } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { CreateBookingBody } from "@workspace/api-zod";
import { createNotification } from "../lib/notifications.js";
import { getPlatformSettings, num } from "../lib/platform-settings.js";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateBookingNumber(id: number): string {
  const year = new Date().getFullYear();
  const padded = String(id).padStart(6, "0");
  return `ХТ-${year}-${padded}`;
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
    ownerPayout: b.ownerPayout !== null && b.ownerPayout !== undefined ? parseFloat(b.ownerPayout as unknown as string) : undefined,
    depositAmount: b.depositAmount ? parseFloat(b.depositAmount as unknown as string) : undefined,
    protectionEnabled: b.protectionEnabled ?? true,
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

  const { listingId, startDate: rawStart, endDate: rawEnd, message, protectionEnabled = true, renterProtectionEnabled = false } = parsed.data;

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

  // ─── Сценарий Б: Прямой расчёт ───────────────────────────────────────────
  if (!protectionEnabled) {
    const today = new Date().toISOString().split("T")[0];
    const startDate = rawStart ?? today;
    const endDate = rawEnd ?? today;

    // Считаем фактическую стоимость аренды (арендатор платит напрямую владельцу)
    const daysB = startDate && endDate
      ? Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000))
      : 1;
    const pricePerDayB = parseFloat(listing.pricePerDay as unknown as string);
    const rentAmountB = parseFloat((daysB * pricePerDayB).toFixed(2));

    const [booking] = await db.insert(bookingsTable).values({
      listingId,
      renterId: req.userId!,
      ownerId: listing.ownerId,
      startDate,
      endDate,
      totalDays: daysB,
      totalPrice: CONTACT_FEE.toString(),
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

    const [renterUser] = await db.select({ name: usersTable.name }).from(usersTable)
      .where(eq(usersTable.id, req.userId!)).limit(1);

    await recordEvent({
      bookingId: booking.id,
      bookingNumber,
      actorId: req.userId!,
      actorRole: "renter",
      eventType: "direct_contact_opened",
      toStatus: "confirmed",
      comment: `Прямой расчёт: оплачено ${CONTACT_FEE} ₽ за открытие контактов`,
    });

    await createNotification({
      userId: listing.ownerId,
      type: "booking_created",
      title: `📞 Прямой запрос контактов — «${listing.title}»`,
      message: `${renterUser?.name ?? "Пользователь"} оплатил открытие ваших контактов (${CONTACT_FEE} ₽). Ожидайте сообщения.`,
      bookingId: booking.id,
      listingTitle: listing.title ?? undefined,
    });
    await createNotification({
      userId: req.userId!,
      type: "booking_submitted",
      title: `📞 Контакты открыты — «${listing.title}»`,
      message: `Вы оплатили открытие контактов владельца. Свяжитесь с ним напрямую.`,
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
  const rent = parseFloat((days * pricePerDay).toFixed(2));

  // ─── Модель А: Один Гарантийный фонд, две независимые подписки ─────────────
  // Каждая сторона платит долю ТОЛЬКО если сама согласилась участвовать.
  // Edge case (Variant 3): если объявление Free, а арендатор хочет защиту →
  // владелец получает 100% rent, арендатор оплачивает service+tax+свою долю фонда.
  const settings = await getPlatformSettings();
  const ownerOptedIn = listing.ownerProtectionEnabled !== false; // выбор владельца при публикации
  const renterOptedIn = renterProtectionEnabled !== false;       // выбор арендатора при бронировании
  const isFreeUpgrade = !ownerOptedIn; // в этой ветке protectionEnabled=true → апгрейд

  // Единая формула доли фонда для обеих сторон
  const fundShare = Math.max(
    parseFloat((rent * num(settings.shieldFeePercent) / 100).toFixed(2)),
    settings.shieldFeeMin,
  );
  const ownerFundContrib = ownerOptedIn ? fundShare : 0;
  const renterFundContrib = renterOptedIn ? fundShare : 0;

  const serviceFeeAmt = parseFloat((rent * num(settings.serviceFeePercent) / 100).toFixed(2));
  const taxFeeAmt = parseFloat((rent * num(settings.taxFeePercent) / 100).toFixed(2));

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

  const listingDeposit = listing.deposit ? parseFloat(listing.deposit as unknown as string) : null;
  const depositAmount = listingDeposit ?? Math.max(settings.depositMin, pricePerDay * num(settings.depositMultiplier));

  // Mapping в существующие поля БД (для обратной совместимости):
  //   fundContribution        ← взнос ВЛАДЕЛЬЦА в фонд
  //   renterFundContribution  ← взнос АРЕНДАТОРА в фонд
  const fundContribution = ownerFundContrib;
  const renterFundContrib_db = renterFundContrib;

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
    title: renterUpgradedFromFree
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

  const [updated] = await db.update(bookingsTable).set({
    status,
    ...(status === "rejected" && { ownerComment: ownerComment?.trim() || null }),
  }).where(eq(bookingsTable.id, id)).returning();

  // Завершена сделка — увеличиваем счётчик у обеих сторон
  if (status === "completed") {
    await Promise.all([
      db.update(usersTable)
        .set({ completedDealsCount: sql`${usersTable.completedDealsCount} + 1` })
        .where(eq(usersTable.id, booking.ownerId)),
      db.update(usersTable)
        .set({ completedDealsCount: sql`${usersTable.completedDealsCount} + 1` })
        .where(eq(usersTable.id, booking.renterId)),
    ]);
  }

  const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, updated.listingId)).limit(1);
  const [owner] = await db.select().from(usersTable).where(eq(usersTable.id, updated.ownerId)).limit(1);
  const title = listing?.title ?? "объявление";
  const bookingNumber = updated.bookingNumber ?? generateBookingNumber(updated.id);

  // Determine actor role for audit
  const actorRole: "owner" | "renter" = req.userId === updated.ownerId ? "owner" : "renter";

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

  // Notifications
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
  const rent = parseFloat((days * pricePerDay).toFixed(2));

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

    const fundShare = Math.max(
      parseFloat((rent * num(settings.shieldFeePercent) / 100).toFixed(2)),
      settings.shieldFeeMin,
    );
    ownerFundContribNew = ownerOptedIn ? fundShare : 0;
    renterFundContribNew = renterOptedIn ? fundShare : 0;

    const svc = parseFloat((rent * num(settings.serviceFeePercent) / 100).toFixed(2));
    const tax = parseFloat((rent * num(settings.taxFeePercent) / 100).toFixed(2));
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

  const [updated] = await db.update(bookingsTable)
    .set({
      startDate,
      endDate,
      totalDays: days,
      totalPrice: String(totalPrice),
      rentAmount: String(rent),
      ...(booking.protectionEnabled && {
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
