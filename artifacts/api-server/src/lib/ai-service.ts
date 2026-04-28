/**
 * Stage 30A — Multi-Provider AI Gateway
 *
 * Единая точка генерации продающих описаний для объявлений.
 * Активный провайдер хранится в platform_settings.activeAiProvider:
 *   - 'mock'   — формат-заглушка с эмодзи (без сети, без расходов; default);
 *   - 'openai' — ChatGPT через OPENAI_API_KEY;
 *   - 'amvera' — российский Amvera AI Inference (llama8b) через AMVERA_API_TOKEN.
 *
 * При любой ошибке/отсутствии ключа провайдер мягко деградирует в 'mock',
 * чтобы UX не сломался. Все ошибки логируются Pino-логгером.
 *
 * ВАЖНО про Amvera (отличия от OpenAI):
 *   - Эндпоинт:           POST https://kong-proxy.yc.amvera.ru/api/v1/models/llama
 *   - Заголовок auth:     X-Auth-Token: Bearer <token>   (НЕ Authorization)
 *   - Поле сообщения:     "text"                          (НЕ "content")
 *   - Парсинг ответа:     data.choices[0].message.text
 */
import { logger } from "./logger.js";
import { getPlatformSettings } from "./platform-settings.js";

const MOCK_DELAY_MS = 1500;
const OPENAI_TIMEOUT_MS = 20_000;
const AMVERA_TIMEOUT_MS = 25_000;

export type AiProvider = "mock" | "openai" | "amvera";

export interface GenerateInput {
  title: string;
  category?: string | null;
  condition?: string | null;
}

export interface GenerateResult {
  text: string;
  provider: AiProvider;
  /** Истинный провайдер, который реально сгенерировал текст (после возможного fallback) */
  actualProvider: AiProvider;
  /** true, если случился graceful fallback в mock из-за ошибки реального API */
  fallback: boolean;
  fallbackReason?: string;
}

const SYSTEM_PROMPT =
  "Ты крутой маркетолог. Напиши продающее описание для вещи, которую сдают в аренду. " +
  "Используй эмодзи и списки. Текст должен быть на русском.";

function userPrompt({ title, category, condition }: GenerateInput): string {
  const parts = [`Название: ${title}`];
  if (category) parts.push(`Категория: ${category}`);
  if (condition) parts.push(`Состояние: ${condition}`);
  return parts.join("\n");
}

// ─── MOCK ──────────────────────────────────────────────────────────────────

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

// ─── OPENAI ────────────────────────────────────────────────────────────────

async function generateOpenAi(input: GenerateInput): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), OPENAI_TIMEOUT_MS);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
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
      throw new Error(`OpenAI HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
    const data: any = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("OpenAI: empty response");
    }
    return text.trim();
  } finally {
    clearTimeout(timer);
  }
}

// ─── AMVERA ────────────────────────────────────────────────────────────────

async function generateAmvera(input: GenerateInput): Promise<string> {
  const token = process.env.AMVERA_API_TOKEN;
  if (!token) throw new Error("AMVERA_API_TOKEN is not set");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AMVERA_TIMEOUT_MS);

  try {
    const res = await fetch(
      "https://kong-proxy.yc.amvera.ru/api/v1/models/llama",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Amvera использует X-Auth-Token (не Authorization)
          "X-Auth-Token": `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: "llama8b",
          messages: [
            // Amvera использует поле "text", не "content"
            { role: "system", text: SYSTEM_PROMPT },
            { role: "user", text: userPrompt(input) },
          ],
        }),
        signal: ctrl.signal,
      },
    );

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Amvera HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
    const data: any = await res.json();
    const text = data?.choices?.[0]?.message?.text;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("Amvera: empty response");
    }
    return text.trim();
  } finally {
    clearTimeout(timer);
  }
}

// ─── ROUTER ────────────────────────────────────────────────────────────────

function isValidProvider(p: string | undefined | null): p is AiProvider {
  return p === "mock" || p === "openai" || p === "amvera";
}

/**
 * Главная точка входа. Читает активного провайдера из platform_settings,
 * пытается сгенерировать через него, при ошибке мягко падает в mock.
 */
export async function generateListingDescription(
  input: GenerateInput,
): Promise<GenerateResult> {
  if (!input.title || !input.title.trim()) {
    throw new Error("title is required");
  }

  const settings = await getPlatformSettings();
  const requested: AiProvider = isValidProvider(settings.activeAiProvider)
    ? (settings.activeAiProvider as AiProvider)
    : "mock";

  if (requested === "mock") {
    const text = await generateMock(input);
    return { text, provider: "mock", actualProvider: "mock", fallback: false };
  }

  try {
    const text =
      requested === "openai"
        ? await generateOpenAi(input)
        : await generateAmvera(input);
    logger.info(
      { provider: requested, title: input.title.slice(0, 60) },
      "ai-service: generation success",
    );
    return {
      text,
      provider: requested,
      actualProvider: requested,
      fallback: false,
    };
  } catch (err: any) {
    const reason = err?.message || String(err);
    logger.error(
      { provider: requested, err: reason },
      "ai-service: real provider failed, falling back to mock",
    );
    const text = await generateMock(input);
    return {
      text,
      provider: requested,
      actualProvider: "mock",
      fallback: true,
      fallbackReason: reason,
    };
  }
}

