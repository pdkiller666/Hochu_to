import { Router } from "express";
import { db } from "@workspace/db";
import { walletsTable, walletTransactionsTable, bookingsTable } from "@workspace/db/schema";
import { eq, desc, and, sql, or, lt, gt } from "drizzle-orm";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth.js";
import { getPlatformSettings } from "../lib/platform-settings.js";
import { getOrCreateWallet } from "../lib/escrow.js";
import { createPayment, YooKassaConfigError, YooKassaApiError } from "../lib/yookassa.js";
import { createNotification } from "../lib/notifications.js";
import { logger } from "../lib/logger.js";

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtWallet(w: typeof walletsTable.$inferSelect) {
  return {
    availableBalance: parseFloat(w.availableBalance ?? "0"),
    frozenBalance: parseFloat(w.frozenBalance ?? "0"),
    currency: w.currency,
    updatedAt: w.updatedAt,
  };
}

function fmtTx(t: typeof walletTransactionsTable.$inferSelect) {
  return {
    id: t.id,
    amount: parseFloat(t.amount ?? "0"),
    platformCommission: parseFloat(t.platformCommission ?? "0"),
    type: t.type,
    status: t.status,
    referenceId: t.referenceId,
    referenceType: t.referenceType,
    bookingNumber: t.bookingNumber,
    description: t.description,
    createdAt: t.createdAt,
  };
}

// ─── GET /wallet/balance ──────────────────────────────────────────────────────

router.get("/balance", requireAuth, async (req: AuthRequest, res) => {
  const wallet = await getOrCreateWallet(req.userId!);
  res.json(fmtWallet(wallet));
});

// ─── GET /wallet/history ──────────────────────────────────────────────────────
// Поддерживает пагинацию: ?limit=20&before=<id>&type=hold|release|commission|payout|refund|topup|withdraw

router.get("/history", requireAuth, async (req: AuthRequest, res) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "30")), 100);
  const beforeId = req.query.before ? parseInt(String(req.query.before)) : null;
  const typeFilter = req.query.type ? String(req.query.type) : null;

  const conditions = [eq(walletTransactionsTable.userId, req.userId!)];
  if (beforeId && !isNaN(beforeId)) {
    conditions.push(lt(walletTransactionsTable.id, beforeId));
  }
  if (typeFilter) {
    conditions.push(eq(walletTransactionsTable.type, typeFilter));
  }

  const transactions = await db
    .select()
    .from(walletTransactionsTable)
    .where(and(...conditions))
    .orderBy(desc(walletTransactionsTable.id))
    .limit(limit + 1);

  const hasMore = transactions.length > limit;
  const items = transactions.slice(0, limit);
  const nextBefore = hasMore ? items[items.length - 1].id : null;

  res.json({
    items: items.map(fmtTx),
    hasMore,
    nextBefore,
  });
});

// ─── POST /wallet/topup ───────────────────────────────────────────────────────
// Mock-режим: зачисляем сразу. ЮKassa-режим: создаём платёж, отдаём redirect URL.

