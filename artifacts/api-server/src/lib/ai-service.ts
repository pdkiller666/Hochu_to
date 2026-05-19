/**
 * Stage 30-Refactoring — OpenRouter AI Gateway
 *
 * Единая точка генерации продающих описаний и буллетов инфографики.
 * Весь реальный LLM-трафик идёт через OpenRouter (openrouter.ai) посредством
 * стандартного SDK `openai` с переопределённым baseURL.
 *
 * Поддерживаемые значения platform_settings.activeAiProvider:
 *   - 'mock'       — format-заглушка, без сети (default / аварийный kill-switch)
 *   - 'openrouter' — новый основной провайдер; модель = OPENROUTER_MODEL env
 *                    (дефолт: "deepseek/deepseek-chat")
 *
 * Backward-compatible алиасы (старые значения в БД продолжают работать):
 *   - 'openai'     → openai/gpt-4o-mini via OpenRouter
 *   - 'gemini'     → google/gemini-flash-1.5 via OpenRouter
 *   - 'amvera'     → deepseek/deepseek-chat via OpenRouter
 *
 * Vision-арбитратор (arbitrateWithGeminiVision) — работает через прямой
 * Gemini API (нужен base64 multimodal), OpenRouter не задействован.
 *
 * При любой ошибке/отсутствии ключа сервис мягко деградирует в 'mock',
 * чтобы UX не сломался. Все ошибки логируются Pino-логгером.
 */
import OpenAI from "openai";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { logger } from "./logger.js";
import { getPlatformSettings } from "./platform-settings.js";
import { UPLOADS_DIR } from "./uploadsDir.js";
import { db, claimsTable, bookingsTable, digitalActsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

// ─── Константы ───────────────────────────────────────────────────────────────

const MOCK_DELAY_MS = 1500;
const OPENROUTER_TIMEOUT_MS = 30_000;
const DEEPSEEK_DIRECT_TIMEOUT_MS = 30_000;

// Stage 33.0 (сохранён): прямой DeepSeek API — резервный провайдер перед mock.
// Включается автоматически при ошибке OpenRouter (если ключ DEEPSEEK_API_KEY задан).
const DEEPSEEK_DIRECT_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_DIRECT_MODEL = "deepseek-chat";

/** Дефолтная модель OpenRouter (если OPENROUTER_MODEL не задан) */
const OPENROUTER_DEFAULT_MODEL = "deepseek/deepseek-chat";

/**
 * Маппинг старых значений activeAiProvider → модель OpenRouter.
 * Позволяет не делать DB-миграцию при переходе со Stage 30A на Refactoring.
 */
const PROVIDER_TO_MODEL: Record<string, string> = {
  openrouter: process.env.OPENROUTER_MODEL ?? OPENROUTER_DEFAULT_MODEL,
  openai:     "openai/gpt-4o-mini",
  gemini:     process.env.OPENROUTER_GEMINI_MODEL ?? "google/gemini-flash-1.5",
  amvera:     "deepseek/deepseek-chat", // DeepSeek-V3 — ближайший эквивалент Amvera
};

// ─── OpenRouter-клиент ────────────────────────────────────────────────────────

/**
 * Создаём клиент lazily — только когда реально нужен.
 * Если OPENROUTER_API_KEY не задан, бросим ошибку при первом вызове
 * (а не при загрузке модуля), чтобы mock-режим не требовал ключа.
 */
function getOpenRouterClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
    defaultHeaders: {
      "HTTP-Referer": "https://hochuto.ru",
      "X-Title": "Hochu_To_Marketplace",
    },
    timeout: OPENROUTER_TIMEOUT_MS,
  });
}

// ─── Типы ──────────────────────────────────────────────────────────────────────

export type AiProvider = "mock" | "openrouter" | "openai" | "amvera" | "gemini";

export interface GenerateInput {
  title: string;
  category?: string | null;
  condition?: string | null;
}

export interface GenerateResult {
  text: string;
  provider: AiProvider;
  /** Истинный провайдер, реально сгенерировавший текст (после возможного fallback) */
  actualProvider: AiProvider;
  /** true, если случился graceful fallback в mock из-за ошибки реального API */
  fallback: boolean;
  fallbackReason?: string;
  /** OpenRouter-модель, которая ответила (для диагностики в UI) */
  model?: string;
}

