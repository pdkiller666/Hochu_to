import { pgTable, text, serial, integer, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("user_role", ["renter", "owner", "admin"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("renter"),
  phone: text("phone"),
  avatar: text("avatar"),
  bio: text("bio"),
  telegram: text("telegram"),
  website: text("website"),
  regionId: integer("region_id"),
  /** Количество завершённых сделок (влияет на кап фонда) */
  completedDealsCount: integer("completed_deals_count").default(0).notNull(),
  isBanned: boolean("is_banned").notNull().default(false),
  banReason: text("ban_reason"),
  /** Уровень 1 — Проверенный владелец (бинарный, ручная верификация админом). См. AGENT_INSTRUCTIONS.md §11d. */
  isVerified: boolean("is_verified").notNull().default(false),
  verifiedAt: timestamp("verified_at"),
  verifiedByAdminId: integer("verified_by_admin_id"),
  /** Внутренняя заметка админа (например, «Скан паспорта в тикете #234»). Не отдаётся публично. */
  verificationNote: text("verification_note"),
  /** Уровень 2 — Trust Score 0..100 (NULL = не вычислялось). Реализация формулы — V6, пока поле зарезервировано. */
  trustScore: integer("trust_score"),
  trustScoreUpdatedAt: timestamp("trust_score_updated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
