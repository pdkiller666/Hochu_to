import { pgTable, text, serial, integer, numeric, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const listingsTable = pgTable("listings", {
  id: serial("id").primaryKey(),
  listingNumber: text("listing_number").unique(),
  title: text("title").notNull(),
  description: text("description"),
  pricePerDay: numeric("price_per_day", { precision: 10, scale: 2 }).notNull(),
  deposit: numeric("deposit", { precision: 10, scale: 2 }),
  /** Рыночная цена вещи — используется для калибровки лимита фонда (опционально) */
  marketValue: numeric("market_value", { precision: 12, scale: 2 }),
  categoryId: integer("category_id").notNull(),
  /** Категория защиты фонда: electronics | tools | leisure | special_machinery */
  itemCategory: text("item_category"),
  /** Лимит выплаты из фонда (авторасчёт: pricePerDay * multiplier, кап для новых пользователей) */
  maxProtectionLimit: integer("max_protection_limit"),
  /** Флаг ручной проверки модератором (аномально высокая цена) */
  requiresManualVerification: boolean("requires_manual_verification").default(false).notNull(),
  regionId: integer("region_id").notNull(),
  city: text("city"),
  lat: real("lat"),
  lng: real("lng"),
  meetingAddress: text("meeting_address"),
  ownerId: integer("owner_id").notNull(),
  photos: text("photos").array().default([]),
  ownerProtectionEnabled: boolean("owner_protection_enabled").default(true).notNull(),
  isAvailable: boolean("is_available").default(true).notNull(),

  // ── Платное продвижение (Stage 18) ────────────────────────────────────
  /** VIP-пакет: жёлтая рамка, корона, верх выдачи. Активен пока now() < featuredUntil. */
  isFeatured: boolean("is_featured").default(false).notNull(),
  featuredUntil: timestamp("featured_until"),
  /** Срочно: красный бейдж, поднимает в выдаче. Активен пока now() < urgentUntil. */
  isUrgent: boolean("is_urgent").default(false).notNull(),
  urgentUntil: timestamp("urgent_until"),
  /** Поднятие на 24ч — boostedUntil > now() работает как «свежее createdAt». */
  boostedUntil: timestamp("boosted_until"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertListingSchema = createInsertSchema(listingsTable).omit({ id: true, createdAt: true });
export type InsertListing = z.infer<typeof insertListingSchema>;
export type Listing = typeof listingsTable.$inferSelect;