// ─── Промпты ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT =
  "Ты крутой маркетолог. Напиши продающее описание для вещи, которую сдают в аренду. " +
  "Используй эмодзи и списки. Текст должен быть на русском.";

function userPrompt({ title, category, condition }: GenerateInput): string {
  const parts = [`Название: ${title}`];
  if (category) parts.push(`Категория: ${category}`);
  if (condition) parts.push(`Состояние: ${condition}`);
  return parts.join("\n");
}

// ─── MOCK ─────────────────────────────────────────────────────────────────────

async function generateMock(input: GenerateInput): Promise<string> {
  await new Promise((r) => setTimeout(r, MOCK_DELAY_MS));
  const { title, category, condition } = input;
  const cat = category ? ` из категории «${category}»` : "";
  const cond = condition
    ? `\n• 🛡️ Состояние: ${condition} — проверено и готово к работе.`
    : "";

  return [
    `✨ ${title} в аренду — то, что вам нужно!`,
    "",
    `Готовы предложить вам ${title.toLowerCase()}${cat}. Идеально подойдёт как для разовой задачи, так и для долгосрочного использования.`,
    "",
    "🔑 Что вы получаете:",
    "• ⚡ Быстрая выдача в удобное время и месте",
    "• 💰 Прозрачная цена без скрытых сборов",
    "• 📋 Подробная инструкция и поддержка по любому вопросу" + cond,
    "• 🤝 Возможность продлить или вернуть досрочно",
    "",
    "📦 Отлично подходит для:",
    "• разовых проектов и мероприятий",
    "• тест-драйва перед покупкой",
    "• любых задач, где собственная вещь — это лишние затраты",
    "",
    "📞 Свяжитесь со мной — отвечу на все вопросы и оформим бронь за пару минут!",
  ].join("\n");
}

// ─── OpenRouter: генерация описания ──────────────────────────────────────────

async function generateViaOpenRouter(
  input: GenerateInput,
  model: string,
): Promise<string> {
  const client = getOpenRouterClient();
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.8,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt(input) },
    ],
  });
  const text = completion.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error(`OpenRouter (${model}): empty response`);
  }
  return text.trim();
}

// ─── Direct DeepSeek (Stage 33.0 — резерв перед mock) ────────────────────────
//
// Используется как промежуточный fallback между OpenRouter и mock:
//   OpenRouter ошибка → пробуем прямой DeepSeek → если нет ключа/ошибка → mock
// OpenAI-совместимый формат (api.deepseek.com). Ключ: DEEPSEEK_API_KEY.

async function generateDirectDeepSeek(input: GenerateInput): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DEEPSEEK_DIRECT_TIMEOUT_MS);

  try {
    const res = await fetch(DEEPSEEK_DIRECT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_DIRECT_MODEL,
        temperature: 0.8,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt(input) },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`DeepSeek HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
    const data: any = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) throw new Error("DeepSeek: empty response");
    return text.trim();
  } finally {
    clearTimeout(timer);
  }
}

async function bulletsDirectDeepSeek(
  title: string,
  category?: string | null,
): Promise<string[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DEEPSEEK_DIRECT_TIMEOUT_MS);

  try {
    const res = await fetch(DEEPSEEK_DIRECT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_DIRECT_MODEL,
        temperature: 0.6,
        messages: [
          { role: "system", content: INFOGRAPHIC_SYSTEM_PROMPT },
          { role: "user", content: infographicUserPrompt(title, category) },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`DeepSeek HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
    const data: any = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) throw new Error("DeepSeek: empty response");
    const bullets = parseBulletsFromLLM(text);
    if (bullets.length < 3) throw new Error("DeepSeek: less than 3 bullets parsed");
    return bullets;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Вспомогательные: резолвер провайдера ────────────────────────────────────

function isValidProvider(p: string | undefined | null): p is AiProvider {
  return (
    p === "mock" ||
    p === "openrouter" ||
    p === "openai" ||
    p === "amvera" ||
    p === "gemini"
  );
}

/**
 * Разрешает активный провайдер с учётом kill-switch админа.
 *
 * Порядок приоритетов:
 *  1. Если DB-настройка = 'mock' → форсируем mock (kill-switch расходов LLM).
 *  2. Per-request провайдер (если валиден и не mock).
 *  3. DB-настройка.
 *  4. Дефолт — 'openrouter'.
 */
