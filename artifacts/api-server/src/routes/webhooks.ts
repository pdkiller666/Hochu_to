import { Router, type Request, type Response } from "express";
import { eq, sql } from "drizzle-orm";
import { db, paymentsTable, listingPromotionsTable, listingsTable } from "@workspace/db";
import { logger } from "../lib/logger.js";
import { verifyWebhookSignature, getPayment } from "../lib/yookassa.js";

const router = Router();

/**
 * Stage 21a — POST /api/webhooks/yookassa
 *
 * ЮKassa шлёт уведомления `payment.succeeded`, `payment.canceled`,
 * `payment.waiting_for_capture` и `refund.succeeded`.
 *
 * Логика:
 *  1. (опц.) Проверка подписи через `YOOKASSA_WEBHOOK_SECRET`.
 *  2. Идемпотентность: ищем платёж по `yookassa_payment_id`.
 *  3. Подтверждаем актуальный статус через GET /payments/:id (доверяем только своему API).
 *  4. По target_type активируем нужный объект (промо / контакты / бронь).
 */
router.post("/yookassa", async (req: Request, res: Response) => {
  // Используем raw body, который сохраняет express.json({ verify }) в app.ts.
  // Если по какой-то причине его нет — фолбэк на JSON.stringify (только для dev).
  const raw = (req as any).rawBody ?? JSON.stringify(req.body ?? {});
  const sig = req.header("x-yookassa-signature") ?? req.header("X-YooKassa-Signature") ?? undefined;
  if (!verifyWebhookSignature(raw, sig)) {
    logger.warn({ hasSig: !!sig }, "yookassa webhook: bad signature");
    res.status(401).json({ error: "bad_signature" });
    return;
  }

  const event = String(req.body?.event ?? "");
  const obj = req.body?.object as { id?: string } | undefined;
  if (!obj?.id) {
    res.status(400).json({ error: "bad_request", message: "Не указан object.id" });
    return;
  }

  // Подтверждаем статус через API (защита от подмены payload)
  let confirmed: any = null;
  try {
    confirmed = await getPayment(obj.id);
  } catch (e: any) {
    logger.error({ err: e, paymentId: obj.id }, "yookassa webhook: getPayment failed");
    // 200, чтобы ЮKassa не зацикливала ретраи (повторим при следующем событии)
    res.status(200).json({ ok: true, note: "verify failed, will retry on next event" });
    return;
  }

  try {
    await db.transaction(async (tx) => {
      // Атомарный lock записи платежа: SELECT FOR UPDATE — защита от
      // параллельных вебхуков (ЮKassa может прислать одно событие дважды).
      const lockedRows = await tx.execute(
        sql`SELECT * FROM payments WHERE yookassa_payment_id = ${obj.id} FOR UPDATE`,
      );
      const payment = (lockedRows as any).rows?.[0];
      if (!payment) {
        logger.warn({ paymentId: obj.id, event }, "yookassa webhook: unknown payment");
        return; // 200 ниже
      }
      if (payment.status === "succeeded") {
        return; // already processed — идемпотентно
      }

      if (confirmed.status === "succeeded") {
        await tx.update(paymentsTable)
          .set({ status: "succeeded", paidAt: new Date(), updatedAt: new Date() })
          .where(eq(paymentsTable.id, payment.id));

        if (payment.target_type === "promotion") {
          const meta = (payment.metadata ?? {}) as { type?: string; plan?: string; days?: number; listingId?: number };
          const type = meta.type as "vip" | "urgent" | "boost" | undefined;
          const listingId = Number(meta.listingId ?? 0);
          const days = Number(meta.days ?? 0);
          if (!type || !listingId || !days) {
            logger.error({ paymentId: payment.id, meta }, "yookassa webhook: некорректные metadata для promotion");
            return;
          }
          const set: Record<string, any> = {};
          if (type === "vip") {
            set.isFeatured = true;
            set.featuredUntil = sql`GREATEST(COALESCE(${listingsTable.featuredUntil}, NOW()), NOW()) + (${days} || ' days')::interval`;
          } else if (type === "urgent") {
            set.isUrgent = true;
            set.urgentUntil = sql`GREATEST(COALESCE(${listingsTable.urgentUntil}, NOW()), NOW()) + (${days} || ' days')::interval`;
          } else {
            set.boostedUntil = sql`GREATEST(COALESCE(${listingsTable.boostedUntil}, NOW()), NOW()) + (${days} || ' days')::interval`;
          }
          const [updated] = await tx.update(listingsTable).set(set).where(eq(listingsTable.id, listingId)).returning();
          const newUntil =
            type === "vip" ? updated.featuredUntil :
            type === "urgent" ? updated.urgentUntil :
            updated.boostedUntil;

          // Создаём итоговую запись listing_promotion ТОЛЬКО при успешной оплате
          const [promo] = await tx.insert(listingPromotionsTable).values({
            listingId,
            ownerId: payment.user_id,
            type,
            plan: meta.plan ?? "",
            days,
            priceRub: Number(payment.amount_rub ?? 0),
            validUntil: newUntil!,
            paymentRef: obj.id,
          }).returning();
          await tx.update(paymentsTable)
            .set({ targetId: promo.id, updatedAt: new Date() })
            .where(eq(paymentsTable.id, payment.id));
        }
        // TODO: contact_pack / booking_protection — Stage 21b/c
      } else if (confirmed.status === "canceled") {
        await tx.update(paymentsTable)
          .set({ status: "canceled", updatedAt: new Date() })
          .where(eq(paymentsTable.id, payment.id));
      }
      // pending / waiting_for_capture — ничего не меняем
    });
  } catch (e: any) {
    logger.error({ err: e, paymentId: obj.id }, "yookassa webhook: tx failed");
    res.status(200).json({ ok: false, note: "tx failed, will retry" });
    return;
  }

  res.status(200).json({ ok: true });
});

export default router;