// ─── Stage 30B: AI Visual Magic — буллеты для инфографики ──────────────────
//
// generateInfographicBullets(title) → ровно 3 коротких буллета (≤5 слов каждый)
// с ключевыми преимуществами вещи, которые накладываются на фото.
// Использует тот же multi-provider gateway (mock/openai/amvera).

export interface InfographicBulletsResult {
  bullets: string[];
  provider: AiProvider;
  actualProvider: AiProvider;
  fallback: boolean;
  fallbackReason?: string;
}

const INFOGRAPHIC_SYSTEM_PROMPT =
  "Ты маркетолог, оформляющий витрину товаров. На основе названия вещи в аренду " +
  "выдай РОВНО 3 коротких буллета (от 2 до 5 слов каждый) с самыми сильными " +
  "продающими характеристиками. Только русский язык. Никаких эмодзи, точек и " +
  "номеров. По одному буллету на строку, без префиксов вроде '1.' или '-'.";

function infographicUserPrompt(title: string, category?: string | null): string {
  const parts = [`Название вещи: ${title}`];
  if (category) parts.push(`Категория: ${category}`);
  parts.push(
    "Пример удачных буллетов: 'Мощность 800 Вт', 'Идеально для бетона', 'Кейс в комплекте'.",
  );
  return parts.join("\n");
}

function bulletsMockFromTitle(title: string, category?: string | null): string[] {
  const cat = category?.trim() || null;
  return [
    "Готово к работе",
    cat ? `Идеально для ${cat.toLowerCase()}` : "Проверенное качество",
    "Полный комплект",
  ].slice(0, 3);
}

/** Парсим текстовый ответ LLM в массив из 3 коротких буллетов. */
function parseBullets(raw: string): string[] {
  const lines = raw
    .split(/\r?\n/)
    .map((s) =>
      s
        // Срезаем "1.", "1)", "- ", "• ", "* " в начале строки
        .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
        .trim(),
    )
    .filter((s) => s.length > 0 && s.length <= 60);

  // Берём первые 3, обрезаем до 5 слов на всякий случай
  return lines.slice(0, 3).map((line) => {
    const words = line.split(/\s+/).slice(0, 5);
    return words.join(" ");
  });
}

async function bulletsOpenAi(
  title: string,
  category?: string | null,
): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), OPENAI_TIMEOUT_MS);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
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
      throw new Error(`OpenAI HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
    const data: any = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("OpenAI: empty response");
    }
    const bullets = parseBullets(text);
    if (bullets.length < 3) throw new Error("OpenAI: less than 3 bullets parsed");
    return bullets;
  } finally {
    clearTimeout(timer);
  }
}

async function bulletsAmvera(
  title: string,
  category?: string | null,
): Promise<string[]> {
  const token = process.env.AMVERA_API_TOKEN;
  if (!token) throw new Error("AMVERA_API_TOKEN is not set");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AMVERA_TIMEOUT_MS);

  try {
    const res = await fetch(
      "https://kong-proxy.yc.amvera.ru/api/v1/models/llama",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Token": `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: "llama8b",
          messages: [
            { role: "system", text: INFOGRAPHIC_SYSTEM_PROMPT },
            { role: "user", text: infographicUserPrompt(title, category) },
          ],
        }),
        signal: ctrl.signal,
      },
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Amvera HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
    const data: any = await res.json();
    const text = data?.choices?.[0]?.message?.text;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("Amvera: empty response");
    }
    const bullets = parseBullets(text);
    if (bullets.length < 3) throw new Error("Amvera: less than 3 bullets parsed");
    return bullets;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Stage 30B: получить 3 коротких буллета для инфографики.
 * Логика fallback идентична generateListingDescription: при ошибке реального
 * провайдера мягко падаем в mock, чтобы UX не сломался.
 */
export async function generateInfographicBullets(
  title: string,
  category?: string | null,
): Promise<InfographicBulletsResult> {
  if (!title || !title.trim()) throw new Error("title is required");

  const settings = await getPlatformSettings();
  const requested: AiProvider = isValidProvider(settings.activeAiProvider)
    ? (settings.activeAiProvider as AiProvider)
    : "mock";

  if (requested === "mock") {
    return {
      bullets: bulletsMockFromTitle(title, category),
      provider: "mock",
      actualProvider: "mock",
      fallback: false,
    };
  }

  try {
    const bullets =
      requested === "openai"
        ? await bulletsOpenAi(title, category)
        : await bulletsAmvera(title, category);
    logger.info(
      { provider: requested, title: title.slice(0, 60) },
      "ai-service: infographic bullets success",
    );
    return {
      bullets,
      provider: requested,
      actualProvider: requested,
      fallback: false,
    };
  } catch (err: any) {
    const reason = err?.message || String(err);
    logger.error(
      { provider: requested, err: reason },
      "ai-service: infographic bullets failed, falling back to mock",
    );
    return {
      bullets: bulletsMockFromTitle(title, category),
      provider: requested,
      actualProvider: "mock",
      fallback: true,
      fallbackReason: reason,
    };
  }
}
