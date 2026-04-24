import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Backfill для денормализованных счётчиков listings (Stage 19e).
 *
 * Идемпотентно: считает значения из bookings/reviews/favorites и проставляет в
 * listings.bookingCount / reviewCount / avgRating / favoritesCount.
 *
 * Запускается на старте сервера. Лёгкий: даже на 100k объявлений это считанные
 * секунды. Если нужно скипнуть на гигантских объёмах — переключить на флаг в
 * platform_settings, но сейчас проще делать всегда (гарантирует консистентность
 * после внешних правок БД).
 */
export async function backfillListingCounters(): Promise<void> {
  const t0 = Date.now();

  // ВАЖНО: используем NOT EXISTS вместо NOT IN, потому что reviews.listing_id
  // и favorites/bookings могут содержать NULL — `NOT IN` с NULL в подзапросе
  // никогда не вернёт true, и обнуление счётчиков не произойдёт.

  // Bookings: статусы, считающиеся "состоявшимися"
  await db.execute(sql`
    UPDATE listings l SET booking_count = COALESCE(b.cnt, 0)
    FROM (
      SELECT listing_id, COUNT(*)::int AS cnt
      FROM bookings
      WHERE status IN ('confirmed','active','return_pending','completed')
        AND listing_id IS NOT NULL
      GROUP BY listing_id
    ) b
    WHERE l.id = b.listing_id AND l.booking_count <> COALESCE(b.cnt, 0)
  `);
  await db.execute(sql`
    UPDATE listings l SET booking_count = 0
    WHERE l.booking_count <> 0
      AND NOT EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.listing_id = l.id
          AND b.status IN ('confirmed','active','return_pending','completed')
      )
  `);

  // Reviews
  await db.execute(sql`
    UPDATE listings l SET
      review_count = COALESCE(r.cnt, 0),
      avg_rating   = COALESCE(r.avg, 0)::numeric(3,2)
    FROM (
      SELECT listing_id, COUNT(*)::int AS cnt, AVG(rating)::numeric(3,2) AS avg
      FROM reviews
      WHERE listing_id IS NOT NULL
      GROUP BY listing_id
    ) r
    WHERE l.id = r.listing_id AND (l.review_count <> COALESCE(r.cnt, 0) OR l.avg_rating <> COALESCE(r.avg, 0)::numeric(3,2))
  `);
  await db.execute(sql`
    UPDATE listings l SET review_count = 0, avg_rating = 0
    WHERE (l.review_count <> 0 OR l.avg_rating <> 0)
      AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.listing_id = l.id)
  `);

  // Favorites
  await db.execute(sql`
    UPDATE listings l SET favorites_count = COALESCE(f.cnt, 0)
    FROM (
      SELECT listing_id, COUNT(*)::int AS cnt
      FROM favorites
      WHERE listing_id IS NOT NULL
      GROUP BY listing_id
    ) f
    WHERE l.id = f.listing_id AND l.favorites_count <> COALESCE(f.cnt, 0)
  `);
  await db.execute(sql`
    UPDATE listings l SET favorites_count = 0
    WHERE l.favorites_count <> 0
      AND NOT EXISTS (SELECT 1 FROM favorites f WHERE f.listing_id = l.id)
  `);

  const ms = Date.now() - t0;
  logger.info({ ms }, "Listing counters backfilled");
}
