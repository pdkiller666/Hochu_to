import { pgTable, serial, integer, text, timestamp, pgEnum, varchar, boolean } from "drizzle-orm/pg-core";

export const supportCategoryEnum = pgEnum("support_category", [
  "general",
  "dispute",
  "technical",
  "billing",
]);

export const supportStatusEnum = pgEnum("support_status", [
  "open",
  "in_progress",
  "resolved",
  "closed",
]);

export const supportPriorityEnum = pgEnum("support_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);

export const supportTicketsTable = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  ticketNumber: varchar("ticket_number", { length: 24 }).unique(),
  userId: integer("user_id").notNull(),
  subject: text("subject").notNull(),
  category: supportCategoryEnum("category").notNull().default("general"),
  status: supportStatusEnum("status").notNull().default("open"),
  priority: supportPriorityEnum("priority").notNull().default("normal"),
  assignedToId: integer("assigned_to_id"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const supportMessagesTable = pgTable("support_messages", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull(),
  authorId: integer("author_id").notNull(),
  body: text("body").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SupportTicket = typeof supportTicketsTable.$inferSelect;
export type SupportMessage = typeof supportMessagesTable.$inferSelect;
