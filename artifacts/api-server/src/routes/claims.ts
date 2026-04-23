import { Router } from "express";
import {
  db,
  claimsTable,
  bookingsTable,
  usersTable,
  payoutMethodsTable,
  listingsTable,
} from "@workspace/db";
import { eq, desc, and, inArray, sql } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { createNotification } from "../lib/notifications.js";

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
 */
async function calcFundBalance(): Promise<{ inSum: number; outSum: number; balance: number }> {
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

  const inSum = Math.round(num(premium?.ownerFund) + num(premium?.renterFund));
  const outSum = Math.round(num(paid?.paidOut));
  return { inSum, outSum, balance: Math.max(0, inSum - outSum) };
}

// ─── GET /claims/fund-status — публичный (для админа) баланс фонда ───────────
router.get("/fund-status", requireAuth, async (req: AuthRequest, res) => {
  if (!(await isAdmin(req.userId!))) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  res.json(await calcFundBalance());
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

  const fund = await calcFundBalance();
  if (approvedAmount > fund.balance) {
    res.status(400).json({
      error: "insufficient_fund_balance",
      message: `Запрошено ${Math.round(approvedAmount)} ₽, баланс фонда ${fund.balance} ₽.`,
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
  if (amount > fund.balance) {
    res.status(400).json({
      error: "insufficient_fund_balance",
      message: `Баланс фонда ${fund.balance} ₽, требуется ${Math.round(amount)} ₽. Отклоните заявку и создайте заново.`,
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
