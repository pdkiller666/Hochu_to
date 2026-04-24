import { pgTable, serial, integer, text, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { bookingsTable } from "./bookings";
import { usersTable } from "./users";

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
  bookingId: integer("booking_id")
    .notNull()
    .references(() => bookingsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  photos: jsonb("photos").$type<string[]>().notNull(),
  videoUrl: text("video_url"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdByUserId: integer("created_by_user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  // Hardening: один акт каждого типа на бронь — иммутабельная доказательная база
  bookingTypeUniq: uniqueIndex("digital_acts_booking_type_uniq").on(t.bookingId, t.type),
  createdByIdx: index("digital_acts_created_by_idx").on(t.createdByUserId),
}));

export const insertDigitalActSchema = createInsertSchema(digitalActsTable, {
  type: z.enum(["check_in", "check_out"]),
  photos: z.array(z.string().min(1)).min(4, "Нужно минимум 4 фото"),
  videoUrl: z.string().url().nullable().optional(),
  metadata: z.record(z.string(), z.any()).nullable().optional(),
}).omit({ id: true, createdAt: true });

export type DigitalAct = typeof digitalActsTable.$inferSelect;
export type InsertDigitalAct = z.infer<typeof insertDigitalActSchema>;
export type DigitalActType = "check_in" | "check_out";
