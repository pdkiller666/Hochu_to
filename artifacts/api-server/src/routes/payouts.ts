import { Router } from "express";
import {
  db,
  bookingsTable,
  usersTable,
  payoutMethodsTable,
  payoutRequestsTable,
} from "@workspace/db";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { requireAuth, requireAdmin, AuthRequest } from "../middleware/auth.js";
import { isValidSbpBankId, normalizeSbpPhone } from "../lib/sbp-banks.js";

const router = Router();

const num = (v: unknown): number => {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const MIN_PAYOUT_RUB = 500;

/**
 * Доступная к выводу сумма для владельца:
 *   sum(ownerPayout) for bookings WHERE ownerId=я AND status='completed' AND payoutSettledAt IS NULL
 *   - sum(amountRub) для активных payout_requests (pending/approved) этого владельца
 */
async function calcAvailable(ownerId: number): Promise<{
  available: number;
  totalEarned: number;
  pendingInRequests: number;
  eligibleBookings: { id: number; bookingNumber: string | null; ownerPayout: number; createdAt: Date }[];
}> {
  const completedRows = await db
    .select({
      id: bookingsTable.id,
      bookingNumber: bookingsTable.bookingNumber,
      ownerPayout: bookingsTable.ownerPayout,
      createdAt: bookingsTable.createdAt,
      payoutSettledAt: bookingsTable.payoutSettledAt,
      payoutRequestId: bookingsTable.payoutRequestId,
    })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.ownerId, ownerId),
        eq(bookingsTable.status, "completed"),
        eq(bookingsTable.protectionEnabled, true),
      ),
    );

  const totalEarned = completedRows.reduce((s, r) => s + num(r.ownerPayout), 0);
  const eligible = completedRows
    .filter((r) => r.payoutSettledAt == null && r.payoutRequestId == null)
    .map((r) => ({
      id: r.id,
      bookingNumber: r.bookingNumber,
      ownerPayout: Math.round(num(r.ownerPayout)),
      createdAt: r.createdAt,
    }));

  const eligibleSum = eligible.reduce((s, r) => s + r.ownerPayout, 0);

  const activeRequests = await db
    .select({ amountRub: payoutRequestsTable.amountRub })
    .from(payoutRequestsTable)
    .where(
      and(
        eq(payoutRequestsTable.ownerId, ownerId),
        sql`${payoutRequestsTable.status} IN ('pending','approved')`,
      ),
    );

  const pendingInRequests = activeRequests.reduce((s, r) => s + r.amountRub, 0);

  return {
    available: Math.max(0, eligibleSum - pendingInRequests),
    totalEarned: Math.round(totalEarned),
    pendingInRequests,
    eligibleBookings: eligible,
  };
}

// ─── PAYOUT METHODS (реквизиты владельца) ─────────────────────────────────────

router.get("/me/payout-methods", requireAuth, async (req: AuthRequest, res) => {
  const rows = await db
    .select()
    .from(payoutMethodsTable)
    .where(eq(payoutMethodsTable.userId, req.userId!))
    .orderBy(desc(payoutMethodsTable.isDefault), desc(payoutMethodsTable.createdAt));
  res.json({ methods: rows });
});

function validateMethod(body: unknown):
  | { ok: true; data: { type: "card"; cardNumber: string; cardHolderName: string; bankName?: string } }
  | { ok: true; data: { type: "sbp"; sbpPhone: string; sbpBank: string; cardHolderName: string } }
  | { ok: false; message: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  if (b.type === "card") {
    const cardNumber = typeof b.cardNumber === "string" ? b.cardNumber.trim() : "";
    const cardHolderName = typeof b.cardHolderName === "string" ? b.cardHolderName.trim() : "";
    const bankName = typeof b.bankName === "string" ? b.bankName.trim() : "";
    if (!/^[\d\s]{13,23}$/.test(cardNumber)) return { ok: false, message: "Неверный номер карты" };
    if (cardHolderName.length < 2 || cardHolderName.length > 100) return { ok: false, message: "Укажите ФИО получателя (2–100 символов)" };
    if (bankName.length > 100) return { ok: false, message: "Слишком длинное название банка" };
    return { ok: true, data: { type: "card", cardNumber, cardHolderName, bankName: bankName || undefined } };
  }
  if (b.type === "sbp") {
    // Stage 20b — нормализация телефона к +7XXXXXXXXXX и whitelist банков.
    const cardHolderName = typeof b.cardHolderName === "string" ? b.cardHolderName.trim() : "";
    const sbpPhone = normalizeSbpPhone(b.sbpPhone);
    if (!sbpPhone) return { ok: false, message: "Неверный номер телефона. Формат: +7 9XX XXX-XX-XX" };
    if (!isValidSbpBankId(b.sbpBank)) return { ok: false, message: "Выберите банк-получатель из списка" };
    if (cardHolderName.length < 2 || cardHolderName.length > 100) return { ok: false, message: "Укажите ФИО получателя" };
    return { ok: true, data: { type: "sbp", sbpPhone, sbpBank: b.sbpBank, cardHolderName } };
  }
  return { ok: false, message: "Неизвестный тип реквизитов" };
}

