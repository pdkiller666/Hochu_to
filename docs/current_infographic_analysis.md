# Отчёт по текущей реализации генерации инфографики (Stage 41-analysis)

> Дата: 21.05.2026 | Коммит: `4dea0b2` | Статус: читает реальный код, без изменений

---

## 1. Общая архитектура

### Точка входа — `POST /api/ai/generate-infographic` (`routes/ai.ts`)

```
multipart/form-data:
  photo        File    ≤10 МБ, image/* only (multer.memoryStorage)
  title        string  ≤200 символов, обязательно
  category     string  опционально
  description  string  ≤600 символов, опционально
  pricePerDay  number  опционально
  template     string  "marketplace" | "classic" | "horizontal" (default: marketplace)
  format       string  "square" | "horizontal"
  preprocess   bool    "true" → препроцессинг фото перед отправкой в AI
  provider     string  "auto" или конкретный провайдер
```

**Ответ:**
```json
{ "url": "/uploads/<uuid>.webp", "template": "marketplace",
  "generativeTier": 1|2|"svg", "preprocessed": false,
  "content": { "title","leftTitle","leftItems[]","rightTitle","rightItems[]" },
  "provider": "openrouter", "actualProvider": "openrouter", "fallback": false }
```

**Auth:** `requireAuth` (JWT Bearer).  
**Rate limit:** 10 запросов/мин/user, общий бакет с `/generate-description`, in-memory Map, окно сбрасывается каждые 5 мин.

---

### Три шаблона — три пути исполнения

```
template=horizontal  → generateInfographicBullets()  → buildHorizontalImage()
                                                         (SVG + sharp, 1200×630)

template=classic     → generateInfographicBullets()  → buildInfographicImage()
                                                         (SVG + sharp, 1080×1080)

template=marketplace → generateMarketplaceContent()  → [preprocessForAI()?]
(default)               (LLM, структурный JSON)          → generateGenerativeInfographic()
                                                              ├─ Tier 1: OpenRouter /images/generate
                                                              ├─ Tier 2: Gemini multimodal
                                                              └─ Tier 3: original photo WebP
                                                         ↓ если tier=3 (или выброс)
                                                         buildMarketplaceInfographic()
                                                         (Tier 2.5: SVG overlay + sharp)
```

**Критическое наблюдение из кода (`routes/ai.ts`, строки 294–296):**
```typescript
// Tier 1/2 (OpenRouter/Gemini image gen) недоступны на бесплатном плане —
// сразу используем надёжный buildMarketplaceInfographic (sharp + SVG overlay).
// При появлении платного Gemini — генеративный tier подключится автоматически.
```
На практике **всегда срабатывает Tier 2.5 (SVG overlay)** — generative tiers требуют платного плана OpenRouter и Gemini. Текущий рабочий результат: `generativeTier: "svg"`.

---

## 2. Генерация текстового содержимого (ai-service.ts)

### 2.1 Для шаблона `marketplace` — `generateMarketplaceContent()`

**Что генерирует:** структурированный JSON:
```typescript
interface MarketplaceInfographicContent {
  title: string;        // "АРЕНДА ...", ЗАГЛАВНЫМИ, ≤24 символа
  leftTitle: string;    // ≤20 символов, ЗАГЛАВНЫМИ
  leftItems: string[];  // 3–4 пункта, ≤22 символа каждый (комплект/аксессуары)
  rightTitle: string;   // ≤24 символа, ЗАГЛАВНЫМИ
  rightItems: string[]; // 3–4 пункта, ≤22 символа каждый (характеристики)
}
```

**Системный промпт** (`MARKETPLACE_SYSTEM_PROMPT`, строка 998):
- Чистый JSON без markdown, без пояснений
- title — начинается с "АРЕНДА", только факты, 2–4 слова на пункт
- leftItems — что входит в комплект; rightItems — технические характеристики

