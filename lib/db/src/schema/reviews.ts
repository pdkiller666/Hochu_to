import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reviewsTable = pgTable("reviews", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id"),
  bookingId: integer("booking_id"),
  bookingNumber: text("booking_number"),
  reviewType: text("review_type").notNull().default("listing"),
  reviewerRole: text("reviewer_role").notNull().default("renter"),
  authorId: integer("author_id").notNull(),
  revieweeId: integer("reviewee_id"),
  rating: integer("rating").notNull(),
  text: text("text"),
  responseText: text("response_text"),
  responseAt: timestamp("response_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  // Один отзыв на одну бронь от одного автора в каждом типе (listing/renter).
  // Защита от race condition — дополняет проверку дублей в коде.
  uniquePerBookingAuthorType: uniqueIndex("reviews_unique_per_booking_author_type")
    .on(t.bookingId, t.authorId, t.reviewType),
}));

export const insertReviewSchema = createInsertSchema(reviewsTable).omit({ id: true, createdAt: true });
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviewsTable.$inferSelect;