async function resolveProvider(requested?: string | null): Promise<AiProvider> {
  const settings = await getPlatformSettings();
  const dbProvider: AiProvider = isValidProvider(settings.activeAiProvider)
    ? (settings.activeAiProvider as AiProvider)
    : "openrouter";

  if (dbProvider === "mock") return "mock";
  if (isValidProvider(requested) && requested !== "mock") return requested;
  return dbProvider;
}

/**
 * Возвращает OpenRouter-модель для провайдера.
 * Если провайдер "openrouter" — читает OPENROUTER_MODEL из env.
 */
function resolveModel(provider: AiProvider): string {
  return PROVIDER_TO_MODEL[provider] ?? OPENROUTER_DEFAULT_MODEL;
}

// ─── Главная точка: описание объявления ──────────────────────────────────────

/**
 * Генерирует продающее описание для объявления.
 * При ошибке реального провайдера мягко падает в mock.
 */
export async function generateListingDescription(
  input: GenerateInput,
  requestedProvider?: string | null,
): Promise<GenerateResult> {
  if (!input.title || !input.title.trim()) {
    throw new Error("title is required");
  }

  const provider = await resolveProvider(requestedProvider);

  if (provider === "mock") {
    const text = await generateMock(input);
    return { text, provider: "mock", actualProvider: "mock", fallback: false };
  }

  const model = resolveModel(provider);

  try {
    let text: string;
    try {
      text = await generateViaOpenRouter(input, model);
    } catch (openRouterErr: any) {
      // OpenRouter недоступен → пробуем прямой DeepSeek (Stage 33.0 резерв)
      logger.warn(
        { provider, model, err: openRouterErr?.message },
        "ai-service: OpenRouter failed, trying direct DeepSeek API",
      );
      text = await generateDirectDeepSeek(input);
    }
    logger.info(
      { provider, model, title: input.title.slice(0, 60) },
      "ai-service: description generation success",
    );
    return { text, provider, actualProvider: provider, fallback: false, model };
  } catch (err: any) {
    const reason = err?.message || String(err);
    logger.error(
      { provider, model, err: reason },
      "ai-service: all providers failed, falling back to mock",
    );
    const text = await generateMock(input);
    return {
      text,
      provider,
      actualProvider: "mock",
      fallback: true,
      fallbackReason: reason,
    };
  }
}

// ─── Stage 33 — AI Арбитражор (Vision Analysis) ──────────────────────────────
//
// ИЗОЛИРОВАНО от текстовых функций. НЕ использует OpenRouter SDK.
// Отдельная константа, отдельный таймаут, отдельный промпт.
// Прямой Gemini API через fetch (multimodal base64 — OpenRouter не поддерживает
// произвольные файлы base64 в том же интерфейсе).
//
// Модель берётся из env GEMINI_VISION_MODEL; дефолт — "gemini-flash-latest".
// ⚠️ НЕ менять дефолт на "gemini-1.5-flash" — этот алиас даёт 404 на v1beta endpoint
// (Stage 30G journal). Алиас "*-latest" — единственный стабильный вариант.

const GEMINI_VISION_MODEL = process.env.GEMINI_VISION_MODEL || "gemini-flash-latest";
const GEMINI_VISION_TIMEOUT_MS = 40_000;

const VISION_ARBITRATION_PROMPT =
  "You are an impartial rental damage arbitrator. " +
  "The photos show the item BEFORE the rental (check-in) and AFTER (check-out). " +
  "Analyze visible damage differences and assign fault to the renter. " +
  "Output ONLY valid JSON with no markdown wrapping, no explanation outside the JSON:\n" +
  '{"faultEstimatePercent":<0-100>,"confidence":"low|medium|high",' +
  '"verdictDraft":"<1-3 neutral Russian sentences>",' +
  '"evidenceCitations":["<observation 1>","<observation 2>"]}' +
  "\nDo NOT calculate monetary amounts. Be objective and concise.";

export interface AiVerdictResult {
  faultEstimatePercent: number;
  confidence: "low" | "medium" | "high";
  verdictDraft: string;
  evidenceCitations: string[];
  error?: string;
}

