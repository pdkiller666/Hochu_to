import { Router } from "express";
import {
  db,
  claimsTable,
  bookingsTable,
  usersTable,
  payoutMethodsTable,
  listingsTable,
} from "@workspace/db";
import { eq, desc, and, inArray, sql, gte } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { createNotification } from "../lib/notifications.js";
import { getPlatformSettings } from "../lib/platform-settings.js";

const router = Router();

const num = (v: unknown): number => {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
};

async function isAdmin(userId: number): Promise<boolean> {
  const [u] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return u?.role === "admin";
}

/**
 * Текущий баланс гарантийного фонда:
 *   sum(fundContribution) по completed Premium-броням
 *   − sum(approvedAmount) по claims со статусом 'paid'
 *
 * Также возвращает reserve (неприкосновенный остаток) и availableForClaims (что реально можно выплатить).
 */
async function calcFundBalance(): Promise<{
  inSum: number;
  outSum: number;
  balance: number;
  reserve: number;
  availableForClaims: number;
  reserveRatioPct: number;
}> {
  const [premium] = await db
    .select({
      ownerFund: sql<string>`COALESCE(SUM(${bookingsTable.fundContribution}), 0)`,
      renterFund: sql<string>`COALESCE(SUM(${bookingsTable.renterFundContribution}), 0)`,
    })
    .from(bookingsTable)
    .where(and(eq(bookingsTable.status, "completed"), eq(bookingsTable.protectionEnabled, true)));

  const [paid] = await db
    .select({ paidOut: sql<string>`COALESCE(SUM(${claimsTable.approvedAmount}), 0)` })
    .from(claimsTable)
    .where(eq(claimsTable.status, "paid"));

  // Уже одобренные, но ещё не выплаченные — резервируются «мягко» против available,
  // чтобы два одновременных approve не превысили баланс.
  const [approvedPending] = await db
    .select({ pendingOut: sql<string>`COALESCE(SUM(${claimsTable.approvedAmount}), 0)` })
    .from(claimsTable)
    .where(eq(claimsTable.status, "approved"));

  const settings = await getPlatformSettings();
  const reserveRatioPct = Math.max(0, Math.min(100, settings.fundReserveRatioPct ?? 0));

  const inSum = Math.round(num(premium?.ownerFund) + num(premium?.renterFund));
  const outSum = Math.round(num(paid?.paidOut));
  const approvedPendingSum = Math.round(num(approvedPending?.pendingOut));
  const balance = Math.max(0, inSum - outSum);
  // Резерв считается от текущего баланса (а не от inSum), иначе по мере роста выплат
  // фонд бы навсегда «залип» на нуле доступного. Резерв — это % того, что лежит сейчас.
  const reserve = Math.round(balance * reserveRatioPct / 100);
  const availableForClaims = Math.max(0, balance - reserve - approvedPendingSum);
  return { inSum, outSum, balance, reserve, availableForClaims, reserveRatioPct };
}

/**
 * Считает claims пользователя за текущий календарный месяц
 * (учитываются все кроме rejected — отклонённые в счёт не идут).
 */
async function countClaimsThisMonth(userId: number): Promise<number> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [row] = await db
    .select({ c: sql<number>`COUNT(*)::int` })
    .from(claimsTable)
    .where(
      and(
        eq(claimsTable.claimantId, userId),
        gte(claimsTable.createdAt, monthStart),
        sql`${claimsTable.status} != 'rejected'`,
      ),
    );
  return row?.c ?? 0;
}

// ─── GET /claims/fund-status — публичный (для админа) баланс фонда ───────────
router.get("/fund-status", requireAuth, async (req: AuthRequest, res) => {
  if (!(await isAdmin(req.userId!))) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  res.json(await calcFundBalance());
});

