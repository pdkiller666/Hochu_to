import { pgTable, serial, integer, text, varchar, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const adminAuditLogTable = pgTable("admin_audit_log", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  entityType: varchar("entity_type", { length: 40 }).notNull(),
  entityId: integer("entity_id"),
  action: varchar("action", { length: 60 }).notNull(),
  detail: text("detail"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("admin_audit_created_at_idx").on(t.createdAt),
  index("admin_audit_admin_idx").on(t.adminId),
  index("admin_audit_entity_idx").on(t.entityType, t.entityId),
]);

export type AdminAuditLog = typeof adminAuditLogTable.$inferSelect;
