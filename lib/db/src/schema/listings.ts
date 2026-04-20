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
  /** Категория защиты фонда: electronics | tools | leisure */
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertListingSchema = createInsertSchema(listingsTable).omit({ id: true, createdAt: true });
export type InsertListing = z.infer<typeof insertListingSchema>;
export type Listing = typeof listingsTable.$inferSelect;
