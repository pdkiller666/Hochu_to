import { pgTable, serial, integer, text, boolean, timestamp, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const payoutMethodTypeEnum = pgEnum("payout_method_type", ["card", "sbp"]);

export const payoutMethodsTable = pgTable("payout_methods", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: payoutMethodTypeEnum("type").notNull(),
  cardLast4: text("card_last4"),
  cardHolderName: text("card_holder_name"),
  bankName: text("bank_name"),
  sbpPhone: text("sbp_phone"),
  /** Stage 20b: slug-id из whitelist `lib/sbp-banks.ts` ('tbank','sber',…). До 20b — свободный текст. */
  sbpBank: text("sbp_bank"),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  // Stage 20b — защита от race на дублирующий реквизит у одного user'а.
  // Для SBP — уникально по (userId, sbpPhone, sbpBank) среди type='sbp'.
  // Для Card — по (userId, cardLast4, cardHolderName) среди type='card'.
  // Partial unique indexes (WHERE type=…) — не мешают разным типам.
  sbpUniqueIdx: uniqueIndex("payout_methods_sbp_unique_idx")
    .on(t.userId, t.sbpPhone, t.sbpBank)
    .where(sql`${t.type} = 'sbp'`),
  cardUniqueIdx: uniqueIndex("payout_methods_card_unique_idx")
    .on(t.userId, t.cardLast4, t.cardHolderName)
    .where(sql`${t.type} = 'card'`),
}));

export const insertPayoutMethodSchema = createInsertSchema(payoutMethodsTable).omit({
  id: true,
  createdAt: true,
});
export type PayoutMethod = typeof payoutMethodsTable.$inferSelect;
