import { db, notificationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export type NotifType =
  | "booking_submitted"
  | "booking_created"
  | "booking_confirmed"
  | "booking_active"
  | "booking_return_pending"
  | "booking_rejected"
  | "booking_completed"
  | "booking_cancelled"
  | "reminder_confirm_pending"
  | "reminder_handover_today"
  | "reminder_handover_overdue"
  | "reminder_return_today"
  | "reminder_return_overdue"
  | "reminder_return_confirm"
  // Stage 22b-followup: за 24ч до передачи/возврата — напомни оформить акт
  | "reminder_checkin_soon"
  | "reminder_checkout_soon"
  // System auto-transition notifications
  | "auto_cancelled"
  | "auto_activated"
  | "auto_completed"
  // Stage 27 — Co-Sharing Transparency (pool/share/offer events)
  | "pool_share_received_funds"   // creator: «Пользователь X перевёл деньги, подтвердите получение»
  | "pool_purchasing"             // все участники: «Сбор завершён, переходим к закупке»
  | "pool_offer_reserved"         // продавец: «Пользователь X хочет выкупить вашу долю»
  | "pool_share_received"         // покупатель: «Продавец подтвердил, доля у вас»
  // Stage 26-B — Co-Sharing Final Polish
  | "pool_custodian_received"     // получатель: «Вам передали вещь — теперь вы Хранитель»
  // Stage 28 — Полный выкуп пула
  | "pool_buyout_requested"       // участник: «X хочет выкупить вашу долю за Y₽»
  | "pool_buyout_transferred"     // участник: «X пометил, что перевёл Y₽ — подтвердите получение»
  | "pool_buyout_confirmed"       // инициатор: «X подтвердил получение, его доля теперь у вас»
  | "pool_buyout_canceled"        // участник: «X отменил выкуп»
  | "pool_buyout_completed";      // все участники: «Пул ликвидирован, X — единственный владелец»

export async function createNotification(params: {
  userId: number;
  type: NotifType;
  title: string;
  message?: string;
  bookingId?: number;
  listingTitle?: string;
}) {
  await db.insert(notificationsTable).values({
    userId: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    bookingId: params.bookingId,
    listingTitle: params.listingTitle,
  });
}

export async function reminderAlreadySent(
  bookingId: number,
  type: NotifType,
  userId: number,
): Promise<boolean> {
  const existing = await db
    .select({ id: notificationsTable.id })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.bookingId, bookingId),
        eq(notificationsTable.type, type),
        eq(notificationsTable.userId, userId),
      ),
    )
    .limit(1);
  return existing.length > 0;
}
