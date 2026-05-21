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
  generateMarketplaceContent,
} from "../lib/ai-service.js";
import {
  buildInfographicImage,
  buildHorizontalImage,
  buildMarketplaceInfographic,
} from "../lib/image-service.js";
import {
  generateGenerativeInfographic,
  preprocessForAI,
} from "../lib/infographic.js";
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

    const { title, category, condition, provider } = req.body ?? {};
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

    // Stage 30C: per-request выбор провайдера. Невалидные значения игнорируем —
    // ai-service сам подберёт дефолт (учитывая kill-switch админа).
    const requestedProvider =
      typeof provider === "string" ? provider.trim().toLowerCase() : null;

    try {
      const result = await generateListingDescription(
        {
          title: title.trim(),
          category: category?.trim() || null,
          condition: condition?.trim() || null,
        },
        requestedProvider,
      );
      return res.json(result);
    } catch (err: any) {
      logger.error(
        { err: err?.message, userId },
        "ai.generate-description: unexpected failure",
      );
      return res
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
      const description =
        typeof req.body?.description === "string"
          ? req.body.description.trim().slice(0, 600) || null
          : null;
      const pricePerDay =
        typeof req.body?.pricePerDay === "string"
          ? Number.parseFloat(req.body.pricePerDay) || null
          : null;
      // Stage 30C: per-request провайдер из multipart-формы.
      const requestedProvider =
        typeof req.body?.provider === "string"
          ? req.body.provider.trim().toLowerCase()
          : null;

      // template=marketplace (Stage 41 default) → AI-generative; classic → SVG-overlay буллеты
      // format: query-string ?format=horizontal ИЛИ multipart body format
      // preprocess: query-string ?preprocess=true ИЛИ body preprocess=true
      const template =
        typeof req.body?.template === "string"
          ? req.body.template.trim().toLowerCase()
          : "marketplace";
      const format = (
        (typeof req.query?.format === "string" ? req.query.format : null) ??
        (typeof req.body?.format === "string" ? req.body.format : null) ??
        "square"
      ).trim().toLowerCase();
      const preprocess =
        req.query?.preprocess === "true" ||
        req.body?.preprocess === "true" ||
        req.body?.preprocess === true;

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
        let webpBuffer: Buffer;
        let responseExtra: Record<string, unknown>;

        if (format === "horizontal") {
          // ── Горизонтальный формат 1200×630 (OG / соцсети) — legacy path, сохранён ──
          const bulletsResult = await generateInfographicBullets(
            title,
            category,
            requestedProvider,
          );
          webpBuffer = await buildHorizontalImage(file.buffer, bulletsResult.bullets);
          responseExtra = {
            template: "horizontal",
            bullets: bulletsResult.bullets,
            provider: bulletsResult.provider,
            actualProvider: bulletsResult.actualProvider,
            fallback: bulletsResult.fallback,
            fallbackReason: bulletsResult.fallbackReason,
          };
        } else if (template === "marketplace") {
          // ── Stage 41: AI-Generative marketplace card (3-tier fallback) ──
          // 1) LLM генерирует структуру (title + bullets) для промпта
          const mktResult = await generateMarketplaceContent(
            title,
            category,
            pricePerDay,
            description,
            requestedProvider,
          );

          // 2) Опциональный препроцессинг (?preprocess=true)
          const sourceBuffer = preprocess
            ? await preprocessForAI(file.buffer)
            : file.buffer;

          // 3) Формируем bullets из контента LLM
          const allBullets = [
            ...mktResult.content.leftItems,
            ...mktResult.content.rightItems,
          ].slice(0, 6);
          const priceNum = pricePerDay ? Math.round(pricePerDay) : 0;

          // 4) Generative AI (Tier 1 OpenRouter → Tier 2 Imagen 3 → Tier 3 original)
          const genResult = await generateGenerativeInfographic(sourceBuffer, {
            title: mktResult.content.title,
            price: priceNum,
            bullets: allBullets,
            format: "square",
          });

          webpBuffer = genResult.buffer;

          // 5) Если Tier 3 (полный отказ AI) — применяем старый SVG-оверлей как подстраховку
          if (genResult.tier === 3) {
            const priceText = pricePerDay
              ? `от ${priceNum.toLocaleString("ru-RU")} ₽/сут`
              : "Цена по запросу";
            webpBuffer = await buildMarketplaceInfographic(
              file.buffer,
              mktResult.content,
              priceText,
            );
          }

          responseExtra = {
            template: "marketplace",
            generativeTier: genResult.tier,
            preprocessed: preprocess,
            content: mktResult.content,
            provider: mktResult.provider,
            actualProvider: mktResult.actualProvider,
            fallback: mktResult.fallback || genResult.tier === 3,
            fallbackReason: mktResult.fallbackReason,
          };
        } else {
          // ── Classic template (3 буллета, SVG-overlay) ────────────────────
          const bulletsResult = await generateInfographicBullets(
            title,
            category,
            requestedProvider,
          );
          webpBuffer = await buildInfographicImage(file.buffer, bulletsResult.bullets);
          responseExtra = {
            template: "classic",
            bullets: bulletsResult.bullets,
            provider: bulletsResult.provider,
            actualProvider: bulletsResult.actualProvider,
            fallback: bulletsResult.fallback,
            fallbackReason: bulletsResult.fallbackReason,
          };
        }

        // 4) Сохраняем как обычный файл в UPLOADS_DIR
        const filename = `${randomUUID()}.webp`;
        await fs.writeFile(path.join(UPLOADS_DIR, filename), webpBuffer);

        logger.info(
          {
            userId,
            title: title.slice(0, 60),
            template,
            sizeKb: Math.round(webpBuffer.length / 1024),
          },
          "ai.generate-infographic: success",
        );

        res.json({ url: `/uploads/${filename}`, ...responseExtra });
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
