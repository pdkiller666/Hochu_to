import { Router, type Response } from "express";
import { eq, and, sql, desc, ne } from "drizzle-orm";
import {
  db,
  poolsTable,
  poolSharesTable,
  buyoutRequestsTable,
  buyoutParticipantsTable,
  usersTable,
  listingsTable,
} from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { getPlatformSettings } from "../lib/platform-settings.js";
import { logger } from "../lib/logger.js";
import { recordAuditEvent } from "../lib/audit-events.js";
import { createNotification, genderedWord } from "../lib/notifications.js";

const router = Router();

/**
 * Stage 28 — Полный выкуп пула (Co-Sharing Buyout).
 *
 * Сценарий:
 *   1. Инициатор (любой совладелец) видит «Выкупить весь пул целиком».
 *   2. Сервер считает справедливые выплаты остальным = residualValue × sharePct/100.
 *   3. Создаётся buyout_request + N buyout_participants (по одному на каждого co-owner-не-инициатора).
 *   4. Каждый участник в своём UI видит «X хочет выкупить вашу долю за Y₽» и нажимает «Согласиться»
 *      → ему показываются СБП-реквизиты инициатора. Это чистый UI (статус не меняется).
 *   5. Инициатор после перевода нажимает «Я перевёл деньги участнику Z» → status='user_transferred'.
 *   6. Участник, получив деньги, нажимает «Деньги получил» → атомарная транзакция:
 *      - status участника → 'confirmed'
 *      - его доля удаляется из pool_shares
 *      - доля инициатора увеличивается на sharePercentage и amountRub
 *      - если суммарный share инициатора достиг 100% (с учётом DECIMAL-погрешности)
 *        → пул ликвидируется, listing.pool_id=NULL, listing.custodian_id=initiator.
 *   7. Инициатор может отменить buyout (POST /cancel) — пока ни один participant не confirmed.
 */

// ── helpers ─────────────────────────────────────────────────────────────────

/**
 * Расчёт текущего residualRatio пула (см. GET /pools/:id/shares/:shareId/suggested-price).
 * Зеркало формулы: residual = max(FLOOR, 1 − meter × pct/100).
 * До активации пула (нет привязанного listing) wear=0 → ratio=1.
 */
async function calculateResidualRatio(poolId: number): Promise<number> {
  const [listing] = await db
    .select({ wearAndTearMeter: listingsTable.wearAndTearMeter })
    .from(listingsTable)
    .where(eq(listingsTable.poolId, poolId))
    .limit(1);

  const settings = await getPlatformSettings();
  const depPct = Math.max(0, settings.depreciationPerRentalPercent ?? 1);
  const meter = Math.max(0, listing?.wearAndTearMeter ?? 0);
  const FLOOR_RATIO = 0.1;
  return Math.max(FLOOR_RATIO, 1 - (meter * depPct) / 100);
}

/**
 * Считает итоговый share инициатора (в процентах numeric(5,2)) после потенциального merge.
 * Используется для проверки «достиг ли 100%».
 */
function isFullOwnership(percentageStr: string): boolean {
  // numeric(5,2) → строка вида "100.00". Сравниваем с 99.99 для запаса по плавающей DECIMAL-погрешности.
  const num = Number.parseFloat(percentageStr);
  return Number.isFinite(num) && num >= 99.99;
}

// ── POST /api/pools/:poolId/buyout — создать запрос на выкуп ────────────────

