import { db, usersTable, reviewsTable, bookingsTable, claimsTable } from "@workspace/db";
import { eq, and, sql, or, inArray } from "drizzle-orm";
import { recordAuditEvent } from "./audit-events.js";
import { logger } from "./logger.js";

/**
 * Stage 29 — Trust Score Engine.
 *
 * Формула (V1, 0..100):
 *   base                      = 20
 *   + (avgRating / 5) * 30   — средний рейтинг отзывов о пользователе
 *   + MIN(deals * 5, 30)     — опыт (число завершённых сделок, кап 30)
 *   + (isVerified ? 20 : 0)  — статус «Проверенный владелец»
 *   - claimsAtFault * 20     — подтверждённые претензии, где пользователь виноват
 *   ────────────────────────
 *   clamp(0, 100)
 *
 * «Виновность» по претензиям:
 *   Учитываются claims со статусом 'approved' или 'paid', где пользователь
 *   был стороной брони, но НЕ получателем выплаты (т.е. компенсация ушла
 *   контрагенту — значит, фонд закрыл его ущерб). Pending/admin_review/rejected
 *   не учитываются (любой может подать заявку).
 *
 * Контракт:
 *   - Не бросает наружу: ловит ошибки, логирует, возвращает null.
 *   - Пишет audit_events (entityType='user', eventType='trust_score_updated').
 *   - Вызывать ПОСЛЕ commit'а основной транзакции (post-side-effect).
 */
export async function calculateAndUpdateTrustScore(
  userId: number,
  actorId?: number | null,
  reason?: string,
): Promise<number | null> {
  try {
    const [user] = await db
      .select({
        id: usersTable.id,
        completedDealsCount: usersTable.completedDealsCount,
        isVerified: usersTable.isVerified,
        trustScore: usersTable.trustScore,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    if (!user) return null;

    // Средний рейтинг отзывов о пользователе (как владелец + как арендатор).
    const [ratingRow] = await db
      .select({
        avg: sql<number>`COALESCE(AVG(${reviewsTable.rating}), 0)::float`,
        cnt: sql<number>`COUNT(*)::int`,
      })
      .from(reviewsTable)
      .where(eq(reviewsTable.revieweeId, userId));
    const avgRating = Number(ratingRow?.avg ?? 0);
    const reviewCount = Number(ratingRow?.cnt ?? 0);

    // Подтверждённые претензии, где пользователь — НЕ получатель выплаты.
    // Считаем по бронированиям, где он либо owner, либо renter.
    const claimsAtFault = await db.execute(sql`
      SELECT COUNT(*)::int AS cnt
      FROM ${claimsTable} c
      JOIN ${bookingsTable} b ON b.id = c.booking_id
      WHERE c.status IN ('approved', 'paid')
        AND (b.owner_id = ${userId} OR b.renter_id = ${userId})
        AND c.payout_to_user_id IS NOT NULL
        AND c.payout_to_user_id <> ${userId}
    `).then((r) => Number((r.rows[0] as any)?.cnt ?? 0));

    const deals = user.completedDealsCount ?? 0;
    const ratingPart = reviewCount > 0 ? (avgRating / 5) * 30 : 0;
    const dealsPart = Math.min(deals * 5, 30);
    const verifiedPart = user.isVerified ? 20 : 0;
    const claimsPenalty = claimsAtFault * 20;

    let score = 20 + ratingPart + dealsPart + verifiedPart - claimsPenalty;
    score = Math.max(0, Math.min(100, Math.round(score)));

    const previous = user.trustScore;
    const now = new Date();
    await db
      .update(usersTable)
      .set({ trustScore: score, trustScoreUpdatedAt: now })
      .where(eq(usersTable.id, userId));

    await recordAuditEvent({
      entityType: "user",
      entityId: userId,
      actorId: actorId ?? null,
      eventType: "trust_score_updated",
      metadata: {
        previousScore: previous,
        newScore: score,
        avgRating: Math.round(avgRating * 10) / 10,
        reviewCount,
        completedDeals: deals,
        isVerified: !!user.isVerified,
        claimsAtFault,
        reason: reason ?? null,
      },
    });

    return score;
  } catch (err) {
    logger.error({ err, userId }, "[trust-score] calculateAndUpdateTrustScore failed");
    return null;
  }
}

/**
 * Удобная обёртка: пересчитать сразу нескольким пользователям (например,
 * обоим участникам сделки после её завершения). Не падает, если кто-то
 * из них не найден.
 */
export async function recalcTrustScoreForUsers(
  userIds: Array<number | null | undefined>,
  actorId?: number | null,
  reason?: string,
): Promise<void> {
  const unique = Array.from(new Set(userIds.filter((x): x is number => typeof x === "number" && x > 0)));
  await Promise.all(unique.map((id) => calculateAndUpdateTrustScore(id, actorId, reason)));
}

// Re-export для тестов.
export const _internal = { inArray, or, and };
