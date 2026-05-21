import { Router, type Response } from "express";
import { eq, and, inArray, sql, desc, asc, isNull } from "drizzle-orm";
import {
  db,
  poolsTable,
  poolSharesTable,
  shareOffersTable,
  usersTable,
  listingsTable,
  auditEventsTable,
  walletTransactionsTable,
  bookingsTable,
} from "@workspace/db";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { getPlatformSettings } from "../lib/platform-settings.js";
import { logger } from "../lib/logger.js";
import { recordAuditEvent } from "../lib/audit-events.js";
import { createNotification, genderedWord } from "../lib/notifications.js";

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
  /** ISO-дата дедлайна сбора (опционально). Если не указана — сбор бессрочный. */
  expiresAt: z.string().datetime({ offset: true }).optional().nullable(),
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

    const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;

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
        expiresAt,
      })
      .returning();

    res.status(201).json(created);

    // Stage 27 — audit log (после ответа, best-effort).
    void recordAuditEvent({
      entityType: "pool",
      entityId: created.id,
      actorId: req.userId!,
      eventType: "pool_created",
      metadata: {
        title: created.title,
        targetAmountRub: created.targetAmountRub,
        collectionMethod: created.collectionMethod,
      },
    });
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
        name: usersTable.name,
        avatar: usersTable.avatar,
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
        userName: usersTable.name,
        userAvatar: usersTable.avatar,
        userTrustScore: usersTable.trustScore,
      })
      .from(poolSharesTable)
      .leftJoin(usersTable, eq(poolSharesTable.userId, usersTable.id))
      .where(eq(poolSharesTable.poolId, id))
      .orderBy(desc(poolSharesTable.createdAt));

    const collected = await getCollectedAmount(id);

    // Stage 26: связанный listing (для расчёта остаточной стоимости на фронте).
    // Создаётся при активации пула (Stage 23c). До активации listing отсутствует.
    const [linkedListing] = await db
      .select({
        id: listingsTable.id,
        wearAndTearMeter: listingsTable.wearAndTearMeter,
        pricePerDay: listingsTable.pricePerDay,
        isAvailable: listingsTable.isAvailable,
        custodianId: listingsTable.custodianId,
      })
      .from(listingsTable)
      .where(eq(listingsTable.poolId, id))
      .limit(1);

    // Stage 25: открытые офферы вторичного рынка для этого пула.
    // Подтягиваются вместе с пулом, чтобы фронт за один запрос показал блок «Рынок долей».
    const offersRaw = await db
      .select({
        id: shareOffersTable.id,
        shareId: shareOffersTable.shareId,
        sellerId: shareOffersTable.sellerId,
        priceRub: shareOffersTable.priceRub,
        status: shareOffersTable.status,
        buyerId: shareOffersTable.buyerId,
        reservedAt: shareOffersTable.reservedAt,
        createdAt: shareOffersTable.createdAt,
        sharePercentage: poolSharesTable.sharePercentage,
        amountRub: poolSharesTable.amountRub,
        sellerName: usersTable.name,
        sellerAvatar: usersTable.avatar,
      })
      .from(shareOffersTable)
      .innerJoin(poolSharesTable, eq(shareOffersTable.shareId, poolSharesTable.id))
      .leftJoin(usersTable, eq(shareOffersTable.sellerId, usersTable.id))
      .where(and(eq(poolSharesTable.poolId, id), eq(shareOffersTable.status, "open")))
      .orderBy(desc(shareOffersTable.createdAt));

    // users.name — единое поле; разбиваем на firstName/lastName для UI.
    const splitName = (n: string | null) => {
      const trimmed = (n ?? "").trim();
      if (!trimmed) return { firstName: null, lastName: null };
      const [first, ...rest] = trimmed.split(/\s+/);
      return { firstName: first ?? null, lastName: rest.join(" ") || null };
    };
    const creatorParts = splitName(creator?.name ?? null);

    res.json({
      ...pool,
      creator: creator
        ? { id: creator.id, firstName: creatorParts.firstName, lastName: creatorParts.lastName, avatarUrl: creator.avatar }
        : null,
      collectedAmountRub: collected,
      // Stage 26: linked listing присутствует только если пул активирован
      // (status='active' и создан genesis-акт). До активации — null.
      listing: linkedListing ?? null,
      shares: sharesRaw.map((s) => ({
        id: s.id,
        userId: s.userId,
        userName: (s.userName ?? "").trim() || `Пользователь #${s.userId}`,
        userAvatarUrl: s.userAvatar,
        // Stage 29 — Trust Score участника, для бейджа в списке совладельцев.
        userTrustScore: s.userTrustScore ?? null,
        sharePercentage: s.sharePercentage,
        amountRub: s.amountRub,
        paymentStatus: s.paymentStatus,
        createdAt: s.createdAt,
      })),
      offers: offersRaw.map((o) => ({
        id: o.id,
        shareId: o.shareId,
        sellerId: o.sellerId,
        sellerName: (o.sellerName ?? "").trim() || `Пользователь #${o.sellerId}`,
        sellerAvatarUrl: o.sellerAvatar,
        priceRub: o.priceRub,
        status: o.status,
        sharePercentage: o.sharePercentage,
        amountRub: o.amountRub,
        buyerId: o.buyerId,
        reservedAt: o.reservedAt,
        createdAt: o.createdAt,
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

    // Stage 27 — audit + notify creator (best-effort, после ответа).
    void recordAuditEvent({
      entityType: "pool",
      entityId: id,
      actorId: req.userId!,
      eventType: "share_contributed",
      metadata: {
        shareId: created.id,
        amountRub: created.amountRub,
        sharePercentage: created.sharePercentage,
        paymentStatus: created.paymentStatus,
      },
    });
    if (paymentStatus === "user_transferred") {
      try {
        const [contributor] = await db
          .select({ name: usersTable.name })
          .from(usersTable)
          .where(eq(usersTable.id, req.userId!))
          .limit(1);
        const contributorName = (contributor?.name ?? "").trim();
        const who = contributorName || `Пользователь #${req.userId}`;
        const transferVerb = genderedWord(contributorName, "перевёл", "перевела");
        await createNotification({
          userId: pool.creatorId,
          type: "pool_share_received_funds",
          title: `${who} ${transferVerb} средства за долю`,
          message: `Откройте «${pool.title}» и подтвердите получение ${parsed.data.amountRub} ₽.`,
          listingTitle: pool.title,
        });
      } catch (err) {
        logger.error({ err, poolId: id }, "[pools] notify creator failed");
      }
    }
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

      // Уведомление дольщику: его взнос подтверждён создателем.
      void (async () => {
        try {
          await createNotification({
            userId: share.userId,
            type: "pool_share_confirmed",
            title: "Ваш взнос подтверждён!",
            message: `Инициатор пула «${pool.title}» подтвердил получение ${result.share.amountRub} ₽ — ваша доля зачислена.`,
            listingTitle: pool.title,
          });
        } catch (err) {
          logger.error({ err, poolId }, "[pools] notify contributor share_confirmed failed");
        }
      })();

      // Stage 27 — audit log + покликовые уведомления (best-effort).
      void recordAuditEvent({
        entityType: "pool",
        entityId: poolId,
        actorId: req.userId!,
        eventType: "share_confirmed",
        metadata: {
          shareId,
          ownerId: result.share.userId,
          amountRub: result.share.amountRub,
          sharePercentage: result.share.sharePercentage,
          collectedAfter: result.collected,
        },
      });

      // Если переход funding → purchasing — отдельное системное событие + push всем.
      if (pool.status === "funding" && result.pool.status === "purchasing") {
        void recordAuditEvent({
          entityType: "pool",
          entityId: poolId,
          actorId: null,
          eventType: "pool_purchasing",
          metadata: {
            collectedAmountRub: result.collected,
            targetAmountRub: pool.targetAmountRub,
          },
        });
        try {
          const stakeholderRows = await db
            .select({ userId: poolSharesTable.userId })
            .from(poolSharesTable)
            .where(eq(poolSharesTable.poolId, poolId));
          const recipients = new Set<number>(stakeholderRows.map((r) => r.userId));
          recipients.add(pool.creatorId); // creator тоже должен знать.
          for (const userId of recipients) {
            await createNotification({
              userId,
              type: "pool_purchasing",
              title: "Сбор завершён!",
              message: `Пул «${pool.title}» перешёл в стадию закупки.`,
              listingTitle: pool.title,
            });
          }
        } catch (err) {
          logger.error({ err, poolId }, "[pools] notify pool_purchasing failed");
        }
      }
    } catch (e) {
      logger.error({ err: e }, "POST /pools/:id/shares/:shareId/confirm failed");
      res.status(500).json({ error: "internal_error" });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// Stage 25 — Вторичный рынок долей (share_offers)
// ═══════════════════════════════════════════════════════════════════════════
//
// Жизненный цикл оффера:
//   1. POST /shares/:shareId/offers       → status='open',  buyer_id=NULL
//   2. POST /offers/:id/buy   (любой юзер) → status='open',  buyer_id=X (резерв)
//   3. POST /offers/:id/confirm-transfer (seller) → status='sold' + merge долей
//   4. POST /offers/:id/cancel (seller)    → status='canceled'
//
// Все мутации с TOCTOU-guard'ом (UPDATE … WHERE status=?) и атомарной транзакцией.
// На beta-этапе платежи P2P через СБП-реквизиты продавца; commercial (Stage 24) —
// эскроу через ЮKassa, поле seller_payment_details станет необязательным.

const createOfferBodySchema = z.object({
  priceRub: z.number().int().nonnegative().max(50_000_000),
  sellerPaymentDetails: z.string().trim().min(3).max(500),
});

// ── POST /api/pools/:id/shares/:shareId/offers — выставить долю на продажу ─
router.post(
  "/:id/shares/:shareId/offers",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const poolId = Number(req.params.id);
      const shareId = Number(req.params.shareId);
      if (
        !Number.isInteger(poolId) || poolId <= 0 ||
        !Number.isInteger(shareId) || shareId <= 0
      ) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }
      const parsed = createOfferBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_body", details: parsed.error.issues });
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
      if (share.userId !== req.userId!) {
        res.status(403).json({ error: "not_share_owner" });
        return;
      }
      // Продавать можно только реально оплаченную долю — иначе можно «продать»
      // фейковую запись и получить деньги за то, чего нет.
      if (!(["creator_confirmed", "escrow_held"] as const).includes(share.paymentStatus as any)) {
        res.status(409).json({
          error: "share_not_paid",
          message: "Долю нельзя продать, пока её оплата не подтверждена",
          currentStatus: share.paymentStatus,
        });
        return;
      }

      // Один открытый оффер на долю — иначе двойная продажа.
      const [openOffer] = await db
        .select({ id: shareOffersTable.id })
        .from(shareOffersTable)
        .where(and(eq(shareOffersTable.shareId, shareId), eq(shareOffersTable.status, "open")))
        .limit(1);
      if (openOffer) {
        res.status(409).json({ error: "offer_already_open", offerId: openOffer.id });
        return;
      }

      const [created] = await db
        .insert(shareOffersTable)
        .values({
          shareId,
          sellerId: req.userId!,
          priceRub: parsed.data.priceRub,
          sellerPaymentDetails: parsed.data.sellerPaymentDetails,
          status: "open",
        })
        .returning();

      res.status(201).json(created);

      // Stage 27 — audit log (best-effort).
      void recordAuditEvent({
        entityType: "pool",
        entityId: poolId,
        actorId: req.userId!,
        eventType: "offer_created",
        metadata: {
          offerId: created.id,
          shareId,
          priceRub: created.priceRub,
          sharePercentage: share.sharePercentage,
        },
      });
    } catch (e) {
      logger.error({ err: e }, "POST /pools/:id/shares/:shareId/offers failed");
      res.status(500).json({ error: "internal_error" });
    }
  },
);

// ── GET /api/pools/:id/offers — список открытых офферов пула ───────────────
router.get("/:id/offers", async (req, res) => {
  try {
    const poolId = Number(req.params.id);
    if (!Number.isInteger(poolId) || poolId <= 0) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }
    const rows = await db
      .select({
        id: shareOffersTable.id,
        shareId: shareOffersTable.shareId,
        sellerId: shareOffersTable.sellerId,
        priceRub: shareOffersTable.priceRub,
        status: shareOffersTable.status,
        buyerId: shareOffersTable.buyerId,
        reservedAt: shareOffersTable.reservedAt,
        createdAt: shareOffersTable.createdAt,
        sharePercentage: poolSharesTable.sharePercentage,
        amountRub: poolSharesTable.amountRub,
        sellerName: usersTable.name,
        sellerAvatar: usersTable.avatar,
      })
      .from(shareOffersTable)
      .innerJoin(poolSharesTable, eq(shareOffersTable.shareId, poolSharesTable.id))
      .leftJoin(usersTable, eq(shareOffersTable.sellerId, usersTable.id))
      .where(and(eq(poolSharesTable.poolId, poolId), eq(shareOffersTable.status, "open")))
      .orderBy(desc(shareOffersTable.createdAt));

    res.json(
      rows.map((o) => ({
        id: o.id,
        shareId: o.shareId,
        sellerId: o.sellerId,
        sellerName: (o.sellerName ?? "").trim() || `Пользователь #${o.sellerId}`,
        sellerAvatarUrl: o.sellerAvatar,
        priceRub: o.priceRub,
        status: o.status,
        sharePercentage: o.sharePercentage,
        amountRub: o.amountRub,
        buyerId: o.buyerId,
        reservedAt: o.reservedAt,
        createdAt: o.createdAt,
      })),
    );
  } catch (e) {
    logger.error({ err: e }, "GET /pools/:id/offers failed");
    res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/pools/:id/offers/:offerId/buy — резерв за покупателем ────────
//
// TOCTOU: атомарный UPDATE WHERE status='open' AND (buyer_id IS NULL OR reserved_at < NOW()-TTL).
// При параллельных нажатиях «Купить» победит ровно один — остальные получат 409.
// TTL предотвращает «вечную заморозку» оффера: если предыдущий buyer не перевёл деньги
// в течение RESERVATION_TTL_MIN минут, оффер автоматически освобождается, и любой
// другой buyer может его перехватить (без необходимости в cron-задаче).
const RESERVATION_TTL_MIN = 30;

router.post(
  "/:id/offers/:offerId/buy",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const poolId = Number(req.params.id);
      const offerId = Number(req.params.offerId);
      if (
        !Number.isInteger(poolId) || poolId <= 0 ||
        !Number.isInteger(offerId) || offerId <= 0
      ) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }

      const [offerWithShare] = await db
        .select({
          offer: shareOffersTable,
          sharePoolId: poolSharesTable.poolId,
        })
        .from(shareOffersTable)
        .innerJoin(poolSharesTable, eq(shareOffersTable.shareId, poolSharesTable.id))
        .where(eq(shareOffersTable.id, offerId))
        .limit(1);
      if (!offerWithShare) {
        res.status(404).json({ error: "offer_not_found" });
        return;
      }
      if (offerWithShare.sharePoolId !== poolId) {
        res.status(404).json({ error: "offer_not_in_pool" });
        return;
      }
      if (offerWithShare.offer.sellerId === req.userId!) {
        res.status(403).json({ error: "cannot_buy_own_offer" });
        return;
      }

      // Атомарная резервация — один UPDATE, никакой race-condition.
      // Свободно, если: buyer_id NULL ИЛИ резерв протух (старше TTL минут).
      const [reserved] = await db
        .update(shareOffersTable)
        .set({ buyerId: req.userId!, reservedAt: new Date() })
        .where(
          and(
            eq(shareOffersTable.id, offerId),
            eq(shareOffersTable.status, "open"),
            sql`(${shareOffersTable.buyerId} IS NULL OR ${shareOffersTable.reservedAt} < NOW() - (${RESERVATION_TTL_MIN} || ' minutes')::interval)`,
          ),
        )
        .returning();
      if (!reserved) {
        res.status(409).json({
          error: "offer_unavailable",
          message: "Этот оффер уже зарезервирован или закрыт",
        });
        return;
      }

      res.json({
        offer: reserved,
        sellerPaymentDetails: reserved.sellerPaymentDetails,
        instructions:
          "Переведите указанную сумму продавцу через СБП. После получения денег продавец подтвердит передачу доли.",
      });

      // Stage 27 — audit log + notify seller (best-effort).
      void recordAuditEvent({
        entityType: "pool",
        entityId: poolId,
        actorId: req.userId!,
        eventType: "offer_reserved",
        metadata: {
          offerId: reserved.id,
          sellerId: reserved.sellerId,
          buyerId: req.userId!,
          priceRub: reserved.priceRub,
        },
      });
      try {
        const [buyer] = await db
          .select({ name: usersTable.name })
          .from(usersTable)
          .where(eq(usersTable.id, req.userId!))
          .limit(1);
        const [poolRow] = await db
          .select({ title: poolsTable.title })
          .from(poolsTable)
          .where(eq(poolsTable.id, poolId))
          .limit(1);
        const who = (buyer?.name ?? "").trim() || `Пользователь #${req.userId}`;
        await createNotification({
          userId: reserved.sellerId,
          type: "pool_offer_reserved",
          title: `${who} хочет выкупить вашу долю`,
          message: `Ожидайте перевод ${reserved.priceRub} ₽ по СБП и подтвердите получение в карточке пула${poolRow ? ` «${poolRow.title}»` : ""}.`,
          listingTitle: poolRow?.title ?? null,
        });
      } catch (err) {
        logger.error({ err, offerId: reserved.id }, "[pools] notify seller failed");
      }
    } catch (e) {
      logger.error({ err: e }, "POST /pools/:id/offers/:offerId/buy failed");
      res.status(500).json({ error: "internal_error" });
    }
  },
);

// ── POST /api/pools/:id/offers/:offerId/confirm-transfer ───────────────────
//
// АТОМАРНАЯ ПЕРЕДАЧА ВЛАДЕНИЯ. Вызывает продавец после получения денег по СБП.
//
// Внутри транзакции:
//   1. UPDATE share_offers SET status='sold' WHERE id=X AND status='open' AND buyer_id IS NOT NULL
//      → TOCTOU-guard, защита от двойного confirm.
//   2. SELECT seller's pool_share (FOR UPDATE — берём свежие данные внутри tx).
//   3. SELECT buyer's existing share для этого пула (UNIQUE(pool_id, user_id)).
//      - Если есть: merge — увеличить процент/сумму у buyer, удалить долю seller.
//      - Если нет:  transfer — переписать user_id на buyer.
//
// Все шаги в одной db.transaction → либо всё, либо откат.
router.post(
  "/:id/offers/:offerId/confirm-transfer",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const poolId = Number(req.params.id);
      const offerId = Number(req.params.offerId);
      if (
        !Number.isInteger(poolId) || poolId <= 0 ||
        !Number.isInteger(offerId) || offerId <= 0
      ) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }

      // Pre-check (для понятных ошибок до транзакции). Авторитативная проверка — внутри tx.
      const [pre] = await db
        .select({
          offer: shareOffersTable,
          sharePoolId: poolSharesTable.poolId,
        })
        .from(shareOffersTable)
        .innerJoin(poolSharesTable, eq(shareOffersTable.shareId, poolSharesTable.id))
        .where(eq(shareOffersTable.id, offerId))
        .limit(1);
      if (!pre) {
        res.status(404).json({ error: "offer_not_found" });
        return;
      }
      if (pre.sharePoolId !== poolId) {
        res.status(404).json({ error: "offer_not_in_pool" });
        return;
      }
      if (pre.offer.sellerId !== req.userId!) {
        res.status(403).json({ error: "only_seller_can_confirm" });
        return;
      }
      if (pre.offer.status !== "open") {
        res.status(409).json({ error: "offer_not_open", currentStatus: pre.offer.status });
        return;
      }
      if (!pre.offer.buyerId) {
        res.status(409).json({
          error: "no_buyer_reserved",
          message: "Никто ещё не нажал «Купить» — резерва нет",
        });
        return;
      }

      const result = await db.transaction(async (tx) => {
        // 1. Атомарный TOCTOU перевод status → 'sold'.
        const [sold] = await tx
          .update(shareOffersTable)
          .set({ status: "sold" })
          .where(
            and(
              eq(shareOffersTable.id, offerId),
              eq(shareOffersTable.status, "open"),
              eq(shareOffersTable.sellerId, req.userId!),
            ),
          )
          .returning();
        if (!sold || !sold.buyerId) {
          throw Object.assign(new Error("invalid_transition"), {
            httpStatus: 409,
            httpBody: { error: "invalid_transition", message: "Оффер уже изменён" },
          });
        }

        // 2. Свежие данные доли продавца внутри tx.
        const [sellerShare] = await tx
          .select()
          .from(poolSharesTable)
          .where(eq(poolSharesTable.id, sold.shareId))
          .limit(1);
        if (!sellerShare) {
          throw Object.assign(new Error("share_not_found"), {
            httpStatus: 409,
            httpBody: { error: "share_not_found" },
          });
        }
        if (sellerShare.userId !== sold.sellerId) {
          // Продавец уже не владелец (например, кто-то другой объединил доли) —
          // безопасно откатываем.
          throw Object.assign(new Error("seller_no_longer_owns_share"), {
            httpStatus: 409,
            httpBody: { error: "seller_no_longer_owns_share" },
          });
        }

        // 3. Существующая доля у покупателя в этом же пуле?
        const [buyerExisting] = await tx
          .select()
          .from(poolSharesTable)
          .where(
            and(
              eq(poolSharesTable.poolId, sellerShare.poolId),
              eq(poolSharesTable.userId, sold.buyerId),
            ),
          )
          .limit(1);

        let mergedShare: typeof sellerShare;
        let mergeMode: "merge" | "transfer";

        if (buyerExisting) {
          mergeMode = "merge";
          // Складываем проценты с DECIMAL-точностью (numeric(5,2)) — на стороне SQL.
          const [updated] = await tx
            .update(poolSharesTable)
            .set({
              sharePercentage: sql`${poolSharesTable.sharePercentage} + ${sellerShare.sharePercentage}`,
              amountRub: sql`${poolSharesTable.amountRub} + ${sellerShare.amountRub}`,
            })
            .where(eq(poolSharesTable.id, buyerExisting.id))
            .returning();
          // Удаляем долю продавца — UNIQUE(pool_id, user_id) не нарушится.
          await tx.delete(poolSharesTable).where(eq(poolSharesTable.id, sellerShare.id));
          mergedShare = updated!;
        } else {
          mergeMode = "transfer";
          const [updated] = await tx
            .update(poolSharesTable)
            .set({ userId: sold.buyerId })
            .where(eq(poolSharesTable.id, sellerShare.id))
            .returning();
          mergedShare = updated!;
        }

        return { offer: sold, share: mergedShare, mergeMode };
      });

      res.json(result);

      // Stage 27 — audit log + notify buyer (best-effort).
      void recordAuditEvent({
        entityType: "pool",
        entityId: poolId,
        actorId: req.userId!,
        eventType: "share_transferred",
        metadata: {
          offerId,
          sellerId: result.offer.sellerId,
          buyerId: result.offer.buyerId,
          priceRub: result.offer.priceRub,
          mergeMode: result.mergeMode,
          shareId: result.share.id,
          sharePercentage: result.share.sharePercentage,
        },
      });
      try {
        const [poolRow] = await db
          .select({ title: poolsTable.title })
          .from(poolsTable)
          .where(eq(poolsTable.id, poolId))
          .limit(1);
        if (result.offer.buyerId) {
          const [seller] = await db
            .select({ name: usersTable.name })
            .from(usersTable)
            .where(eq(usersTable.id, req.userId!))
            .limit(1);
          const sellerName = (seller?.name ?? "").trim();
          const confirmVerb = genderedWord(sellerName, "подтвердил", "подтвердила");
          await createNotification({
            userId: result.offer.buyerId,
            type: "pool_share_received",
            title: "Доля перешла к вам!",
            message: `Продавец ${confirmVerb} получение средств в пуле${poolRow ? ` «${poolRow.title}»` : ""}. Доля теперь ваша.`,
            listingTitle: poolRow?.title ?? null,
          });
        }
      } catch (err) {
        logger.error({ err, offerId }, "[pools] notify buyer failed");
      }
    } catch (e: any) {
      if (e?.httpStatus && e?.httpBody) {
        res.status(e.httpStatus).json(e.httpBody);
        return;
      }
      logger.error({ err: e }, "POST /pools/:id/offers/:offerId/confirm-transfer failed");
      res.status(500).json({ error: "internal_error" });
    }
  },
);