router.post("/pools/:poolId/buyout", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const poolId = Number.parseInt(req.params.poolId as string, 10);
    if (!Number.isInteger(poolId) || poolId <= 0) {
      res.status(400).json({ error: "invalid_pool_id" });
      return;
    }
    const initiatorId = req.userId!;

    // ── Pre-checks ────────────────────────────────────────────────────────
    const [pool] = await db
      .select()
      .from(poolsTable)
      .where(eq(poolsTable.id, poolId))
      .limit(1);
    if (!pool) {
      res.status(404).json({ error: "pool_not_found" });
      return;
    }
    if (pool.status === "liquidated" || pool.status === "canceled") {
      res.status(409).json({ error: "pool_not_active", currentStatus: pool.status });
      return;
    }

    // Все доли пула.
    const allShares = await db
      .select()
      .from(poolSharesTable)
      .where(eq(poolSharesTable.poolId, poolId));

    const initiatorShare = allShares.find((s) => s.userId === initiatorId);
    if (!initiatorShare) {
      res.status(403).json({ error: "not_a_co_owner", message: "У вас нет доли в этом пуле" });
      return;
    }

    const otherShares = allShares.filter((s) => s.userId !== initiatorId);
    if (otherShares.length === 0) {
      res.status(409).json({
        error: "already_sole_owner",
        message: "Вы уже единственный совладелец — выкупать некого",
      });
      return;
    }

    // Нет ли активного buyout-запроса на этот пул?
    const [existing] = await db
      .select({ id: buyoutRequestsTable.id, initiatorId: buyoutRequestsTable.initiatorId })
      .from(buyoutRequestsTable)
      .where(and(eq(buyoutRequestsTable.poolId, poolId), eq(buyoutRequestsTable.status, "pending")))
      .limit(1);
    if (existing) {
      res.status(409).json({
        error: "buyout_already_active",
        message: "На этот пул уже есть активный запрос на выкуп",
        existingBuyoutId: existing.id,
        existingInitiatorId: existing.initiatorId,
      });
      return;
    }

    // ── Расчёт payout per participant ─────────────────────────────────────
    const residualRatio = await calculateResidualRatio(poolId);
    const targetAmountRub = pool.targetAmountRub;

    const participantsToInsert = otherShares.map((sh) => {
      const sharePct = Number.parseFloat(sh.sharePercentage);
      // priceRub = residualValue × sharePct/100, где residualValue = targetAmount × residualRatio.
      // Эквивалентно: amountRub × residualRatio (т.к. amountRub = targetAmount × sharePct/100).
      const priceRub = Math.round(sh.amountRub * residualRatio);
      return {
        userId: sh.userId,
        shareId: sh.id,
        sharePercentage: sh.sharePercentage,
        shareAmountRub: sh.amountRub,
        priceRub,
        sharePctNum: sharePct,
      };
    });

    // ── Транзакция: создаём request + participants атомарно ───────────────
    const result = await db.transaction(async (tx) => {
      const [request] = await tx
        .insert(buyoutRequestsTable)
        .values({ poolId, initiatorId, status: "pending" })
        .returning();
      if (!request) {
        throw new Error("failed_to_create_buyout_request");
      }

      const insertedParticipants = await tx
        .insert(buyoutParticipantsTable)
        .values(
          participantsToInsert.map((p) => ({
            buyoutRequestId: request.id,
            userId: p.userId,
            shareId: p.shareId,
            sharePercentage: p.sharePercentage,
            shareAmountRub: p.shareAmountRub,
            priceRub: p.priceRub,
            status: "pending_approval" as const,
          })),
        )
        .returning();

      return { request, participants: insertedParticipants };
    });

    const totalPayout = result.participants.reduce((s, p) => s + p.priceRub, 0);
    res.status(201).json({
      buyoutRequest: result.request,
      participants: result.participants,
      summary: {
        residualRatio: Math.round(residualRatio * 10000) / 10000,
        totalPayoutRub: totalPayout,
        participantsCount: result.participants.length,
        targetAmountRub,
      },
    });

    // ── Audit + notify (post-commit, best-effort) ─────────────────────────
    void recordAuditEvent({
      entityType: "pool",
      entityId: poolId,
      actorId: initiatorId,
      eventType: "buyout_requested",
      metadata: {
        buyoutRequestId: result.request.id,
        residualRatio: Math.round(residualRatio * 10000) / 10000,
        totalPayoutRub: totalPayout,
        participantsCount: result.participants.length,
      },
    });

    try {
      const [initiator] = await db
        .select({ name: usersTable.name })
        .from(usersTable)
        .where(eq(usersTable.id, initiatorId))
        .limit(1);
      const who = (initiator?.name ?? "").trim() || `Пользователь #${initiatorId}`;
      for (const p of result.participants) {
        await createNotification({
          userId: p.userId,
          type: "pool_buyout_requested",
          title: `${who} хочет выкупить вашу долю`,
          message: `За вашу долю (${p.sharePercentage}%) предлагается ${p.priceRub} ₽ — пул «${pool.title}». Откройте карточку пула, чтобы согласиться.`,
          listingTitle: pool.title,
        });
      }
    } catch (err) {
      logger.error({ err, buyoutRequestId: result.request.id }, "[buyouts] notify participants failed");
    }
  } catch (e: any) {
    // Partial unique violation = race с другим запросом
    if (e?.code === "23505") {
      res.status(409).json({ error: "buyout_already_active" });
      return;
    }
    logger.error({ err: e }, "POST /pools/:poolId/buyout failed");
    res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/pools/:poolId/buyout — текущий активный (или последний) запрос ─

router.get("/pools/:poolId/buyout", async (req, res) => {
  try {
    const poolId = Number.parseInt(req.params.poolId as string, 10);
    if (!Number.isInteger(poolId) || poolId <= 0) {
      res.status(400).json({ error: "invalid_pool_id" });
      return;
    }

    // Последний по created_at (не обязательно pending — UI хочет видеть и завершённые).
    const [request] = await db
      .select({
        id: buyoutRequestsTable.id,
        poolId: buyoutRequestsTable.poolId,
        initiatorId: buyoutRequestsTable.initiatorId,
        status: buyoutRequestsTable.status,
        createdAt: buyoutRequestsTable.createdAt,
        initiatorName: usersTable.name,
        initiatorPaymentDetails: poolsTable.creatorPaymentDetails,
      })
      .from(buyoutRequestsTable)
      .leftJoin(usersTable, eq(usersTable.id, buyoutRequestsTable.initiatorId))
      .leftJoin(poolsTable, eq(poolsTable.id, buyoutRequestsTable.poolId))
      .where(eq(buyoutRequestsTable.poolId, poolId))
      .orderBy(desc(buyoutRequestsTable.createdAt))
      .limit(1);
    if (!request) {
      res.json({ buyoutRequest: null, participants: [] });
      return;
    }

    const participants = await db
      .select({
        id: buyoutParticipantsTable.id,
        userId: buyoutParticipantsTable.userId,
        userName: usersTable.name,
        shareId: buyoutParticipantsTable.shareId,
        sharePercentage: buyoutParticipantsTable.sharePercentage,
        shareAmountRub: buyoutParticipantsTable.shareAmountRub,
        priceRub: buyoutParticipantsTable.priceRub,
        status: buyoutParticipantsTable.status,
        createdAt: buyoutParticipantsTable.createdAt,
      })
      .from(buyoutParticipantsTable)
      .leftJoin(usersTable, eq(usersTable.id, buyoutParticipantsTable.userId))
      .where(eq(buyoutParticipantsTable.buyoutRequestId, request.id))
      .orderBy(buyoutParticipantsTable.id);

    res.json({ buyoutRequest: request, participants });
  } catch (e) {
    logger.error({ err: e }, "GET /pools/:poolId/buyout failed");
    res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/buyouts/:requestId/participants/:participantId/mark-transferred ─
// Инициатор подтверждает: «я перевёл этому участнику деньги».
// Status pending_approval → user_transferred.

router.post(
  "/buyouts/:requestId/participants/:participantId/mark-transferred",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const requestId = Number.parseInt(req.params.requestId as string, 10);
      const participantId = Number.parseInt(req.params.participantId as string, 10);
      if (
        !Number.isInteger(requestId) || requestId <= 0 ||
        !Number.isInteger(participantId) || participantId <= 0
      ) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }

      const [request] = await db
        .select()
        .from(buyoutRequestsTable)
        .where(eq(buyoutRequestsTable.id, requestId))
        .limit(1);
      if (!request) {
        res.status(404).json({ error: "buyout_not_found" });
        return;
      }
      if (request.initiatorId !== req.userId!) {
        res.status(403).json({ error: "only_initiator_can_mark_transferred" });
        return;
      }
      if (request.status !== "pending") {
        res.status(409).json({ error: "buyout_not_pending", currentStatus: request.status });
        return;
      }

      // Атомарный переход pending_approval → user_transferred.
      const [updated] = await db
        .update(buyoutParticipantsTable)
        .set({ status: "user_transferred" })
        .where(
          and(
            eq(buyoutParticipantsTable.id, participantId),
            eq(buyoutParticipantsTable.buyoutRequestId, requestId),
            eq(buyoutParticipantsTable.status, "pending_approval"),
          ),
        )
        .returning();
      if (!updated) {
        res.status(409).json({
          error: "invalid_transition",
          message: "Участник уже в другом статусе или не найден",
        });
        return;
      }

      res.json({ participant: updated });

      // Notify participant + audit.
      void recordAuditEvent({
        entityType: "pool",
        entityId: request.poolId,
        actorId: req.userId!,
        eventType: "buyout_transferred",
        metadata: { buyoutRequestId: requestId, participantId, priceRub: updated.priceRub },
      });
      try {
        const [poolRow] = await db
          .select({ title: poolsTable.title })
          .from(poolsTable)
          .where(eq(poolsTable.id, request.poolId))
          .limit(1);
        const [initiator] = await db
          .select({ name: usersTable.name })
          .from(usersTable)
          .where(eq(usersTable.id, req.userId!))
          .limit(1);
        const initiatorName = (initiator?.name ?? "").trim();
        const who = initiatorName || `Пользователь #${req.userId}`;
        const transferVerb = genderedWord(initiatorName, "перевёл", "перевела");
        await createNotification({
          userId: updated.userId,
          type: "pool_buyout_transferred",
          title: `${who} ${transferVerb} вам ${updated.priceRub} ₽`,
          message: `Проверьте поступление по СБП и подтвердите получение в карточке пула${poolRow ? ` «${poolRow.title}»` : ""}.`,
          listingTitle: poolRow?.title ?? null,
        });
      } catch (err) {
        logger.error({ err, participantId }, "[buyouts] notify participant transferred failed");
      }
    } catch (e) {
      logger.error({ err: e }, "POST /buyouts/.../mark-transferred failed");
      res.status(500).json({ error: "internal_error" });
    }
  },
);

// ── POST /api/buyouts/:requestId/participants/:participantId/confirm ────────
// Участник подтверждает получение денег.
// АТОМАРНО: status → confirmed, merge доли в initiator'а, удалить долю участника.
// Если initiator достиг 100% → ликвидировать пул, переписать listing.

router.post(
  "/buyouts/:requestId/participants/:participantId/confirm",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const requestId = Number.parseInt(req.params.requestId as string, 10);
      const participantId = Number.parseInt(req.params.participantId as string, 10);
      if (
        !Number.isInteger(requestId) || requestId <= 0 ||
        !Number.isInteger(participantId) || participantId <= 0
      ) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }

      // Pre-check для понятных ошибок (авторитативная проверка — внутри tx).
      const [pre] = await db
        .select({
          requestStatus: buyoutRequestsTable.status,
          requestPoolId: buyoutRequestsTable.poolId,
          requestInitiatorId: buyoutRequestsTable.initiatorId,
          participantUserId: buyoutParticipantsTable.userId,
          participantStatus: buyoutParticipantsTable.status,
        })
        .from(buyoutParticipantsTable)
        .innerJoin(
          buyoutRequestsTable,
          eq(buyoutRequestsTable.id, buyoutParticipantsTable.buyoutRequestId),
        )
        .where(
          and(
            eq(buyoutParticipantsTable.id, participantId),
            eq(buyoutParticipantsTable.buyoutRequestId, requestId),
          ),
        )
        .limit(1);
      if (!pre) {
        res.status(404).json({ error: "participant_not_found" });
        return;
      }
      if (pre.participantUserId !== req.userId!) {
        res.status(403).json({ error: "only_participant_can_confirm" });
        return;
      }
      if (pre.requestStatus !== "pending") {
        res.status(409).json({ error: "buyout_not_pending", currentStatus: pre.requestStatus });
        return;
      }
      if (pre.participantStatus !== "user_transferred") {
        res.status(409).json({
          error: "participant_not_in_transferred_state",
          currentStatus: pre.participantStatus,
        });
        return;
      }

      // ── Атомарная транзакция ──────────────────────────────────────────
      const result = await db.transaction(async (tx) => {
        // 1. TOCTOU: status → confirmed. Только для нашего participantId и текущего state.
        const [confirmed] = await tx
          .update(buyoutParticipantsTable)
          .set({ status: "confirmed" })
          .where(
            and(
              eq(buyoutParticipantsTable.id, participantId),
              eq(buyoutParticipantsTable.buyoutRequestId, requestId),
              eq(buyoutParticipantsTable.userId, req.userId!),
              eq(buyoutParticipantsTable.status, "user_transferred"),
            ),
          )
          .returning();
        if (!confirmed) {
          throw Object.assign(new Error("invalid_transition"), {
            httpStatus: 409,
            httpBody: { error: "invalid_transition", message: "Участник уже в другом статусе" },
          });
        }

        // 2. Подгрузим request + initiator'а свежими данными.
        const [reqRow] = await tx
          .select()
          .from(buyoutRequestsTable)
          .where(eq(buyoutRequestsTable.id, requestId))
          .limit(1);
        if (!reqRow || reqRow.status !== "pending") {
          throw Object.assign(new Error("buyout_changed"), {
            httpStatus: 409,
            httpBody: { error: "buyout_changed" },
          });
        }

        // 3. Доля участника (живая) — должна ещё принадлежать ему.
        const [participantShare] = await tx
          .select()
          .from(poolSharesTable)
          .where(
            and(
              eq(poolSharesTable.poolId, reqRow.poolId),
              eq(poolSharesTable.userId, req.userId!),
            ),
          )
          .limit(1);
        if (!participantShare) {
          throw Object.assign(new Error("participant_share_missing"), {
            httpStatus: 409,
            httpBody: { error: "participant_share_missing" },
          });
        }

        // 4. Доля инициатора — обязана быть.
        const [initiatorShare] = await tx
          .select()
          .from(poolSharesTable)
          .where(
            and(
              eq(poolSharesTable.poolId, reqRow.poolId),
              eq(poolSharesTable.userId, reqRow.initiatorId),
            ),
          )
          .limit(1);
        if (!initiatorShare) {
          throw Object.assign(new Error("initiator_share_missing"), {
            httpStatus: 409,
            httpBody: { error: "initiator_share_missing" },
          });
        }

        // 5. Merge: у initiator увеличиваем %, удаляем долю participant'а.
        // Используем snapshot из buyout_participants (sharePercentage/shareAmountRub),
        // а не текущие значения — defensive против изменения доли между request и confirm.
        // Но т.к. участник всё это время не торговался (мы его статусы блокируют), берём актуал.
        const [mergedInitiatorShare] = await tx
          .update(poolSharesTable)
          .set({
            sharePercentage: sql`${poolSharesTable.sharePercentage} + ${participantShare.sharePercentage}`,
            amountRub: sql`${poolSharesTable.amountRub} + ${participantShare.amountRub}`,
          })
          .where(eq(poolSharesTable.id, initiatorShare.id))
          .returning();
        if (!mergedInitiatorShare) {
          throw Object.assign(new Error("merge_failed"), {
            httpStatus: 500,
            httpBody: { error: "merge_failed" },
          });
        }

        await tx.delete(poolSharesTable).where(eq(poolSharesTable.id, participantShare.id));

        // 6. Если инициатор достиг 100% — ликвидация пула.
        let liquidated = false;
        let updatedListing: typeof listingsTable.$inferSelect | null = null;
        if (isFullOwnership(mergedInitiatorShare.sharePercentage)) {
          await tx
            .update(poolsTable)
            .set({ status: "liquidated" })
            .where(eq(poolsTable.id, reqRow.poolId));

          const [listing] = await tx
            .update(listingsTable)
            .set({
              poolId: null,
              ownerId: reqRow.initiatorId,
              custodianId: reqRow.initiatorId,
              isAvailable: true,
            })
            .where(eq(listingsTable.poolId, reqRow.poolId))
            .returning();
          updatedListing = listing ?? null;

          await tx
            .update(buyoutRequestsTable)
            .set({ status: "completed" })
            .where(eq(buyoutRequestsTable.id, requestId));

          liquidated = true;
        }

        return {
          participant: confirmed,
          initiatorShare: mergedInitiatorShare,
          liquidated,
          listing: updatedListing,
          poolId: reqRow.poolId,
          initiatorId: reqRow.initiatorId,
        };
      });

      res.json({
        participant: result.participant,
        initiatorShare: result.initiatorShare,
        poolLiquidated: result.liquidated,
        listing: result.listing,
      });

      // ── Audit + notify (post-commit) ───────────────────────────────────
      void recordAuditEvent({
        entityType: "pool",
        entityId: result.poolId,
        actorId: req.userId!,
        eventType: "buyout_confirmed",
        metadata: {
          buyoutRequestId: requestId,
          participantId,
          initiatorId: result.initiatorId,
          newInitiatorPercentage: result.initiatorShare.sharePercentage,
          liquidated: result.liquidated,
        },
      });

      try {
        const [poolRow] = await db
          .select({ title: poolsTable.title })
          .from(poolsTable)
          .where(eq(poolsTable.id, result.poolId))
          .limit(1);
        const [participantUser] = await db
          .select({ name: usersTable.name })
          .from(usersTable)
          .where(eq(usersTable.id, req.userId!))
          .limit(1);
        const participantName = (participantUser?.name ?? "").trim();
        const whoConfirmed = participantName || `Пользователь #${req.userId}`;
        const confirmVerb = genderedWord(participantName, "подтвердил", "подтвердила");

        // Уведомить инициатора что доля смерджена.
        await createNotification({
          userId: result.initiatorId,
          type: "pool_buyout_confirmed",
          title: `${whoConfirmed} ${confirmVerb} получение`,
          message: `Доля перешла к вам. Текущая доля: ${result.initiatorShare.sharePercentage}%${
            result.liquidated ? " — пул ликвидирован, вы единственный владелец." : "."
          }`,
          listingTitle: poolRow?.title ?? null,
        });

        if (result.liquidated) {
          // Финал — оповестить ВСЕХ изначальных участников выкупа.
          void recordAuditEvent({
            entityType: "pool",
            entityId: result.poolId,
            eventType: "pool_liquidated",
            actorId: result.initiatorId,
            metadata: { buyoutRequestId: requestId, listingId: result.listing?.id ?? null },
          });
          const allParticipants = await db
            .select({ userId: buyoutParticipantsTable.userId })
            .from(buyoutParticipantsTable)
            .where(eq(buyoutParticipantsTable.buyoutRequestId, requestId));
          const [initiatorUser] = await db
            .select({ name: usersTable.name })
            .from(usersTable)
            .where(eq(usersTable.id, result.initiatorId))
            .limit(1);
          const initiatorRawName = (initiatorUser?.name ?? "").trim();
          const initiatorName = initiatorRawName || `Пользователь #${result.initiatorId}`;
          const buyoutVerb = genderedWord(initiatorRawName, "выкупил", "выкупила");
          const buyoutPronoun = genderedWord(initiatorRawName, "его", "её");
          for (const p of allParticipants) {
            if (p.userId === result.initiatorId) continue;
            await createNotification({
              userId: p.userId,
              type: "pool_buyout_completed",
              title: `Пул ликвидирован`,
              message: `${initiatorName} ${buyoutVerb} все доли — теперь это ${buyoutPronoun} личная вещь${poolRow ? ` («${poolRow.title}»)` : ""}.`,
              listingTitle: poolRow?.title ?? null,
            });
          }
        }
      } catch (err) {
        logger.error({ err, requestId, participantId }, "[buyouts] notify confirm failed");
      }
    } catch (e: any) {
      if (e?.httpStatus && e?.httpBody) {
        res.status(e.httpStatus).json(e.httpBody);
        return;
      }
      logger.error({ err: e }, "POST /buyouts/.../confirm failed");
      res.status(500).json({ error: "internal_error" });
    }
  },
);

