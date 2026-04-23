import { Router } from "express";
import { db, bookingsTable, listingsTable, usersTable, contactPurchasesTable, claimsTable } from "@workspace/db";
import { eq, or, desc, and, sql, gte } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

const router = Router();

const num = (v: unknown): number => {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
};

type Direction = "in" | "out";
type EntryStatus = "pending" | "settled" | "off_platform" | "held";
type EntryType =
  | "rent_payout"        // владелец: выплата от платформы за защищённую сделку
  | "rent_paid"          // арендатор: оплата защищённой сделки
  | "direct_cash_in"     // владелец: наличные от арендатора (Free)
  | "direct_cash_out"    // арендатор: наличные владельцу (Free)
  | "contact_fee_paid"   // арендатор: оплата открытия контакта (Free)
  | "contact_fee_revenue"// (admin) выручка платформы за контакт
  | "service_fee"        // (admin) выручка платформы — сервисный сбор
  | "tax_fee"            // (admin) налоговый компонент
  | "fund_in"            // взнос в Гарантийный фонд
  | "fund_out"           // выплата из фонда (по claim)
  | "deposit_hold"       // залог удержан
  | "deposit_release"    // залог возвращён
  | "contact_topup";     // пополнение баланса контактов (top-up)

interface FinanceEntry {
  id: string;
  date: string;
  type: EntryType;
  direction: Direction;
  amount: number;
  status: EntryStatus;
  bookingId?: number;
  bookingNumber?: string;
  listingTitle?: string;
  counterparty?: string;
  description: string;
}

const SETTLED_STATUSES = ["completed"];
const PENDING_STATUSES = ["confirmed", "pending"];

