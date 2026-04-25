/**
 * Booking Reminder Scheduler
 *
 * Performance design (scales to 100k+ bookings):
 * - Fixed 5 DB queries per run regardless of number of active bookings
 * - 1x SELECT active bookings
 * - 1x SELECT listing titles (batched by IDs)
 * - 1x SELECT all existing reminder notifications (batched by booking IDs)
 * - 1x SELECT booking_return_pending timestamps (for return_pending bookings)
 * - 1x batch INSERT new notifications
 *
 * Deduplication is done in-memory via a Set — zero per-booking queries.
 */

import { schedule } from "node-cron";
import { db, bookingsTable, listingsTable, notificationsTable, bookingEventsTable, digitalActsTable } from "@workspace/db";
import { inArray, and, eq } from "drizzle-orm";
import type { NotifType } from "./notifications";
import { logger } from "./logger";

const REMINDER_TYPES: NotifType[] = [
  "reminder_confirm_pending",
  "reminder_handover_today",
  "reminder_handover_overdue",
  "reminder_return_today",
  "reminder_return_overdue",
  "reminder_return_confirm",
  // Stage 22b-followup
  "reminder_checkin_soon",
  "reminder_checkout_soon",
];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

function hoursSince(date: Date): number {
  return (Date.now() - date.getTime()) / 3_600_000;
}

function pluralDays(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return "день";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return "дня";
  return "дней";
}

type NewNotif = {
  userId: number;
  type: NotifType;
  title: string;
  message: string;
  bookingId: number;
  listingTitle: string;
};