// ─── GET /claims/analytics — аналитика фонда (admin) ────────────────────────
//   Возвращает: ежедневный баланс за N дней, топ получателей, флаги подозрительных
router.get("/analytics", requireAuth, async (req: AuthRequest, res) => {
  if (!(await isAdmin(req.userId!))) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  const days = Math.min(365, Math.max(7, parseInt(String(req.query.days ?? "30"), 10) || 30));
  // UTC-начало окна: предсказуемо совпадает с TO_CHAR(...::date) в Postgres (UTC).
  const now = new Date();
  const sinceUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - (days - 1) * 86_400_000;
  const since = new Date(sinceUtcMs);

  // 1. Поступления по дням (completed Premium-брони).
  //    bookings не содержит updated_at; используем COALESCE(payout_settled_at, created_at)
  //    как момент финализации взноса в фонд.
  const inflowDayExpr = sql`TO_CHAR(COALESCE(${bookingsTable.payoutSettledAt}, ${bookingsTable.createdAt})::date, 'YYYY-MM-DD')`;
  const inflowDateExpr = sql`COALESCE(${bookingsTable.payoutSettledAt}, ${bookingsTable.createdAt})`;
  const inflowRows = await db
    .select({
      day: sql<string>`${inflowDayExpr}`,
      amount: sql<string>`COALESCE(SUM(${bookingsTable.fundContribution} + ${bookingsTable.renterFundContribution}), 0)`,
    })
    .from(bookingsTable)
    .where(and(
      eq(bookingsTable.status, "completed"),
      eq(bookingsTable.protectionEnabled, true),
      sql`${inflowDateExpr} >= ${since}`,
    ))
    .groupBy(inflowDayExpr);

  // 2. Выплаты по дням (paid claims)
  const outflowRows = await db
    .select({
      day: sql<string>`TO_CHAR(${claimsTable.paidAt}::date, 'YYYY-MM-DD')`,
      amount: sql<string>`COALESCE(SUM(${claimsTable.approvedAmount}), 0)`,
    })
    .from(claimsTable)
    .where(and(
      eq(claimsTable.status, "paid"),
      gte(claimsTable.paidAt, since),
    ))
    .groupBy(sql`TO_CHAR(${claimsTable.paidAt}::date, 'YYYY-MM-DD')`);

  // Стартовый баланс (всё что было ДО окна)
  const [preIn] = await db
    .select({ s: sql<string>`COALESCE(SUM(${bookingsTable.fundContribution} + ${bookingsTable.renterFundContribution}), 0)` })
    .from(bookingsTable)
    .where(and(
      eq(bookingsTable.status, "completed"),
      eq(bookingsTable.protectionEnabled, true),
      sql`${inflowDateExpr} < ${since}`,
    ));
  const [preOut] = await db
    .select({ s: sql<string>`COALESCE(SUM(${claimsTable.approvedAmount}), 0)` })
    .from(claimsTable)
    .where(and(
      eq(claimsTable.status, "paid"),
      sql`${claimsTable.paidAt} < ${since}`,
    ));

  const inflowMap = new Map(inflowRows.map(r => [r.day, num(r.amount)]));
  const outflowMap = new Map(outflowRows.map(r => [r.day, num(r.amount)]));

  let runningBalance = Math.max(0, num(preIn?.s) - num(preOut?.s));
  const daily: Array<{ date: string; inflow: number; outflow: number; balance: number }> = [];
  for (let i = 0; i < days; i++) {
    const key = new Date(sinceUtcMs + i * 86_400_000).toISOString().slice(0, 10);
    const inflow = Math.round(inflowMap.get(key) ?? 0);
    const outflow = Math.round(outflowMap.get(key) ?? 0);
    runningBalance = Math.max(0, runningBalance + inflow - outflow);
    daily.push({ date: key, inflow, outflow, balance: runningBalance });
  }

  // 3. Топ получателей за всё время (только paid)
  const topRows = await db
    .select({
      userId: claimsTable.payoutToUserId,
      name: usersTable.name,
      email: usersTable.email,
      totalRub: sql<string>`COALESCE(SUM(${claimsTable.approvedAmount}), 0)`,
      claimsCount: sql<number>`COUNT(*)::int`,
    })
    .from(claimsTable)
    .leftJoin(usersTable, eq(usersTable.id, claimsTable.payoutToUserId))
    .where(eq(claimsTable.status, "paid"))
    .groupBy(claimsTable.payoutToUserId, usersTable.name, usersTable.email)
    .orderBy(sql`SUM(${claimsTable.approvedAmount}) DESC NULLS LAST`)
    .limit(10);
  const topRecipients = topRows
    .filter(r => r.userId != null)
    .map(r => ({
      userId: r.userId,
      name: r.name ?? "—",
      email: r.email ?? "",
      totalRub: Math.round(num(r.totalRub)),
      claimsCount: r.claimsCount ?? 0,
    }));

  // 4. Подозрительные паттерны: пользователи с ≥3 не-rejected claims за последние 90 дней
  //    либо с уже ≥2 выплатами (на сумму потенциальной убыточной категории).
  //    Rejected исключаем сразу в WHERE — они не должны идти в счёт.
  const suspSince = new Date();
  suspSince.setDate(suspSince.getDate() - 90);
  const suspRows = await db
    .select({
      userId: claimsTable.claimantId,
      name: usersTable.name,
      email: usersTable.email,
      claimsCount: sql<number>`COUNT(*)::int`,
      totalRequested: sql<string>`COALESCE(SUM(${claimsTable.requestedAmount}), 0)`,
      paidCount: sql<number>`SUM(CASE WHEN ${claimsTable.status} = 'paid' THEN 1 ELSE 0 END)::int`,
    })
    .from(claimsTable)
    .leftJoin(usersTable, eq(usersTable.id, claimsTable.claimantId))
    .where(and(
      gte(claimsTable.createdAt, suspSince),
      sql`${claimsTable.status} != 'rejected'`,
    ))
    .groupBy(claimsTable.claimantId, usersTable.name, usersTable.email)
    .having(sql`COUNT(*) >= 3 OR SUM(CASE WHEN ${claimsTable.status} = 'paid' THEN 1 ELSE 0 END) >= 2`)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(20);
  const suspicious = suspRows.map(r => {
    const reasons: string[] = [];
    if ((r.claimsCount ?? 0) >= 3) reasons.push(`${r.claimsCount} заявок за 90 дней`);
    if ((r.paidCount ?? 0) >= 2) reasons.push(`${r.paidCount} уже выплачены`);
    return {
      userId: r.userId,
      name: r.name ?? "—",
      email: r.email ?? "",
      claimsCount: r.claimsCount ?? 0,
      paidCount: r.paidCount ?? 0,
      rejectedCount: r.rejectedCount ?? 0,
      totalRequested: Math.round(num(r.totalRequested)),
      reasons,
    };
  });

  res.json({ days, daily, topRecipients, suspicious });
});