router.post("/me/payout-methods", requireAuth, async (req: AuthRequest, res) => {
  const parsed = validateMethod(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: "invalid_input", message: parsed.message });
    return;
  }
  const data = parsed.data;
  const userId = req.userId!;

  const existing = await db.select({ id: payoutMethodsTable.id }).from(payoutMethodsTable).where(eq(payoutMethodsTable.userId, userId));
  const isFirst = existing.length === 0;

  let insertData: typeof payoutMethodsTable.$inferInsert;
  if (data.type === "card") {
    const digits = data.cardNumber.replace(/\D/g, "");
    insertData = {
      userId,
      type: "card",
      cardLast4: digits.slice(-4),
      cardHolderName: data.cardHolderName,
      bankName: data.bankName ?? null,
      isDefault: isFirst,
    };
  } else {
    insertData = {
      userId,
      type: "sbp",
      sbpPhone: data.sbpPhone,
      sbpBank: data.sbpBank,
      cardHolderName: data.cardHolderName,
      isDefault: isFirst,
    };
  }

  // Stage 20b — partial unique index ловит дубль (sbp: userId+phone+bank, card: userId+last4+holder).
  // Возвращаем 409 с понятным сообщением, чтобы UI мог подсветить ошибку.
  try {
    const [created] = await db.insert(payoutMethodsTable).values(insertData).returning();
    res.json({ method: created });
  } catch (err: unknown) {
    // drizzle 0.45 оборачивает pg-error в DrizzleQueryError; реальный код в .cause.code.
    const e = err as { code?: string; cause?: { code?: string } };
    const code = e?.cause?.code ?? e?.code;
    if (code === "23505") {
      res.status(409).json({
        error: "duplicate_method",
        message: data.type === "sbp"
          ? "Такие СБП-реквизиты уже сохранены (тот же телефон и банк)"
          : "Такая карта уже сохранена (те же 4 цифры и ФИО)",
      });
      return;
    }
    throw err;
  }
});

router.patch("/me/payout-methods/:id/default", requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "invalid_id" });
    return;
  }
  const userId = req.userId!;

  const [existing] = await db
    .select()
    .from(payoutMethodsTable)
    .where(and(eq(payoutMethodsTable.id, id), eq(payoutMethodsTable.userId, userId)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  await db.transaction(async (tx) => {
    await tx
      .update(payoutMethodsTable)
      .set({ isDefault: false })
      .where(eq(payoutMethodsTable.userId, userId));
    await tx
      .update(payoutMethodsTable)
      .set({ isDefault: true })
      .where(eq(payoutMethodsTable.id, id));
  });
  res.json({ ok: true });
});

router.delete("/me/payout-methods/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "invalid_id" });
    return;
  }
  const userId = req.userId!;

  const [existing] = await db
    .select()
    .from(payoutMethodsTable)
    .where(and(eq(payoutMethodsTable.id, id), eq(payoutMethodsTable.userId, userId)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  // Запрет удаления, если этот метод используется в активной заявке
  const activeUsing = await db
    .select({ id: payoutRequestsTable.id })
    .from(payoutRequestsTable)
    .where(
      and(
        eq(payoutRequestsTable.payoutMethodId, id),
        sql`${payoutRequestsTable.status} IN ('pending','approved')`,
      ),
    );
  if (activeUsing.length > 0) {
    res.status(409).json({ error: "method_in_use", message: "Реквизиты используются в активной заявке на выплату" });
    return;
  }

  await db.delete(payoutMethodsTable).where(eq(payoutMethodsTable.id, id));

  // Если удалили дефолтный — назначить дефолтным самый свежий из оставшихся
  if (existing.isDefault) {
    const [next] = await db
      .select()
      .from(payoutMethodsTable)
      .where(eq(payoutMethodsTable.userId, userId))
      .orderBy(desc(payoutMethodsTable.createdAt))
      .limit(1);
    if (next) {
      await db
        .update(payoutMethodsTable)
        .set({ isDefault: true })
        .where(eq(payoutMethodsTable.id, next.id));
    }
  }
  res.json({ ok: true });
});

// ─── ME / PAYOUTS ────────────────────────────────────────────────────────────

