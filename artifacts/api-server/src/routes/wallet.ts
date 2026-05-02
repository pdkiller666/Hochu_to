import { Router } from "express";
import { db } from "@workspace/db";
import { walletsTable, walletTransactionsTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth.js";
import { getPlatformSettings } from "../lib/platform-settings.js";
import { getOrCreateWallet } from "../lib/escrow.js";

const router = Router();

/**
 * GET /wallet/balance
 * Возвращает баланс кошелька текущего пользователя.
 * Доступно только при isCommercialMode=true (fintech beta gate).
 */
router.get("/balance", requireAuth, async (req: AuthRequest, res) => {
  const settings = await getPlatformSettings();
  if (!settings.isCommercialMode) {
    return res.status(403).json({
      error: "fintech_disabled",
      message: "Кошелёк доступен только в коммерческом режиме",
    });
  }
  const wallet = await getOrCreateWallet(req.userId!);
  res.json({
    availableBalance: parseFloat(wallet.availableBalance ?? "0"),
    frozenBalance: parseFloat(wallet.frozenBalance ?? "0"),
    currency: wallet.currency,
    updatedAt: wallet.updatedAt,
  });
});

/**
 * GET /wallet/history
 * История транзакций текущего пользователя (последние 50).
 * Доступно только при isCommercialMode=true.
 */
router.get("/history", requireAuth, async (req: AuthRequest, res) => {
  const settings = await getPlatformSettings();
  if (!settings.isCommercialMode) {
    return res.status(403).json({
      error: "fintech_disabled",
      message: "Кошелёк доступен только в коммерческом режиме",
    });
  }
  const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 200);
  const transactions = await db
    .select()
    .from(walletTransactionsTable)
    .where(eq(walletTransactionsTable.userId, req.userId!))
    .orderBy(desc(walletTransactionsTable.createdAt))
    .limit(limit);

  res.json(transactions.map((t) => ({
    id: t.id,
    amount: parseFloat(t.amount ?? "0"),
    platformCommission: parseFloat(t.platformCommission ?? "0"),
    type: t.type,
    status: t.status,
    referenceId: t.referenceId,
    referenceType: t.referenceType,
    description: t.description,
    createdAt: t.createdAt,
  })));
});

// ─── Admin endpoints ──────────────────────────────────────────────────────────

/**
 * GET /wallet/admin/users/:userId/balance
 * Баланс кошелька конкретного пользователя (superadmin).
 */
router.get(
  "/admin/users/:userId/balance",
  requireAuth,
  requireRole("superadmin", "admin"),
  async (req: AuthRequest, res) => {
    const userId = parseInt(req.params.userId as string);
    if (isNaN(userId)) return res.status(400).json({ error: "invalid_user_id" });

    const rows = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, userId))
      .limit(1);

    if (rows.length === 0) {
      return res.json({ userId, availableBalance: 0, frozenBalance: 0, currency: "RUB", exists: false });
    }
    const w = rows[0];
    res.json({
      userId,
      availableBalance: parseFloat(w.availableBalance ?? "0"),
      frozenBalance: parseFloat(w.frozenBalance ?? "0"),
      currency: w.currency,
      exists: true,
      updatedAt: w.updatedAt,
    });
  }
);

/**
 * GET /wallet/admin/payouts
 * Список последних транзакций типа payout (superadmin).
 */
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

    res.json(payouts.map((t) => ({
      id: t.id,
      userId: t.userId,
      amount: parseFloat(t.amount ?? "0"),
      platformCommission: parseFloat(t.platformCommission ?? "0"),
      referenceId: t.referenceId,
      referenceType: t.referenceType,
      description: t.description,
      createdAt: t.createdAt,
    })));
  }
);

/**
 * GET /wallet/admin/stats
 * Сводная статистика кошельков (superadmin).
 */
router.get(
  "/admin/stats",
  requireAuth,
  requireRole("superadmin"),
  async (req: AuthRequest, res) => {
    const settings = await getPlatformSettings();

    const allWallets = await db.select().from(walletsTable);
    const totalAvailable = allWallets.reduce((s, w) => s + parseFloat(w.availableBalance ?? "0"), 0);
    const totalFrozen = allWallets.reduce((s, w) => s + parseFloat(w.frozenBalance ?? "0"), 0);

    const commissions = await db
      .select()
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.type, "commission"));
    const totalCommission = commissions.reduce((s, t) => s + parseFloat(t.platformCommission ?? "0"), 0);

    res.json({
      walletsCount: allWallets.length,
      totalAvailableBalance: parseFloat(totalAvailable.toFixed(2)),
      totalFrozenBalance: parseFloat(totalFrozen.toFixed(2)),
      totalPlatformCommission: parseFloat(totalCommission.toFixed(2)),
      paymentProvider: settings.paymentProvider,
      isCommercialMode: settings.isCommercialMode,
    });
  }
);

export default router;
