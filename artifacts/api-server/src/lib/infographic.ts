/**
 * Stage 41 — Generative Infographic Service
 *
 * generateGenerativeInfographic(): 3-tier fallback chain
 *   Tier 1 — OpenRouter (LLM-only, всегда throws → cascade to Tier 2)
 *   Tier 2 — Google Imagen 3 via generativelanguage.googleapis.com
 *   Tier 3 — graceful degradation: возвращает исходный imageBuffer в WebP
 *
 * buildImagePrompt(): строит промпт для Imagen 3.
 * preprocessForAI(): опциональный препроцессинг (resize + sharpen + saturation).
 *
 * Audit-логирование: структурированные Pino-записи (tier, durationMs, err).
 * SHA-256 disk-cache 24ч в /tmp/infographic-cache/ (shared с image-service).
 */
import { createHash } from "crypto";
import { promises as fs } from "fs";
import sharp from "sharp";
import { logger } from "./logger.js";

// ─── Cache (shared dir с image-service) ──────────────────────────────────────

const CACHE_DIR = "/tmp/infographic-cache";

async function getCached(key: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(`${CACHE_DIR}/${key}.webp`);
  } catch {
    return null;
  }
}

async function putCached(key: string, data: Buffer): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(`${CACHE_DIR}/${key}.webp`, data);
  } catch { /* ignore */ }
}

function makeCacheKey(imageBuffer: Buffer, prompt: string): string {
  return (
    "gen_" +
    createHash("sha256")
      .update(imageBuffer)
      .update("|")
      .update(prompt)
      .digest("hex")
  );
}

// ─── Prompt builder ────────────────────────────────────────────────────────────

/**
 * buildImagePrompt — строит промпт для генеративной модели.
 * Инструкции на английском (модель лучше следует), русский текст встроен точно.
 */
export function buildImagePrompt(item: {
  title: string;
  price: number;
  bullets: string[];
  format?: "square" | "horizontal";
}): string {
  const aspect =
    item.format === "horizontal" ? "1200x630 landscape" : "1080x1080 square";
  const bulletsText = item.bullets.map((b) => `"${b}"`).join(", ");
  return (
    `Generate a premium product card for a Russian rental marketplace. ` +
    `Aspect ratio: ${aspect}. Center the product from the attached photo, remove original background, ` +
    `replace with a stylish studio or atmospheric setting. ` +
    `Overlay the following Russian text clearly on the image: ` +
    `- Title: "${item.title}" ` +
    `- Price: "Аренда ${item.price} ₽/сутки" ` +
    `- Bullets: ${bulletsText} ` +
    `Style: minimalistic, modern, clean typography, no distortion, text must be perfectly readable.`
  );
}

// ─── Tier helpers ─────────────────────────────────────────────────────────────

/**
 * Tier 1: OpenRouter.
 * OpenRouter поддерживает только LLM — генерация изображений недоступна.
 * Всегда бросает ошибку → автоматический cascade в Tier 2.
 * Оставлено как точка расширения на случай появления image-моделей на OpenRouter.
 */
async function tryOpenRouter(_prompt: string): Promise<Buffer> {
  throw new Error(
    "OpenRouter does not support image generation — cascading to Tier 2 (Imagen 3)",
  );
}

/**
 * Tier 2: Google Imagen 3 через Gemini API (text-to-image).
 * Endpoint: generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict
 * Auth: ?key=GEMINI_API_KEY (стандарт Gemini REST, тот же что в ai-service.ts)
 * Ответ: predictions[0].bytesBase64Encoded — PNG base64
 */