router.get("/me/payouts", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const stats = await calcAvailable(userId);
  const requests = await db
    .select()
    .from(payoutRequestsTable)
    .where(eq(payoutRequestsTable.ownerId, userId))
    .orderBy(desc(payoutRequestsTable.createdAt));
  res.json({
    available: stats.available,
    totalEarned: stats.totalEarned,
    pendingInRequests: stats.pendingInRequests,
    eligibleBookings: stats.eligibleBookings,
    requests,
    minPayoutRub: MIN_PAYOUT_RUB,
  });
});

router.post("/me/payouts", requireAuth, async (req: AuthRequest, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const payoutMethodId = Number(body.payoutMethodId);
  const requestedAmount = body.amountRub != null ? Number(body.amountRub) : null;
  if (!Number.isInteger(payoutMethodId) || payoutMethodId <= 0) {
    res.status(400).json({ error: "invalid_input", message: "Не выбраны реквизиты" });
    return;
  }
  if (requestedAmount != null && (!Number.isFinite(requestedAmount) || requestedAmount <= 0)) {
    res.status(400).json({ error: "invalid_input", message: "Неверная сумма" });
    return;
  }
  const userId = req.userId!;

  // Реквизиты владельца
  const [method] = await db
    .select()
    .from(payoutMethodsTable)
    .where(and(eq(payoutMethodsTable.id, payoutMethodId), eq(payoutMethodsTable.userId, userId)))
    .limit(1);
  if (!method) {
    res.status(404).json({ error: "method_not_found" });
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

  // Сериализуемая транзакция: блокируем eligible-брони (FOR UPDATE) перед расчётом,
  // чтобы исключить race-condition при параллельных запросах одного владельца.
  let result: { ok: false; status: number; body: any } | { ok: true; request: any };
  try {
    result = await db.transaction(async (tx) => {
      // Блокируем строки eligible-броней
      const lockedRows = await tx.execute(sql`
        SELECT id, booking_number, owner_payout, created_at, payout_request_id
          FROM bookings
         WHERE owner_id = ${userId}
           AND status = 'completed'
           AND protection_enabled = true
           AND payout_settled_at IS NULL
           AND payout_request_id IS NULL
         FOR UPDATE
      `);
      const eligible = (lockedRows.rows as any[]).map((r) => ({
        id: Number(r.id),
        bookingNumber: r.booking_number as string | null,
        ownerPayout: Math.round(num(r.owner_payout)),
        createdAt: new Date(r.created_at),
      }));

      // Сумма активных заявок этого же владельца
      const activeRequests = await tx
        .select({ amountRub: payoutRequestsTable.amountRub })
        .from(payoutRequestsTable)
        .where(
          and(
            eq(payoutRequestsTable.ownerId, userId),
            sql`${payoutRequestsTable.status} IN ('pending','approved')`,
          ),
        );
      const pendingInRequests = activeRequests.reduce((s, r) => s + r.amountRub, 0);
      const eligibleSum = eligible.reduce((s, r) => s + r.ownerPayout, 0);
      const available = Math.max(0, eligibleSum - pendingInRequests);

      if (available < MIN_PAYOUT_RUB) {
        return {
          ok: false as const,
          status: 400,
          body: {
            error: "insufficient_funds",
            message: `Минимальная сумма для вывода — ${MIN_PAYOUT_RUB} ₽. Доступно: ${available} ₽.`,
          },
        };
      }
      if (eligible.length === 0) {
        return { ok: false as const, status: 400, body: { error: "no_eligible_bookings" } };
      }

      const requested = requestedAmount ?? available;
      if (requested > available) {
        return {
          ok: false as const,
          status: 400,
          body: {
            error: "amount_exceeds_available",
            message: `Запрошено ${requested} ₽, доступно ${available} ₽.`,
          },
        };
      }
      if (requested < MIN_PAYOUT_RUB) {
        return {
          ok: false as const,
          status: 400,
          body: { error: "amount_below_minimum", min: MIN_PAYOUT_RUB },
        };
      }

      const sorted = [...eligible].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const selected: typeof sorted = [];
      let acc = 0;
      for (const r of sorted) {
        if (acc >= requested) break;
        selected.push(r);
        acc += r.ownerPayout;
      }
      if (selected.length === 0) {
        return { ok: false as const, status: 400, body: { error: "no_eligible_bookings" } };
      }
      const finalAmount = acc;

      const [request] = await tx
        .insert(payoutRequestsTable)
        .values({
          ownerId: userId,
          amountRub: finalAmount,
          status: "pending",
          payoutMethodId: method.id,
          methodSnapshot: snapshot,
          bookingIds: selected.map((s) => s.id),
        })
        .returning();

      await tx
        .update(bookingsTable)
        .set({ payoutRequestId: request.id })
        .where(inArray(bookingsTable.id, selected.map((s) => s.id)));

      return { ok: true as const, request };
    });
  } catch (e: any) {
    res.status(500).json({ error: "transaction_failed", message: String(e?.message || e) });
    return;
  }

  if (!result.ok) {
    res.status(result.status).json(result.body);
    return;
  }
  res.json({ request: result.request });
});

// ─── ADMIN / PAYOUTS ─────────────────────────────────────────────────────────

router.get("/admin/payouts", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const status = (req.query.status as string) || "all";
  const allowed = ["all", "pending", "approved", "paid", "rejected"];
  if (!allowed.includes(status)) {
    res.status(400).json({ error: "invalid_status" });
    return;
  }

  const where = status === "all"
    ? undefined
    : eq(payoutRequestsTable.status, status as "pending" | "approved" | "paid" | "rejected");

  const rows = await db
    .select({
      request: payoutRequestsTable,
      ownerName: usersTable.name,
      ownerEmail: usersTable.email,
    })
    .from(payoutRequestsTable)
    .leftJoin(usersTable, eq(payoutRequestsTable.ownerId, usersTable.id))
    .where(where ?? sql`true`)
    .orderBy(desc(payoutRequestsTable.createdAt))
    .limit(200);

  res.json({
    requests: rows.map((r) => ({
      ...r.request,
      ownerName: r.ownerName,
      ownerEmail: r.ownerEmail,
    })),
  });
});

