/**
 * Stage 41 — Generative Infographic Service
 *
 * generateGenerativeInfographic(): 3-tier fallback chain
 *   Tier 1 — OpenRouter /images/generate (DALL-E 3 / Flux) — text-to-image,
 *             детальный промпт на основе товарных данных, без референса
 *   Tier 2 — Google Gemini 2.0 Flash multimodal image generation
 *             (фото-референс + промпт → генерирует карточку)
 *   Tier 3 — graceful degradation: возвращает исходный imageBuffer в WebP
 *
 * buildImagePrompt(): строит детальный промпт для image generation.
 * preprocessForAI(): опциональный препроцессинг (resize + sharpen + saturation).
 *
 * Audit-логирование: структурированные Pino-записи (tier, durationMs, err).
 * SHA-256 disk-cache 24ч в /tmp/infographic-cache/.
 */
import { createHash } from "crypto";
import { promises as fs } from "fs";
import sharp from "sharp";
import { logger } from "./logger.js";

// ─── Cache ────────────────────────────────────────────────────────────────────

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

export function buildImagePrompt(item: {
  title: string;
  price: number;
  bullets: string[];
  description?: string;
  category?: string;
  format?: "square" | "horizontal";
}): string {
  const priceRu = item.price > 0
    ? `от ${item.price.toLocaleString("ru-RU")} ₽/сутки`
    : "";

  const featuresBlock = item.bullets.length > 0
    ? `KEY FEATURES to display (use these exact Russian phrases):\n` +
      item.bullets.slice(0, 5).map((b, i) => `  ${i + 1}. ${b}`).join("\n")
    : `KEY FEATURES: generate 4-5 concise Russian rental advantages for this product.`;

  const descBlock = item.description && item.description.trim().length > 10
    ? `PRODUCT DESCRIPTION (extract key rental features):\n"${item.description.slice(0, 500)}"`
    : "";

  const categoryHint = item.category ? `Category: ${item.category}. ` : "";

  return `Professional marketplace product card image (1080×1080 square) for Russian rental platform "Хочу_То".

PRODUCT: "${item.title}"
${categoryHint}${priceRu ? `RENTAL PRICE: ${priceRu}` : ""}
${featuresBlock}
${descBlock}

VISUAL DESIGN:
- Clean studio photo of the product as the main visual (center/foreground, sharp, professional)
- Background: clean studio or atmospheric context matching item type
- Semi-transparent dark panel at bottom showing product features as a clean list
- Large bold white title at top: "${item.title}"
${priceRu ? `- Orange price badge (color #C65D3B): "${priceRu}"` : ""}
- Small "Хочу_То" brand watermark in corner
- Premium Russian marketplace quality (Avito/Wildberries top seller level)
- All Cyrillic text sharp and perfectly legible
- No lorem ipsum, no device frames

OUTPUT: Complete, ready-to-post product card image.`;
}

// ─── Tier 1: OpenRouter /images/generate ──────────────────────────────────────

/**
 * Tier 1: OpenRouter images/generate endpoint.
 * Использует DALL-E 3 или Flux — настоящие image generation модели.
 * Не требует референс-фото (text-to-image), но генерирует красивую карточку.
 * Fallback модели пробуются по очереди.
 */
async function tryOpenRouter(prompt: string, _imageBuffer: Buffer): Promise<Buffer> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  // Пробуем модели по порядку (DALL-E 3 → Flux Pro → Flux 1.1)
  const MODELS = [
    "openai/dall-e-3",
    "black-forest-labs/flux-1.1-pro",
    "black-forest-labs/flux-pro",
  ];

  let lastErr = "";
  for (const model of MODELS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60_000);
    try {
      const res = await fetch("https://openrouter.ai/api/v1/images/generate", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://hochu.to",
          "X-Title": "Хочу_То Infographic Generator",
        },
        body: JSON.stringify({
          model,
          prompt,
          n: 1,
          size: "1024x1024",
          quality: "standard",
          response_format: "url",
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      if (res.status === 404 || res.status === 400 || res.status === 402) {
        const txt = await res.text().catch(() => "");
        lastErr = `${model}: HTTP ${res.status} — ${txt.slice(0, 150)}`;
        logger.warn({ model, status: res.status }, "infographic.openrouter: model unavailable, trying next");
        continue;
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`${model}: HTTP ${res.status}: ${txt.slice(0, 200)}`);
      }

      const data: any = await res.json();
      const imgUrl: string | undefined = data?.data?.[0]?.url;
      const b64: string | undefined = data?.data?.[0]?.b64_json;

      if (b64) {
        logger.info({ model }, "infographic.openrouter: image generated (b64)");
        return Buffer.from(b64, "base64");
      }
      if (imgUrl) {
        const imgRes = await fetch(imgUrl);
        if (!imgRes.ok) throw new Error(`${model}: failed to fetch generated image: ${imgRes.status}`);
        logger.info({ model }, "infographic.openrouter: image generated (url)");
        return Buffer.from(await imgRes.arrayBuffer());
      }

      lastErr = `${model}: empty response (no url, no b64)`;
      logger.warn({ model, data: JSON.stringify(data).slice(0, 200) }, "infographic.openrouter: no image in response");
      continue;
    } catch (e: any) {
      clearTimeout(timer);
      if (e?.name === "AbortError") { lastErr = `${model}: timeout`; continue; }
      lastErr = e?.message || String(e);
      if (lastErr.includes("HTTP 404") || lastErr.includes("HTTP 400") || lastErr.includes("HTTP 402")) continue;
      throw e;
    }
  }

  throw new Error(`OpenRouter image generation failed: ${lastErr}`);
}

// ─── Tier 2: Gemini multimodal image generation ───────────────────────────────

/**
 * Tier 2: Gemini 2.0 Flash — multimodal image generation.
 * Принимает фото-референс + промпт, генерирует карточку товара.
 * Использует актуальные модели с поддержкой IMAGE output.
 */
async function tryGeminiImageGen(prompt: string, imageBuffer: Buffer): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const jpegBuf = await sharp(imageBuffer)
    .rotate()
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  const imageBase64 = jpegBuf.toString("base64");

  // Актуальные модели с image generation output (пробуем по очереди)
  const MODELS = [
    "gemini-2.0-flash-exp",
    "gemini-2.0-flash-preview-image-generation",
    "gemini-2.0-flash",
  ];

  let lastErr = "";

  for (const model of MODELS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90_000);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
              ],
            }],
            generationConfig: {
              // TEXT + IMAGE: модель может дополнить картинку текстом — нужны оба
              responseModalities: ["TEXT", "IMAGE"],
              temperature: 0.8,
            },
          }),
          signal: ctrl.signal,
        },
      );
      clearTimeout(timer);

      if (res.status === 404 || res.status === 400) {
        const txt = await res.text().catch(() => "");
        lastErr = `${model}: HTTP ${res.status} — ${txt.slice(0, 200)}`;
        logger.warn({ model, status: res.status, lastErr }, "infographic.gemini: model not available");
        continue;
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`${model}: HTTP ${res.status}: ${txt.slice(0, 200)}`);
      }

      const data: any = await res.json();
      const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
      const imgPart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));

      if (!imgPart?.inlineData?.data) {
        const textPart = parts.find((p: any) => p.text);
        lastErr = `${model}: no image in response (parts: ${parts.length}, has_text: ${!!textPart})`;
        logger.warn({ model, lastErr }, "infographic.gemini: no image part");
        continue;
      }

      logger.info({ model }, "infographic.gemini: image generated successfully");
      return Buffer.from(imgPart.inlineData.data, "base64");
    } catch (e: any) {
      clearTimeout(timer);
      if (e?.name === "AbortError") { lastErr = `${model}: timeout`; continue; }
      lastErr = e?.message || String(e);
      if (lastErr.includes("HTTP 404") || lastErr.includes("HTTP 400")) continue;
      throw e;
    }
  }

  // Fallback: Imagen 3 text-to-image (без референса, но стабильно)
  logger.warn({ lastErr }, "infographic.gemini: all multimodal models failed, trying Imagen3");
  return tryImagen3TextOnly(prompt, apiKey);
}

/** Imagen 3 text-to-image fallback */
async function tryImagen3TextOnly(prompt: string, apiKey: string): Promise<Buffer> {
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
      throw new Error(`Imagen3 HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
    const data: any = await res.json();
    const b64: string | undefined = data?.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) throw new Error("Imagen3: empty prediction");
    logger.info("infographic.imagen3: image generated successfully");
    return Buffer.from(b64, "base64");
  } finally {
    clearTimeout(timer);
  }
}