// ── POST /api/pools/:id/offers/:offerId/cancel — продавец отменяет оффер ───
router.post(
  "/:id/offers/:offerId/cancel",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const poolId = Number(req.params.id);
      const offerId = Number(req.params.offerId);
      if (
        !Number.isInteger(poolId) || poolId <= 0 ||
        !Number.isInteger(offerId) || offerId <= 0
      ) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }

      const [pre] = await db
        .select({
          offer: shareOffersTable,
          sharePoolId: poolSharesTable.poolId,
        })
        .from(shareOffersTable)
        .innerJoin(poolSharesTable, eq(shareOffersTable.shareId, poolSharesTable.id))
        .where(eq(shareOffersTable.id, offerId))
        .limit(1);
      if (!pre) {
        res.status(404).json({ error: "offer_not_found" });
        return;
      }
      if (pre.sharePoolId !== poolId) {
        res.status(404).json({ error: "offer_not_in_pool" });
        return;
      }
      if (pre.offer.sellerId !== req.userId!) {
        res.status(403).json({ error: "only_seller_can_cancel" });
        return;
      }

      const [canceled] = await db
        .update(shareOffersTable)
        .set({ status: "canceled", buyerId: null, reservedAt: null })
        .where(
          and(
            eq(shareOffersTable.id, offerId),
            eq(shareOffersTable.status, "open"),
          ),
        )
        .returning();
      if (!canceled) {
        res.status(409).json({ error: "invalid_transition", currentStatus: pre.offer.status });
        return;
      }

      res.json({ offer: canceled });

      // Stage 27 — audit log (best-effort).
      void recordAuditEvent({
        entityType: "pool",
        entityId: poolId,
        actorId: req.userId!,
        eventType: "offer_canceled",
        metadata: {
          offerId,
          priceRub: canceled.priceRub,
        },
      });
    } catch (e) {
      logger.error({ err: e }, "POST /pools/:id/offers/:offerId/cancel failed");
      res.status(500).json({ error: "internal_error" });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// Stage 27 — Co-Sharing Transparency: история событий пула
// ═══════════════════════════════════════════════════════════════════════════
//
// Публичный endpoint (без auth) — история операций пула в хронологическом
// порядке. Используется блоком «История событий» в карточке пула.
//
// Возвращает события из audit_events (Stage 27), которые относятся к пулу:
//   - entity_type='pool' AND entity_id=:id
// + плюс: события офферов, привязанные к этому пулу через metadata.offerId
//   (на текущем этапе все наши offer-события пишутся как entity_type='pool',
//   так что отдельной выборки по 'offer' пока не требуется).
router.get("/:id/events", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));

    const rows = await db
      .select({
        id: auditEventsTable.id,
        eventType: auditEventsTable.eventType,
        actorId: auditEventsTable.actorId,
        metadata: auditEventsTable.metadata,
        createdAt: auditEventsTable.createdAt,
        actorName: usersTable.name,
        actorAvatar: usersTable.avatar,
      })
      .from(auditEventsTable)
      .leftJoin(usersTable, eq(auditEventsTable.actorId, usersTable.id))
      .where(
        and(
          eq(auditEventsTable.entityType, "pool"),
          eq(auditEventsTable.entityId, id),
        ),
      )
      .orderBy(asc(auditEventsTable.createdAt))
      .limit(limit);

    res.json(
      rows.map((r) => ({
        id: r.id,
        eventType: r.eventType,
        actorId: r.actorId,
        actorName: r.actorId ? ((r.actorName ?? "").trim() || `Пользователь #${r.actorId}`) : null,
        actorAvatarUrl: r.actorAvatar,
        metadata: r.metadata,
        createdAt: r.createdAt,
      })),
    );
  } catch (e) {
    logger.error({ err: e }, "GET /pools/:id/events failed");
    res.status(500).json({ error: "internal_error" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Stage 26-B — GET /api/pools/:id/shares/:shareId/suggested-price
// ═══════════════════════════════════════════════════════════════════════════
//
// Серверное «зеркало» формулы остаточной стоимости из `lib/pricing.ts`.
// Source of truth для SellShareModal: фронт всё ещё умеет считать сам
// (UX-fallback при сетевой ошибке), но нормальный путь — взять цифру отсюда,
// чтобы admin-настройка `depreciation_per_rental_percent` не дрейфовала.
//
// Формула:
//   sharePct        = share.amountRub / pool.targetAmountRub      (доля в исходной стоимости)
//   shareInitialRub = pool.targetAmountRub × sharePct = share.amountRub
//   residualPerWear = max(0.1, 1 − meter × depPct/100)
//   suggestedRub    = round(shareInitialRub × residualPerWear)
//
// Никакой приватной информации — открыто всем (без auth), как и pool/shares
// в режиме чтения.
//
router.get("/:id/shares/:shareId/suggested-price", async (req, res) => {
  const poolId = Number.parseInt(req.params.id as string, 10);
  const shareId = Number.parseInt(req.params.shareId as string, 10);
  if (!Number.isFinite(poolId) || poolId <= 0 || !Number.isFinite(shareId) || shareId <= 0) {
    res.status(400).json({ error: "bad_request" });
    return;
  }

  try {
    const [share] = await db
      .select({
        id: poolSharesTable.id,
        poolId: poolSharesTable.poolId,
        amountRub: poolSharesTable.amountRub,
      })
      .from(poolSharesTable)
      .where(and(eq(poolSharesTable.id, shareId), eq(poolSharesTable.poolId, poolId)))
      .limit(1);
    if (!share) {
      res.status(404).json({ error: "share_not_found" });
      return;
    }

    const [pool] = await db
      .select({
        id: poolsTable.id,
        targetAmountRub: poolsTable.targetAmountRub,
      })
      .from(poolsTable)
      .where(eq(poolsTable.id, poolId))
      .limit(1);
    if (!pool) {
      res.status(404).json({ error: "pool_not_found" });
      return;
    }

    // Связанный листинг — есть только когда пул активирован (status='active').
    // До активации wear=0, depreciationPercent игнорируется → suggested = amountRub.
    const [listing] = await db
      .select({ wearAndTearMeter: listingsTable.wearAndTearMeter })
      .from(listingsTable)
      .where(eq(listingsTable.poolId, poolId))
      .limit(1);

    const settings = await getPlatformSettings();
    const depPct = Math.max(0, settings.depreciationPerRentalPercent ?? 1);
    const meter = Math.max(0, listing?.wearAndTearMeter ?? 0);

    const FLOOR_RATIO = 0.1;
    const residualRatio = Math.max(FLOOR_RATIO, 1 - (meter * depPct) / 100);
    const sharePct = pool.targetAmountRub > 0 ? share.amountRub / pool.targetAmountRub : 0;
    const shareInitialRub = share.amountRub; // == pool.targetAmountRub × sharePct
    const suggestedRub = Math.round(shareInitialRub * residualRatio);
    const depreciationPercent = Math.round((1 - residualRatio) * 100);

    res.json({
      poolId,
      shareId,
      shareInitialRub,
      sharePct: Math.round(sharePct * 10000) / 100, // bp → %
      wearAndTearMeter: meter,
      depreciationPerRentalPercent: depPct,
      depreciationPercent,
      residualRatio: Math.round(residualRatio * 10000) / 10000,
      suggestedRub,
      currency: "RUB",
    });
  } catch (e) {
    logger.error({ err: e }, "GET /pools/:id/shares/:shareId/suggested-price failed");
    res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/pools/:id/income ───────────────────────────────────────────────
// История распределения дохода с аренды пула по дольщикам.
// Доступна любому авторизованному пользователю (дольщику или создателю).
router.get("/:id/income", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }

    const [pool] = await db.select({ id: poolsTable.id, creatorId: poolsTable.creatorId, maintenanceFundBalance: poolsTable.maintenanceFundBalance })
      .from(poolsTable).where(eq(poolsTable.id, id)).limit(1);
    if (!pool) {
      res.status(404).json({ error: "pool_not_found" });
      return;
    }

    // Только участники пула или создатель могут видеть доходы
    const userId = req.userId!;
    const myShare = await db.select({ id: poolSharesTable.id })
      .from(poolSharesTable)
      .where(and(eq(poolSharesTable.poolId, id), eq(poolSharesTable.userId, userId)))
      .limit(1);
    const isAdmin = (req as any).userRole === "admin";
    if (pool.creatorId !== userId && myShare.length === 0 && !isAdmin) {
      res.status(403).json({ error: "forbidden" });
      return;
    }

    // Связанный листинг пула
    const [listing] = await db
      .select({ id: listingsTable.id })
      .from(listingsTable)
      .where(eq(listingsTable.poolId, id))
      .limit(1);

    if (!listing) {
      res.json({ entries: [], totalDistributed: 0, maintenanceTotal: 0, maintenanceFundBalance: parseFloat(String(pool.maintenanceFundBalance ?? "0")) });
      return;
    }

    // Все транзакции pool_rental по брониям этого листинга
    const result = await db.execute(sql`
      SELECT
        wt.id,
        wt.user_id       AS "userId",
        wt.amount,
        wt.type,
        wt.reference_id  AS "bookingId",
        wt.booking_number AS "bookingNumber",
        wt.description,
        wt.created_at    AS "createdAt",
        u.name           AS "userName"
      FROM wallet_transactions wt
      LEFT JOIN users u ON u.id = wt.user_id
      INNER JOIN bookings b ON b.id = wt.reference_id
      WHERE wt.reference_type = 'pool_rental'
        AND b.listing_id = ${listing.id}
      ORDER BY wt.created_at DESC
      LIMIT 300
    `);

    const rows = result.rows as Array<{
      id: number; userId: number; amount: string; type: string;
      bookingId: number; bookingNumber: string | null; description: string | null;
      createdAt: string; userName: string | null;
    }>;

    // Суммарные итоги
    const totalDistributed = rows
      .filter(r => r.type === "payout")
      .reduce((s, r) => s + parseFloat(r.amount ?? "0"), 0);
    const maintenanceTotal = rows
      .filter(r => r.type === "commission")
      .reduce((s, r) => s + parseFloat(r.amount ?? "0"), 0);

    // Группировка по брони
    const byBooking = new Map<number, {
      bookingId: number; bookingNumber: string | null;
      date: string; distributions: Array<{ userId: number; userName: string | null; amount: number; description: string | null }>;
      maintenanceCut: number; total: number;
    }>();

    for (const row of rows) {
      const key = row.bookingId;
      if (!byBooking.has(key)) {
        byBooking.set(key, { bookingId: key, bookingNumber: row.bookingNumber, date: row.createdAt, distributions: [], maintenanceCut: 0, total: 0 });
      }
      const entry = byBooking.get(key)!;
      if (row.type === "payout") {
        entry.distributions.push({ userId: row.userId, userName: row.userName, amount: parseFloat(row.amount), description: row.description });
        entry.total += parseFloat(row.amount);
      } else if (row.type === "commission") {
        entry.maintenanceCut += parseFloat(row.amount);
      }
    }

    res.json({
      entries: Array.from(byBooking.values()),
      totalDistributed: Math.round(totalDistributed * 100) / 100,
      maintenanceTotal: Math.round(maintenanceTotal * 100) / 100,
      maintenanceFundBalance: parseFloat(String(pool.maintenanceFundBalance ?? "0")),
    });
  } catch (e) {
    logger.error({ err: e }, "GET /pools/:id/income failed");
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;