// ─── GET /claims/payout-methods/:userId — реквизиты получателя (admin) ───────
router.get("/payout-methods/:userId", requireAuth, async (req: AuthRequest, res) => {
  if (!(await isAdmin(req.userId!))) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  const userId = parseInt(req.params.userId as string, 10);
  if (!Number.isFinite(userId)) {
    res.status(400).json({ error: "invalid_user_id" });
    return;
  }
  const methods = await db.select({
    id: payoutMethodsTable.id,
    type: payoutMethodsTable.type,
    cardLast4: payoutMethodsTable.cardLast4,
    cardHolderName: payoutMethodsTable.cardHolderName,
    bankName: payoutMethodsTable.bankName,
    sbpPhone: payoutMethodsTable.sbpPhone,
    sbpBank: payoutMethodsTable.sbpBank,
    isDefault: payoutMethodsTable.isDefault,
  }).from(payoutMethodsTable).where(eq(payoutMethodsTable.userId, userId));
  res.json(methods);
});

// ─── GET /claims — список всех заявок (только admin) ─────────────────────────
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  if (!(await isAdmin(req.userId!))) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  const claims = await db.select().from(claimsTable).orderBy(desc(claimsTable.createdAt));
  if (claims.length === 0) {
    res.json([]);
    return;
  }

  // Подтягиваем данные броней и пользователей разом
  const bookingIds = Array.from(new Set(claims.map((c) => c.bookingId)));
  const userIds = Array.from(new Set(claims.flatMap((c) => [c.claimantId, c.payoutToUserId].filter((x): x is number => x != null))));

  const bookings = bookingIds.length > 0
    ? await db.select({
        id: bookingsTable.id,
        bookingNumber: bookingsTable.bookingNumber,
        ownerId: bookingsTable.ownerId,
        renterId: bookingsTable.renterId,
        listingId: bookingsTable.listingId,
        maxProtectionLimit: listingsTable.maxProtectionLimit,
      })
        .from(bookingsTable)
        .leftJoin(listingsTable, eq(listingsTable.id, bookingsTable.listingId))
        .where(inArray(bookingsTable.id, bookingIds))
    : [];
  const bMap = new Map(bookings.map((b) => [b.id, b]));

  const users = userIds.length > 0
    ? await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email }).from(usersTable).where(inArray(usersTable.id, userIds))
    : [];
  const uMap = new Map(users.map((u) => [u.id, u]));

  const enriched = claims.map((c) => {
    const b = bMap.get(c.bookingId);
    return {
      ...c,
      bookingNumber: b?.bookingNumber ?? null,
      ownerId: b?.ownerId ?? null,
      renterId: b?.renterId ?? null,
      maxProtectionLimit: b?.maxProtectionLimit ?? null,
      claimantName: uMap.get(c.claimantId)?.name ?? null,
      claimantEmail: uMap.get(c.claimantId)?.email ?? null,
      payoutToName: c.payoutToUserId ? uMap.get(c.payoutToUserId)?.name ?? null : null,
    };
  });

  res.json(enriched);
});

