import { Router, type Response } from "express";
import { eq, and, inArray, sql, desc } from "drizzle-orm";
import {
  db,
  poolsTable,
  poolSharesTable,
  usersTable,
} from "@workspace/db";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { getPlatformSettings } from "../lib/platform-settings.js";
import { logger } from "../lib/logger.js";

const router = Router();

/**
 * Stage 23b — Co-Sharing UI & P2P Funding (Beta).
 *
 * 5 endpoints поверх Stage 23a-схемы (pools, pool_shares):
 *   GET  /api/pools                              — список пулов (фильтр ?status=)
 *   POST /api/pools                              — создать пул (auth)
 *   GET  /api/pools/:id                          — детали + доли + creator
 *   POST /api/pools/:id/shares                   — внести долю (auth, статус 'user_transferred')
 *   POST /api/pools/:id/shares/:shareId/confirm  — creator подтверждает (auth, → 'creator_confirmed')
 *
 * Stage 23c (НЕ в этом этапе): авто-листинг при pools.status='active',
 * динамический Хранитель через Цифровой Акт, secondary-маркет долей.
 */

// ── helpers ────────────────────────────────────────────────────────────────

/**
 * Сумма «реально собранных» средств — только creator_confirmed (СБП p2p) +
 * escrow_held (commercial ЮKassa). pending/user_transferred НЕ учитываются —
 * это «обещано», но деньги ещё не у инициатора.
 */
const COLLECTED_STATUSES = ["creator_confirmed", "escrow_held"] as const;