router.post("/admin/payouts/:id/approve", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const adminNote = typeof req.body?.adminNote === "string" ? req.body.adminNote.slice(0, 500) : null;

  const [request] = await db.select().from(payoutRequestsTable).where(eq(payoutRequestsTable.id, id)).limit(1);
  if (!request) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (request.status !== "pending") {
    res.status(409).json({ error: "invalid_state", current: request.status });
    return;
  }
  await db
    .update(payoutRequestsTable)
    .set({ status: "approved", adminNote, updatedAt: new Date() })
    .where(eq(payoutRequestsTable.id, id));
  res.json({ ok: true });
});

router.post("/admin/payouts/:id/mark-paid", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const b = (req.body ?? {}) as Record<string, unknown>;
  const paymentRef = typeof b.paymentRef === "string" ? b.paymentRef.trim() : "";
  const adminNote = typeof b.adminNote === "string" ? b.adminNote.slice(0, 500) : undefined;
  if (paymentRef.length < 2 || paymentRef.length > 200) {
    res.status(400).json({ error: "invalid_input", message: "Укажите номер банковского перевода / ссылку на чек (2–200 символов)" });
    return;
  }

  const [request] = await db.select().from(payoutRequestsTable).where(eq(payoutRequestsTable.id, id)).limit(1);
  if (!request) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (!["pending", "approved"].includes(request.status)) {
    res.status(409).json({ error: "invalid_state", current: request.status });
    return;
  }
  const bookingIds = (request.bookingIds as number[]) ?? [];
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(payoutRequestsTable)
      .set({
        status: "paid",
        paymentRef,
        adminNote: adminNote ?? request.adminNote,
        paidAt: now,
        updatedAt: now,
      })
      .where(eq(payoutRequestsTable.id, id));
    if (bookingIds.length > 0) {
      await tx
        .update(bookingsTable)
        .set({ payoutSettledAt: now })
        .where(inArray(bookingsTable.id, bookingIds));
    }
  });
  res.json({ ok: true });
});

router.post("/admin/payouts/:id/reject", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const b = (req.body ?? {}) as Record<string, unknown>;
  const rejectionReason = typeof b.rejectionReason === "string" ? b.rejectionReason.trim() : "";
  if (rejectionReason.length < 2 || rejectionReason.length > 500) {
    res.status(400).json({ error: "invalid_input", message: "Причина отклонения 2–500 символов" });
    return;
  }

  const [request] = await db.select().from(payoutRequestsTable).where(eq(payoutRequestsTable.id, id)).limit(1);
  if (!request) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (!["pending", "approved"].includes(request.status)) {
    res.status(409).json({ error: "invalid_state", current: request.status });
    return;
  }
  const bookingIds = (request.bookingIds as number[]) ?? [];

  await db.transaction(async (tx) => {
    await tx
      .update(payoutRequestsTable)
      .set({
        status: "rejected",
        rejectionReason,
        updatedAt: new Date(),
      })
      .where(eq(payoutRequestsTable.id, id));
    if (bookingIds.length > 0) {
      // Возвращаем брони в "доступные" (отвязываем от заявки)
      await tx
        .update(bookingsTable)
        .set({ payoutRequestId: null })
        .where(inArray(bookingsTable.id, bookingIds));
    }
  });
  res.json({ ok: true });
});

export default router;
