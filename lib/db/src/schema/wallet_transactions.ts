import { pgTable, serial, integer, numeric, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Транзакции кошельков (Stage 39 — Escrow Engine, Stage 40 — Wallet Pro).
 *
 * Типы транзакций:
 *  - `hold`       — заморозка суммы при бронировании (available → frozen)
 *  - `release`    — разморозка без выплаты (отмена/возврат; frozen → available)
 *  - `commission` — удержание комиссии платформы при завершении аренды
 *  - `payout`     — выплата владельцу после завершения аренды (frozen → available владельца)
 *  - `refund`     — возврат арендатору (cancel или claim)
 *  - `topup`      — пополнение кошелька (external payment → available)
 *  - `withdraw`   — запрос на вывод средств (available → pending payout)
 *
 * `referenceId`   — booking.id или иной бизнес-объект.
 * `referenceType` — 'booking' | 'claim' | 'manual' | 'topup' | 'withdraw'.
 * `bookingNumber` — человекочитаемый номер брони (ХТ-2026-000001), денормализован для удобства.
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
  bookingNumber: text("booking_number"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("wt_user_idx").on(t.userId),
  refIdx: index("wt_ref_idx").on(t.referenceId, t.referenceType),
  createdAtIdx: index("wt_created_at_idx").on(t.createdAt),
}));

export type WalletTransaction = typeof walletTransactionsTable.$inferSelect;
export type NewWalletTransaction = typeof walletTransactionsTable.$inferInsert;