async function runReminders() {
  const today = todayStr();
  const tomorrow = tomorrowStr();
  const startTime = Date.now();
  logger.info({ today, tomorrow }, "Scheduler: starting reminder check");

  // ── Query 1: all open bookings ──────────────────────────────────────────
  const activeBookings = await db
    .select()
    .from(bookingsTable)
    .where(inArray(bookingsTable.status, ["pending", "confirmed", "active", "return_pending"]));

  if (activeBookings.length === 0) {
    logger.info("Scheduler: no active bookings, skipping");
    return;
  }

  const bookingIds = activeBookings.map((b) => b.id);

  // ── Query 2: listing titles (distinct IDs only) ─────────────────────────
  const listingIds = [...new Set(activeBookings.map((b) => b.listingId))];
  const listings = await db
    .select({ id: listingsTable.id, title: listingsTable.title })
    .from(listingsTable)
    .where(inArray(listingsTable.id, listingIds));
  const listingMap = new Map(listings.map((l) => [l.id, l.title]));

  // ── Query 3: ALL existing reminder notifications for these bookings ──────
  // Used for in-memory deduplication — zero per-booking queries.
  const existingReminders = await db
    .select({
      bookingId: notificationsTable.bookingId,
      type: notificationsTable.type,
      userId: notificationsTable.userId,
    })
    .from(notificationsTable)
    .where(
      and(
        inArray(notificationsTable.type, REMINDER_TYPES as string[]),
        inArray(notificationsTable.bookingId, bookingIds),
      ),
    );

  // Key format: "bookingId:type:userId"
  const sent = new Set(existingReminders.map((r) => `${r.bookingId}:${r.type}:${r.userId}`));
  const alreadySent = (bookingId: number, type: NotifType, userId: number) =>
    sent.has(`${bookingId}:${type}:${userId}`);

  // ── Query 3b (Stage 22b-followup): какие бронирования уже имеют check_in / check_out акты ───
  // Нужно, чтобы reminder_checkin_soon / reminder_checkout_soon не слать,
  // если участник уже оформил акт.
  const acts = await db
    .select({ bookingId: digitalActsTable.bookingId, type: digitalActsTable.type })
    .from(digitalActsTable)
    .where(inArray(digitalActsTable.bookingId, bookingIds));
  const hasCheckIn  = new Set<number>();
  const hasCheckOut = new Set<number>();
  for (const a of acts) {
    if (a.type === "check_in")  hasCheckIn.add(a.bookingId);
    if (a.type === "check_out") hasCheckOut.add(a.bookingId);
  }

  // ── Query 4: booking_return_pending timestamps for return_pending bookings
  const returnPendingIds = activeBookings
    .filter((b) => b.status === "return_pending")
    .map((b) => b.id);

  const returnTimestamps = new Map<number, Date>();
  if (returnPendingIds.length > 0) {
    const rows = await db
      .select({ bookingId: notificationsTable.bookingId, createdAt: notificationsTable.createdAt })
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.type, "booking_return_pending"),
          inArray(notificationsTable.bookingId, returnPendingIds),
        ),
      );
    for (const row of rows) {
      if (row.bookingId !== null && !returnTimestamps.has(row.bookingId)) {
        returnTimestamps.set(row.bookingId, new Date(row.createdAt));
      }
    }
  }

  // ── In-memory processing — build list of notifications to send ──────────
  const toInsert: NewNotif[] = [];

  const queue = (n: NewNotif) => {
    if (!alreadySent(n.bookingId, n.type, n.userId)) {
      toInsert.push(n);
      sent.add(`${n.bookingId}:${n.type}:${n.userId}`);
    }
  };

  for (const booking of activeBookings) {
    const title = listingMap.get(booking.listingId) ?? "объявление";
    const { id: bookingId, renterId, ownerId, status, startDate, endDate, createdAt } = booking;

    // 1. PENDING > 24h — owner hasn't responded
    if (status === "pending") {
      const hours = hoursSince(new Date(createdAt));
      if (hours >= 24) {
        queue({
          userId: ownerId, type: "reminder_confirm_pending", bookingId, listingTitle: title,
          title: `⏰ Заявка ждёт ответа — «${title}»`,
          message: `Заявка на аренду ожидает вашего ответа уже более суток. Подтвердите или отклоните её в личном кабинете.`,
        });
      }
      if (hours >= 48) {
        queue({
          userId: renterId, type: "reminder_confirm_pending", bookingId, listingTitle: title,
          title: `⏳ Владелец ещё не ответил — «${title}»`,
          message: `Ваша заявка ожидает ответа более двух суток. Возможно, стоит связаться с владельцем или найти другое объявление.`,
        });
      }
    }

    // 2a. CONFIRMED + startDate = tomorrow — за 24ч до передачи: оформите акт
    if (status === "confirmed" && startDate === tomorrow && !hasCheckIn.has(bookingId)) {
      queue({
        userId: renterId, type: "reminder_checkin_soon", bookingId, listingTitle: title,
        title: `📸 Завтра передача — оформите Цифровой акт «${title}»`,
        message: `Завтра вы получите вещь. При встрече оформите Цифровой акт приёмки (4+ фото, видео, подпись) — это ваша единственная защита при споре.`,
      });
      queue({
        userId: ownerId, type: "reminder_checkin_soon", bookingId, listingTitle: title,
        title: `📸 Завтра передаёте вещь — оформите Цифровой акт «${title}»`,
        message: `Завтра передадите вещь арендатору. Оформите Цифровой акт приёмки совместно — без него платформа не сможет защитить вас при споре.`,
      });
    }

    // 2. CONFIRMED + startDate = today — handover day
    if (status === "confirmed" && startDate === today) {
      queue({
        userId: renterId, type: "reminder_handover_today", bookingId, listingTitle: title,
        title: `📅 Сегодня день получения вещи — «${title}»`,
        message: `Аренда начинается сегодня. Свяжитесь с владельцем для получения вещи.`,
      });
      queue({
        userId: ownerId, type: "reminder_handover_today", bookingId, listingTitle: title,
        title: `📅 Сегодня передайте вещь арендатору — «${title}»`,
        message: `Аренда начинается сегодня. Передайте вещь арендатору и нажмите «Передать вещь» в личном кабинете.`,
      });
    }

    // 3. CONFIRMED + startDate < today — handover overdue
    if (status === "confirmed" && startDate < today) {
      queue({
        userId: ownerId, type: "reminder_handover_overdue", bookingId, listingTitle: title,
        title: `⚠️ Вещь не передана — «${title}»`,
        message: `Срок начала аренды (${startDate}) уже прошёл, а вещь ещё не передана арендатору. Передайте вещь или отмените бронирование.`,
      });
      queue({
        userId: renterId, type: "reminder_handover_overdue", bookingId, listingTitle: title,
        title: `⚠️ Аренда началась, но вещь не передана — «${title}»`,
        message: `Срок начала аренды (${startDate}) прошёл, но вещь ещё не передана. Уточните у владельца.`,
      });
    }

    // 4a. ACTIVE + endDate = tomorrow — за 24ч до возврата: оформите акт
    if (status === "active" && endDate === tomorrow && !hasCheckOut.has(bookingId)) {
      queue({
        userId: renterId, type: "reminder_checkout_soon", bookingId, listingTitle: title,
        title: `📸 Завтра возврат — оформите акт возврата «${title}»`,
        message: `Завтра вы возвращаете вещь. При встрече оформите Цифровой акт возврата (4+ фото, видео, подпись) — это докажет, что вы вернули вещь в исправном виде.`,
      });
      queue({
        userId: ownerId, type: "reminder_checkout_soon", bookingId, listingTitle: title,
        title: `📸 Завтра возврат — оформите акт возврата «${title}»`,
        message: `Завтра арендатор возвращает вещь. Оформите Цифровой акт возврата совместно — это зафиксирует состояние вещи на момент возврата.`,
      });
    }

    // 4. ACTIVE + endDate = today — last rental day
    if (status === "active" && endDate === today) {
      queue({
        userId: renterId, type: "reminder_return_today", bookingId, listingTitle: title,
        title: `📅 Сегодня последний день аренды — «${title}»`,
        message: `Верните вещь владельцу и нажмите «Возвращаю вещь» в личном кабинете.`,
      });
      queue({
        userId: ownerId, type: "reminder_return_today", bookingId, listingTitle: title,
        title: `📅 Сегодня арендатор возвращает вещь — «${title}»`,
        message: `Сегодня последний день аренды. Будьте готовы принять вещь обратно.`,
      });
    }

    // 5. ACTIVE + endDate < today — return overdue
    if (status === "active" && endDate < today) {
      const days = daysBetween(endDate, today);
      queue({
        userId: renterId, type: "reminder_return_overdue", bookingId, listingTitle: title,
        title: `🚨 Срок аренды истёк — верните вещь — «${title}»`,
        message: `Срок аренды закончился ${endDate} (${days} ${pluralDays(days)} назад). Немедленно верните вещь и нажмите «Возвращаю вещь» в личном кабинете.`,
      });
      queue({
        userId: ownerId, type: "reminder_return_overdue", bookingId, listingTitle: title,
        title: `🚨 Срок аренды истёк — ждём возврата — «${title}»`,
        message: `Срок аренды закончился ${endDate} (${days} ${pluralDays(days)} назад). Арендатор ещё не вернул вещь. Свяжитесь с ним.`,
      });
    }

    // 6. RETURN_PENDING > 48h — owner hasn't confirmed return
    if (status === "return_pending") {
      const returnedAt = returnTimestamps.get(bookingId);
      if (returnedAt && hoursSince(returnedAt) >= 48) {
        queue({
          userId: ownerId, type: "reminder_return_confirm", bookingId, listingTitle: title,
          title: `⏰ Подтвердите получение вещи — «${title}»`,
          message: `Арендатор сообщил о возврате вещи более 48 часов назад. Подтвердите получение в личном кабинете, чтобы завершить сделку.`,
        });
        queue({
          userId: renterId, type: "reminder_return_confirm", bookingId, listingTitle: title,
          title: `⏳ Владелец ещё не подтвердил возврат — «${title}»`,
          message: `Вы сообщили о возврате вещи более 48 часов назад, но владелец ещё не подтвердил получение. Свяжитесь с ним.`,
        });
      }
    }
  }

  // ── Query 5: batch insert all new notifications ─────────────────────────
  if (toInsert.length > 0) {
    await db.insert(notificationsTable).values(toInsert);
    logger.info(
      { sent: toInsert.length, bookings: activeBookings.length, ms: Date.now() - startTime },
      "Scheduler: reminders sent",
    );
  } else {
    logger.info(
      { bookings: activeBookings.length, ms: Date.now() - startTime },
      "Scheduler: no new reminders needed",
    );
  }
}

