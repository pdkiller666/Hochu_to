/**
 * Stage 30A — Multi-Provider AI Gateway
 *
 * Единая точка генерации продающих описаний для объявлений.
 * Активный провайдер хранится в platform_settings.activeAiProvider:
 *   - 'mock'   — формат-заглушка с эмодзи (без сети, без расходов; default);
 *   - 'openai' — ChatGPT через OPENAI_API_KEY;
 *   - 'amvera' — российский Amvera AI Inference (deepseek-v3 на /models/gpt) через AMVERA_API_TOKEN.
 *
 * При любой ошибке/отсутствии ключа провайдер мягко деградирует в 'mock',
 * чтобы UX не сломался. Все ошибки логируются Pino-логгером.
 *
 * ВАЖНО про Amvera (отличия от OpenAI):
 *   - Эндпоинт:           POST https://kong-proxy.yc.amvera.ru/api/v1/models/gpt
 *                         (Stage 30H: /models/llama помечен deprecated в openapi
 *                         Amvera + давал empty response на проде; перешли на /gpt
 *                         с моделью deepseek-v3, доступной в админке Amvera).
 *   - Заголовок auth:     X-Auth-Token: Bearer <token>   (НЕ Authorization)
 *   - Поле сообщения:     "text"                         (НЕ "content" — даже на
 *                         /gpt-эндпоинте; openapi.yaml: messages[].text)
 *   - Парсинг ответа:     data.choices[0].message.text   (НЕ .content)
 */
import { logger } from "./logger.js";
import { getPlatformSettings } from "./platform-settings.js";

const MOCK_DELAY_MS = 1500;
const OPENAI_TIMEOUT_MS = 20_000;
const AMVERA_TIMEOUT_MS = 25_000;
const GEMINI_TIMEOUT_MS = 25_000;
// Stage 30G: gemini-1.5-flash отдаёт 404 на v1beta endpoint — Google переименовал
// этот алиас. Используем gemini-flash-latest, который всегда указывает на актуальный
// stable-флэш (на момент правки — Gemini 2.0 Flash). Менять на конкретную версию
// нежелательно, чтобы не словить ту же ошибку при следующей ротации алиасов.
const GEMINI_MODEL = "gemini-flash-latest";

// Stage 30H (28.04.2026): пивот Amvera со старого /models/llama (deprecated, давал
// "empty response" на проде) на /models/deepseek с моделью deepseek-V3.
//
// ВНИМАНИЕ: эндпоинт собирается как POST /models/<inference_name>, где
// <inference_name> — СЕМЕЙСТВО, не модель. Согласно официальной документации
// https://docs.amvera.ru/LLM/doc-inference-ru.html:
//   /llama       → llama8b, llama70b
//   /gpt         → gpt-4.1, gpt-5         (только OpenAI-модели!)
//   /deepseek    → deepseek-R1, deepseek-V3
//   /qwen        → qwen3_30b, qwen3_235b
// Поэтому для DeepSeek-V3 используем именно /models/deepseek, а не /models/gpt
// (как мог бы подсказать тэг GPT в swagger — он группирует только OpenAI-роут).
//
// Имя модели — РОВНО "deepseek-V3" с заглавной V (см. документацию). Lowercase
// "deepseek-v3" Amvera не распознает и вернёт пустой ответ.
//
// Поле сообщений и ответа — "text" (НЕ "content"), общее правило для всех
// Amvera-инференс-роутов; см. example в документации.
const AMVERA_URL = "https://kong-proxy.yc.amvera.ru/api/v1/models/deepseek";
const AMVERA_MODEL = "deepseek-V3";