// ─── GET /claims/my — заявки текущего пользователя ──────────────────────────
router.get("/my", requireAuth, async (req: AuthRequest, res) => {
  const claims = await db.select().from(claimsTable)
    .where(eq(claimsTable.claimantId, req.userId!))
    .orderBy(desc(claimsTable.createdAt));
  res.json(claims);
});

// ─── POST /claims — создать заявку ──────────────────────────────────────────
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const { bookingId, type, description, evidenceUrl, requestedAmount } = req.body;

  if (!bookingId || !type || !description) {
    res.status(400).json({ error: "validation_error", message: "bookingId, type, description обязательны" });
    return;
  }

  if (!["damage", "theft"].includes(type)) {
    res.status(400).json({ error: "invalid_type", message: "type должен быть damage или theft" });
    return;
  }
  if (typeof description !== "string" || description.trim().length < 10) {
    res.status(400).json({ error: "validation_error", message: "Описание должно быть не менее 10 символов" });
    return;
  }

  // Проверяем, что бронирование принадлежит этому пользователю
  const [booking] = await db.select({
    id: bookingsTable.id,
    bookingNumber: bookingsTable.bookingNumber,
    renterId: bookingsTable.renterId,
    ownerId: bookingsTable.ownerId,
    status: bookingsTable.status,
    protectionEnabled: bookingsTable.protectionEnabled,
    listingId: bookingsTable.listingId,
    maxProtectionLimit: listingsTable.maxProtectionLimit,
  })
    .from(bookingsTable)
    .leftJoin(listingsTable, eq(listingsTable.id, bookingsTable.listingId))
    .where(eq(bookingsTable.id, parseInt(bookingId, 10)))
    .limit(1);

  if (!booking) {
    res.status(404).json({ error: "not_found", message: "Бронирование не найдено" });
    return;
  }

  const userId = req.userId!;
  if (booking.renterId !== userId && booking.ownerId !== userId) {
    res.status(403).json({ error: "forbidden", message: "Вы не участник этого бронирования" });
    return;
  }

  // Только Premium-сделки покрыты фондом
  if (!booking.protectionEnabled) {
    res.status(400).json({
      error: "no_protection",
      message: "Заявку в фонд можно подать только для сделки с защитой (Premium).",
    });
    return;
  }

  // Заявку можно подать только для active/return_pending/completed бронирований
  if (!["active", "return_pending", "completed"].includes(booking.status)) {
    res.status(400).json({
      error: "invalid_status",
      message: "Заявку можно подать только для активных или завершённых бронирований",
    });
    return;
  }

  const requested = requestedAmount != null ? num(requestedAmount) : null;
  if (requested != null && requested <= 0) {
    res.status(400).json({ error: "invalid_amount", message: "Сумма должна быть положительной" });
    return;
  }
  // Лимит на одно объявление: не больше maxProtectionLimit
  const maxAllowed = num(booking.maxProtectionLimit);
  if (requested != null && maxAllowed > 0 && requested > maxAllowed) {
    res.status(400).json({
      error: "exceeds_protection_limit",
      message: `Максимальная защита по этому объявлению — ${Math.round(maxAllowed)} ₽`,
    });
    return;
  }

  // ── Анти-фрод лимиты из platform_settings ────────────────────────────────
  const settings = await getPlatformSettings();

  if (requested != null && settings.maxClaimAmountSingleRub > 0 && requested > settings.maxClaimAmountSingleRub) {
    res.status(400).json({
      error: "exceeds_single_claim_cap",
      message: `Максимум для одной заявки — ${settings.maxClaimAmountSingleRub} ₽`,
    });
    return;
  }
  const listingPct = settings.maxClaimAmountPerListingPct;
  if (requested != null && listingPct > 0 && listingPct < 100 && maxAllowed > 0) {
    const listingCap = Math.round(maxAllowed * listingPct / 100);
    if (requested > listingCap) {
      res.status(400).json({
        error: "exceeds_listing_cap",
        message: `По правилам фонда выплата по этому объявлению не может превышать ${listingCap} ₽ (${listingPct}% от лимита защиты).`,
      });
      return;
    }
  }
  if (settings.maxClaimsPerUserMonth > 0) {
    const claimsThisMonth = await countClaimsThisMonth(userId);
    if (claimsThisMonth >= settings.maxClaimsPerUserMonth) {
      res.status(429).json({
        error: "monthly_limit_reached",
        message: `Превышен лимит заявок: ${settings.maxClaimsPerUserMonth} в месяц на одного пользователя.`,
      });
      return;
    }
  }

  // Защита от дубликатов: одна активная заявка на бронь от одного юзера
  const existing = await db
    .select({ id: claimsTable.id })
    .from(claimsTable)
    .where(
      and(
        eq(claimsTable.bookingId, booking.id),
        eq(claimsTable.claimantId, userId),
        sql`${claimsTable.status} IN ('pending','admin_review','approved')`,
      ),
    )
    .limit(1);
  if (existing.length > 0) {
    res.status(409).json({
      error: "claim_already_exists",
      message: "У вас уже есть активная заявка по этому бронированию",
      claimId: existing[0].id,
    });
    return;
  }

  const [claim] = await db.insert(claimsTable).values({
    bookingId: booking.id,
    claimantId: userId,
    type,
    description: description.trim(),
    evidenceUrl: evidenceUrl ?? null,
    requestedAmount: requested != null ? requested.toString() : null,
    status: "pending",
  }).returning();

  // Уведомления: вторая сторона + все админы
  const otherSideId = booking.ownerId === userId ? booking.renterId : booking.ownerId;
  try {
    await createNotification({
      userId: otherSideId,
      type: "claim_created" as any,
      title: "Открыта заявка в гарантийный фонд",
      message: `По брони ${booking.bookingNumber ?? `#${booking.id}`} подана заявка типа "${type === "damage" ? "повреждение" : "кража"}".`,
      bookingId: booking.id,
    });
    const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
    for (const a of admins) {
      await createNotification({
        userId: a.id,
        type: "claim_created" as any,
        title: "Новая заявка в фонд",
        message: `Заявка #${claim.id} по броне ${booking.bookingNumber ?? `#${booking.id}`} ждёт обработки.`,
        bookingId: booking.id,
      });
    }
  } catch (e) {
    // Не валим создание из-за уведомлений
    console.error("[claims] notify failed:", e);
  }

  res.status(201).json(claim);
});

