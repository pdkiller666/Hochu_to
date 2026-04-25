import { db, auditEventsTable } from "@workspace/db";
import { logger } from "./logger.js";

/**
 * Stage 27 — universal audit logger for non-booking entities (pools, offers, …).
 *
 * Контракт:
 *   - Никогда не бросает наружу — логирует и проглатывает ошибки. Audit failure
 *     не должен ронять основную транзакцию.
 *   - Вызывать ПОСЛЕ commit'а главной операции (для корректности порядка событий).
 *
 * Параметры:
 *   - entityType: 'pool' | 'share' | 'offer' (короткий код).
 *   - entityId: ID этой сущности (например, poolId).
 *   - actorId: кто сделал действие; null/undefined для system-events.
 *   - eventType: short snake_case ('pool_created', 'offer_reserved' и т.д.).
 *   - metadata: произвольный JSON со связанными ID и числами.
 */
export type AuditEntityType = "pool" | "share" | "offer";

export async function recordAuditEvent(params: {
  entityType: AuditEntityType;
  entityId: number;
  actorId?: number | null;
  eventType: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(auditEventsTable).values({
      entityType: params.entityType,
      entityId: params.entityId,
      actorId: params.actorId ?? null,
      eventType: params.eventType,
      metadata: params.metadata ?? null,
    });
  } catch (err) {
    logger.error(
      { err, entityType: params.entityType, entityId: params.entityId, eventType: params.eventType },
      "[audit-events] recordAuditEvent failed",
    );
  }
}
