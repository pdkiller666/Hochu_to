import { pgTable, serial, integer, text, varchar, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { listingsTable } from "./listings";

export const reportsTable = pgTable("reports", {
  id: serial("id").primaryKey(),
  reporterUserId: integer("reporter_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  reportType: varchar("report_type", { length: 30 }).notNull(),
  reportedListingId: integer("reported_listing_id").references(() => listingsTable.id, { onDelete: "cascade" }),
  reportedUserId: integer("reported_user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  reason: varchar("reason", { length: 100 }).notNull(),
  comment: text("comment"),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  resolvedByAdminId: integer("resolved_by_admin_id").references(() => usersTable.id, { onDelete: "set null" }),
  resolvedNote: text("resolved_note"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("reports_status_idx").on(t.status),
  index("reports_created_at_idx").on(t.createdAt),
]);

export type Report = typeof reportsTable.$inferSelect;
