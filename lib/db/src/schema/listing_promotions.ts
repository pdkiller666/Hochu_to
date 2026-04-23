import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Журнал транзакций платного продвижения объявлений.
 * Каждая успешная покупка пакета (VIP/Срочно/Поднятие) пишет строку.
 * Используется для отчётности владельца и для админ-аналитики выручки.
 */
export const listingPromotionsTable = pgTable("listing_promotions", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull(),
  ownerId: integer("owner_id").notNull(),
  /** vip | urgent | boost */
  type: text("type").notNull(),
  /** Кодовое имя плана: '7d' | '14d' | '30d' | '3d' | '24h' */
  plan: text("plan").notNull(),
  /** Сколько дней действия выдано (для boost = 1) */
  days: integer("days").notNull(),
  priceRub: integer("price_rub").notNull(),
  /** До какого момента действует продвижение */
  validUntil: timestamp("valid_until").notNull(),
  /** Имитация платежа: пока всегда заполняется автоматически в момент покупки */
  paidAt: timestamp("paid_at").defaultNow().notNull(),
  paymentRef: text("payment_ref"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ListingPromotion = typeof listingPromotionsTable.$inferSelect;