router.post("/topup", requireAuth, async (req: AuthRequest, res) => {
  const { amountRub, returnUrl } = req.body as { amountRub?: number; returnUrl?: string };

  if (!amountRub || typeof amountRub !== "number" || amountRub < 10 || amountRub > 500_000) {
    return res.status(400).json({
      error: "invalid_amount",
      message: "Сумма пополнения должна быть от 10 до 500 000 ₽",
    });
  }

  const settings = await getPlatformSettings();
  const userId = req.userId!;

  // Mock-режим: виртуальное пополнение
  if (!settings.isCommercialMode || settings.paymentProvider === "mock") {
    await db.transaction(async (tx) => {
      const rows = await tx.execute(
        sql`SELECT * FROM wallets WHERE user_id = ${userId} FOR UPDATE`
      );
      let wallet = (rows.rows as any[])[0];
      let currentBalance = 0;

      if (!wallet) {
        await tx.insert(walletsTable).values({ userId, availableBalance: "0", frozenBalance: "0" });
      } else {
        currentBalance = parseFloat(wallet.available_balance ?? "0");
      }

      await tx
        .update(walletsTable)
        .set({
          availableBalance: (currentBalance + amountRub).toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(walletsTable.userId, userId));

      await tx.insert(walletTransactionsTable).values({
        userId,
        amount: amountRub.toFixed(2),
        platformCommission: "0",
        type: "topup",
        status: "completed",
        referenceType: "topup",
        description: `Пополнение кошелька на ${amountRub.toLocaleString("ru-RU")} ₽ (тестовый режим)`,
      });
    });

    await createNotification({
      userId,
      type: "wallet_topup",
      title: "Кошелёк пополнен",
      message: `Пополнение на ${amountRub.toLocaleString("ru-RU")} ₽ зачислено`,
      link: "/dashboard",
    }).catch(() => {});

    const wallet = await getOrCreateWallet(userId);
    return res.json({
      mode: "mock",
      message: "Кошелёк пополнен (тестовый режим)",
      ...fmtWallet(wallet),
    });
  }

  // ЮKassa-режим: создаём платёж
  try {
    const frontendBase = process.env.FRONTEND_URL?.trim() ||
      (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://localhost:5000");
    const resolvedReturnUrl = returnUrl || `${frontendBase}/dashboard?tab=wallet&topup=success`;

    const result = await createPayment({
      amountRub,
      description: `Пополнение кошелька Хочу_То на ${amountRub.toLocaleString("ru-RU")} ₽`,
      returnUrl: resolvedReturnUrl,
      capture: true,
      metadata: { target_type: "wallet_topup", user_id: userId },
    });

    // Создаём pending-транзакцию, вебхук её завершит
    await db.insert(walletTransactionsTable).values({
      userId,
      amount: amountRub.toFixed(2),
      platformCommission: "0",
      type: "topup",
      status: "pending",
      referenceType: "topup",
      description: `Пополнение кошелька на ${amountRub.toLocaleString("ru-RU")} ₽`,
    });

    return res.json({
      mode: "yookassa",
      confirmationUrl: result.confirmationUrl,
      paymentId: result.payment.id,
    });
  } catch (e: any) {
    logger.error({ err: e }, "wallet topup YooKassa error");
    const status = e instanceof YooKassaConfigError ? 503 : (e instanceof YooKassaApiError ? 502 : 500);
    return res.status(status).json({
      error: e?.name ?? "payment_error",
      message: e?.message ?? "Ошибка при создании платежа",
    });
  }
});

// ─── POST /wallet/withdraw ────────────────────────────────────────────────────
// Запрос на вывод средств с кошелька (создаёт payout_request у текущего пользователя)

router.post("/withdraw", requireAuth, async (req: AuthRequest, res) => {
  const { amountRub, payoutMethodId } = req.body as { amountRub?: number; payoutMethodId?: number };

  if (!amountRub || typeof amountRub !== "number" || amountRub < 100) {
    return res.status(400).json({
      error: "invalid_amount",
      message: "Минимальная сумма вывода — 100 ₽",
    });
  }
  if (!payoutMethodId || typeof payoutMethodId !== "number") {
    return res.status(400).json({
      error: "missing_method",
      message: "Укажите реквизиты для вывода",
    });
  }

  const userId = req.userId!;

  // Проверяем баланс с блокировкой
  let txResult: { newBalance: number; payoutId: number | undefined } | null = null;
  try {
    txResult = await db.transaction(async (tx) => {
      const rows = await tx.execute(
        sql`SELECT * FROM wallets WHERE user_id = ${userId} FOR UPDATE`
      );
      const wallet = (rows.rows as any[])[0];
      if (!wallet) {
        throw Object.assign(new Error("Кошелёк пуст — нечего выводить"), { code: "no_wallet" });
      }
      const available = parseFloat(wallet.available_balance ?? "0");
      if (available < amountRub) {
        throw Object.assign(new Error(`Недостаточно средств. Доступно: ${available.toFixed(2)} ₽`), { code: "insufficient_funds" });
      }

      const methodRows = await tx.execute(
        sql`SELECT * FROM payout_methods WHERE id = ${payoutMethodId} AND user_id = ${userId} LIMIT 1`
      );
      const methodRow = (methodRows.rows as any[])?.[0];
      if (!methodRow) {
        throw Object.assign(new Error("Реквизиты не найдены"), { code: "method_not_found" });
      }

      await tx
        .update(walletsTable)
        .set({ availableBalance: (available - amountRub).toFixed(2), updatedAt: new Date() })
        .where(eq(walletsTable.userId, userId));

      await tx.insert(walletTransactionsTable).values({
        userId,
        amount: amountRub.toFixed(2),
        platformCommission: "0",
        type: "withdraw",
        status: "pending",
        referenceType: "withdraw",
        description: `Вывод ${amountRub.toLocaleString("ru-RU")} ₽ (ожидает обработки)`,
      });

      const methodSnapshot = {
        type: methodRow.type,
        cardLast4: methodRow.card_last4,
        cardHolderName: methodRow.card_holder_name,
        bankName: methodRow.bank_name,
        sbpPhone: methodRow.sbp_phone,
        sbpBank: methodRow.sbp_bank,
      };

      const payoutRes = await tx.execute(
        sql`INSERT INTO payout_requests (owner_id, amount_rub, status, method_snapshot, booking_ids, created_at, updated_at)
            VALUES (${userId}, ${amountRub}, 'pending', ${JSON.stringify(methodSnapshot)}::jsonb, '{}', NOW(), NOW())
            RETURNING id`
      );

      return { newBalance: available - amountRub, payoutId: (payoutRes.rows as any[])?.[0]?.id };
    });
  } catch (e: any) {
    if (e?.code) {
      return res.status(400).json({ error: e.code, message: e.message });
    }
    logger.error({ err: e }, "wallet withdraw error");
    return res.status(500).json({ error: "withdraw_failed", message: "Ошибка при создании заявки на вывод" });
  }

  await createNotification({
    userId,
    type: "wallet_withdraw",
    title: "Заявка на вывод создана",
    message: `Вывод ${amountRub.toLocaleString("ru-RU")} ₽ — обработка до 3 рабочих дней`,
    link: "/dashboard",
  }).catch(() => {});

  return res.json({
    success: true,
    message: "Заявка на вывод создана. Обработка — до 3 рабочих дней.",
    newAvailableBalance: parseFloat(txResult!.newBalance.toFixed(2)),
    payoutRequestId: txResult!.payoutId,
  });
});

// ─── GET /wallet/escrow-summary ───────────────────────────────────────────────
// Список активных заморозок по броням текущего пользователя

router.get("/escrow-summary", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;

  // Броня в статусах confirmed/active/return_pending имеет заморозку
  const activeBookings = await db
    .select({
      id: bookingsTable.id,
      bookingNumber: bookingsTable.bookingNumber,
      status: bookingsTable.status,
      startDate: bookingsTable.startDate,
      endDate: bookingsTable.endDate,
      totalPrice: bookingsTable.totalPrice,
      depositAmount: bookingsTable.depositAmount,
    })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.renterId, userId),
        sql`${bookingsTable.status} IN ('confirmed', 'active', 'return_pending')`
      )
    )
    .orderBy(desc(bookingsTable.id))
    .limit(20);

  res.json(activeBookings.map((b) => ({
    bookingId: b.id,
    bookingNumber: b.bookingNumber,
    status: b.status,
    startDate: b.startDate,
    endDate: b.endDate,
    frozenAmount: parseFloat(String(b.totalPrice ?? "0")),
    depositAmount: parseFloat(String(b.depositAmount ?? "0")),
  })));
});