/**
 * Stage 33 — запросить AI-анализ фото из Цифровых Актов для заявки.
 * Читает digital_acts (check_in + check_out) из БД, загружает фото с диска,
 * конвертирует в base64, отправляет в Gemini Vision напрямую.
 *
 * КРИТИЧНО: не трогает generateViaOpenRouter. Прямой fetch к Google API.
 */
export async function arbitrateWithGeminiVision(claimId: number): Promise<AiVerdictResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return { faultEstimatePercent: 0, confidence: "low", verdictDraft: "", evidenceCitations: [], error: "GEMINI_API_KEY не задан" };
  }

  try {
    // 1. Получаем заявку
    const [claim] = await db.select().from(claimsTable).where(eq(claimsTable.id, claimId)).limit(1);
    if (!claim) {
      return { faultEstimatePercent: 0, confidence: "low", verdictDraft: "", evidenceCitations: [], error: "Заявка не найдена" };
    }

    // 2. Получаем бронь для поиска актов
    const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, claim.bookingId)).limit(1);
    if (!booking) {
      return { faultEstimatePercent: 0, confidence: "low", verdictDraft: "", evidenceCitations: [], error: "Бронирование не найдено" };
    }

    // 3. Получаем оба цифровых акта (check_in + check_out)
    const acts = await db
      .select()
      .from(digitalActsTable)
      .where(eq(digitalActsTable.bookingId, claim.bookingId));

    const checkInAct = acts.find((a) => a.type === "check_in");
    const checkOutAct = acts.find((a) => a.type === "check_out");

    if (!checkInAct || !checkOutAct) {
      return {
        faultEstimatePercent: 0,
        confidence: "low",
        verdictDraft: "",
        evidenceCitations: [],
        error: `Отсутствуют акты: ${!checkInAct ? "приёмки" : ""}${!checkOutAct ? " возврата" : ""}`.trim(),
      };
    }

    // 4. Загружаем фото (до 3 из каждого акта), ресайзим через sharp и конвертируем в base64
    async function loadPhotos(photos: string[]): Promise<Array<{ data: string; mimeType: string }>> {
      const result: Array<{ data: string; mimeType: string }> = [];
      for (const photoUrl of photos.slice(0, 3)) {
        try {
          // photoUrl вида /uploads/filename.jpg
          const filename = path.basename(photoUrl);
          if (!filename || filename.includes("..")) continue;
          const filePath = path.join(UPLOADS_DIR, filename);
          const rawBuf = await fs.readFile(filePath);
          // Ресайз до 1280×1280, JPEG 80% — уменьшает payload и ускоряет Gemini
          const resized = await sharp(rawBuf)
            .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();
          result.push({ data: resized.toString("base64"), mimeType: "image/jpeg" });
        } catch {
          /* пропускаем недоступные или битые фото */
        }
      }
      return result;
    }

    const checkInPhotos = Array.isArray(checkInAct.photos) ? checkInAct.photos as string[] : [];
    const checkOutPhotos = Array.isArray(checkOutAct.photos) ? checkOutAct.photos as string[] : [];

    const [inImgs, outImgs] = await Promise.all([
      loadPhotos(checkInPhotos),
      loadPhotos(checkOutPhotos),
    ]);

    if (inImgs.length === 0 || outImgs.length === 0) {
      return {
        faultEstimatePercent: 0,
        confidence: "low",
        verdictDraft: "",
        evidenceCitations: [],
        error: "Не удалось загрузить фото с диска для анализа",
      };
    }

    // 5. Строим multimodal-запрос для Gemini Vision
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
      { text: VISION_ARBITRATION_PROMPT },
      { text: "=== ФОТО ДО (CHECK-IN) ===" },
      ...inImgs.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
      { text: "=== ФОТО ПОСЛЕ (CHECK-OUT) ===" },
      ...outImgs.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
    ];

    // Fallback-цепочка моделей — пробуем по очереди при 503/404
    const MODEL_FALLBACKS = [
      GEMINI_VISION_MODEL,
      "gemini-1.5-flash-latest",
      "gemini-2.0-flash-lite",
      "gemini-2.0-flash",
    ];
    const BODY = JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    });

    let raw: string | null = null;
    let lastErr = "";

    outer: for (const model of MODEL_FALLBACKS) {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 2000 * attempt));
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), GEMINI_VISION_TIMEOUT_MS);
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
            { method: "POST", headers: { "Content-Type": "application/json" }, body: BODY, signal: ctrl.signal },
          );
          clearTimeout(timer);
          if (res.status === 503 || res.status === 429) {
            lastErr = `HTTP ${res.status} (${model})`;
            await new Promise(r => setTimeout(r, 3000 + attempt * 2000));
            continue;
          }
          if (res.status === 404) { lastErr = `model ${model} not found`; break; }
          if (!res.ok) {
            const txt = await res.text().catch(() => "");
            throw new Error(`Gemini Vision HTTP ${res.status}: ${txt.slice(0, 200)}`);
          }
          const data: any = await res.json();
          raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          if (!raw.trim()) throw new Error("Gemini Vision: empty response");
          logger.info({ model, attempt }, "ai-arbitrator: success");
          break outer;
        } catch (e: any) {
          clearTimeout(timer);
          lastErr = e?.message || String(e);
          if (e?.name === "AbortError") { lastErr = `timeout on ${model}`; break; }
        }
      }
    }

    if (!raw) throw new Error(`Все модели недоступны: ${lastErr}`);

    // 6. Парсим JSON-ответ арбитратора (устойчиво к обрезанным ответам)
    logger.info({ claimId, rawLen: raw.length, rawSnippet: raw.slice(0, 120) }, "ai-arbitrator: raw response");
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

    let verdict: any = {};
    try {
      verdict = JSON.parse(cleaned);
    } catch {
      // Gemini иногда обрезает JSON — пробуем извлечь поля регексами
      const fault = cleaned.match(/"faultEstimatePercent"\s*:\s*(\d+)/);
      const conf = cleaned.match(/"confidence"\s*:\s*"(\w+)"/);
      const draft = cleaned.match(/"verdictDraft"\s*:\s*"([^"]{0,300})"/);
      verdict = {
        faultEstimatePercent: fault ? Number(fault[1]) : 0,
        confidence: conf ? conf[1] : "low",
        verdictDraft: draft ? draft[1] : "",
        evidenceCitations: [],
      };
      logger.warn({ claimId, err: "truncated JSON, regex fallback applied" }, "ai-arbitrator: parse fallback");
    }

    return {
      faultEstimatePercent: Math.min(100, Math.max(0, Number(verdict.faultEstimatePercent ?? 0))),
      confidence: ["low", "medium", "high"].includes(verdict.confidence) ? verdict.confidence : "low",
      verdictDraft: String(verdict.verdictDraft ?? ""),
      evidenceCitations: Array.isArray(verdict.evidenceCitations)
        ? verdict.evidenceCitations.map(String)
        : [],
    };
  } catch (err: any) {
    const message = err?.message || String(err);
    logger.error({ claimId, err: message }, "ai-arbitrator: failed");
    return {
      faultEstimatePercent: 0,
      confidence: "low",
      verdictDraft: "",
      evidenceCitations: [],
      error: `Сервис недоступен или таймаут: ${message.slice(0, 120)}`,
    };
  }
}