export type AiProvider = "mock" | "openai" | "amvera" | "gemini";

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
  // Stage 30F: .trim() — страховка от хвостового \n или пробела при копипасте
  // ключа в панель Amvera (одна из самых частых причин ложного 401/400).
  const token = process.env.AMVERA_API_TOKEN?.trim();
  if (!token) throw new Error("AMVERA_API_TOKEN is missing");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AMVERA_TIMEOUT_MS);

  try {
    const res = await fetch(AMVERA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Stage 30E (REVERT 30D): прод вернул HTTP 401 на стандартный
        // Authorization: Bearer. Amvera-шлюз ожидает кастомный X-Auth-Token
        // c префиксом Bearer — это и был исходный рабочий формат.
        "X-Auth-Token": `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: AMVERA_MODEL,
        messages: [
          // Stage 30H: даже на /models/gpt Amvera использует поле "text",
          // НЕ "content" (см. openapi.yaml — это не стандартная OpenAI-схема).
          { role: "system", text: SYSTEM_PROMPT },
          { role: "user", text: userPrompt(input) },
        ],
      }),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const fullText = await res.text().catch(() => "");
      console.error(
        "[AI Service Error][Amvera/description]: Response Status:",
        res.status,
        "Text:",
        fullText,
      );
      throw new Error(`Amvera HTTP ${res.status}: ${fullText.slice(0, 200)}`);
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

// ─── GEMINI ────────────────────────────────────────────────────────────────

async function generateGemini(input: GenerateInput): Promise<string> {
  // Stage 30F: .trim() для защиты от \n/пробелов при копипасте ключа
  // (типичная причина 400 "API key not valid" от Google).
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), GEMINI_TIMEOUT_MS);

  try {
    const promptText = `${SYSTEM_PROMPT}\n\n${userPrompt(input)}`;
    // Stage 30D: ключ передаём в query (?key=...) — основной формат Google,
    // меньше шансов, что промежуточные прокси (Amvera/Kong) срежут заголовок.
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 800 },
        }),
        signal: ctrl.signal,
      },
    );
    if (!res.ok) {
      const fullText = await res.text().catch(() => "");
      console.error(
        "[AI Service Error][Gemini/description]: Response Status:",
        res.status,
        "Text:",
        fullText,
      );
      throw new Error(`Gemini HTTP ${res.status}: ${fullText.slice(0, 200)}`);
    }
    const data: any = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("Gemini: empty response");
    }
    return text.trim();
  } finally {
    clearTimeout(timer);
  }
}

// ─── ROUTER ────────────────────────────────────────────────────────────────

function isValidProvider(p: string | undefined | null): p is AiProvider {
  return p === "mock" || p === "openai" || p === "amvera" || p === "gemini";
}

/**
 * Stage 30C: разрешение провайдера с учётом kill-switch админа.
 *
 * Поведение:
 *   1. Если админ выставил в DB activeAiProvider='mock' — форсим mock.
 *      Это аварийный «kill-switch» для контроля расходов на LLM.
 *   2. Иначе если запрос явно указал валидного реального провайдера — берём его.
 *      Так пользователь сам выбирает между Gemini и Amvera per-request.
 *   3. Иначе — fallback в DB-настройку (для обратной совместимости с прежним UX).
 *   4. Если и там пусто — 'amvera' как разумный дефолт (как просил CTO).
 */
async function resolveProvider(requested?: string | null): Promise<AiProvider> {
  const settings = await getPlatformSettings();
  const dbProvider: AiProvider = isValidProvider(settings.activeAiProvider)
    ? (settings.activeAiProvider as AiProvider)
    : "mock";

  if (dbProvider === "mock") return "mock";
  if (isValidProvider(requested) && requested !== "mock") return requested;
  return dbProvider || "amvera";
}

/**
 * Главная точка входа. Учитывает per-request выбор провайдера; при ошибке
 * реального провайдера мягко падает в mock, чтобы UX не сломался.
 */
export async function generateListingDescription(
  input: GenerateInput,
  requestedProvider?: string | null,
): Promise<GenerateResult> {
  if (!input.title || !input.title.trim()) {
    throw new Error("title is required");
  }

  const requested = await resolveProvider(requestedProvider);

  if (requested === "mock") {
    const text = await generateMock(input);
    return { text, provider: "mock", actualProvider: "mock", fallback: false };
  }

  try {
    let text: string;
    if (requested === "openai") text = await generateOpenAi(input);
    else if (requested === "gemini") text = await generateGemini(input);
    else text = await generateAmvera(input);

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

function infographicUserPrompt(title: string, category?: string | null): string {
  const parts = [`Название вещи: ${title}`];
  if (category) parts.push(`Категория: ${category}`);
  parts.push(
    "Сгенерируй 3 буллета, опираясь на название и категорию. Без воды.",
  );
  return parts.join("\n");
}

/**
 * Stage 30B-Fix v2 — пул живых буллетов по категориям.
 *
 * Подбирается по нормализованной категории (точное совпадение или вхождение
 * ключевого слова). Внутри категории — 3 готовых набора, конкретный набор
 * выбирается детерминированно по хешу title: одинаковое объявление всегда
 * получит одну и ту же инфографику, разные объявления — разную.
 *
 * Если категория не распознана — берём DEFAULT_BULLETS.
 */
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

/** djb2 — стабильный неотрицательный хеш строки. Нужен для детерминированной выборки. */
function djb2Hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Нормализуем категорию и пытаемся попасть в ключ BULLET_BANK по вхождению. */
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
  // Stage 30F: trim — защита от хвостового \n/пробела в env (см. generateAmvera).
  const token = process.env.AMVERA_API_TOKEN?.trim();
  if (!token) throw new Error("AMVERA_API_TOKEN is missing");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AMVERA_TIMEOUT_MS);

  try {
    const res = await fetch(AMVERA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Stage 30E (REVERT 30D): прод вернул 401 на Authorization: Bearer.
        // Возвращаем X-Auth-Token: Bearer ... — исходный рабочий формат Amvera.
        "X-Auth-Token": `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: AMVERA_MODEL,
        // Stage 30H: на /models/gpt поле остаётся "text" (см. openapi.yaml).
        messages: [
          { role: "system", text: INFOGRAPHIC_SYSTEM_PROMPT },
          { role: "user", text: infographicUserPrompt(title, category) },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const fullText = await res.text().catch(() => "");
      console.error(
        "[AI Service Error][Amvera/bullets]: Response Status:",
        res.status,
        "Text:",
        fullText,
      );
      throw new Error(`Amvera HTTP ${res.status}: ${fullText.slice(0, 200)}`);
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
 * Stage 30C — Gemini-вариант с СТРОГИМ форматом ответа.
 *
 * Картинка инфографики ломается, если буллет длиннее 32 символов (≈ 2 строки
 * по 16). Чтобы Gemini не выдавал «красивые», но непомещающиеся фразы,
 * заворачиваем INFOGRAPHIC_SYSTEM_PROMPT в дополнительные жёсткие правила
 * формата: один pipe-separated ряд, ≤ 32 char/буллет.
 *
 * Парсер сначала пробует pipe-формат, потом fallback в построчный.
 * Любой буллет > 32 символов жёстко обрезается по слову.
 */
async function bulletsGemini(
  title: string,
  category?: string | null,
): Promise<string[]> {
  // Stage 30F: trim — защита от хвостового \n/пробела в env (см. generateGemini).
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

  const STRICT_GEMINI_INFOGRAPHIC_PROMPT = [
    INFOGRAPHIC_SYSTEM_PROMPT,
    "",
    "СТРОГИЙ ФОРМАТ ОТВЕТА (Stage 30C):",
    "Верни РОВНО 3 буллета в одной строке, разделённых вертикальной чертой |",
    "Формат: буллет1|буллет2|буллет3",
    "Пример: Мощность 800 Вт|Кейс с битами|Подходит для бетона",
    "",
    "ОГРАНИЧЕНИЯ ДЛИНЫ (СТРОГО):",
    "- Каждый буллет — максимум 32 символа всего.",
    "- Должен легко делиться на 2 строки по ≤ 16 символов каждая.",
    "- Не используй символ | внутри самого буллета.",
    "- Никаких пояснений вокруг — ТОЛЬКО три буллета через |.",
  ].join("\n");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), GEMINI_TIMEOUT_MS);

  try {
    const promptText = `${STRICT_GEMINI_INFOGRAPHIC_PROMPT}\n\n${infographicUserPrompt(title, category)}`;
    // Stage 30D: ключ в query (?key=...) — единый формат с generateGemini.
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 200 },
        }),
        signal: ctrl.signal,
      },
    );
    if (!res.ok) {
      const fullText = await res.text().catch(() => "");
      console.error(
        "[AI Service Error][Gemini/bullets]: Response Status:",
        res.status,
        "Text:",
        fullText,
      );
      throw new Error(`Gemini HTTP ${res.status}: ${fullText.slice(0, 200)}`);
    }
    const data: any = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("Gemini: empty response");
    }

    // Сначала пробуем pipe-формат (как просили в промпте), потом fallback.
    let bullets: string[];
    if (text.includes("|")) {
      bullets = text
        .replace(/\r?\n/g, " ")
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      bullets = parseBullets(text);
    }

    // Жёсткая защита верстки: режем длиннее 32 символов по границе слова.
    bullets = bullets.slice(0, 3).map((b) => {
      if (b.length <= 32) return b;
      const words = b.split(/\s+/);
      let acc = "";
      for (const w of words) {
        const next = acc ? `${acc} ${w}` : w;
        if (next.length > 32) break;
        acc = next;
      }
      return acc || b.slice(0, 32);
    });

    if (bullets.length < 3) {
      throw new Error("Gemini: less than 3 bullets parsed");
    }
    return bullets;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Stage 30B/30C: получить 3 коротких буллета для инфографики.
 * Логика fallback идентична generateListingDescription: при ошибке реального
 * провайдера мягко падаем в mock, чтобы UX не сломался.
 */
export async function generateInfographicBullets(
  title: string,
  category?: string | null,
  requestedProvider?: string | null,
): Promise<InfographicBulletsResult> {
  if (!title || !title.trim()) throw new Error("title is required");

  const requested = await resolveProvider(requestedProvider);

  if (requested === "mock") {
    return {
      bullets: bulletsMockFromTitle(title, category),
      provider: "mock",
      actualProvider: "mock",
      fallback: false,
    };
  }

  try {
    let bullets: string[];
    if (requested === "openai") bullets = await bulletsOpenAi(title, category);
    else if (requested === "gemini") bullets = await bulletsGemini(title, category);
    else bullets = await bulletsAmvera(title, category);

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
