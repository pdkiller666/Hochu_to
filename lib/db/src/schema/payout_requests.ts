import { pgTable, serial, integer, text, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const payoutRequestStatusEnum = pgEnum("payout_request_status", [
  "pending",
  "approved",
  "paid",
  "rejected",
]);

export const payoutRequestsTable = pgTable("payout_requests", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull(),
  amountRub: integer("amount_rub").notNull(),
  status: payoutRequestStatusEnum("status").notNull().default("pending"),
  payoutMethodId: integer("payout_method_id"),
  /** Снапшот реквизитов на момент создания заявки (защита от изменений в payout_methods) */
  methodSnapshot: jsonb("method_snapshot").notNull(),
  /** Список ID бронирований, средства по которым выводятся этой заявкой */
  bookingIds: jsonb("booking_ids").notNull(),
  adminNote: text("admin_note"),
  rejectionReason: text("rejection_reason"),
  /** Реквизит платежа (номер банковского перевода / дата чека) — для записи факта выплаты */
  paymentRef: text("payment_ref"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPayoutRequestSchema = createInsertSchema(payoutRequestsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PayoutRequest = typeof payoutRequestsTable.$inferSelect;