// ─── PATCH /claims/:id — обновление заявки ────────────────────────────────
// Admin: смена статуса между pending/admin_review/rejected, изменение adminNote
// User: добавление/обновление доказательства пока pending
router.patch("/:id", requireAuth, async (req: AuthRequest, res) => {
  const claimId = parseInt(req.params.id as string, 10);
  const [existing] = await db.select().from(claimsTable).where(eq(claimsTable.id, claimId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const userId = req.userId!;
  const admin = await isAdmin(userId);

  if (admin) {
    const { status, adminNote } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (adminNote !== undefined) updates.adminNote = adminNote ? String(adminNote).slice(0, 1000) : null;
    if (status && ["pending", "admin_review"].includes(status)) {
      updates.status = status;
    }
    if (Object.keys(updates).length === 1) {
      res.status(400).json({ error: "nothing_to_update" });
      return;
    }
    const [updated] = await db.update(claimsTable).set(updates).where(eq(claimsTable.id, claimId)).returning();
    res.json(updated);
    return;
  }

  if (existing.claimantId !== userId) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  if (existing.status !== "pending") {
    res.status(400).json({ error: "not_editable", message: "Заявка уже передана в обработку" });
    return;
  }
  const { evidenceUrl, description } = req.body;
  const updates: Record<string, any> = { updatedAt: new Date() };
  if (evidenceUrl !== undefined) updates.evidenceUrl = evidenceUrl;
  if (description !== undefined) {
    if (typeof description !== "string" || description.trim().length < 10) {
      res.status(400).json({ error: "validation_error", message: "Описание ≥ 10 символов" });
      return;
    }
    updates.description = description.trim();
  }
  const [updated] = await db.update(claimsTable).set(updates).where(eq(claimsTable.id, claimId)).returning();
  res.json(updated);
});

// ─── POST /claims/:id/approve — admin одобряет с указанием получателя/суммы ──
router.post("/:id/approve", requireAuth, async (req: AuthRequest, res) => {
  if (!(await isAdmin(req.userId!))) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  const claimId = parseInt(req.params.id as string, 10);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const payoutToUserId = Number(body.payoutToUserId);
  const approvedAmount = Number(body.approvedAmount);
  const payoutMethodId = Number(body.payoutMethodId);
  const adminNote = typeof body.adminNote === "string" ? body.adminNote.slice(0, 1000) : undefined;

  if (!Number.isFinite(approvedAmount) || approvedAmount <= 0) {
    res.status(400).json({ error: "invalid_amount", message: "Укажите положительную сумму выплаты" });
    return;
  }
  if (!Number.isInteger(payoutToUserId) || payoutToUserId <= 0) {
    res.status(400).json({ error: "invalid_payout_to", message: "Укажите получателя компенсации" });
    return;
  }
  if (!Number.isInteger(payoutMethodId) || payoutMethodId <= 0) {
    res.status(400).json({ error: "invalid_method", message: "Укажите реквизиты получателя" });
    return;
  }

  const [claim] = await db.select().from(claimsTable).where(eq(claimsTable.id, claimId)).limit(1);
  if (!claim) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (!["pending", "admin_review"].includes(claim.status)) {
    res.status(400).json({ error: "wrong_status", message: `Текущий статус: ${claim.status}` });
    return;
  }

  // Получатель должен быть участником брони
  const [booking] = await db.select({
    id: bookingsTable.id,
    bookingNumber: bookingsTable.bookingNumber,
    ownerId: bookingsTable.ownerId,
    renterId: bookingsTable.renterId,
    maxProtectionLimit: listingsTable.maxProtectionLimit,
    listingId: bookingsTable.listingId,
  })
    .from(bookingsTable)
    .leftJoin(listingsTable, eq(listingsTable.id, bookingsTable.listingId))
    .where(eq(bookingsTable.id, claim.bookingId))
    .limit(1);
  if (!booking) {
    res.status(404).json({ error: "booking_not_found" });
    return;
  }
  if (payoutToUserId !== booking.ownerId && payoutToUserId !== booking.renterId) {
    res.status(400).json({ error: "invalid_payout_to", message: "Получатель должен быть владельцем или арендатором этой брони" });
    return;
  }

  const maxAllowed = num(booking.maxProtectionLimit);
  if (maxAllowed > 0 && approvedAmount > maxAllowed) {
    res.status(400).json({
      error: "exceeds_protection_limit",
      message: `Лимит защиты по объявлению — ${Math.round(maxAllowed)} ₽.`,
    });
    return;
  }

  // Анти-фрод лимиты при approve
  const settings = await getPlatformSettings();
  if (settings.maxClaimAmountSingleRub > 0 && approvedAmount > settings.maxClaimAmountSingleRub) {
    res.status(400).json({
      error: "exceeds_single_claim_cap",
      message: `Максимум для одной выплаты — ${settings.maxClaimAmountSingleRub} ₽.`,
    });
    return;
  }
  const listingPct = settings.maxClaimAmountPerListingPct;
  if (listingPct > 0 && listingPct < 100 && maxAllowed > 0) {
    const listingCap = Math.round(maxAllowed * listingPct / 100);
    if (approvedAmount > listingCap) {
      res.status(400).json({
        error: "exceeds_listing_cap",
        message: `Лимит выплаты по объявлению — ${listingCap} ₽ (${listingPct}% от защиты).`,
      });
      return;
    }
  }

  const fund = await calcFundBalance();
  if (approvedAmount > fund.availableForClaims) {
    res.status(400).json({
      error: "insufficient_fund_balance",
      message: `Доступно к выплате ${fund.availableForClaims} ₽ (баланс ${fund.balance} ₽ − резерв ${fund.reserve} ₽).`,
    });
    return;
  }

  // Реквизиты получателя
  const [method] = await db.select().from(payoutMethodsTable)
    .where(and(eq(payoutMethodsTable.id, payoutMethodId), eq(payoutMethodsTable.userId, payoutToUserId)))
    .limit(1);
  if (!method) {
    res.status(404).json({ error: "method_not_found", message: "У получателя нет таких реквизитов" });
    return;
  }

  const snapshot = {
    type: method.type,
    cardLast4: method.cardLast4,
    cardHolderName: method.cardHolderName,
    bankName: method.bankName,
    sbpPhone: method.sbpPhone,
    sbpBank: method.sbpBank,
  };

  const [updated] = await db.update(claimsTable)
    .set({
      status: "approved",
      approvedAmount: Math.round(approvedAmount).toString(),
      payoutToUserId,
      payoutMethodId,
      methodSnapshot: snapshot,
      adminNote: adminNote ?? claim.adminNote,
      updatedAt: new Date(),
    })
    .where(eq(claimsTable.id, claimId))
    .returning();

  // Уведомления участникам
  try {
    await createNotification({
      userId: payoutToUserId,
      type: "claim_approved" as any,
      title: "Заявка в фонд одобрена",
      message: `Сумма ${Math.round(approvedAmount)} ₽ ожидает выплаты.`,
      bookingId: booking.id,
    });
    if (claim.claimantId !== payoutToUserId) {
      await createNotification({
        userId: claim.claimantId,
        type: "claim_approved" as any,
        title: "Решение по вашей заявке",
        message: `Заявка #${claim.id} одобрена на ${Math.round(approvedAmount)} ₽ (получатель — другая сторона).`,
        bookingId: booking.id,
      });
    }
  } catch (e) {
    console.error("[claims] notify failed:", e);
  }

  res.json(updated);
});

// ─── POST /claims/:id/mark-paid — admin отмечает выплату ─────────────────────
router.post("/:id/mark-paid", requireAuth, async (req: AuthRequest, res) => {
  if (!(await isAdmin(req.userId!))) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  const claimId = parseInt(req.params.id as string, 10);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const paymentRef = typeof body.paymentRef === "string" ? body.paymentRef.trim() : "";
  if (paymentRef.length < 2 || paymentRef.length > 200) {
    res.status(400).json({ error: "invalid_input", message: "Укажите референс перевода (2–200 символов)" });
    return;
  }

  const [claim] = await db.select().from(claimsTable).where(eq(claimsTable.id, claimId)).limit(1);
  if (!claim) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (claim.status !== "approved") {
    res.status(400).json({ error: "wrong_status", message: "Можно отметить выплаченной только одобренную заявку" });
    return;
  }

  // Повторная проверка баланса фонда (защита на случай если другие заявки прошли)
  const fund = await calcFundBalance();
  const amount = num(claim.approvedAmount);
  if (amount > fund.availableForClaims) {
    res.status(400).json({
      error: "insufficient_fund_balance",
      message: `Доступно к выплате ${fund.availableForClaims} ₽ (баланс ${fund.balance} ₽ − резерв ${fund.reserve} ₽), требуется ${Math.round(amount)} ₽.`,
    });
    return;
  }

  const now = new Date();
  const [updated] = await db.update(claimsTable)
    .set({
      status: "paid",
      paymentRef,
      paidAt: now,
      resolvedAt: now,
      updatedAt: now,
    })
    .where(eq(claimsTable.id, claimId))
    .returning();

  if (claim.payoutToUserId) {
    try {
      await createNotification({
        userId: claim.payoutToUserId,
        type: "claim_paid" as any,
        title: "Компенсация выплачена",
        message: `Сумма ${Math.round(amount)} ₽ отправлена. Референс: ${paymentRef}`,
        bookingId: claim.bookingId,
      });
    } catch (e) {
      console.error("[claims] notify failed:", e);
    }
  }

  res.json(updated);
});

// ─── POST /claims/:id/reject — admin отклоняет ───────────────────────────────
router.post("/:id/reject", requireAuth, async (req: AuthRequest, res) => {
  if (!(await isAdmin(req.userId!))) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  const claimId = parseInt(req.params.id as string, 10);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const rejectionReason = typeof body.rejectionReason === "string" ? body.rejectionReason.trim() : "";
  if (rejectionReason.length < 2 || rejectionReason.length > 1000) {
    res.status(400).json({ error: "invalid_input", message: "Причина 2–1000 символов" });
    return;
  }

  const [claim] = await db.select().from(claimsTable).where(eq(claimsTable.id, claimId)).limit(1);
  if (!claim) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (!["pending", "admin_review", "approved"].includes(claim.status)) {
    res.status(400).json({ error: "wrong_status" });
    return;
  }

  const now = new Date();
  const [updated] = await db.update(claimsTable)
    .set({
      status: "rejected",
      rejectionReason,
      resolvedAt: now,
      updatedAt: now,
    })
    .where(eq(claimsTable.id, claimId))
    .returning();

  try {
    await createNotification({
      userId: claim.claimantId,
      type: "claim_rejected" as any,
      title: "Заявка отклонена",
      message: rejectionReason,
      bookingId: claim.bookingId,
    });
  } catch (e) {
    console.error("[claims] notify failed:", e);
  }

  res.json(updated);
});

export default router;
