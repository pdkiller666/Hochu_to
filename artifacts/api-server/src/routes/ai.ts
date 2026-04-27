/**
 * Stage 30A — AI Gateway endpoint
 *
 * POST /api/ai/generate-description
 *   Body:    { title: string, category?: string, condition?: string }
 *   Auth:    требуется (любой залогиненный пользователь)
 *   Лимит:   10 запросов в минуту на пользователя (in-memory token bucket)
 *   Ответ:   { text, provider, actualProvider, fallback, fallbackReason? }
 */
import { Router, type Response } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { generateListingDescription } from "../lib/ai-service.js";
import { logger } from "../lib/logger.js";

const router: Router = Router();

// ─── Rate limit: 10 req/min/user, in-memory ────────────────────────────────
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const buckets = new Map<number, { count: number; resetAt: number }>();

function rateLimit(userId: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const b = buckets.get(userId);
  if (!b || b.resetAt <= now) {
    buckets.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { ok: true, retryAfterSec: 0 };
  }
  if (b.count >= RATE_LIMIT_MAX) {
    return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count++;
  return { ok: true, retryAfterSec: 0 };
}

// Периодическая чистка протухших бакетов (раз в 5 минут)
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}, 5 * 60_000).unref?.();

// ───────────────────────────────────────────────────────────────────────────

router.post(
  "/generate-description",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "unauthorized" });

    const rl = rateLimit(userId);
    if (!rl.ok) {
      res.setHeader("Retry-After", String(rl.retryAfterSec));
      return res.status(429).json({
        error: "rate_limited",
        message: `Слишком много запросов. Попробуйте через ${rl.retryAfterSec} сек.`,
      });
    }

    const { title, category, condition } = req.body ?? {};
    if (typeof title !== "string" || !title.trim()) {
      return res
        .status(400)
        .json({ error: "invalid_input", message: "Поле 'title' обязательно" });
    }
    if (title.length > 200) {
      return res.status(400).json({
        error: "invalid_input",
        message: "Название слишком длинное (макс. 200 символов)",
      });
    }
    if (category && (typeof category !== "string" || category.length > 100)) {
      return res.status(400).json({ error: "invalid_input", field: "category" });
    }
    if (
      condition &&
      (typeof condition !== "string" || condition.length > 100)
    ) {
      return res
        .status(400)
        .json({ error: "invalid_input", field: "condition" });
    }

    try {
      const result = await generateListingDescription({
        title: title.trim(),
        category: category?.trim() || null,
        condition: condition?.trim() || null,
      });
      res.json(result);
    } catch (err: any) {
      logger.error(
        { err: err?.message, userId },
        "ai.generate-description: unexpected failure",
      );
      res
        .status(500)
        .json({ error: "internal", message: "Не удалось сгенерировать текст" });
    }
  },
);

export default router;