// ─── Stage 30B: AI Visual Magic — буллеты для инфографики ────────────────────
//
// generateInfographicBullets(title, category?, requestedProvider?)
//   → { bullets: string[3], provider, actualProvider, fallback, fallbackReason? }
//
// Использует тот же OpenRouter gateway (mock/openrouter/openai/amvera/gemini).
// Stage 33.1: in-memory кэш буллетов TTL 24ч — повторные запросы бесплатны.

export interface InfographicBulletsResult {
  bullets: string[];
  provider: AiProvider;
  actualProvider: AiProvider;
  fallback: boolean;
  fallbackReason?: string;
  model?: string;
}

const INFOGRAPHIC_SYSTEM_PROMPT = [
  "Ты лучший копирайтер маркетплейса аренды вещей в России.",
  "Твоя задача — за 3 буллета убедить арендатора взять именно эту вещь.",
  "",
  "Правила оформления:",
  "- Ровно 3 буллета, по одному на строку.",
  "- Длина каждого: 2–5 слов, без точки в конце.",
  "- Без эмодзи, без нумерации, без дефисов и звёздочек в начале строки.",
  "- Только русский язык.",
  "",
  "СТРОГО ЗАПРЕЩЕНО использовать общие фразы:",
  "«Готово к работе», «Идеально для…», «Полный комплект», «Проверенное качество»,",
  "«Надёжность», «Удобство», «Качество гарантировано», «Высокое качество».",
  "",
  "Используй КОНКРЕТИКУ по существу: материал, мощность, размер, ёмкость,",
  "количество предметов, для каких задач подходит, что входит в набор,",
  "особенности конструкции, бренд или стандарт.",
  "",
  "Примеры удачных буллетов:",
  "  Перфоратор:  «Мощность 800 Вт» / «Кейс с битами» / «Подходит для бетона»",
  "  Палатка:     «Вмещает 4 человек» / «Защита от ливня» / «Сборка за 5 минут»",
  "  Мангал:      «Сталь 3 мм» / «6 шампуров в наборе» / «Складная конструкция»",
  "  Велосипед:   «Алюминиевая рама» / «27 скоростей» / «Подходит до 100 кг»",
  "  Дрон:        «4К-камера 60 fps» / «Полёт до 30 минут» / «Радиус 5 км»",
].join("\n");

