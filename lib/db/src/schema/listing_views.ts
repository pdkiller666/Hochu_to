import { pgTable, serial, integer, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";

/**
 * Stage 19c — журнал просмотров объявлений.
 *
 * Каждый просмотр detail-страницы объявления превращается в одну строку.
 * Для борьбы с накруткой и ботами просмотры от одного и того же зрителя
 * (auth-userId или, для гостей, IP) в течение одного часа дедуплицируются
 * через UNIQUE INDEX (listing_id, viewer_key, hour_bucket).
 *
 * Поле viewer_key — строка вида "u:<userId>" или "ip:<ipv4>" — это позволяет
 * иметь общий уникальный ключ и не плодить NULLs.
 *
 * hour_bucket — округлённый до часа таймстамп в виде строки 'YYYY-MM-DD-HH'
 * (UTC). Использовать строку, а не date_trunc, чтобы UNIQUE мог быть обычным
 * b-tree без выражений.
 */
export const listingViewsTable = pgTable(
  "listing_views",
  {
    id: serial("id").primaryKey(),
    listingId: integer("listing_id").notNull(),
    viewerKey: text("viewer_key").notNull(),
    hourBucket: text("hour_bucket").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqPerHour: uniqueIndex("listing_views_uniq_per_hour")
      .on(t.listingId, t.viewerKey, t.hourBucket),
    byListingCreatedAt: index("listing_views_by_listing_created_at")
      .on(t.listingId, t.createdAt),
  }),
);

export type ListingView = typeof listingViewsTable.$inferSelect;