// ─── Admin endpoints ──────────────────────────────────────────────────────────

router.get(
  "/admin/users/:userId/balance",
  requireAuth,
  requireRole("superadmin", "admin"),
  async (req: AuthRequest, res) => {
    const userId = parseInt(req.params.userId as string);
    if (isNaN(userId)) return res.status(400).json({ error: "invalid_user_id" });

    const rows = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).limit(1);
    if (rows.length === 0) {
      return res.json({ userId, availableBalance: 0, frozenBalance: 0, currency: "RUB", exists: false });
    }
    const w = rows[0];
    return res.json({ userId, ...fmtWallet(w), exists: true });
  }
);

router.get(
  "/admin/payouts",
  requireAuth,
  requireRole("superadmin", "admin"),
  async (req: AuthRequest, res) => {
    const limit = Math.min(parseInt(String(req.query.limit ?? "100")), 500);
    const payouts = await db
      .select()
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.type, "payout"))
      .orderBy(desc(walletTransactionsTable.createdAt))
      .limit(limit);

    res.json(payouts.map(fmtTx));
  }
);

router.get(
  "/admin/stats",
  requireAuth,
  requireRole("superadmin"),
  async (req: AuthRequest, res) => {
    const settings = await getPlatformSettings();

    const allWallets = await db.select().from(walletsTable);
    const totalAvailable = allWallets.reduce((s, w) => s + parseFloat(w.availableBalance ?? "0"), 0);
    const totalFrozen = allWallets.reduce((s, w) => s + parseFloat(w.frozenBalance ?? "0"), 0);

    const commRows = await db.execute(
      sql`SELECT COALESCE(SUM(platform_commission::numeric), 0) AS total FROM wallet_transactions WHERE type = 'commission'`
    ) as any;
    const totalCommission = parseFloat((commRows?.rows ?? commRows)?.[0]?.total ?? "0");

    const txRows = await db.execute(
      sql`SELECT type, COUNT(*) AS cnt, COALESCE(SUM(amount::numeric), 0) AS vol FROM wallet_transactions GROUP BY type`
    ) as any;

    return res.json({
      walletsCount: allWallets.length,
      totalAvailableBalance: parseFloat(totalAvailable.toFixed(2)),
      totalFrozenBalance: parseFloat(totalFrozen.toFixed(2)),
      totalPlatformCommission: parseFloat(totalCommission.toFixed(2)),
      paymentProvider: settings.paymentProvider,
      isCommercialMode: settings.isCommercialMode,
      txBreakdown: ((txRows?.rows ?? txRows) as Array<{ type: string; cnt: string; vol: string }>) ?? [],
    });
  }
);

export default router;