// ─── Auto-transition grace periods ───────────────────────────────────────────
const AUTO_CANCEL_PENDING_HOURS       = 72; // pending → cancelled if no owner response
const AUTO_CANCEL_CONFIRMED_HOURS     = 48; // confirmed → cancelled if no handover after startDate
const AUTO_COMPLETE_DAYS_PAST         = 7;  // active → completed, N days after endDate
const AUTO_COMPLETE_RETURN_HOURS      = 72; // return_pending → completed, N hours in state

type AutoTransitionResult = {
  cancelled: number;
  completed: number;
  returnCompleted: number;
};

async function runAutoTransitions(): Promise<AutoTransitionResult> {
  const result: AutoTransitionResult = { cancelled: 0, completed: 0, returnCompleted: 0 };
  const startTime = Date.now();
  logger.info("AutoTransition: starting check");

  // Fetch all open bookings once
  const openBookings = await db
    .select()
    .from(bookingsTable)
    .where(inArray(bookingsTable.status, ["pending", "confirmed", "active", "return_pending"]));

  if (openBookings.length === 0) {
    logger.info("AutoTransition: no open bookings");
    return result;
  }

  const now = Date.now();

  // Helpers
  const msHours = (h: number) => h * 3_600_000;
  const msDays  = (d: number) => d * 86_400_000;

  const candidates = {
    cancel:        [] as typeof openBookings,
    complete:      [] as typeof openBookings,
    returnPending: [] as typeof openBookings,
  };

  for (const b of openBookings) {
    const createdMs = new Date(b.createdAt).getTime();

    if (b.status === "pending" && now - createdMs > msHours(AUTO_CANCEL_PENDING_HOURS)) {
      candidates.cancel.push(b);
    } else if (b.status === "confirmed") {
      const startMs = new Date(b.startDate).getTime();
      // Cancel if owner never confirmed handover after startDate + grace period
      if (now - startMs > msHours(AUTO_CANCEL_CONFIRMED_HOURS)) {
        candidates.cancel.push(b);
      }
    } else if (b.status === "active") {
      const endMs = new Date(b.endDate).getTime();
      if (now - endMs > msDays(AUTO_COMPLETE_DAYS_PAST)) {
        candidates.complete.push(b);
      }
    } else if (b.status === "return_pending") {
      candidates.returnPending.push(b);
    }
  }

  // For return_pending: find when each entered that status.
  // Primary source: booking_events (toStatus = 'return_pending').
  // Fallback: booking_return_pending notification timestamp (for legacy/seed data without events).
  if (candidates.returnPending.length > 0) {
    const rpIds = candidates.returnPending.map((b) => b.id);

    // Source 1: booking_events
    const events = await db
      .select({
        bookingId: bookingEventsTable.bookingId,
        createdAt: bookingEventsTable.createdAt,
      })
      .from(bookingEventsTable)
      .where(
        and(
          inArray(bookingEventsTable.bookingId, rpIds),
          eq(bookingEventsTable.toStatus, "return_pending"),
        ),
      );

    const enteredReturnPending = new Map<number, number>(); // bookingId → timestamp ms
    for (const ev of events) {
      if (!enteredReturnPending.has(ev.bookingId)) {
        enteredReturnPending.set(ev.bookingId, new Date(ev.createdAt).getTime());
      }
    }

    // Source 2: fallback — booking_return_pending notification for bookings not found in events
    const missingIds = rpIds.filter((id) => !enteredReturnPending.has(id));
    if (missingIds.length > 0) {
      const notifRows = await db
        .select({ bookingId: notificationsTable.bookingId, createdAt: notificationsTable.createdAt })
        .from(notificationsTable)
        .where(
          and(
            eq(notificationsTable.type, "booking_return_pending"),
            inArray(notificationsTable.bookingId, missingIds),
          ),
        );
      for (const row of notifRows) {
        if (row.bookingId !== null && !enteredReturnPending.has(row.bookingId)) {
          enteredReturnPending.set(row.bookingId, new Date(row.createdAt).getTime());
        }
      }
    }

    for (const b of candidates.returnPending) {
      const enteredAt = enteredReturnPending.get(b.id);
      if (!enteredAt) {
        // No reference timestamp at all — use booking createdAt as last resort
        const fallback = new Date(b.createdAt).getTime();
        if (now - fallback > msHours(AUTO_COMPLETE_RETURN_HOURS)) {
          candidates.complete.push(b);
        }
      } else if (now - enteredAt > msHours(AUTO_COMPLETE_RETURN_HOURS)) {
        candidates.complete.push(b);
      }
    }
  }

  // Listing titles for notifications
  const allCandidates = [
    ...candidates.cancel,
    ...candidates.complete,
  ];

  if (allCandidates.length === 0) {
    logger.info("AutoTransition: no candidates to transition");
    return result;
  }

  const listingIds = [...new Set(allCandidates.map((b) => b.listingId))];
  const listings = await db
    .select({ id: listingsTable.id, title: listingsTable.title })
    .from(listingsTable)
    .where(inArray(listingsTable.id, listingIds));
  const listingMap = new Map(listings.map((l) => [l.id, l.title]));

  const newNotifs: Array<{
    userId: number; type: NotifType; title: string; message: string;
    bookingId: number; listingTitle: string;
  }> = [];

  const newEvents: Array<{
    bookingId: number; bookingNumber: string; actorId: null; actorRole: "system";
    eventType: string; fromStatus: string; toStatus: string; comment: string;
  }> = [];

  // ── Rule 1: pending/confirmed → cancelled ─────────────────────────────────
  for (const b of candidates.cancel) {
    const t = listingMap.get(b.listingId) ?? "объявление";
    const fromStatus = b.status as "pending" | "confirmed";
    await db.update(bookingsTable).set({ status: "cancelled" }).where(eq(bookingsTable.id, b.id));

    const isPending = fromStatus === "pending";
    const eventComment = isPending
      ? `Автоматически отменено: владелец не ответил в течение ${AUTO_CANCEL_PENDING_HOURS} часов`
      : `Автоматически отменено: вещь не была передана в течение ${AUTO_CANCEL_CONFIRMED_HOURS} часов после даты начала аренды (${b.startDate})`;

    newEvents.push({
      bookingId: b.id, bookingNumber: b.bookingNumber ?? "", actorId: null, actorRole: "system",
      eventType: "auto_cancelled",
      fromStatus, toStatus: "cancelled",
      comment: eventComment,
    });

    if (isPending) {
      newNotifs.push({
        userId: b.ownerId, type: "auto_cancelled", bookingId: b.id, listingTitle: t,
        title: `🤖 Заявка автоматически отменена — «${t}»`,
        message: `Заявка на аренду была автоматически отменена, так как вы не ответили в течение ${AUTO_CANCEL_PENDING_HOURS / 24} суток. Старайтесь отвечать быстрее, чтобы не терять арендаторов.`,
      });
      newNotifs.push({
        userId: b.renterId, type: "auto_cancelled", bookingId: b.id, listingTitle: t,
        title: `🤖 Заявка автоматически отменена — «${t}»`,
        message: `Ваша заявка на аренду отменена автоматически — владелец не ответил в течение ${AUTO_CANCEL_PENDING_HOURS / 24} суток. Попробуйте найти другое объявление.`,
      });
    } else {
      // confirmed → cancelled: item was never handed over
      newNotifs.push({
        userId: b.ownerId, type: "auto_cancelled", bookingId: b.id, listingTitle: t,
        title: `🤖 Бронирование автоматически отменено — «${t}»`,
        message: `Дата начала аренды (${b.startDate}) прошла, но вы не подтвердили передачу вещи. Бронирование отменено автоматически — арендатор получил уведомление.`,
      });
      newNotifs.push({
        userId: b.renterId, type: "auto_cancelled", bookingId: b.id, listingTitle: t,
        title: `🤖 Бронирование автоматически отменено — «${t}»`,
        message: `Дата начала аренды (${b.startDate}) прошла, но владелец так и не передал вещь. Бронирование отменено автоматически. Попробуйте найти другое объявление.`,
      });
    }

    result.cancelled++;
    logger.info({ bookingId: b.id, fromStatus }, `AutoTransition: ${fromStatus} → cancelled`);
  }

  // ── Rule 3 & 4: → completed ────────────────────────────────────────────────
  for (const b of candidates.complete) {
    const t = listingMap.get(b.listingId) ?? "объявление";
    const fromStatus = b.status as "active" | "return_pending";
    await db.update(bookingsTable).set({ status: "completed" }).where(eq(bookingsTable.id, b.id));
    const comment = fromStatus === "active"
      ? `Автоматически завершено: прошло ${AUTO_COMPLETE_DAYS_PAST} дней после даты окончания без подтверждения возврата`
      : `Автоматически завершено: владелец не подтвердил возврат в течение ${AUTO_COMPLETE_RETURN_HOURS} часов`;
    newEvents.push({
      bookingId: b.id, bookingNumber: b.bookingNumber ?? "", actorId: null, actorRole: "system",
      eventType: "auto_completed",
      fromStatus, toStatus: "completed",
      comment,
    });
    if (fromStatus === "active") {
      newNotifs.push({
        userId: b.ownerId, type: "auto_completed", bookingId: b.id, listingTitle: t,
        title: `🤖 Сделка автоматически завершена — «${t}»`,
        message: `Прошло ${AUTO_COMPLETE_DAYS_PAST} дней после даты окончания аренды (${b.endDate}). Сделка завершена автоматически. Если возврат не произошёл — обратитесь в поддержку для разбирательства.`,
      });
      newNotifs.push({
        userId: b.renterId, type: "auto_completed", bookingId: b.id, listingTitle: t,
        title: `🤖 Сделка автоматически завершена — «${t}»`,
        message: `Прошло ${AUTO_COMPLETE_DAYS_PAST} дней после даты окончания аренды (${b.endDate}). Сделка завершена автоматически. Теперь вы можете оставить отзыв о вещи.`,
      });
    } else {
      newNotifs.push({
        userId: b.ownerId, type: "auto_completed", bookingId: b.id, listingTitle: t,
        title: `🤖 Возврат подтверждён автоматически — «${t}»`,
        message: `Арендатор заявил о возврате более ${AUTO_COMPLETE_RETURN_HOURS} часов назад, но вы не подтвердили. Сделка завершена автоматически. Если вещь не получена — обратитесь в поддержку.`,
      });
      newNotifs.push({
        userId: b.renterId, type: "auto_completed", bookingId: b.id, listingTitle: t,
        title: `🤖 Возврат подтверждён автоматически — «${t}»`,
        message: `Сделка завершена автоматически, так как владелец не подтвердил возврат в течение ${AUTO_COMPLETE_RETURN_HOURS} часов. Теперь вы можете оставить отзыв о вещи.`,
      });
    }
    if (fromStatus === "active") result.completed++;
    else result.returnCompleted++;
    logger.info({ bookingId: b.id, fromStatus }, "AutoTransition: → completed");
  }

  // Batch insert events and notifications
  if (newEvents.length > 0) {
    await db.insert(bookingEventsTable).values(newEvents);
  }
  if (newNotifs.length > 0) {
    await db.insert(notificationsTable).values(newNotifs);
  }

  logger.info(
    { ...result, ms: Date.now() - startTime },
    "AutoTransition: done",
  );
  return result;
}

export function startScheduler() {
  const runAll = async () => {
    await runReminders().catch((err) => logger.error({ err }, "Scheduler: reminders failed"));
    await runAutoTransitions().catch((err) => logger.error({ err }, "Scheduler: auto-transitions failed"));
  };

  runAll();

  schedule("0 * * * *", () => {
    runAll().catch((err) => logger.error({ err }, "Scheduler: hourly run failed"));
  });

  logger.info("Scheduler started (runs every hour): reminders + auto-transitions");
}