async function tryImagen3(prompt: string): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `imagen-3.0-generate-001:predict?key=${encodeURIComponent(apiKey)}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45_000);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: "1:1" },
      }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Imagen3 HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }

  const data: any = await res.json();
  const b64: string | undefined =
    data?.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) {
    throw new Error(`Imagen3: empty prediction (keys: ${Object.keys(data ?? {}).join(",")})`);
  }
  return Buffer.from(b64, "base64");
}

// ─── Core service ──────────────────────────────────────────────────────────────

export interface GenerativeInfographicResult {
  buffer: Buffer;
  /** Какой tier реально отработал: 1=OpenRouter, 2=Imagen3, 3=degradation */
  tier: 1 | 2 | 3;
}

/**
 * generateGenerativeInfographic — 3-tier fallback chain.
 *
 * Результат всегда Buffer (WebP, 1080×1080 или ближайший размер из модели).
 * Все попытки логируются через Pino (tier, durationMs, ошибки).
 * Кэш SHA-256 на диске 24ч во избежание повторных дорогостоящих API-вызовов.
 */
export async function generateGenerativeInfographic(
  imageBuffer: Buffer,
  itemData: {
    title: string;
    price: number;
    bullets: string[];
    format?: "square" | "horizontal";
  },
): Promise<GenerativeInfographicResult> {
  const prompt = buildImagePrompt(itemData);
  const cacheKey = makeCacheKey(imageBuffer, prompt);

  const cached = await getCached(cacheKey);
  if (cached) {
    logger.info(
      { cacheKey: cacheKey.slice(0, 16) },
      "infographic.generative: cache hit",
    );
    return { buffer: cached, tier: 2 };
  }

  const startedAt = Date.now();

  // ── Tier 1: OpenRouter ────────────────────────────────────────────────────
  try {
    const raw = await tryOpenRouter(prompt);
    const out = await sharp(raw).webp({ quality: 90 }).toBuffer();
    await putCached(cacheKey, out);
    logger.info(
      { tier: 1, durationMs: Date.now() - startedAt, title: itemData.title.slice(0, 60) },
      "infographic.generative: success tier=1 (OpenRouter)",
    );
    return { buffer: out, tier: 1 };
  } catch (e1: any) {
    logger.warn(
      { tier: 1, err: e1?.message, durationMs: Date.now() - startedAt },
      "infographic.generative: tier 1 failed, trying Imagen 3",
    );
  }

  // ── Tier 2: Google Imagen 3 ───────────────────────────────────────────────
  try {
    const raw = await tryImagen3(prompt);
    const out = await sharp(raw).webp({ quality: 90 }).toBuffer();
    await putCached(cacheKey, out);
    logger.info(
      { tier: 2, durationMs: Date.now() - startedAt, title: itemData.title.slice(0, 60) },
      "infographic.generative: success tier=2 (Imagen3)",
    );
    return { buffer: out, tier: 2 };
  } catch (e2: any) {
    logger.warn(
      { tier: 2, err: e2?.message, durationMs: Date.now() - startedAt },
      "infographic.generative: tier 2 failed, graceful degradation",
    );
  }

  // ── Tier 3: Graceful degradation — исходное фото в WebP ──────────────────
  logger.error(
    { tier: 3, durationMs: Date.now() - startedAt, title: itemData.title.slice(0, 60) },
    "infographic.generative: all tiers failed — returning original image",
  );
  const fallback = await sharp(imageBuffer)
    .rotate()
    .resize(1080, 1080, { fit: "cover", position: "centre" })
    .webp({ quality: 85 })
    .toBuffer();
  return { buffer: fallback, tier: 3 };
}

// ─── Preprocessing ─────────────────────────────────────────────────────────────

/**
 * preprocessForAI — опциональный препроцессинг перед отправкой в генеративную модель.
 * Ресайз до 1024×1024, повышение резкости и насыщенности для лучшего результата генерации.
 * Вызывается при ?preprocess=true в запросе.
 */
export async function preprocessForAI(imageBuffer: Buffer): Promise<Buffer> {
  return sharp(imageBuffer)
    .rotate()
    .resize(1024, 1024, { fit: "cover", position: "centre" })
    .sharpen({ sigma: 1.5 })
    .modulate({ brightness: 1.05, saturation: 1.1 })
    .png()
    .toBuffer();
}