**Парсинг ответа** (`parseMarketplaceContent()`, строка 1030):
- Срезает ```json-блоки, `JSON.parse()`, валидирует наличие всех полей
- Обрезает строки: title до 26, leftTitle/rightTitle до 22/26, items до 25 символов
- Возвращает `null` при ошибке → fallback в mock

**Mock-контент** (`marketplaceMockContent()`, строка 1056):
- Категорийные заглушки (инструмент/электроника/спорт/general)
- Используется при `provider=mock` или при ошибке LLM

**⚠️ Нет кэша** — `generateMarketplaceContent()` вызывается при каждом запросе заново. Кэшируется только финальное изображение (disk-кэш).

---

### 2.2 Для шаблонов `classic` / `horizontal` — `generateInfographicBullets()`

**Что генерирует:** ровно 3 коротких буллета (2–5 слов каждый).

**Системный промпт** (`INFOGRAPHIC_SYSTEM_PROMPT`, строка 617):
- Запрет общих фраз: «Готово к работе», «Высокое качество» и т.д.
- Требует конкретику: мощность, материал, размер, что входит в набор

**Провайдеры:** `openrouter` → `amvera` → `deepseek-direct` → `mock`  
Выбор через `resolveProvider()` с учётом DB kill-switch (`platform_settings.activeAiProvider`).

**Парсинг LLM-ответа** (`parseBulletsFromLLM()`, строка 774):
1. Попытка `JSON.parse()` (для Gemini-стиля с эмодзи)
2. Pipe-формат (`bullet1 | bullet2 | bullet3`)
3. Построчный
- Обрезка до 32 символов по границе слова

**In-memory кэш буллетов** (`BULLETS_CACHE`, строка 867):
- Тип: `Map<string, BulletsEntry>`
- Ключ: `lowercase(title)|lowercase(category)` (djb2-подобный)
- TTL: 24 часа, ленивая очистка
- ⚠️ Сбрасывается при рестарте сервера

**Mock-банк буллетов** (`BULLET_BANK`, строка 667):
- 10 категорий на русском (туризм, спорт, техника, инструмент, электроника, одежда, транспорт, недвижимость, мебель, детское, сад)
- По 3 набора × 3 буллета на категорию
- `djb2Hash(title) % bank.length` — детерминированный выбор

---

## 3. Генеративный AI-пайплайн (infographic.ts)

### 3.1 Tier 1 — OpenRouter `/images/generate` (`tryOpenRouter()`, строка 106)

**Endpoint:** `https://openrouter.ai/api/v1/images/generate`  
**Метод:** text-to-image (фото-референс НЕ используется)  
**Модели по очереди:**
1. `openai/dall-e-3`
2. `black-forest-labs/flux-1.1-pro`
3. `black-forest-labs/flux-pro`

**Параметры:** `size: "1024x1024"`, `quality: "standard"`, `response_format: "url"`  
**Таймаут:** 60 сек на модель  
**Ответ:** URL или b64_json  
**Пропуск модели при:** HTTP 400/402/404 → следующая модель  
**ENV:** `OPENROUTER_API_KEY`

---

### 3.2 Tier 2 — Gemini multimodal (`tryGeminiImageGen()`, строка 190)

**Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`  
**Метод:** image-to-image (фото-референс + промпт → новое изображение)  
**Препроцессинг входного фото:** `sharp → rotate → resize 1024×1024 (fit:inside) → JPEG 85%`  
**Модели по очереди:**
1. `gemini-2.0-flash-exp`
2. `gemini-2.0-flash-preview-image-generation`
3. `gemini-2.0-flash`

**Параметры:** `responseModalities: ["TEXT","IMAGE"]`, `temperature: 0.8`  
**Таймаут:** 90 сек на модель  
**Парсинг:** ищет `parts[].inlineData.mimeType.startsWith("image/")` в ответе  
**Sub-fallback:** если все три модели дали "нет image part" → `tryImagen3TextOnly()`

**Imagen 3 sub-fallback** (`tryImagen3TextOnly()`, строка 276):  
`imagen-3.0-generate-001:predict`, `aspectRatio:"1:1"`, таймаут 45 сек  
**ENV:** `GEMINI_API_KEY`

---

### 3.3 Tier 3 — Деградация

Если Tier 1 и Tier 2 оба бросили исключение:
```typescript
sharp(imageBuffer).rotate().resize(1080,1080,{fit:"cover"}).webp({quality:85})
```
Возвращает оригинальное фото, кропнутое под квадрат. Без оверлея.

---

### 3.4 Tier 2.5 — SVG Overlay Fallback (`buildMarketplaceInfographic()`, строка 409)

Срабатывает, если `genResult === null` или `genResult.tier === 3`.  
Это **реальный рабочий путь** в текущей конфигурации.

**Пайплайн sharp:**
```typescript
sharp(imageBuffer)
  .rotate()                                     // EXIF-ориентация
  .resize(1080, 1080, {fit:"cover",position:"centre"})
  .modulate({brightness: 0.80})                 // затемнение для читаемости
  .png()
  .toBuffer()
→ composite([{input: overlaySvg}])              // SVG поверх
.webp({quality: 90})
```

**SVG-оверлей** (`buildMarketplaceOverlaySvg()`, строка 301):

| Элемент | Параметры |
|---|---|
| Верхний градиент | `rgba(0,0,0,0.82 → 0)`, высота 268px — для заголовка |
| Нижний градиент | `rgba(0,0,0,0 → 0.74)`, y=758 — для нижней зоны |
| Заголовок | Montserrat Bold 68px, white, center, y≈104–140 |
| Левая панель | `rect` white/91%, rx=18, y=210, h=510 |
| └─ Заголовок | Montserrat Bold 17px, letter-spacing 2, #2B2B2B |
| └─ Разделитель | `line` #C65D3B opacity 35% |
| └─ Пункты | `circle` r=8 #C65D3B + `text` Inter 27px #2B2B2B, шаг 96px |
| Правая панель | `rect` #1c1c1c/87%, rx=18, y=210, h=510 |
| └─ Пункты | `text` #F0EBE0 |
| Цена | `rect` #C65D3B, rx=14, 334×66px; Montserrat Bold 35px white |
| Брендинг | "Хочу_То" Montserrat Bold 25px white, "МАРКЕТПЛЕЙС АРЕНДЫ" 12px |

**Обрезка текста:** `truncStr(item, 24)` — жёсткое обрезание до 24 символов с `…`

---

### 3.5 Промпт для generative tier (`buildImagePrompt()`, строка 54)

```
Professional marketplace product card image (1080×1080 square) for Russian rental platform "Хочу_То".

PRODUCT: "{title}"
Category: {category}. RENTAL PRICE: от {price} ₽/сутки
KEY FEATURES to display:
  1. {bullet1}
  2. {bullet2}
  ...
PRODUCT DESCRIPTION: "{description}"