/**
 * Premium-промпт для инфографики (Gemini-style с эмодзи и JSON-массивом).
 * Используется, если провайдер 'gemini' (т.е. OpenRouter google/*).
 */
const PREMIUM_INFOGRAPHIC_SYSTEM_PROMPT = [
  "You are a top-tier marketing copywriter for a premium marketplace.",
  "Analyze the item and extract exactly 3 absolute best selling points.",
  "Each point MUST be ultra-short (maximum 3-5 words), extremely punchy,",
  "and include 1 highly relevant emoji at the start.",
  "Do NOT use markdown code blocks.",
  "Return ONLY a valid JSON array of 3 strings.",
  "The strings themselves MUST be in Russian.",
  'Example of valid output: ["⚡ Мощность 800 Вт","🧰 Кейс с битами","🏗 Бьёт бетон"]',
].join("\n");

function infographicUserPrompt(title: string, category?: string | null): string {
  const parts = [`Название вещи: ${title}`];
  if (category) parts.push(`Категория: ${category}`);
  parts.push("Сгенерируй 3 буллета, опираясь на название и категорию. Без воды.");
  return parts.join("\n");
}

// ─── Bullet bank: mock-данные по категориям ──────────────────────────────────

const BULLET_BANK: Record<string, string[][]> = {
  туризм: [
    ["Лёгкий и компактный", "Полная комплектация", "Готов к выезду"],
    ["Проверено в походах", "Защита от непогоды", "Удобная переноска"],
    ["Сезонный фаворит", "Без скрытых дефектов", "Быстрая сборка"],
  ],
  спорт: [
    ["Профессиональный уровень", "Свежее обслуживание", "Подойдёт новичкам"],
    ["Лёгкий каркас", "Регулировка под рост", "Минимум износа"],
    ["Турнирная модель", "Чехол в комплекте", "Гарантия исправности"],
  ],
  техника: [
    ["Полная диагностика", "Все аксессуары в наборе", "Гарантия исправности"],
    ["Чистая после клининга", "Работает без сбоев", "Возможна доставка"],
    ["Свежий технический осмотр", "Кабели и зарядка в комплекте", "Опытный владелец"],
  ],
  инструмент: [
    ["Производительная модель", "Кейс с расходниками", "Подходит для дома и стройки"],
    ["Высокая мощность", "Запасные биты в наборе", "Нет следов износа"],
    ["Заточен и обслужен", "Рекомендован профи", "Быстрая выдача"],
  ],
  электроника: [
    ["Оригинал, не копия", "Зарядка в комплекте", "Без сколов и царапин"],
    ["Чистая прошивка", "Аксессуары родные", "Полная функциональность"],
    ["Свежее ПО", "Защитное стекло сверху", "Готов к подключению"],
  ],
  одежда: [
    ["После химчистки", "Размерная сетка указана", "Бережная эксплуатация"],
    ["Стирка перед выдачей", "Без потёртостей", "Подходит на разные размеры"],
    ["Сезонная коллекция", "Дышащий материал", "Чистый и отглаженный"],
  ],
  транспорт: [
    ["Свежее ТО", "Полная заправка", "Документы оформлены"],
    ["Чистый салон", "Зимняя резина в наличии", "Без штрафов"],
    ["Регулярный сервис", "Кондиционер исправен", "Передача за 15 минут"],
  ],
  недвижимость: [
    ["Регулярная уборка", "Близко к транспорту", "Быстрое заселение"],
    ["Тихий район", "Проверенный собственник", "Гибкий график проживания"],
    ["Свежий ремонт", "Wi-Fi и техника есть", "Без скрытых платежей"],
  ],
  мебель: [
    ["Без сколов и царапин", "Сборка по инструкции", "Доставка возможна"],
    ["Натуральный материал", "Бережная эксплуатация", "Подходит для офиса"],
    ["Лёгкая транспортировка", "Полный комплект крепежа", "Чистая поверхность"],
  ],
  детское: [
    ["Безопасные материалы", "Регулярная санобработка", "Сертификат качества"],
    ["Возраст 0–3 года", "Регулировка по росту", "Все ремни исправны"],
    ["Чистка после каждой выдачи", "Удобный механизм", "Подходит для путешествий"],
  ],
  сад: [
    ["Острая режущая часть", "Регулярная заточка", "Готов к сезону"],
    ["Удобная рукоять", "Ремкомплект в наличии", "Большой запас прочности"],
    ["Аккумулятор заряжен", "Длинный шнур питания", "Подходит для дачи"],
  ],
};

