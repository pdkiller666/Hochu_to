import { pgTable, text, serial, integer, timestamp, pgEnum, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("user_role", ["renter", "owner", "user", "moderator", "support", "arbiter", "admin", "superadmin"]);

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
  /** Stage 35 — KYC fields (зарезервировано для будущих этапов, например, Суфтели/Yoti). */
  verificationStatus: text("verification_status").default("unverified"),
  verificationProvider: text("verification_provider"),
  verificationData: jsonb("verification_data"),
  // ── Stage 38 — Telegram Bot Integration ──────────────────────────────────
  /** Telegram Chat ID (числовой, хранится как text для безопасности с bigint) */
  telegramChatId: text("telegram_chat_id"),
  /** 6-значный OTP для привязки аккаунта */
  telegramOtp: text("telegram_otp"),
  /** Когда истекает OTP (10 минут) */
  telegramOtpExpiresAt: timestamp("telegram_otp_expires_at"),
  /** Настройки уведомлений через Telegram {bookings, system, chats} */
  telegramNotifications: jsonb("telegram_notifications").$type<{
    bookings: boolean;
    system: boolean;
    chats: boolean;
  }>(),
  // ── Stage 38-UE — Phone Verification & SMS OTP ────────────────────────────
  /** Верифицирован ли номер телефона через SMS-OTP */
  phoneVerified: boolean("phone_verified").default(false).notNull(),
  /** OTP для верификации телефона или финансовых операций */
  phoneOtp: text("phone_otp"),
  /** Когда истекает phone OTP (5 минут) */
  phoneOtpExpiresAt: timestamp("phone_otp_expires_at"),
  /** Подтверждён ли email через ссылку из письма */
  emailVerified: boolean("email_verified").default(false).notNull(),
  /** Токен для верификации email (UUID, TTL 24ч) */
  emailVerifyToken: text("email_verify_token"),
  /** Когда истекает токен верификации email */
  emailVerifyTokenExpiresAt: timestamp("email_verify_token_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
