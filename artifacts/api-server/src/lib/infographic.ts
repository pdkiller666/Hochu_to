/**
 * Stage 42 — Full Generative Infographic Service
 *
 * generateGenerativeInfographic(): 3-tier fallback chain
 *   Tier 1 — OpenRouter /images/generate (DALL-E 3 / Flux Pro / etc.)
 *             text-to-image, детальный промпт из MarketplaceInfographicContent
 *   Tier 2 — Google Gemini multimodal + Imagen 3 sub-fallback (прямой API)
 *             image-to-image (фото-референс + промпт) или text-to-image
 *   Tier 3 — SVG overlay fallback (buildMarketplaceInfographic) — всегда работает
 *
 * Persistent cache: SHA-256(imageBuffer + prompt) → CACHE_DIR/<hash>.webp
 * CACHE_DIR = /data/cache/infographic (prod) или ./uploads/../cache/infographic (dev)
 * TTL: 24 ч
 */
import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { logger } from "./logger.js";
import type { MarketplaceInfographicContent } from "./ai-service.js";
import { buildMarketplaceInfographic } from "./image-service.js";
import { UPLOADS_DIR } from "./uploadsDir.js";

// ─── Persistent cache ──────────────────────────────────────────────────────────

const CACHE_DIR = path.join(UPLOADS_DIR, "..", "cache", "infographic");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function ensureCacheDir(): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}
ensureCacheDir().catch(() => {});

async function getCached(key: string): Promise<Buffer | null> {
  try {
    const fp = path.join(CACHE_DIR, `${key}.webp`);
    const stat = await fs.stat(fp);
    if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) {
      await fs.unlink(fp).catch(() => {});
      return null;
    }
    return await fs.readFile(fp);
  } catch {
    return null;
  }
}

