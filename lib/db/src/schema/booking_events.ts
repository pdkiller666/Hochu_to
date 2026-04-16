import { pgTable, serial, integer, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { bookingsTable } from "./bookings";
import { usersTable } from "./users";

/**
 * Full audit trail for every booking action.
 * Managers use this for dispute resolution, tracking, and analytics.
 */
export const bookingEventsTable = pgTable("booking_events", {
  id: serial("id").primaryKey(),

  bookingId: integer("booking_id")
    .notNull()
    .references(() => bookingsTable.id, { onDelete: "cascade" }),

  bookingNumber: varchar("booking_number", { length: 24 }).notNull(),

  actorId: integer("actor_id")
    .references(() => usersTable.id, { onDelete: "set null" }),

  actorRole: varchar("actor_role", { length: 20 }),

  eventType: varchar("event_type", { length: 40 }).notNull(),

  fromStatus: varchar("from_status", { length: 30 }),

  toStatus: varchar("to_status", { length: 30 }),

  comment: text("comment"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("be_booking_id_idx").on(t.bookingId),
  index("be_booking_number_idx").on(t.bookingNumber),
  index("be_actor_id_idx").on(t.actorId),
  index("be_created_at_idx").on(t.createdAt),
]);

export type BookingEvent = typeof bookingEventsTable.$inferSelect;
