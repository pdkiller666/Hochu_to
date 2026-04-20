import { pgTable, serial, integer, text, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const claimTypeEnum = pgEnum("claim_type", ["damage", "theft"]);
export const claimResolutionEnum = pgEnum("claim_resolution", ["pending", "admin_review", "approved", "paid", "rejected"]);

export const claimsTable = pgTable("claims", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull(),
  claimantId: integer("claimant_id").notNull(),
  type: claimTypeEnum("type").notNull(),
  status: claimResolutionEnum("status").notNull().default("pending"),
  description: text("description").notNull(),
  evidenceUrl: text("evidence_url"),
  adminNote: text("admin_note"),
  /** Запрошенная сумма компенсации */
  requestedAmount: numeric("requested_amount", { precision: 10, scale: 2 }),
  /** Одобренная сумма выплаты (заполняется admin'ом) */
  approvedAmount: numeric("approved_amount", { precision: 10, scale: 2 }),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertClaimSchema = createInsertSchema(claimsTable).omit({ id: true, createdAt: true, updatedAt: true, resolvedAt: true });
export type ClaimResolution = "pending" | "admin_review" | "approved" | "paid" | "rejected";
export type InsertClaim = z.infer<typeof insertClaimSchema>;
export type Claim = typeof claimsTable.$inferSelect;