async function putCached(key: string, data: Buffer): Promise<void> {
  try {
    await fs.writeFile(path.join(CACHE_DIR, `${key}.webp`), data);
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

// ─── OpenRouter models ─────────────────────────────────────────────────────────
// API: POST /api/v1/chat/completions (НЕ /images/generate)
// Ответ: choices[0].message.images[0].image_url.url (base64 data URL)
// Параметр: modalities + image_config.aspect_ratio

const DEFAULT_OPENROUTER_MODELS = [
  "google/gemini-3.1-flash-image-preview",  // поддерживает text+image
  "google/gemini-2.5-flash-image",           // поддерживает text+image
  "black-forest-labs/flux.2-pro",            // только image
  "black-forest-labs/flux.2-flex",           // только image
];

function getOpenRouterModels(): string[] {
  const env = process.env.OPENROUTER_IMAGE_MODELS?.trim();
  if (env) return env.split(",").map((m) => m.trim()).filter(Boolean);
  return DEFAULT_OPENROUTER_MODELS;
}

/**
 * Gemini-based models через OpenRouter возвращают и текст, и изображение.
 * Flux/Sourceful — только изображение (modalities: ["image"]).
 */
function pickModalities(model: string): string[] {
  if (model.includes("gemini")) return ["image", "text"];
  return ["image"];
}

// ─── Prompt builder ────────────────────────────────────────────────────────────

export function buildImagePrompt(
  content: MarketplaceInfographicContent,
  options?: {
    price?: number;
    category?: string;
    description?: string;
    format?: "square" | "horizontal";
  },
): string {
  const priceRu =
    options?.price && options.price > 0
      ? `от ${options.price.toLocaleString("ru-RU")} ₽/сутки`
      : "";

  const bullets = [...content.leftItems, ...content.rightItems].slice(0, 6);
  const featuresBlock =
    bullets.length > 0
      ? `KEY FEATURES to display (use these exact Russian phrases):\n` +
        bullets.map((b, i) => `  ${i + 1}. ${b}`).join("\n")
      : `KEY FEATURES: generate 4-5 concise Russian rental advantages for this product.`;

  const descBlock =
    options?.description && options.description.trim().length > 10
      ? `PRODUCT DESCRIPTION (extract key rental features):\n"${options.description.slice(0, 500)}"`
      : "";

  const categoryHint = options?.category ? `Category: ${options.category}. ` : "";
  const aspectNote =
    options?.format === "horizontal"
      ? "Image size: 1200×630 (16:9 horizontal)."
      : "Image size: 1080×1080 (square 1:1).";

  return `Professional marketplace product card image for Russian rental platform "Хочу_То".

PRODUCT: "${content.title}"
${categoryHint}${priceRu ? `RENTAL PRICE: ${priceRu}` : ""}
${featuresBlock}
${descBlock}

VISUAL DESIGN:
- ${aspectNote}
- Clean studio photo of the product as the main visual (center/foreground, sharp, professional)
- Background: clean studio or atmospheric context matching item type
- Semi-transparent dark panel at bottom showing product features as a clean list
- Large bold white title at top: "${content.title}"
${priceRu ? `- Orange price badge (color #C65D3B terracotta): "${priceRu}"` : ""}
- Small "Хочу_То" brand watermark in bottom corner
- Premium Russian marketplace quality (Avito/Wildberries top seller level)
- All Cyrillic text sharp and perfectly legible
- Brand colors: primary #C65D3B (terracotta orange), background accent #4A8587 (teal)
- NO lorem ipsum, NO device frames, NO watermarks except "Хочу_То"

OUTPUT: Complete, ready-to-post product card image.`;
}

// ─── Tier 1: OpenRouter via /chat/completions + modalities ───────────────────

async function tryOpenRouter(
  prompt: string,
  format: "square" | "horizontal" = "square",
): Promise<{ image: Buffer; provider: string } | null> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    logger.warn("infographic.tier1: OPENROUTER_API_KEY not set, skipping");
    return null;
  }

  // OpenRouter использует /chat/completions с полем modalities, НЕ /images/generate
  const aspectRatio = format === "horizontal" ? "16:9" : "1:1";
  const models = getOpenRouterModels();

  for (const model of models) {
    const modalities = pickModalities(model);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60_000);
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://hochu.to",
          "X-Title": "Хочу_То Infographic Generator",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          modalities,
          image_config: { aspect_ratio: aspectRatio },
          stream: false,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      if (res.status === 400 || res.status === 402 || res.status === 404 || res.status === 422) {
        const txt = await res.text().catch(() => "");
        logger.warn(
          { model, status: res.status, body: txt.slice(0, 200) },
          "infographic.tier1: model unavailable, trying next",
        );
        continue;
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        logger.warn(
          { model, status: res.status, body: txt.slice(0, 200) },
          "infographic.tier1: HTTP error, trying next",
        );
        continue;
      }

      const data: any = await res.json();

      // Ответ: choices[0].message.images[0].image_url.url — base64 data URL
      const images: any[] | undefined = data?.choices?.[0]?.message?.images;
      if (images && images.length > 0) {
        const dataUrl: string | undefined = images[0]?.image_url?.url;
        if (dataUrl?.startsWith("data:")) {
          // Парсим base64 из data URL: "data:image/png;base64,<b64>"
          const commaIdx = dataUrl.indexOf(",");
          if (commaIdx !== -1) {
            const b64 = dataUrl.slice(commaIdx + 1);
            logger.info({ model, modalities }, "infographic.tier1: image generated");
            return { image: Buffer.from(b64, "base64"), provider: model };
          }
        }
        // Иногда может прийти и просто URL
        if (typeof dataUrl === "string" && (dataUrl.startsWith("http://") || dataUrl.startsWith("https://"))) {
          const imgRes = await fetch(dataUrl);
          if (imgRes.ok) {
            logger.info({ model }, "infographic.tier1: image fetched from URL");
            return { image: Buffer.from(await imgRes.arrayBuffer()), provider: model };
          }
        }
        logger.warn({ model, dataUrl: String(dataUrl).slice(0, 80) }, "infographic.tier1: unrecognised image_url format");
        continue;
      }

      // Ряд моделей может вернуть изображение прямо в content (text part с data-URI)
      const content: string | undefined = data?.choices?.[0]?.message?.content;
      if (typeof content === "string" && content.startsWith("data:image")) {
        const commaIdx = content.indexOf(",");
        if (commaIdx !== -1) {
          logger.info({ model }, "infographic.tier1: image in content field");
          return { image: Buffer.from(content.slice(commaIdx + 1), "base64"), provider: model };
        }
      }

      logger.warn(
        { model, keys: Object.keys(data?.choices?.[0]?.message ?? {}) },
        "infographic.tier1: no images in response, trying next",
      );
    } catch (e: any) {
      clearTimeout(timer);
      if (e?.name === "AbortError") {
        logger.warn({ model }, "infographic.tier1: timeout, trying next");
        continue;
      }
      logger.warn({ model, err: e?.message }, "infographic.tier1: exception, trying next");
    }
  }

  logger.warn("infographic.tier1: all models exhausted");
  return null;
}

// ─── Tier 2: Gemini multimodal + Imagen 3 ─────────────────────────────────────

async function tryGeminiImageGen(
  prompt: string,
  imageBuffer: Buffer,
): Promise<Buffer | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    logger.warn("infographic.tier2: GEMINI_API_KEY not set, skipping");
    return null;
  }

  // Конвертируем референс-фото в JPEG для отправки в Gemini
  const jpegBuf = await sharp(imageBuffer)
    .rotate()
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  const imageBase64 = jpegBuf.toString("base64");

  const MULTIMODAL_MODELS = [
    "gemini-2.0-flash-exp",
    "gemini-2.0-flash-preview-image-generation",
    "gemini-2.0-flash",
  ];

  for (const model of MULTIMODAL_MODELS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90_000);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ["IMAGE"],
              temperature: 0.8,
            },
          }),
          signal: ctrl.signal,
        },
      );
      clearTimeout(timer);

      if (res.status === 404 || res.status === 400) {
        const txt = await res.text().catch(() => "");
        logger.warn(
          { model, status: res.status, txt: txt.slice(0, 200) },
          "infographic.tier2: model not available",
        );
        continue;
      }
      if (!res.ok) {
        logger.warn({ model, status: res.status }, "infographic.tier2: HTTP error");
        continue;
      }

      const data: any = await res.json();
      const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
      const imgPart = parts.find((p: any) =>
        p.inlineData?.mimeType?.startsWith("image/"),
      );

      if (imgPart?.inlineData?.data) {
        logger.info({ model }, "infographic.tier2: multimodal image generated");
        return Buffer.from(imgPart.inlineData.data, "base64");
      }

      logger.warn(
        { model, partsCount: parts.length },
        "infographic.tier2: no image part in response",
      );
    } catch (e: any) {
      clearTimeout(timer);
      if (e?.name === "AbortError") {
        logger.warn({ model }, "infographic.tier2: timeout, trying next");
        continue;
      }
      logger.warn({ model, err: e?.message }, "infographic.tier2: exception");
    }
  }

  // Sub-fallback: Imagen 3 text-to-image (без референса)
  logger.warn("infographic.tier2: all multimodal models failed, trying Imagen 3");
  return tryImagen3(prompt, apiKey);
}

async function tryImagen3(prompt: string, apiKey: string): Promise<Buffer | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45_000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { sampleCount: 1, aspectRatio: "1:1" },
        }),
        signal: ctrl.signal,
      },
    );
    clearTimeout(timer);

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      logger.warn(
        { status: res.status, txt: txt.slice(0, 200) },
        "infographic.tier2.imagen3: HTTP error",
      );
      return null;
    }

    const data: any = await res.json();
    const b64: string | undefined = data?.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) {
      logger.warn("infographic.tier2.imagen3: empty prediction");
      return null;
    }

    logger.info("infographic.tier2.imagen3: image generated");
    return Buffer.from(b64, "base64");
  } catch (e: any) {
    clearTimeout(timer);
    logger.warn({ err: e?.message }, "infographic.tier2.imagen3: failed");
    return null;
  }
}

// ─── Core service ──────────────────────────────────────────────────────────────

export interface GenerativeInfographicResult {
  image: Buffer;
  /** 1=OpenRouter, 2=Gemini/Imagen3, 3=SVG overlay */
  tier: 1 | 2 | 3;
  provider: string;
}

/**
 * Stage 42: 3-tier generative infographic pipeline.
 *   Tier 1 → OpenRouter /images/generate (DALL-E 3 / Flux)
 *   Tier 2 → Gemini multimodal + Imagen 3 fallback
 *   Tier 3 → SVG overlay (buildMarketplaceInfographic) — никогда не падает
 *
 * Никогда не бросает исключение — всегда возвращает результат.
 */
export async function generateGenerativeInfographic(
  imageBuffer: Buffer,
  content: MarketplaceInfographicContent,
  options?: {
    format?: "square" | "horizontal";
    preprocess?: boolean;
    price?: number;
    category?: string;
    description?: string;
  },
): Promise<GenerativeInfographicResult> {
  const format = options?.format ?? "square";

  // 1. Опциональный препроцессинг
  const sourceBuffer = options?.preprocess
    ? await preprocessForAI(imageBuffer)
    : imageBuffer;

  // 2. Промпт из MarketplaceInfographicContent
  const prompt = buildImagePrompt(content, {
    price: options?.price,
    category: options?.category,
    description: options?.description,
    format,
  });

  // 3. Disk-кэш
  const cacheKey = makeCacheKey(sourceBuffer, prompt);
  const cached = await getCached(cacheKey);
  if (cached) {
    logger.info({ cacheKey: cacheKey.slice(0, 16) }, "infographic: cache hit");
    return { image: cached, tier: 1, provider: "cache" };
  }

  const startedAt = Date.now();

  // 4. Tier 1: OpenRouter
  try {
    const result = await tryOpenRouter(prompt, format);
    if (result) {
      const out = await sharp(result.image).webp({ quality: 90 }).toBuffer();
      await putCached(cacheKey, out);
      logger.info(
        { tier: 1, provider: result.provider, durationMs: Date.now() - startedAt },
        "infographic: tier=1 success",
      );
      return { image: out, tier: 1, provider: result.provider };
    }
  } catch (e: any) {
    logger.warn({ tier: 1, err: e?.message }, "infographic: tier 1 threw unexpectedly");
  }

  // 5. Tier 2: Gemini
  try {
    const raw = await tryGeminiImageGen(prompt, sourceBuffer);
    if (raw) {
      const out = await sharp(raw).webp({ quality: 92 }).toBuffer();
      await putCached(cacheKey, out);
      logger.info(
        { tier: 2, durationMs: Date.now() - startedAt },
        "infographic: tier=2 success",
      );
      return { image: out, tier: 2, provider: "gemini" };
    }
  } catch (e: any) {
    logger.warn({ tier: 2, err: e?.message }, "infographic: tier 2 threw unexpectedly");
  }

  // 6. Tier 3: SVG overlay — всегда работает
  logger.warn(
    { durationMs: Date.now() - startedAt },
    "infographic: all AI tiers failed → SVG overlay (tier 3)",
  );
  const priceText =
    options?.price && options.price > 0
      ? `от ${options.price.toLocaleString("ru-RU")} ₽/сут`
      : "";
  const fallback = await buildMarketplaceInfographic(imageBuffer, content, priceText);
  return { image: fallback, tier: 3, provider: "svg-overlay" };
}

// ─── Preprocessing ─────────────────────────────────────────────────────────────

export async function preprocessForAI(imageBuffer: Buffer): Promise<Buffer> {
  return sharp(imageBuffer)
    .rotate()
    .resize(1024, 1024, { fit: "cover", position: "centre" })
    .sharpen({ sigma: 1.5 })
    .modulate({ brightness: 1.05, saturation: 1.1 })
    .png()
    .toBuffer();
}
