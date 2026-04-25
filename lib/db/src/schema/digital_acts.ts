import { pgTable, serial, integer, text, jsonb, timestamp, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { bookingsTable } from "./bookings";
import { usersTable } from "./users";
import { poolsTable } from "./co_sharing";

/**
 * Stage 22a — Цифровой Акт (Check-in / Check-out).
 *
 * Каркас системы фиксации состояния вещи на момент передачи и возврата.
 * Платформа использует акты как доказательную базу для арбитража споров.
 *
 * `type`:
 *  - `check_in`  — приёмка вещи арендатором (фото перед началом аренды)
 *  - `check_out` — возврат вещи владельцу (фото в конце аренды)
 *
 * `metadata` хранит EXIF/GPS извлечённые на клиенте + любую служебную инфу:
 *  { gps?: { lat: number; lng: number }, takenAt?: string, device?: string,
 *    extractedFromExif?: boolean }
 *
 * `photos` — массив URL вида `/uploads/<uuid>.jpg` (минимум 4).
 *
 * Бизнес-правила:
 *  - Переход booking.status confirmed → active блокируется без записи type='check_in'.
 *  - Только участники брони (owner | renter) могут создавать акт.
 *  - **Иммутабельность** (Stage 22a hardening, после code review): один акт каждого
 *    типа на бронь — UNIQUE(booking_id, type). Это защищает доказательную базу
 *    от перезаписи задним числом и повышает достоверность арбитража.
 */
export const digitalActsTable = pgTable("digital_acts", {
  id: serial("id").primaryKey(),
  // Stage 23c: bookingId стал nullable — Genesis-акт пула (type='check_in')
  // привязан не к брони, а к pulu (poolId). XOR-инвариант гарантируется CHECK ниже.
  bookingId: integer("booking_id")
    .references(() => bookingsTable.id, { onDelete: "cascade" }),
  // Stage 23c — Genesis-акт совместной покупки.
  // Когда creator пула загружает первый Цифровой Акт после `pools.status='purchasing'`,
  // создаётся запись с poolId (а не bookingId). Это триггерит auto-listing и
  // переход pool → 'active'.
  poolId: integer("pool_id")
    .references(() => poolsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  photos: jsonb("photos").$type<string[]>().notNull(),
  videoUrl: text("video_url"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdByUserId: integer("created_by_user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  // Hardening (Stage 22a): один акт каждого типа на бронь — partial unique
  // (NULL значения poolId/bookingId не считаются дубликатами).
  bookingTypeUniq: uniqueIndex("digital_acts_booking_type_uniq")
    .on(t.bookingId, t.type)
    .where(sql`booking_id IS NOT NULL`),
  // Stage 23c: один genesis-акт каждого типа на пул.
  poolTypeUniq: uniqueIndex("digital_acts_pool_type_uniq")
    .on(t.poolId, t.type)
    .where(sql`pool_id IS NOT NULL`),
  createdByIdx: index("digital_acts_created_by_idx").on(t.createdByUserId),
  // XOR-инвариант: акт привязан либо к брони, либо к пулу — но не к обоим и не «в воздухе».
  bookingOrPoolXor: check(
    "digital_acts_booking_or_pool_xor",
    sql`(booking_id IS NOT NULL)::int + (pool_id IS NOT NULL)::int = 1`,
  ),
}));

export const insertDigitalActSchema = createInsertSchema(digitalActsTable, {
  type: z.enum(["check_in", "check_out"]),
  photos: z.array(z.string().min(1)).min(4, "Нужно минимум 4 фото"),
  // Stage 22b-followup: либо внешний http(s) URL, либо внутренний /uploads/<uuid>.(mp4|webm|mov|m4v)
  // Финальная валидация форматов делается в роуте (whitelist), здесь — только базовая непустота.
  videoUrl: z.string().min(1).nullable().optional(),
  metadata: z.record(z.string(), z.any()).nullable().optional(),
  // Stage 23c: bookingId/poolId — оба nullable на schema-уровне, XOR обеспечивается роутом + CHECK constraint.
  bookingId: z.number().int().positive().nullable().optional(),
  poolId: z.number().int().positive().nullable().optional(),
}).omit({ id: true, createdAt: true });

export type DigitalAct = typeof digitalActsTable.$inferSelect;
export type InsertDigitalAct = z.infer<typeof insertDigitalActSchema>;
export type DigitalActType = "check_in" | "check_out";