// ── POST /api/buyouts/:requestId/cancel — инициатор отменяет ───────────────
// Разрешено только если ни один participant не confirmed.

router.post(
  "/buyouts/:requestId/cancel",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const requestId = Number.parseInt(req.params.requestId as string, 10);
      if (!Number.isInteger(requestId) || requestId <= 0) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }

      const [request] = await db
        .select()
        .from(buyoutRequestsTable)
        .where(eq(buyoutRequestsTable.id, requestId))
        .limit(1);
      if (!request) {
        res.status(404).json({ error: "buyout_not_found" });
        return;
      }
      if (request.initiatorId !== req.userId!) {
        res.status(403).json({ error: "only_initiator_can_cancel" });
        return;
      }
      if (request.status !== "pending") {
        res.status(409).json({ error: "buyout_not_pending", currentStatus: request.status });
        return;
      }

      // Проверка: нет ли уже подтверждённых участников (отменять после merge нельзя).
      const [confirmedRow] = await db
        .select({ count: sql<string>`COUNT(*)::text` })
        .from(buyoutParticipantsTable)
        .where(
          and(
            eq(buyoutParticipantsTable.buyoutRequestId, requestId),
            eq(buyoutParticipantsTable.status, "confirmed"),
          ),
        );
      if (Number(confirmedRow?.count ?? 0) > 0) {
        res.status(409).json({
          error: "cannot_cancel_after_confirmation",
          message: "Нельзя отменить выкуп — часть долей уже передана. Свяжитесь с участниками для возврата.",
        });
        return;
      }

      const [canceled] = await db
        .update(buyoutRequestsTable)
        .set({ status: "canceled" })
        .where(
          and(
            eq(buyoutRequestsTable.id, requestId),
            eq(buyoutRequestsTable.status, "pending"),
          ),
        )
        .returning();
      if (!canceled) {
        res.status(409).json({ error: "buyout_already_changed" });
        return;
      }

      res.json({ buyoutRequest: canceled });

      void recordAuditEvent({
        entityType: "pool",
        entityId: request.poolId,
        actorId: req.userId!,
        eventType: "buyout_canceled",
        metadata: { buyoutRequestId: requestId },
      });
      try {
        const [poolRow] = await db
          .select({ title: poolsTable.title })
          .from(poolsTable)
          .where(eq(poolsTable.id, request.poolId))
          .limit(1);
        const [initiatorUser] = await db
          .select({ name: usersTable.name })
          .from(usersTable)
          .where(eq(usersTable.id, req.userId!))
          .limit(1);
        const initiatorRawName = (initiatorUser?.name ?? "").trim();
        const initiatorName = initiatorRawName || `Пользователь #${req.userId}`;
        const cancelVerb = genderedWord(initiatorRawName, "отменил", "отменила");
        const participants = await db
          .select({ userId: buyoutParticipantsTable.userId })
          .from(buyoutParticipantsTable)
          .where(eq(buyoutParticipantsTable.buyoutRequestId, requestId));
        for (const p of participants) {
          await createNotification({
            userId: p.userId,
            type: "pool_buyout_canceled",
            title: `${initiatorName} ${cancelVerb} выкуп`,
            message: `Запрос на выкуп пула${poolRow ? ` «${poolRow.title}»` : ""} отменён.`,
            listingTitle: poolRow?.title ?? null,
          });
        }
      } catch (err) {
        logger.error({ err, requestId }, "[buyouts] notify cancel failed");
      }
    } catch (e) {
      logger.error({ err: e }, "POST /buyouts/:requestId/cancel failed");
      res.status(500).json({ error: "internal_error" });
    }
  },
);

export default router;
