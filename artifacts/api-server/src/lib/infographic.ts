/**
 * Stage 41 — Generative Infographic Service
 *
 * generateGenerativeInfographic(): 3-tier fallback chain
 *   Tier 1 — OpenRouter (LLM-only, всегда throws → cascade to Tier 2)
 *   Tier 2 — Google Gemini 2.0 Flash multimodal image generation
 *             (принимает фото-референс + текстовый промпт → генерирует карточку)
 *   Tier 3 — graceful degradation: возвращает исходный imageBuffer в WebP
 *
 * buildImagePrompt(): строит детальный промпт для карточки товара.
 * preprocessForAI(): опциональный препроцессинг (resize + sharpen + saturation).
 *
 * Audit-логирование: структурированные Pino-записи (tier, durationMs, err).
 * SHA-256 disk-cache 24ч в /tmp/infographic-cache/ (shared с image-service).
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

/**
 * buildImagePrompt — строит детальный промпт для Gemini image generation.
 *
 * Модель получает фото-референс (само изображение вещи) + этот промпт.
 * Она должна самостоятельно распознать вещь, взять характеристики из description
 * (или придумать подходящие), и нарисовать готовую карточку товара.
 *
 * Промпт на английском — модель лучше следует инструкциям.
 * Пользовательский контент (title, bullets, description) вставляется как есть (на русском).
 */
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
    : `KEY FEATURES: examine the product in the reference photo carefully and generate 4-5 concise Russian rental advantages (e.g. комплектация, состояние, удобство использования).`;

  const descBlock = item.description && item.description.trim().length > 10
    ? `PRODUCT DESCRIPTION (extract key rental features from this):\n"${item.description.slice(0, 500)}"`
    : `No description provided — infer the product's key rental benefits from the reference image.`;

  const categoryHint = item.category ? `Category: ${item.category}. ` : "";

  return `You are a professional graphic designer creating marketplace product cards for "Хочу_То" — a Russian item rental platform (like Avito/Ozon quality).

TASK: Create a complete, publication-ready product card image (1080×1080 square).

REFERENCE PHOTO: The attached image shows the actual rental item. ${categoryHint}Use it as the main product visual.

PRODUCT CARD CONTENT:
- TITLE (large bold Cyrillic, top area): "${item.title}"
${priceRu ? `- PRICE BADGE (rounded pill, terracotta/orange #C65D3B color): "${priceRu}"` : ""}
${featuresBlock}
${descBlock}

VISUAL DESIGN REQUIREMENTS:
- Place the product prominently in center/foreground — sharp, well-lit, professional
- Background: clean studio setting or atmospheric context matching the item type (outdoor gear → nature backdrop; tools → workshop; electronics → minimal desk)
- Two semi-transparent panels (white and dark) on the sides or bottom — use them for the features list
- Title text: bold, white or dark (high contrast), Montserrat-style sans-serif, perfectly readable
- Price badge: terracotta/orange pill shape, white bold text, lower-left area
- Features: clean numbered or bulleted list in Cyrillic, readable font, no blur
- Small brand text "Хочу_То" in bottom corner
- Overall feel: premium Russian marketplace (Avito/Wildberries top seller level)
- No watermarks, no device frames, no lorem ipsum

CRITICAL: All Cyrillic text must be perfectly sharp and legible. The final card should look like it was made by a professional designer, not auto-generated.`;
}

// ─── Tier helpers ─────────────────────────────────────────────────────────────

/**
 * Tier 1: OpenRouter — google/gemini-2.5-flash-image (image input + image output).
 * Отправляет фото-референс + промпт, получает сгенерированную карточку товара.
 * Модели на OpenRouter: google/gemini-2.5-flash-image, google/gemini-3.1-flash-image-preview
 */
async function tryOpenRouter(prompt: string, imageBuffer: Buffer): Promise<Buffer> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const jpegBuf = await sharp(imageBuffer)
    .rotate()
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  const imageBase64 = jpegBuf.toString("base64");

  const MODELS = [
    "google/gemini-2.5-flash-image",
    "google/gemini-3.1-flash-image-preview",
  ];

  let lastErr = "";
  for (const model of MODELS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90_000);
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://hochu.to",
          "X-Title": "Хочу_То Infographic Generator",
        },
        body: JSON.stringify({
          model,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            ],
          }],
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      if (res.status === 404 || res.status === 400) {
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
      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error(`${model}: empty response`);

      // content может быть строкой или массивом частей
      const parts: any[] = Array.isArray(content) ? content : [];
      const imgPart = parts.find((p: any) =>
        p.type === "image_url" && p.image_url?.url,
      );

      if (!imgPart) {
        // Иногда модель возвращает только текст (не смогла сгенерировать)
        lastErr = `${model}: no image in response (parts: ${parts.length}, type: ${typeof content})`;
        logger.warn({ model, lastErr }, "infographic.openrouter: no image part");
        continue;
      }

      // Извлекаем изображение: data URI или внешний URL
      const imgUrl: string = imgPart.image_url.url;
      let imgBuffer: Buffer;
      if (imgUrl.startsWith("data:")) {
        const base64Data = imgUrl.split(",")[1];
        imgBuffer = Buffer.from(base64Data, "base64");
      } else {
        const imgRes = await fetch(imgUrl);
        if (!imgRes.ok) throw new Error(`${model}: failed to fetch image URL: ${imgRes.status}`);
        imgBuffer = Buffer.from(await imgRes.arrayBuffer());
      }

      logger.info({ model }, "infographic.openrouter: image generated successfully");
      return imgBuffer;
    } catch (e: any) {
      clearTimeout(timer);
      if (e?.name === "AbortError") { lastErr = `${model}: timeout`; continue; }
      lastErr = e?.message || String(e);
      if (lastErr.includes("HTTP 404") || lastErr.includes("HTTP 400") || lastErr.includes("no image")) continue;
      throw e;
    }
  }

  throw new Error(`OpenRouter image generation failed: ${lastErr}`);
}

/**
 * Tier 2: Gemini 2.0 Flash multimodal image generation.
 *
 * Отправляет фото-референс + промпт в модель, которая умеет генерировать изображения.
 * Endpoint: generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation
 * Fallback: imagen-3.0-generate-001 (text-to-image, без референса)
 *
 * Auth: ?key=GEMINI_API_KEY (стандарт Gemini REST)
 */
async function tryGeminiImageGen(prompt: string, imageBuffer: Buffer): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  // Конвертируем фото-референс в JPEG base64 для inline данных
  const jpegBuf = await sharp(imageBuffer)
    .rotate()
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  const imageBase64 = jpegBuf.toString("base64");

  // Модели с поддержкой image generation (пробуем по очереди)
  const MODELS = [
    "gemini-2.0-flash-preview-image-generation",
    "gemini-2.0-flash-exp",
  ];

  let lastErr = "";

  for (const model of MODELS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60_000);
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
              responseModalities: ["IMAGE"],
              temperature: 0.9,
            },
          }),
          signal: ctrl.signal,
        },
      );
      clearTimeout(timer);

      if (res.status === 404 || res.status === 400) {
        const txt = await res.text().catch(() => "");
        lastErr = `${model}: HTTP ${res.status} — ${txt.slice(0, 150)}`;
        logger.warn({ model, status: res.status }, "infographic: model not available, trying next");
        continue;
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`${model}: HTTP ${res.status}: ${txt.slice(0, 200)}`);
      }

      const data: any = await res.json();
      // Ищем image part в ответе
      const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
      const imgPart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));
      if (!imgPart?.inlineData?.data) {
        throw new Error(`${model}: no image in response (parts: ${parts.length})`);
      }
      logger.info({ model }, "infographic.gemini: image generated successfully");
      return Buffer.from(imgPart.inlineData.data, "base64");
    } catch (e: any) {
      clearTimeout(timer);
      if (e?.name === "AbortError") { lastErr = `${model}: timeout`; continue; }
      lastErr = e?.message || String(e);
      if (lastErr.includes("HTTP 404") || lastErr.includes("HTTP 400")) continue;
      throw e; // другие ошибки — сразу наверх
    }
  }

  // Fallback: Imagen 3 text-to-image (без референса, но всё равно лучше ничего)
  logger.warn({ lastErr }, "infographic.gemini: all multimodal models failed, trying Imagen3 text-to-image");
  return tryImagen3TextOnly(prompt, apiKey);
}

/** Imagen 3 text-to-image fallback (без фото-референса) */
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
 * Tier 1: OpenRouter (stub → cascade)
 * Tier 2: Gemini 2.0 multimodal + Imagen 3 fallback
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
    return { buffer: cached, tier: 2 };
  }

  const startedAt = Date.now();

  // ── Tier 1: OpenRouter ─────────────────────────────────────────────────────
  try {
    const raw = await tryOpenRouter(prompt, imageBuffer);
    const out = await sharp(raw).webp({ quality: 90 }).toBuffer();
    await putCached(cacheKey, out);
    logger.info({ tier: 1, durationMs: Date.now() - startedAt }, "infographic: tier=1 success");
    return { buffer: out, tier: 1 };
  } catch (e1: any) {
    logger.warn({ tier: 1, err: e1?.message }, "infographic: tier 1 failed → Gemini");
  }

  // ── Tier 2: Gemini multimodal image generation ─────────────────────────────
  try {
    const raw = await tryGeminiImageGen(prompt, imageBuffer);
    const out = await sharp(raw).webp({ quality: 92 }).toBuffer();
    await putCached(cacheKey, out);
    logger.info({ tier: 2, durationMs: Date.now() - startedAt }, "infographic: tier=2 success");
    return { buffer: out, tier: 2 };
  } catch (e2: any) {
    logger.warn({ tier: 2, err: e2?.message, durationMs: Date.now() - startedAt }, "infographic: tier 2 failed → degradation");
  }

  // ── Tier 3: Graceful degradation ───────────────────────────────────────────
  logger.error({ tier: 3, durationMs: Date.now() - startedAt }, "infographic: all tiers failed — original image");
  const fallback = await sharp(imageBuffer)
    .rotate()
    .resize(1080, 1080, { fit: "cover", position: "centre" })
    .webp({ quality: 85 })
    .toBuffer();
  return { buffer: fallback, tier: 3 };
}

// ─── Preprocessing ─────────────────────────────────────────────────────────────

/**
 * preprocessForAI — опциональный препроцессинг перед отправкой в AI.
 * Resize до 1024×1024, повышение резкости и насыщенности.
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
