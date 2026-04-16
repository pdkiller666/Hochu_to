import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const bookingMessagesTable = pgTable("booking_messages", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull(),
  senderId: integer("sender_id").notNull(),
  content: text("content").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type BookingMessage = typeof bookingMessagesTable.$inferSelect;