VISUAL DESIGN:
- Clean studio photo of the product (center/foreground, sharp, professional)
- Semi-transparent dark panel at bottom with features as clean list
- Large bold white title at top
- Orange price badge (#C65D3B)
- Small "Хочу_То" watermark
- All Cyrillic text sharp and perfectly legible
- No lorem ipsum, no device frames

OUTPUT: Complete, ready-to-post product card image.
```

**Cache key:** `SHA-256(imageBuffer + "|" + prompt)` → `/tmp/infographic-cache/gen_<hash>.webp`

---

## 4. Препроцессинг фото (`preprocessForAI()`, infographic.ts строка 378)

Активируется при `?preprocess=true` (или body `preprocess=true`):
```typescript
sharp(imageBuffer)
  .rotate()
  .resize(1024, 1024, {fit:"cover", position:"centre"})
  .sharpen({sigma: 1.5})
  .modulate({brightness: 1.05, saturation: 1.1})
  .png()
```
Улучшает резкость и насыщенность для лучшего распознавания генеративными моделями.  
По умолчанию **отключён** — фронтенд передаёт без `preprocess`.

---

## 5. Шрифты (image-service.ts)

- **Файлы:** `src/assets/fonts/Montserrat-Bold.ttf`, `Inter-Regular.ttf`
- **Загрузка:** lazy при первом вызове, кэшируются in-memory (`_fontFaceBlock`)
- **Встраивание:** base64 `@font-face` в SVG → `librsvg` (sharp) читает без системного fontconfig
- **Fallback:** `DejaVu Sans` (из Dockerfile/Amvera-образа) при ошибке загрузки файлов

---

## 6. Кэширование

| Слой | Тип | Ключ | TTL | Сброс при рестарте |
|---|---|---|---|---|
| Буллеты (classic/horizontal) | in-memory Map | `lowercase(title\|category)` | 24 ч | ✅ Да |
| Финальный WebP (SVG шаблоны) | disk `/tmp/infographic-cache/` | `SHA-256(prefix+photo+bullets)` | 24 ч | Нет (до очистки /tmp) |
| Generative WebP (Tier 1/2) | disk `/tmp/infographic-cache/` | `SHA-256(photo+prompt)` | 24 ч | Нет |
| Шрифты | in-memory (`_fontFaceBlock`) | — | ∞ (процесс) | ✅ Да |

Инициализация disk-кэша: `initCache()` при старте модуля → удаляет файлы старше 24ч.

---

## 7. UI (ListingForm.tsx)

**Кнопка:** `"✨ Создать инфографику"` (`data-testid="button-infographic"`)  
- Disabled при: `infoGenerating === true` или `photos.length >= 10`
- Два input: выбор из галереи (`infoInputId`) и камера (`infoCameraInputId`)

**Что отправляет на бэк:**
```
photo        — выбранный файл
title        — formData.title (обязательно)
category     — name категории из справочника (если выбрана)
template     — "marketplace" (хардкод, Stage 41)
pricePerDay  — formData.pricePerDay (если заполнено)
description  — formData.description.slice(0, 500) (если есть)
provider     — "auto"
Authorization: Bearer {token}
```

**При успехе:**
- Добавляет `j.url` в массив `photos` (появляется в галерее объявления)
- Toast: `"Продающее фото готово! 🪄"` + `content.title · bullet1 · bullet2 · bullet3`

**При ошибке:**
- Destructive toast с `j.message` или `j.error`

---

## 8. Зависимости и переменные окружения

### ENV vars

| Переменная | Где используется | Без неё |
|---|---|---|
| `OPENROUTER_API_KEY` | `infographic.ts` Tier 1, `ai-service.ts` буллеты | Tier 1 пропускается, буллеты → mock |
| `GEMINI_API_KEY` | `infographic.ts` Tier 2 + Imagen 3 | Tier 2 пропускается |
| `AMVERA_API_TOKEN` | `ai-service.ts` провайдер `amvera` | Этот провайдер недоступен |
| `DEEPSEEK_API_KEY` | `ai-service.ts` deepseek-direct | Этот fallback недоступен |
| `OPENROUTER_MODEL` | `ai-service.ts` (буллеты) | default: `deepseek/deepseek-chat` |
| `OPENROUTER_GEMINI_MODEL` | `ai-service.ts` | default: `google/gemini-flash-1.5` |

### NPM-зависимости

| Пакет | Роль |
|---|---|
| `sharp` | Resize, rotate, composite, SVG rasterization, WebP encode |
| `multer` | multipart/form-data, memoryStorage |
| `crypto` (built-in) | SHA-256 cache keys |
| `pino` (`logger`) | Структурированные логи tier/duration/err |

### Таймауты

| Операция | Значение |
|---|---|
| OpenRouter Tier 1 (per model) | 60 сек |
| Gemini Tier 2 (per model) | 90 сек |
| Imagen 3 sub-fallback | 45 сек |
| OpenRouter буллеты | 30 сек |

---

## 9. Фактический рабочий путь (что происходит прямо сейчас)

```
Пользователь нажимает "✨ Создать инфографику" и выбирает фото
    ↓
POST /api/ai/generate-infographic (multipart)
    ↓
generateMarketplaceContent()  ←→  OpenRouter LLM (deepseek/deepseek-chat)
    → JSON: {title, leftTitle[4 bullets], rightTitle, rightItems[4 bullets]}
    ↓
generateGenerativeInfographic()  ← пробует Tier 1 и Tier 2
    → Tier 1 (OpenRouter /images/generate): 402/404 — модели недоступны на free plan
    → Tier 2 (Gemini multimodal): нет image output без платного plan
    → Tier 3: возвращает оригинальный кроп 1080×1080
    ↓
routes/ai.ts: genResult.tier === 3  → buildMarketplaceInfographic() [Tier 2.5]
    ↓
sharp: фото → 1080×1080 cover, brightness 0.80
composite: SVG overlay (заголовок + 2 панели + цена + бренд)
encode: WebP quality 90
    ↓
fs.writeFile → UPLOADS_DIR/<uuid>.webp
    ↓
{ url: "/uploads/<uuid>.webp", generativeTier: "svg", content: {...} }
```

**Итог:** генерация занимает ~2–5 сек (LLM для структуры + sharp для SVG). Результат стабильный, брендированный, но не "AI-generated" в смысле generative модели — это SVG overlay поверх фото.

---

## 10. Слабые места для Stage 42

| Проблема | Место в коде | Приоритет |
|---|---|---|
| Generative tier недоступен без платного API | `infographic.ts` tryOpenRouter/tryGemini | 🔴 Критично |
| Текст обрезается твёрдо до 24 символов | `image-service.ts` `truncStr(item, 24)` | 🟠 Высокий |
| Заголовок SVG не переносит слова >22 символов | `wrapMarketplaceTitle()` строка 282 | 🟠 Высокий |
| Нет кэша для `generateMarketplaceContent()` | `ai-service.ts` ~970+ | 🟡 Средний |
| Буллеты кэшируются in-memory → сброс при деплое | `BULLETS_CACHE` | 🟡 Средний |
| Disk-кэш в /tmp → очищается при рестарте Amvera | `CACHE_DIR = "/tmp/infographic-cache"` | 🟡 Средний |
| `preprocessForAI()` отключён на фронте | `ListingForm.tsx` — не передаёт `preprocess` | 🟢 Низкий |
| Все категории — одинаковый шаблон SVG | `buildMarketplaceOverlaySvg()` | 🟢 Низкий |

---

## 11. Рекомендации для Stage 42

### Ключевой выбор: что менять

**Вариант A — Гибридный (рекомендуется):**
1. Оставить SVG overlay (`buildMarketplaceInfographic`) как основу
2. Добавить AI-генерацию только фона (без текста): `prompt = "clean studio background for {category} product, no text, photorealistic"`
3. Текст накладывать SVG-слоем → решает проблему нечитаемой кириллицы

**Вариант B — Полностью генеративный:**
1. Подключить DALL-E 3 или Flux через OpenRouter (нужен платный план, ~$0.04/img)
2. Промпт уже готов (`buildImagePrompt`)
3. Добавить SVG постпроцессинг поверх для текста (иначе кириллица нечитаема)

### Конкретные изменения для Stage 42

| Задача | Файл | Что делать |
|---|---|---|
| Подключить OpenRouter images/generate | `infographic.ts` | Уже реализовано, нужен платный ключ |
| Кэш для `generateMarketplaceContent()` | `ai-service.ts` | Добавить аналог `BULLETS_CACHE` |
| Disk-кэш в persistent path | `image-service.ts`, `infographic.ts` | Сменить `/tmp` → `UPLOADS_DIR/../cache/` |
| Категорийные стили SVG | `image-service.ts` | Разные цветовые схемы по `category` |
| Снять hard-truncation 24 символа | `image-service.ts` | Авто-уменьшение шрифта вместо обрезки |

---

*Отчёт составлен по реальному коду коммита `4dea0b2`. Готов к использованию как ТЗ для Stage 42.*
