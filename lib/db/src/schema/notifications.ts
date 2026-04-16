import { pgTable, serial, integer, text, boolean, timestamp, varchar, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { bookingsTable } from "./bookings";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 60 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  bookingId: integer("booking_id").references(() => bookingsTable.id, { onDelete: "set null" }),
  listingTitle: varchar("listing_title", { length: 255 }),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  // Fast lookup for deduplication in scheduler (booking_id + type + user_id)
  index("notif_booking_type_user_idx").on(t.bookingId, t.type, t.userId),
  // Fast lookup for GET /api/notifications (user_id ordered by created_at)
  index("notif_user_created_idx").on(t.userId, t.createdAt),
  // Fast unread count per user
  index("notif_user_read_idx").on(t.userId, t.isRead),
]);

export type Notification = typeof notificationsTable.$inferSelect;
