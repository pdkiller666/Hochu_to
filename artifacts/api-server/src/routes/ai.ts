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
import multer from "multer";
import path from "path";
import { promises as fs } from "fs";
import { randomUUID } from "crypto";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import {
  generateListingDescription,
  generateInfographicBullets,
} from "../lib/ai-service.js";
import { buildInfographicImage } from "../lib/image-service.js";
import { UPLOADS_DIR } from "../lib/uploadsDir.js";
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

// ─── Stage 30B: AI Visual Magic — генерация инфографики ─────────────────────
//
// POST /api/ai/generate-infographic
//   multipart/form-data:
//     - photo:    File   (jpg/png/webp, до 10 МБ — то же что /upload)
//     - title:    string (название вещи; может прийти как form-field)
//     - category: string (опционально)
//   Auth:     требуется
//   Лимит:    тот же общий 10 req/min/user, что и для текста (общий бакет —
//             уважаем кошелёк LLM-провайдера)
//   Ответ:    { url, bullets, provider, actualProvider, fallback?, fallbackReason? }
//
// Почему отдельный multer-инстанс:
//   - принимаем ровно одно фото (multer.single)
//   - храним в памяти, чтобы передать sharp напрямую без лишнего I/O

const infographicUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 МБ как у обычной загрузки фото
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Только изображения"));
  },
});

router.post(
  "/generate-infographic",
  requireAuth,
  (req: AuthRequest, res: Response) => {
    infographicUpload.single("photo")(req, res, async (err: any) => {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }

      // Multer-ошибки (размер, mime) → JSON, не HTML
      if (err) {
        const isLimit = err?.code === "LIMIT_FILE_SIZE";
        res.status(400).json({
          error: isLimit ? "file_too_large" : "invalid_file",
          message: isLimit
            ? "Фото слишком большое. Лимит — 10 МБ."
            : err?.message || "Файл не принят",
        });
        return;
      }

      const file = req.file as Express.Multer.File | undefined;
      if (!file) {
        res
          .status(400)
          .json({ error: "no_file", message: "Файл фото обязателен" });
        return;
      }

      const title =
        typeof req.body?.title === "string" ? req.body.title.trim() : "";
      const category =
        typeof req.body?.category === "string"
          ? req.body.category.trim() || null
          : null;

      if (!title) {
        res.status(400).json({
          error: "invalid_input",
          message: "Поле 'title' обязательно",
        });
        return;
      }
      if (title.length > 200) {
        res.status(400).json({
          error: "invalid_input",
          message: "Название слишком длинное (макс. 200 символов)",
        });
        return;
      }

      // Общий с описаниями rate-limit: цель — защита кошелька LLM
      const rl = rateLimit(userId);
      if (!rl.ok) {
        res.setHeader("Retry-After", String(rl.retryAfterSec));
        res.status(429).json({
          error: "rate_limited",
          message: `Слишком много запросов. Попробуйте через ${rl.retryAfterSec} сек.`,
        });
        return;
      }

      try {
        // 1) Достаём 3 буллета из LLM (с graceful fallback в mock)
        const bulletsResult = await generateInfographicBullets(title, category);

        // 2) Собираем картинку 1080×1080 (sharp + SVG композит)
        const webpBuffer = await buildInfographicImage(
          file.buffer,
          bulletsResult.bullets,
        );

        // 3) Сохраняем как обычный файл в UPLOADS_DIR — фронт получит
        //    стандартный URL вида /uploads/<uuid>.webp и просто добавит
        //    его в галерею объявления.
        const filename = `${randomUUID()}.webp`;
        await fs.writeFile(path.join(UPLOADS_DIR, filename), webpBuffer);

        logger.info(
          {
            userId,
            title: title.slice(0, 60),
            provider: bulletsResult.provider,
            actualProvider: bulletsResult.actualProvider,
            fallback: bulletsResult.fallback,
            sizeKb: Math.round(webpBuffer.length / 1024),
          },
          "ai.generate-infographic: success",
        );

        res.json({
          url: `/uploads/${filename}`,
          bullets: bulletsResult.bullets,
          provider: bulletsResult.provider,
          actualProvider: bulletsResult.actualProvider,
          fallback: bulletsResult.fallback,
          fallbackReason: bulletsResult.fallbackReason,
        });
      } catch (e: any) {
        logger.error(
          { err: e?.message, userId, title: title.slice(0, 60) },
          "ai.generate-infographic: unexpected failure",
        );
        res.status(500).json({
          error: "internal",
          message: "Не удалось сгенерировать инфографику",
        });
      }
    });
  },
);

export default router;