// ─── GET /api/me/finance ──────────────────────────────────────────────────────
router.get("/me/finance", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;

  // Брони, в которых я владелец или арендатор
  const rows = await db
    .select({
      booking: bookingsTable,
      listingTitle: listingsTable.title,
      renterName: sql<string>`renter.name`,
      ownerName: sql<string>`owner.name`,
    })
    .from(bookingsTable)
    .leftJoin(listingsTable, eq(bookingsTable.listingId, listingsTable.id))
    .leftJoin(sql`${usersTable} AS renter`, sql`renter.id = ${bookingsTable.renterId}`)
    .leftJoin(sql`${usersTable} AS owner`, sql`owner.id = ${bookingsTable.ownerId}`)
    .where(or(eq(bookingsTable.renterId, userId), eq(bookingsTable.ownerId, userId)))
    .orderBy(desc(bookingsTable.createdAt));

  // Пополнения баланса контактов
  const topups = await db
    .select()
    .from(contactPurchasesTable)
    .where(eq(contactPurchasesTable.userId, userId))
    .orderBy(desc(contactPurchasesTable.createdAt));

  const entries: FinanceEntry[] = [];
  let lifetimeEarned = 0;
  let lifetimeSpent = 0;
  let pendingPayout = 0;
  let pendingDeposit = 0;

  for (const row of rows) {
    const b = row.booking;
    const date = b.createdAt.toISOString();
    const isOwner = b.ownerId === userId;
    const isRenter = b.renterId === userId;
    const protection = b.protectionEnabled ?? true;
    const status = b.status;
    const isCancelled = status === "cancelled" || status === "rejected";
    if (isCancelled) continue;

    const settled = SETTLED_STATUSES.includes(status);
    const entryStatus: EntryStatus = settled ? "settled" : "pending";

    const counterparty = isOwner ? (row.renterName ?? "Арендатор") : (row.ownerName ?? "Владелец");
    const baseTitle = row.listingTitle ?? "Объявление";

    if (!protection) {
      // ── Прямой расчёт (контакты) ─────────────────────────────────────────
      const contactFee = num(b.totalPrice);
      const rent = num(b.rentAmount);

      if (isRenter) {
        // 1) Платёж платформе за контакт
        entries.push({
          id: `b${b.id}-contact`,
          date,
          type: "contact_fee_paid",
          direction: "out",
          amount: contactFee,
          status: "settled",
          bookingId: b.id,
          bookingNumber: b.bookingNumber ?? undefined,
          listingTitle: baseTitle,
          counterparty,
          description: "Оплата открытия контактов владельца",
        });
        lifetimeSpent += contactFee;

        // 2) Наличные владельцу (вне платформы)
        if (rent > 0) {
          entries.push({
            id: `b${b.id}-cash-out`,
            date,
            type: "direct_cash_out",
            direction: "out",
            amount: rent,
            status: "off_platform",
            bookingId: b.id,
            bookingNumber: b.bookingNumber ?? undefined,
            listingTitle: baseTitle,
            counterparty,
            description: "Аренда оплачивается наличными владельцу",
          });
        }
      }

      if (isOwner) {
        // Наличные от арендатора (вне платформы)
        if (rent > 0) {
          entries.push({
            id: `b${b.id}-cash-in`,
            date,
            type: "direct_cash_in",
            direction: "in",
            amount: rent,
            status: "off_platform",
            bookingId: b.id,
            bookingNumber: b.bookingNumber ?? undefined,
            listingTitle: baseTitle,
            counterparty,
            description: "Аренда наличными от арендатора (вне платформы)",
          });
        }
      }
      continue;
    }

    // ── Защищённая сделка ──────────────────────────────────────────────────
    const totalPaid = num(b.totalPrice);
    const ownerPayout = num(b.ownerPayout) || num(b.rentAmount);
    const renterFund = num(b.renterFundContribution);
    const ownerFund = num(b.fundContribution);
    const deposit = num(b.depositAmount);

    if (isRenter) {
      entries.push({
        id: `b${b.id}-pay`,
        date,
        type: "rent_paid",
        direction: "out",
        amount: totalPaid,
        status: entryStatus,
        bookingId: b.id,
        bookingNumber: b.bookingNumber ?? undefined,
        listingTitle: baseTitle,
        counterparty,
        description: settled ? "Сделка завершена" : "Оплата сделки (на эскроу-удержании)",
      });
      lifetimeSpent += totalPaid;
      if (renterFund > 0) {
        entries.push({
          id: `b${b.id}-rfund`,
          date,
          type: "fund_in",
          direction: "out",
          amount: renterFund,
          status: "held",
          bookingId: b.id,
          bookingNumber: b.bookingNumber ?? undefined,
          listingTitle: baseTitle,
          counterparty,
          description: "Взнос в Гарантийный фонд (ваша защита)",
        });
      }
      if (deposit > 0) {
        entries.push({
          id: `b${b.id}-dep`,
          date,
          type: settled ? "deposit_release" : "deposit_hold",
          direction: settled ? "in" : "out",
          amount: deposit,
          status: settled ? "settled" : "held",
          bookingId: b.id,
          bookingNumber: b.bookingNumber ?? undefined,
          listingTitle: baseTitle,
          counterparty,
          description: settled ? "Залог возвращён" : "Залог удерживается на время аренды",
        });
        if (!settled) pendingDeposit += deposit;
      }
    }

    if (isOwner) {
      entries.push({
        id: `b${b.id}-payout`,
        date,
        type: "rent_payout",
        direction: "in",
        amount: ownerPayout,
        status: entryStatus,
        bookingId: b.id,
        bookingNumber: b.bookingNumber ?? undefined,
        listingTitle: baseTitle,
        counterparty,
        description: settled
          ? "Выплата на карту"
          : "Ожидает завершения сделки — выплата после возврата вещи",
      });
      if (settled) lifetimeEarned += ownerPayout;
      else pendingPayout += ownerPayout;

      if (ownerFund > 0) {
        entries.push({
          id: `b${b.id}-ofund`,
          date,
          type: "fund_in",
          direction: "out",
          amount: ownerFund,
          status: "held",
          bookingId: b.id,
          bookingNumber: b.bookingNumber ?? undefined,
          listingTitle: baseTitle,
          counterparty,
          description: "Ваш взнос в Гарантийный фонд",
        });
      }
    }
  }

  // ── Top-up'ы баланса контактов ───────────────────────────────────────────
  for (const t of topups) {
    if (t.amountRub <= 0) continue;
    entries.push({
      id: `t${t.id}`,
      date: t.createdAt.toISOString(),
      type: "contact_topup",
      direction: "out",
      amount: t.amountRub,
      status: t.refundedAt ? "settled" : "settled",
      description: t.kind === "pack10" ? "Пакет 10 контактов"
        : t.kind === "unlimited30d" ? "Безлимит на 30 дней"
        : t.kind === "single" ? "Покупка 1 контакта"
        : t.kind === "bonus" ? "Бонус — приветственные контакты"
        : t.kind === "admin_grant" ? "Зачислено администратором"
        : `Пополнение: ${t.kind}`,
    });
    if (t.kind !== "bonus" && t.kind !== "admin_grant") lifetimeSpent += t.amountRub;
  }

  entries.sort((a, b) => (a.date < b.date ? 1 : -1));

  res.json({
    summary: {
      lifetimeEarned: Math.round(lifetimeEarned),
      lifetimeSpent: Math.round(lifetimeSpent),
      pendingPayout: Math.round(pendingPayout),
      pendingDeposit: Math.round(pendingDeposit),
    },
    entries,
  });
});

