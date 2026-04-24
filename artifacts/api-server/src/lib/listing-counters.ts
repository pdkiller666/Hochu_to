import { db } from "@workspace/db";
import { listingsTable, reviewsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Хелперы для денормализованных счётчиков listings (Stage 19e).
 * Используются роутами bookings/reviews/favorites для синхронизации
 * `bookingCount`, `reviewCount`, `avgRating`, `favoritesCount`.
 *
 * Статусы броней, считающиеся «состоявшимися»:
 *   confirmed | active | return_pending | completed
 * pending/rejected/cancelled НЕ учитываются.
 */

const ACTIVE_BOOKING_STATUSES = new Set([
  "confirmed",
  "active",
  "return_pending",
  "completed",
]);

export function bookingCounts(status: string | null | undefined): boolean {
  return status ? ACTIVE_BOOKING_STATUSES.has(status) : false;
}

/** Дельта счётчика при переходе статуса fromStatus → toStatus. */
export function bookingCountDelta(
  fromStatus: string | null | undefined,
  toStatus: string | null | undefined,
): number {
  const wasIn = bookingCounts(fromStatus);
  const nowIn = bookingCounts(toStatus);
  if (wasIn === nowIn) return 0;
  return nowIn ? 1 : -1;
}

export async function applyBookingCountDelta(listingId: number, delta: number): Promise<void> {
  if (delta === 0) return;
  await db
    .update(listingsTable)
    .set({ bookingCount: sql`GREATEST(0, ${listingsTable.bookingCount} + ${delta})` })
    .where(eq(listingsTable.id, listingId));
}

/**
 * Пересчитать рейтинг + кол-во отзывов из `reviews` и проставить в `listings`.
 * Вызывается после insert/update/delete отзыва.
 */
export async function recomputeListingRating(listingId: number): Promise<void> {
  const [agg] = await db
    .select({
      avg: sql<number>`COALESCE(AVG(${reviewsTable.rating}), 0)::float`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(reviewsTable)
    .where(eq(reviewsTable.listingId, listingId));

  await db
    .update(listingsTable)
    .set({
      avgRating: (agg?.avg ?? 0).toFixed(2),
      reviewCount: agg?.count ?? 0,
    })
    .where(eq(listingsTable.id, listingId));
}

export async function applyFavoritesCountDelta(listingId: number, delta: number): Promise<void> {
  if (delta === 0) return;
  await db
    .update(listingsTable)
    .set({ favoritesCount: sql`GREATEST(0, ${listingsTable.favoritesCount} + ${delta})` })
    .where(eq(listingsTable.id, listingId));
}
