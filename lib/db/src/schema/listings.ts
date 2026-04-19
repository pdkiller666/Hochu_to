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
  categoryId: integer("category_id").notNull(),
  regionId: integer("region_id").notNull(),
  city: text("city"),
  lat: real("lat"),
  lng: real("lng"),
  meetingAddress: text("meeting_address"),
  ownerId: integer("owner_id").notNull(),
  photos: text("photos").array().default([]),
  marketValue: numeric("market_value", { precision: 12, scale: 2 }),
  isAvailable: boolean("is_available").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertListingSchema = createInsertSchema(listingsTable).omit({ id: true, createdAt: true });
export type InsertListing = z.infer<typeof insertListingSchema>;
export type Listing = typeof listingsTable.$inferSelect;
