import { pgTable, serial, integer, text, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jpStatusEnum = pgEnum("jp_status", ["open", "closed", "completed"]);

export const jointPurchasesTable = pgTable("joint_purchases", {
  id: serial("id").primaryKey(),
  itemName: text("item_name").notNull(),
  description: text("description"),
  targetAmount: numeric("target_amount", { precision: 10, scale: 2 }).notNull(),
  collectedAmount: numeric("collected_amount", { precision: 10, scale: 2 }).default("0").notNull(),
  participantsCount: integer("participants_count").default(0).notNull(),
  status: jpStatusEnum("status").notNull().default("open"),
  authorId: integer("author_id"),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertJointPurchaseSchema = createInsertSchema(jointPurchasesTable).omit({ id: true, createdAt: true });
export type InsertJointPurchase = z.infer<typeof insertJointPurchaseSchema>;
export type JointPurchase = typeof jointPurchasesTable.$inferSelect;
