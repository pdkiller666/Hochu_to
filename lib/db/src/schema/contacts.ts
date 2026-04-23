import { pgTable, serial, integer, text, timestamp, boolean, uniqueIndex, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { listingsTable } from "./listings";

/**
 * Баланс контактов арендатора — singleton-строка на каждого пользователя.
 * Используется при покупке/разблокировке контактов владельцев Free-объявлений.
 *
 * Логика:
 *  - balance > 0 — спишет 1 при разблокировке очередного контакта
 *  - unlimitedUntil > now — разблокировка бесплатна (тариф «безлимит на 30 дней»)
 *  - bonusGranted=true — welcome-бонус (freeContactsBonus из platform_settings) уже начислен
 */
export const contactBalancesTable = pgTable("contact_balances", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  balance: integer("balance").default(0).notNull(),
  unlimitedUntil: timestamp("unlimited_until"),
  bonusGranted: boolean("bonus_granted").default(false).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  userUq: uniqueIndex("contact_balances_user_uq").on(t.userId),
}));

/**
 * История покупок контактов / пакетов / безлимита.
 * `kind`: 'single' | 'pack10' | 'unlimited30d' | 'bonus' | 'admin_grant'
 * При возврате (refund) пакета — заполняется refundedAt и баланс уменьшается.
 */
export const contactPurchasesTable = pgTable("contact_purchases", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  amountRub: integer("amount_rub").default(0).notNull(),
  contactsAdded: integer("contacts_added").default(0).notNull(),
  expiresAt: timestamp("expires_at"),
  paymentRef: text("payment_ref"),
  refundedAt: timestamp("refunded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("contact_purchases_user_idx").on(t.userId),
}));

/**
 * Журнал разблокированных контактов: какому пользователю какой телефон владельца открыли.
 * Если contactLifetimeDays > 0 — заполнен expiresAt, иначе доступ навсегда.
 * Уникальный индекс (userId, listingId) предотвращает двойную тарификацию.
 */
export const contactUnlocksTable = pgTable("contact_unlocks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  listingId: integer("listing_id").notNull().references(() => listingsTable.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
}, (t) => ({
  userListingUq: uniqueIndex("contact_unlocks_user_listing_uq").on(t.userId, t.listingId),
  userIdx: index("contact_unlocks_user_idx").on(t.userId),
}));

export type ContactBalance = typeof contactBalancesTable.$inferSelect;
export type ContactPurchase = typeof contactPurchasesTable.$inferSelect;
export type ContactUnlock = typeof contactUnlocksTable.$inferSelect;
