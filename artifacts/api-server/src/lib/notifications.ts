import { db, notificationsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { broadcastToUser } from "./websocket.js";
import { sendTelegramToUser } from "./telegram.js";
import { getSmsProvider } from "./sms/factory.js";

// ─── Gender helpers (Stage 33.1) ─────────────────────────────────────────────
//
// Определяем грамматический род по имени — используем эвристики:
//   • имена, оканчивающиеся на «а»/«я», как правило женские
//   • исключения: мужские имена на «а»/«я» (Никита, Илья, Петя, …)
//   • двусмысленные имена (Саша, Женя, Валя) → нейтральный
//
// Если род неизвестен — возвращаем нейтральную форму (maleForm по умолчанию,
// или явный neutralForm, если передан).

const MALE_A_ENDINGS = new Set([
  "никита","илья","кузьма","фома","савва","коля","петя","вася","дима",
  "миша","паша","лёша","алёша","серёжа","витя","костя","митя","стёпа",
  "лёва","федя","гоша","тёма","яша","сеня","антоша","лёня","гриша",
]);

const AMBIGUOUS = new Set(["саша","женя","валя","шура","зоря"]);

export type Gender = "m" | "f" | "n";

/** Определяет пол по первому слову имени на основе русских эвристик. */
export function detectGender(name: string): Gender {
  if (!name?.trim()) return "n";
  const first = name.trim().split(/\s+/)[0].toLowerCase();
  if (AMBIGUOUS.has(first)) return "n";
  if (MALE_A_ENDINGS.has(first)) return "m";
  if (first.endsWith("а") || first.endsWith("я")) return "f";
  return "m";
}

/**
 * Возвращает нужную форму слова/глагола исходя из рода владельца имени.
 * @param name       имя пользователя
 * @param maleForm   мужская форма  («подтвердил», «Владелец»)
 * @param femaleForm женская форма  («подтвердила», «Владелица»)
 * @param neutralForm нейтральная форма; если не передана — используется maleForm
 */
export function genderedWord(
  name: string,
  maleForm: string,
  femaleForm: string,
  neutralForm?: string,
): string {
  const g = detectGender(name);
  if (g === "f") return femaleForm;
  return g === "m" ? maleForm : (neutralForm ?? maleForm);
}

/** Краткий alias: возвращает «его» или «её» для имени. */
export function genderPronounGen(name: string): string {
  return genderedWord(name, "него", "неё", "него");
}

// ─────────────────────────────────────────────────────────────────────────────

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
  // Stage 22c: двусторонняя подпись Цифрового акта
  | "digital_act_countersign_required"  // вторая сторона: «Первая сторона подписала — ваша очередь»
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
  | "pool_buyout_completed"       // все участники: «Пул ликвидирован, X — единственный владелец»
  // Stage 40 — Wallet Pro
  | "wallet_topup"               // пополнение кошелька
  | "wallet_withdraw"            // вывод средств
  // Stage N — чат по бронированию
  | "new_booking_message";       // новое сообщение в чате бронирования

export async function createNotification(params: {
  userId: number;
  type: NotifType;
  title: string;
  message?: string;
  bookingId?: number;
  listingTitle?: string;
  link?: string;
}) {
  const [notif] = await db.insert(notificationsTable).values({
    userId: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    bookingId: params.bookingId,
    listingTitle: params.listingTitle,
  }).returning();

  // Stage 34: push notification to the user via WebSocket
  if (notif) {
    broadcastToUser(params.userId, "NEW_NOTIFICATION", notif);
  }

  // Stage 38: also deliver via Telegram if user has linked account
  const category: "bookings" | "system" | "chats" =
    params.type.startsWith("booking_") || params.type.startsWith("reminder_") || params.type.startsWith("auto_") ? "bookings"
    : params.type.startsWith("pool_") ? "chats"
    : "system";

  const tgText = params.message
    ? `<b>${params.title}</b>\n${params.message}`
    : `<b>${params.title}</b>`;

  // Stage 38-UE: circuit breaker — if Telegram times out (60 s), fall back to SMS
  const tgDelivery = Promise.race([
    sendTelegramToUser(params.userId, category, tgText, params.link),
    new Promise<boolean>(resolve => setTimeout(() => resolve(false), 60_000)),
  ]);

  tgDelivery.then(async (tgOk) => {
    if (!tgOk) {
      const sms = getSmsProvider();
      if (sms) {
        const [user] = await db.select({ phone: usersTable.phone, phoneVerified: usersTable.phoneVerified })
          .from(usersTable).where(eq(usersTable.id, params.userId)).limit(1).catch(() => [null]);
        if (user?.phone && user.phoneVerified) {
          const text = params.message
            ? `${params.title}: ${params.message}`
            : params.title;
          sms.send(user.phone, `Хочу_То: ${text.slice(0, 160)}`).catch(() => {});
        }
      }
    }
  }).catch(() => {});
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
