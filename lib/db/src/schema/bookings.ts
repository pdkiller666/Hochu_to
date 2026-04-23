import { pgTable, serial, integer, text, numeric, boolean, timestamp, pgEnum, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bookingStatusEnum = pgEnum("booking_status", ["pending", "confirmed", "active", "return_pending", "rejected", "completed", "cancelled"]);

export const bookingsTable = pgTable("bookings", {
  id: serial("id").primaryKey(),
  bookingNumber: varchar("booking_number", { length: 24 }).unique(),
  listingId: integer("listing_id").notNull(),
  renterId: integer("renter_id").notNull(),
  ownerId: integer("owner_id").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  totalDays: integer("total_days").notNull(),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
  rentAmount: numeric("rent_amount", { precision: 10, scale: 2 }),
  serviceFee: numeric("service_fee", { precision: 10, scale: 2 }),
  taxFee: numeric("tax_fee", { precision: 10, scale: 2 }),
  fundContribution: numeric("fund_contribution", { precision: 10, scale: 2 }),
  renterFundContribution: numeric("renter_fund_contribution", { precision: 10, scale: 2 }),
  depositAmount: numeric("deposit_amount", { precision: 10, scale: 2 }),
  /** Выплата владельцу = rentAmount - serviceFee - taxFee - fundContribution */
  ownerPayout: numeric("owner_payout", { precision: 10, scale: 2 }),
  protectionEnabled: boolean("protection_enabled").default(true),
  renterProtectionEnabled: boolean("renter_protection_enabled").default(false),
  status: bookingStatusEnum("status").notNull().default("pending"),
  /** Статус заявки на компенсацию из фонда */
  claimStatus: text("claim_status").default("none"),
  message: text("message"),
  ownerComment: text("owner_comment"),
  /** Дата фактической выплаты владельцу. NULL = выплата ещё не сделана. */
  payoutSettledAt: timestamp("payout_settled_at"),
  /** Заявка на выплату, к которой привязана эта бронь (FK -> payout_requests.id) */
  payoutRequestId: integer("payout_request_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({ id: true, createdAt: true });
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
