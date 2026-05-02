import { pgTable, serial, integer, numeric, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Транзакции кошельков (Stage 39 — Escrow Engine).
 *
 * Каждое изменение баланса фиксируется как отдельная строка — неизменяемый аудит-трейл.
 *
 * Типы транзакций:
 *  - `hold`       — заморозка суммы при бронировании (available → frozen)
 *  - `release`    — разморозка без выплаты (отмена/возврат; frozen → available)
 *  - `commission` — удержание комиссии платформы при завершении аренды
 *  - `payout`     — выплата владельцу после завершения аренды (frozen → available владельца)
 *  - `refund`     — возврат арендатору (cancel или claim)
 *  - `topup`      — пополнение кошелька (external payment → available)
 *
 * `referenceId`  — booking.id или иной бизнес-объект, к которому привязана транзакция.
 * `referenceType`— тип объекта: 'booking' | 'claim' | 'manual'.
 */
export const walletTransactionsTable = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  platformCommission: numeric("platform_commission", { precision: 12, scale: 2 }).default("0").notNull(),
  type: text("type").notNull(),
  status: text("status").default("completed").notNull(),
  referenceId: integer("reference_id"),
  referenceType: text("reference_type"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("wt_user_idx").on(t.userId),
  refIdx: index("wt_ref_idx").on(t.referenceId, t.referenceType),
  createdAtIdx: index("wt_created_at_idx").on(t.createdAt),
}));

export type WalletTransaction = typeof walletTransactionsTable.$inferSelect;
export type NewWalletTransaction = typeof walletTransactionsTable.$inferInsert;
