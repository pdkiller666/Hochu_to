import { pgTable, serial, integer, varchar, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Stage 27 — Universal audit log for non-booking entities (pools, offers, future).
 *
 * Why a new table (and not booking_events / admin_audit_log):
 *   - booking_events.booking_id is NOT NULL FK → cannot host pool/offer events.
 *   - admin_audit_log.admin_id is NOT NULL + admin-only semantically.
 *
 * This table is the generic "event log by entity_type" — currently used for
 * pool / offer / share events, but designed to host any future entity events
 * (claims, payouts, etc.) without yet another mirror table.
 *
 * actor_id is nullable for system-triggered events (e.g. scheduler auto-state).
 * On user delete: SET NULL (history must survive account deletion).
 */
export const auditEventsTable = pgTable("audit_events", {
  id: serial("id").primaryKey(),

  // What entity this event is about. Keep both for pluggable joins.
  entityType: varchar("entity_type", { length: 30 }).notNull(),
  entityId: integer("entity_id").notNull(),

  // Who triggered. NULL = system / scheduler.
  actorId: integer("actor_id").references(() => usersTable.id, { onDelete: "set null" }),

  // Short machine-readable type, e.g. 'pool_created', 'offer_reserved'.
  eventType: varchar("event_type", { length: 50 }).notNull(),

  // Free-form structured payload: shareId, offerId, priceRub, fromUserId, toUserId, mergeMode, etc.
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  // Главный индекс: события по сущности в порядке времени (для GET /pools/:id/events).
  index("ae_entity_created_idx").on(t.entityType, t.entityId, t.createdAt),
  // Сводка по актёру (для будущих экранов «моя активность»).
  index("ae_actor_idx").on(t.actorId),
]);

export type AuditEvent = typeof auditEventsTable.$inferSelect;
