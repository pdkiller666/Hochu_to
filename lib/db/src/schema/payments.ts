import { pgTable, serial, integer, text, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Универсальная таблица платежей платформы (Stage 21a).
 * Используется и в мок-режиме (`is_commercial_mode = false` → instantly succeeded),
 * и в реальном через ЮKassa (`is_commercial_mode = true` → pending до webhook).
 *
 * `targetType` определяет смысл `targetId`:
 *  - `booking_protection` → bookings.id (холд защиты, capture:false)
 *  - `contact_pack`       → contact_purchases.id (single | pack10 | unlimited30d)
 *  - `promotion`          → listing_promotions.id (vip | urgent | boost)
 *
 * `status`:
 *  - `pending`   — создан, ждёт оплаты или webhook
 *  - `succeeded` — оплачен (или мок-флоу мгновенно подтвердил)
 *  - `canceled`  — отменён пользователем / шлюзом
 *  - `failed`    — ошибка платёжной системы
 *  - `refunded`  — возвращён
 */
export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  amountRub: integer("amount_rub").notNull(),
  status: text("status").default("pending").notNull(),
  yookassaPaymentId: text("yookassa_payment_id"),
  targetType: text("target_type").notNull(),
  targetId: integer("target_id"),
  /** Произвольные метаданные платежа (план продвижения, kind пакета и т.п.) */
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  /** Источник: 'mock' | 'yookassa' */
  provider: text("provider").default("mock").notNull(),
  /** Idempotency-Key, который мы отправляли в ЮKassa, для дебага */
  idempotencyKey: text("idempotency_key"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("payments_user_idx").on(t.userId),
  yookassaUq: uniqueIndex("payments_yookassa_uq").on(t.yookassaPaymentId),
  targetIdx: index("payments_target_idx").on(t.targetType, t.targetId),
  statusIdx: index("payments_status_idx").on(t.status),
}));

export type Payment = typeof paymentsTable.$inferSelect;
export type NewPayment = typeof paymentsTable.$inferInsert;