async function getCollectedAmount(poolId: number): Promise<number> {
  const [row] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${poolSharesTable.amountRub}), 0)::text`,
    })
    .from(poolSharesTable)
    .where(
      and(
        eq(poolSharesTable.poolId, poolId),
        inArray(poolSharesTable.paymentStatus, COLLECTED_STATUSES as any),
      ),
    );
  return Number(row?.total ?? 0);
}

// ── GET /api/pools ─────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const status = String(req.query.status ?? "funding");
    const allowed = new Set(["funding", "purchasing", "active", "liquidated", "canceled"]);
    if (!allowed.has(status)) {
      res.status(400).json({ error: "invalid_status" });
      return;
    }

    const rows = await db
      .select({
        id: poolsTable.id,
        title: poolsTable.title,
        description: poolsTable.description,
        itemUrl: poolsTable.itemUrl,
        targetAmountRub: poolsTable.targetAmountRub,
        collectionMethod: poolsTable.collectionMethod,
        procurementStrategy: poolsTable.procurementStrategy,
        status: poolsTable.status,
        creatorId: poolsTable.creatorId,
        createdAt: poolsTable.createdAt,
        expiresAt: poolsTable.expiresAt,
      })
      .from(poolsTable)
      .where(eq(poolsTable.status, status as any))
      .orderBy(desc(poolsTable.createdAt))
      .limit(100);

    if (rows.length === 0) {
      res.json([]);
      return;
    }

    // Один batched-select собранных сумм по всем пулам страницы
    const ids = rows.map((r) => r.id);
    const sums = await db
      .select({
        poolId: poolSharesTable.poolId,
        total: sql<string>`COALESCE(SUM(${poolSharesTable.amountRub}), 0)::text`,
      })
      .from(poolSharesTable)
      .where(
        and(
          inArray(poolSharesTable.poolId, ids),
          inArray(poolSharesTable.paymentStatus, COLLECTED_STATUSES as any),
        ),
      )
      .groupBy(poolSharesTable.poolId);

    const sumByPool = new Map(sums.map((s) => [s.poolId, Number(s.total)]));

    res.json(
      rows.map((r) => ({
        ...r,
        collectedAmountRub: sumByPool.get(r.id) ?? 0,
      })),
    );
  } catch (e) {
    logger.error({ err: e }, "GET /pools failed");
    res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/pools ────────────────────────────────────────────────────────
const createBodySchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional().nullable(),
  itemUrl: z
    .string()
    .max(2000)
    .optional()
    .nullable()
    .refine(
      (v) => {
        if (!v) return true;
        try {
          const u = new URL(v);
          return u.protocol === "http:" || u.protocol === "https:";
        } catch {
          return false;
        }
      },
      { message: "itemUrl должен быть http(s) URL" },
    ),
  targetAmountRub: z.number().int().positive().max(50_000_000),
  creatorPaymentDetails: z.string().min(3).max(500),
});

router.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = createBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body", details: parsed.error.issues });
      return;
    }
    const settings = await getPlatformSettings();
    const commercial = settings.isCommercialMode === true;

    // В Beta форсируем p2p_direct и self_managed (минимум ручной работы платформы).
    // Stage 23c добавит escrow + concierge при коммерческом режиме.
    const collectionMethod = commercial ? "platform_escrow" : "p2p_direct";
    const procurementStrategy = "self_managed" as const;

    // creator_payment_details обязателен только при p2p_direct
    if (collectionMethod === "p2p_direct" && !parsed.data.creatorPaymentDetails.trim()) {
      res.status(400).json({ error: "payment_details_required" });
      return;
    }

    const [created] = await db
      .insert(poolsTable)
      .values({
        creatorId: req.userId!,
        title: parsed.data.title.trim(),
        description: parsed.data.description?.trim() || null,
        itemUrl: parsed.data.itemUrl?.trim() || null,
        targetAmountRub: parsed.data.targetAmountRub,
        collectionMethod,
        procurementStrategy,
        creatorPaymentDetails:
          collectionMethod === "p2p_direct" ? parsed.data.creatorPaymentDetails.trim() : null,
      })
      .returning();

    res.status(201).json(created);
  } catch (e) {
    logger.error({ err: e }, "POST /pools failed");
    res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/pools/:id ─────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }
    const [pool] = await db.select().from(poolsTable).where(eq(poolsTable.id, id)).limit(1);
    if (!pool) {
      res.status(404).json({ error: "pool_not_found" });
      return;
    }

    const [creator] = await db
      .select({
        id: usersTable.id,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        avatarUrl: usersTable.avatarUrl,
      })
      .from(usersTable)
      .where(eq(usersTable.id, pool.creatorId))
      .limit(1);

    const sharesRaw = await db
      .select({
        id: poolSharesTable.id,
        userId: poolSharesTable.userId,
        sharePercentage: poolSharesTable.sharePercentage,
        amountRub: poolSharesTable.amountRub,
        paymentStatus: poolSharesTable.paymentStatus,
        createdAt: poolSharesTable.createdAt,
        userFirstName: usersTable.firstName,
        userLastName: usersTable.lastName,
        userAvatarUrl: usersTable.avatarUrl,
      })
      .from(poolSharesTable)
      .leftJoin(usersTable, eq(poolSharesTable.userId, usersTable.id))
      .where(eq(poolSharesTable.poolId, id))
      .orderBy(desc(poolSharesTable.createdAt));

    const collected = await getCollectedAmount(id);

    res.json({
      ...pool,
      creator: creator ?? null,
      collectedAmountRub: collected,
      shares: sharesRaw.map((s) => ({
        id: s.id,
        userId: s.userId,
        userName: [s.userFirstName, s.userLastName].filter(Boolean).join(" ") || `Пользователь #${s.userId}`,
        userAvatarUrl: s.userAvatarUrl,
        sharePercentage: s.sharePercentage,
        amountRub: s.amountRub,
        paymentStatus: s.paymentStatus,
        createdAt: s.createdAt,
      })),
    });
  } catch (e) {
    logger.error({ err: e }, "GET /pools/:id failed");
    res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/pools/:id/shares — «я перевёл деньги» ────────────────────────
const contributeBodySchema = z.object({
  amountRub: z.number().int().positive().max(50_000_000),
});

router.post("/:id/shares", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }
    const parsed = contributeBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body", details: parsed.error.issues });
      return;
    }

    const [pool] = await db.select().from(poolsTable).where(eq(poolsTable.id, id)).limit(1);
    if (!pool) {
      res.status(404).json({ error: "pool_not_found" });
      return;
    }
    if (pool.status !== "funding") {
      res.status(409).json({ error: "pool_not_funding", message: "Сбор уже закрыт" });
      return;
    }
    // Creator не может вносить долю в собственный пул — иначе он мог бы сам себе
    // подтвердить перевод и фейково набить 100% сбора. Stage 23c пересмотрит,
    // если введём «creator-as-keeper» с явной долей; пока запрещено.
    if (pool.creatorId === req.userId!) {
      res.status(403).json({
        error: "creator_cannot_contribute",
        message: "Инициатор не может вносить долю в собственный пул",
      });
      return;
    }

    // Один user = одна доля (UNIQUE(pool_id, user_id) на уровне БД).
    const [existing] = await db
      .select()
      .from(poolSharesTable)
      .where(and(eq(poolSharesTable.poolId, id), eq(poolSharesTable.userId, req.userId!)))
      .limit(1);
    if (existing) {
      res.status(409).json({ error: "share_already_exists", shareId: existing.id });
      return;
    }

    // share_percentage = amount / target * 100, округлено до 2 знаков.
    const sharePercent = Math.min(
      100,
      Math.round((parsed.data.amountRub / pool.targetAmountRub) * 10000) / 100,
    );
    if (sharePercent <= 0) {
      res.status(400).json({ error: "invalid_amount" });
      return;
    }

    // Beta p2p: пользователь нажал «я перевёл» → user_transferred (ждём подтверждения creator).
    // Commercial escrow (Stage 23c): сразу escrow_held после успешного charge на ЮKassa.
    const settings = await getPlatformSettings();
    const isP2P = pool.collectionMethod === "p2p_direct";
    const paymentStatus = isP2P || !settings.isCommercialMode ? "user_transferred" : "user_transferred";

    const [created] = await db
      .insert(poolSharesTable)
      .values({
        poolId: id,
        userId: req.userId!,
        sharePercentage: sharePercent.toFixed(2),
        amountRub: parsed.data.amountRub,
        paymentStatus,
      })
      .returning();

    res.status(201).json(created);
  } catch (e) {
    logger.error({ err: e }, "POST /pools/:id/shares failed");
    res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/pools/:id/shares/:shareId/confirm — creator confirms ─────────
router.post(
  "/:id/shares/:shareId/confirm",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const poolId = Number(req.params.id);
      const shareId = Number(req.params.shareId);
      if (!Number.isInteger(poolId) || poolId <= 0 || !Number.isInteger(shareId) || shareId <= 0) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }

      const [pool] = await db.select().from(poolsTable).where(eq(poolsTable.id, poolId)).limit(1);
      if (!pool) {
        res.status(404).json({ error: "pool_not_found" });
        return;
      }
      if (pool.creatorId !== req.userId!) {
        res.status(403).json({ error: "only_creator_can_confirm" });
        return;
      }

      const [share] = await db
        .select()
        .from(poolSharesTable)
        .where(and(eq(poolSharesTable.id, shareId), eq(poolSharesTable.poolId, poolId)))
        .limit(1);
      if (!share) {
        res.status(404).json({ error: "share_not_found" });
        return;
      }
      if (share.paymentStatus !== "user_transferred") {
        res.status(409).json({
          error: "share_not_transferred",
          message: "Эту долю нельзя подтвердить — статус не 'user_transferred'",
          currentStatus: share.paymentStatus,
        });
        return;
      }

      // Атомарно: апдейт + проверка прогресса в одной транзакции.
      const result = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(poolSharesTable)
          .set({ paymentStatus: "creator_confirmed" })
          .where(eq(poolSharesTable.id, shareId))
          .returning();

        const [sumRow] = await tx
          .select({
            total: sql<string>`COALESCE(SUM(${poolSharesTable.amountRub}), 0)::text`,
          })
          .from(poolSharesTable)
          .where(
            and(
              eq(poolSharesTable.poolId, poolId),
              inArray(poolSharesTable.paymentStatus, COLLECTED_STATUSES as any),
            ),
          );
        const collected = Number(sumRow?.total ?? 0);

        let poolUpdated = pool;
        if (collected >= pool.targetAmountRub && pool.status === "funding") {
          const [p] = await tx
            .update(poolsTable)
            .set({ status: "purchasing" })
            .where(and(eq(poolsTable.id, poolId), eq(poolsTable.status, "funding")))
            .returning();
          if (p) poolUpdated = p;
        }

        return { share: updated, collected, pool: poolUpdated };
      });

      res.json(result);
    } catch (e) {
      logger.error({ err: e }, "POST /pools/:id/shares/:shareId/confirm failed");
      res.status(500).json({ error: "internal_error" });
    }
  },
);

export default router;