// ─── GET /api/admin/finance ───────────────────────────────────────────────────
router.get("/admin/finance", requireAuth, async (req: AuthRequest, res) => {
  const [actor] = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);
  if (actor?.role !== "admin") {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  const ALLOWED_PERIODS = ["today", "week", "month", "all"] as const;
  type Period = (typeof ALLOWED_PERIODS)[number];
  const rawPeriod = (req.query.period as string) ?? "month";
  if (!ALLOWED_PERIODS.includes(rawPeriod as Period)) {
    res.status(400).json({ error: "invalid_period", allowed: ALLOWED_PERIODS });
    return;
  }
  const period = rawPeriod as Period;
  const now = new Date();
  let since: Date | null = null;
  if (period === "today") {
    since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === "week") {
    since = new Date(now.getTime() - 7 * 86_400_000);
  } else if (period === "month") {
    since = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const wherePeriod = since ? gte(bookingsTable.createdAt, since) : undefined;

  const wherePremiumActive = and(
    eq(bookingsTable.protectionEnabled, true),
    sql`${bookingsTable.status} IN ('confirmed','completed')`,
    ...(wherePeriod ? [wherePeriod] : []),
  );

  const whereContactBookings = and(
    eq(bookingsTable.protectionEnabled, false),
    ...(wherePeriod ? [wherePeriod] : []),
  );

  const [premiumAgg] = await db
    .select({
      serviceFee: sql<string>`COALESCE(SUM(${bookingsTable.serviceFee}),0)`,
      taxFee: sql<string>`COALESCE(SUM(${bookingsTable.taxFee}),0)`,
      ownerFund: sql<string>`COALESCE(SUM(${bookingsTable.fundContribution}),0)`,
      renterFund: sql<string>`COALESCE(SUM(${bookingsTable.renterFundContribution}),0)`,
      pendingPayout: sql<string>`COALESCE(SUM(CASE WHEN ${bookingsTable.status}='confirmed' THEN ${bookingsTable.ownerPayout} ELSE 0 END),0)`,
      settledPayout: sql<string>`COALESCE(SUM(CASE WHEN ${bookingsTable.status}='completed' THEN ${bookingsTable.ownerPayout} ELSE 0 END),0)`,
      bookingsCount: sql<number>`COUNT(*)::int`,
    })
    .from(bookingsTable)
    .where(wherePremiumActive);

  const [contactAgg] = await db
    .select({
      contactRevenue: sql<string>`COALESCE(SUM(${bookingsTable.totalPrice}),0)`,
      contactCount: sql<number>`COUNT(*)::int`,
    })
    .from(bookingsTable)
    .where(whereContactBookings);

  const whereTopup = since ? gte(contactPurchasesTable.createdAt, since) : undefined;
  const [topupAgg] = await db
    .select({
      topupRevenue: sql<string>`COALESCE(SUM(${contactPurchasesTable.amountRub}),0)`,
      topupCount: sql<number>`COUNT(*)::int`,
    })
    .from(contactPurchasesTable)
    .where(whereTopup);

  const claimsWhere = since
    ? and(eq(claimsTable.status, "paid"), gte(claimsTable.updatedAt, since))
    : eq(claimsTable.status, "paid");
  const [claimAgg] = await db
    .select({
      paidOut: sql<string>`COALESCE(SUM(${claimsTable.approvedAmount}),0)`,
      claimsCount: sql<number>`COUNT(*)::int`,
    })
    .from(claimsTable)
    .where(claimsWhere);

  const serviceRevenue = num(premiumAgg.serviceFee);
  const taxRevenue = num(premiumAgg.taxFee);
  const fundIn = num(premiumAgg.ownerFund) + num(premiumAgg.renterFund);
  const fundOut = num(claimAgg.paidOut);
  const contactRevenue = num(contactAgg.contactRevenue) + num(topupAgg.topupRevenue);
  const totalRevenue = serviceRevenue + taxRevenue + contactRevenue;

  // Последние транзакции (объединение)
  const recentBookings = await db
    .select({
      booking: bookingsTable,
      listingTitle: listingsTable.title,
      renterName: sql<string>`renter.name`,
      ownerName: sql<string>`owner.name`,
    })
    .from(bookingsTable)
    .leftJoin(listingsTable, eq(bookingsTable.listingId, listingsTable.id))
    .leftJoin(sql`${usersTable} AS renter`, sql`renter.id = ${bookingsTable.renterId}`)
    .leftJoin(sql`${usersTable} AS owner`, sql`owner.id = ${bookingsTable.ownerId}`)
    .where(wherePeriod ?? sql`true`)
    .orderBy(desc(bookingsTable.createdAt))
    .limit(50);

  const recent = recentBookings.map(row => {
    const b = row.booking;
    const protection = b.protectionEnabled ?? true;
    return {
      id: b.id,
      date: b.createdAt.toISOString(),
      bookingNumber: b.bookingNumber,
      listingTitle: row.listingTitle,
      kind: protection ? "premium" : "direct",
      status: b.status,
      totalPrice: Math.round(num(b.totalPrice)),
      serviceFee: Math.round(num(b.serviceFee)),
      taxFee: Math.round(num(b.taxFee)),
      fund: Math.round(num(b.fundContribution) + num(b.renterFundContribution)),
      ownerPayout: Math.round(num(b.ownerPayout)),
      renterName: row.renterName,
      ownerName: row.ownerName,
    };
  });

  res.json({
    period,
    revenue: {
      total: Math.round(totalRevenue),
      service: Math.round(serviceRevenue),
      tax: Math.round(taxRevenue),
      contacts: Math.round(contactRevenue),
    },
    fund: {
      in: Math.round(fundIn),
      out: Math.round(fundOut),
      balance: Math.round(fundIn - fundOut),
    },
    payouts: {
      pending: Math.round(num(premiumAgg.pendingPayout)),
      settled: Math.round(num(premiumAgg.settledPayout)),
    },
    counts: {
      premiumBookings: premiumAgg.bookingsCount,
      directBookings: contactAgg.contactCount,
      topups: topupAgg.topupCount,
      paidClaims: claimAgg.claimsCount,
    },
    recent,
  });
});

export default router;
