import { pgTable, serial, integer, numeric, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Кошельки пользователей платформы (Stage 39 — Escrow Engine).
 *
 * `available_balance` — доступные средства (можно вывести).
 * `frozen_balance`    — заморожены под активные брони (escrow hold).
 * `currency`          — ISO-код валюты (по умолчанию 'RUB').
 *
 * Все изменения баланса атомарны: используй SELECT ... FOR UPDATE + транзакцию.
 */
export const walletsTable = pgTable("wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  availableBalance: numeric("available_balance", { precision: 12, scale: 2 }).default("0").notNull(),
  frozenBalance: numeric("frozen_balance", { precision: 12, scale: 2 }).default("0").notNull(),
  currency: text("currency").default("RUB").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("wallets_user_idx").on(t.userId),
}));

export type Wallet = typeof walletsTable.$inferSelect;
export type NewWallet = typeof walletsTable.$inferInsert;