// ─── Core service ──────────────────────────────────────────────────────────────

export interface GenerativeInfographicResult {
  buffer: Buffer;
  /** Какой tier реально отработал: 1=OpenRouter, 2=Gemini/Imagen3, 3=degradation */
  tier: 1 | 2 | 3;
}

/**
 * generateGenerativeInfographic — 3-tier fallback chain.
 *
 * Tier 1: OpenRouter /images/generate (DALL-E 3 / Flux) — надёжная генерация
 * Tier 2: Gemini 2.0 Flash multimodal + Imagen 3 fallback
 * Tier 3: возвращает исходное изображение в WebP (без оверлеев)
 */
export async function generateGenerativeInfographic(
  imageBuffer: Buffer,
  itemData: {
    title: string;
    price: number;
    bullets: string[];
    description?: string;
    category?: string;
    format?: "square" | "horizontal";
  },
): Promise<GenerativeInfographicResult> {
  const prompt = buildImagePrompt(itemData);
  const cacheKey = makeCacheKey(imageBuffer, prompt);

  const cached = await getCached(cacheKey);
  if (cached) {
    logger.info({ cacheKey: cacheKey.slice(0, 16) }, "infographic.generative: cache hit");
    return { buffer: cached, tier: 1 };
  }

  const startedAt = Date.now();

  // ── Tier 1: OpenRouter /images/generate ─────────────────────────────────────
  try {
    const raw = await tryOpenRouter(prompt, imageBuffer);
    const out = await sharp(raw).webp({ quality: 90 }).toBuffer();
    await putCached(cacheKey, out);
    logger.info({ tier: 1, durationMs: Date.now() - startedAt }, "infographic: tier=1 success");
    return { buffer: out, tier: 1 };
  } catch (e1: any) {
    logger.warn({ tier: 1, err: e1?.message }, "infographic: tier 1 failed → Gemini");
  }

  // ── Tier 2: Gemini multimodal image generation ──────────────────────────────
  try {
    const raw = await tryGeminiImageGen(prompt, imageBuffer);
    const out = await sharp(raw).webp({ quality: 92 }).toBuffer();
    await putCached(cacheKey, out);
    logger.info({ tier: 2, durationMs: Date.now() - startedAt }, "infographic: tier=2 success");
    return { buffer: out, tier: 2 };
  } catch (e2: any) {
    logger.warn({ tier: 2, err: e2?.message, durationMs: Date.now() - startedAt }, "infographic: tier 2 failed → degradation");
  }

  // ── Tier 3: Graceful degradation ─────────────────────────────────────────────
  logger.error({ tier: 3, durationMs: Date.now() - startedAt }, "infographic: all tiers failed — original image");
  const fallback = await sharp(imageBuffer)
    .rotate()
    .resize(1080, 1080, { fit: "cover", position: "centre" })
    .webp({ quality: 85 })
    .toBuffer();
  return { buffer: fallback, tier: 3 };
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