const DEFAULT_BULLETS: string[][] = [
  ["Проверено владельцем", "Без скрытых дефектов", "Быстрое оформление брони"],
  ["Чистая и ухоженная", "Полная комплектация", "Бережная эксплуатация"],
  ["Свежее обслуживание", "Подходит новичкам", "Возможна доставка"],
];

/** djb2 — стабильный неотрицательный хеш строки. */
function djb2Hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickBulletBank(category: string | null | undefined): string[][] {
  const norm = (category || "").toLowerCase().trim();
  if (!norm) return DEFAULT_BULLETS;
  for (const key of Object.keys(BULLET_BANK)) {
    if (norm.includes(key)) return BULLET_BANK[key];
  }
  return DEFAULT_BULLETS;
}

function bulletsMockFromTitle(title: string, category?: string | null): string[] {
  const bank = pickBulletBank(category);
  const idx = djb2Hash(title) % bank.length;
  return [...bank[idx]];
}

/** Парсим текстовый ответ LLM в массив из 3 коротких буллетов. */
function parseBullets(raw: string): string[] {
  const lines = raw
    .split(/\r?\n/)
    .map((s) =>
      s
        .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
        .trim(),
    )
    .filter((s) => s.length > 0 && s.length <= 60);

  return lines.slice(0, 3).map((line) => {
    const words = line.split(/\s+/).slice(0, 5);
    return words.join(" ");
  });
}

/**
 * Парсит ответ OpenRouter в массив из 3 буллетов.
 * Три попытки парсинга: JSON-массив → pipe-формат → построчный.
 */
function parseBulletsFromLLM(text: string, maxLen = 32): string[] {
  let bullets: string[] = [];

  // 1) JSON-массив
  try {
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      bullets = parsed.filter((s) => typeof s === "string").map((s) => s.trim()).filter(Boolean);
    }
  } catch { /* не JSON */ }

  // 2) Pipe-формат
  if (bullets.length < 3 && text.includes("|")) {
    bullets = text
      .replace(/\r?\n/g, " ")
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // 3) Построчный
  if (bullets.length < 3) {
    bullets = parseBullets(text);
  }

  // Защита вёрстки: режем длиннее maxLen по границе слова
  return bullets.slice(0, 3).map((b) => {
    if (b.length <= maxLen) return b;
    const words = b.split(/\s+/);
    let acc = "";
    for (const w of words) {
      const next = acc ? `${acc} ${w}` : w;
      if (next.length > maxLen) break;
      acc = next;
    }
    return acc || b.slice(0, maxLen);
  });
}

// ─── OpenRouter: генерация буллетов ──────────────────────────────────────────

