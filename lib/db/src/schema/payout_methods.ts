import { pgTable, serial, integer, text, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
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
  sbpBank: text("sbp_bank"),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPayoutMethodSchema = createInsertSchema(payoutMethodsTable).omit({
  id: true,
  createdAt: true,
});
export type PayoutMethod = typeof payoutMethodsTable.$inferSelect;