async function bulletsViaOpenRouter(
  title: string,
  category: string | null | undefined,
  model: string,
  provider: AiProvider,
): Promise<string[]> {
  const client = getOpenRouterClient();

  // Для Gemini-модели используем premium-промпт (JSON-массив + эмодзи)
  const isGemini = model.startsWith("google/");
  const systemPrompt = isGemini ? PREMIUM_INFOGRAPHIC_SYSTEM_PROMPT : INFOGRAPHIC_SYSTEM_PROMPT;

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.6,
    max_tokens: isGemini ? 200 : 400,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: infographicUserPrompt(title, category) },
    ],
  });

  const text = completion.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error(`OpenRouter (${model}): empty response`);
  }

  const bullets = parseBulletsFromLLM(text);
  if (bullets.length < 3) {
    throw new Error(`OpenRouter (${model}): less than 3 bullets parsed`);
  }
  return bullets;
}

// ─── Infographic bullets cache (Stage 33.1) ──────────────────────────────────
//
// In-memory кэш буллетов. Ключ = lowercase(title + "|" + category).
// TTL = 24 часа. Повторные запросы для одинаковых вещей бесплатны.

interface BulletsEntry {
  bullets: string[];
  provider: AiProvider;
  actualProvider: AiProvider;
  model?: string;
  cachedAt: number;
}

const BULLETS_CACHE = new Map<string, BulletsEntry>();
const BULLETS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 ч

function bulletsCacheKey(title: string, category?: string | null): string {
  return `${title.trim().toLowerCase()}|${(category ?? "").toLowerCase()}`;
}

function bulletsCacheGet(key: string): BulletsEntry | null {
  const entry = BULLETS_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > BULLETS_CACHE_TTL_MS) {
    BULLETS_CACHE.delete(key);
    return null;
  }
  return entry;
}

// ─── Главная точка: буллеты инфографики ──────────────────────────────────────

/**
 * Stage 30B / 30-Refactoring: получить 3 коротких буллета для инфографики.
 * Stage 33.1: in-memory кэш (TTL 24ч) — повторные запросы не тратят LLM-токены.
 */
export async function generateInfographicBullets(
  title: string,
  category?: string | null,
  requestedProvider?: string | null,
): Promise<InfographicBulletsResult> {
  if (!title || !title.trim()) throw new Error("title is required");

  const provider = await resolveProvider(requestedProvider);

  if (provider === "mock") {
    return {
      bullets: bulletsMockFromTitle(title, category),
      provider: "mock",
      actualProvider: "mock",
      fallback: false,
    };
  }

  // Проверяем кэш (только для не-mock провайдеров)
  const cacheKey = bulletsCacheKey(title, category);
  const cached = bulletsCacheGet(cacheKey);
  if (cached) {
    logger.info(
      { provider: cached.provider, model: cached.model, title: title.slice(0, 60), fromCache: true },
      "ai-service: infographic bullets cache hit",
    );
    return {
      bullets: cached.bullets,
      provider: cached.provider,
      actualProvider: cached.actualProvider,
      model: cached.model,
      fallback: false,
    };
  }

  const model = resolveModel(provider);

  try {
    let bullets: string[];
    try {
      bullets = await bulletsViaOpenRouter(title, category, model, provider);
    } catch (openRouterErr: any) {
      // OpenRouter недоступен → пробуем прямой DeepSeek (Stage 33.0 резерв)
      logger.warn(
        { provider, model, err: openRouterErr?.message },
        "ai-service: OpenRouter bullets failed, trying direct DeepSeek API",
      );
      bullets = await bulletsDirectDeepSeek(title, category);
    }

    // Сохраняем в кэш
    BULLETS_CACHE.set(cacheKey, {
      bullets,
      provider,
      actualProvider: provider,
      model,
      cachedAt: Date.now(),
    });

    logger.info(
      { provider, model, title: title.slice(0, 60) },
      "ai-service: infographic bullets success",
    );
    return { bullets, provider, actualProvider: provider, fallback: false, model };
  } catch (err: any) {
    const reason = err?.message || String(err);
    logger.error(
      { provider, model, err: reason },
      "ai-service: all providers failed, falling back to mock bullets",
    );
    return {
      bullets: bulletsMockFromTitle(title, category),
      provider,
      actualProvider: "mock",
      fallback: true,
      fallbackReason: reason,
    };
  }
}
