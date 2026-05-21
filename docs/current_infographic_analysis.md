# Отчёт по текущей реализации генерации инфографики (Stage 41-analysis)

> Дата: 21.05.2026  
> Автор: аудит агента на основе кода коммита `4dea0b2`  
> Статус: актуально — включает изменения, внесённые в рамках текущей сессии (Stage 41 rewrite)

---

## 1. Общая архитектура

### Точка входа

```
POST /api/ai/generate-infographic
Content-Type: multipart/form-data
Auth: Bearer <access_token>  (requireAuth)
```

**Параметры запроса (multipart):**

| Поле | Тип | Обязательно | Описание |
|---|---|---|---|
| `photo` | File (jpg/png/webp, ≤10 МБ) | ✅ | Фото товара |
| `title` | string (≤200 символов) | ✅ | Название товара |
| `category` | string | — | Категория |
| `description` | string (≤600 символов) | — | Описание |
| `pricePerDay` | string/number | — | Цена аренды ₽/сут |
| `template` | `"marketplace"` \| `"classic"` \| `"horizontal"` | — | Тип карточки (default: `marketplace`) |
| `format` | `"square"` \| `"horizontal"` | — | Только для `classic` |
| `preprocess` | `"true"` | — | Препроцессинг фото (sharpen + saturation) |
| `provider` | string | — | LLM-провайдер для буллетов (`"auto"` — подбор автоматически) |

**Ответ (JSON):**
```json
{
  "url": "/uploads/<uuid>.webp",
  "template": "marketplace",
  "generativeTier": 1 | 2 | "svg",
  "preprocessed": false,
  "content": { "title", "leftTitle", "leftItems[]", "rightTitle", "rightItems[]" },
  "provider": "openrouter",
  "actualProvider": "openrouter",
  "fallback": false
}
```

### Участвующие компоненты

```
ListingForm.tsx (UI)
    │  multipart upload
    ▼
routes/ai.ts  POST /api/ai/generate-infographic
    │
    ├─ generateMarketplaceContent()   ← ai-service.ts  (LLM: структура карточки)
    │
    ├─ preprocessForAI()              ← infographic.ts  (опционально: sharpen)
    │
    ├─ generateGenerativeInfographic()  ← infographic.ts
    │       ├── Tier 1: OpenRouter /images/generate  (DALL-E 3 / Flux)
    │       ├── Tier 2: Gemini 2.0 Flash multimodal  (+Imagen 3 sub-fallback)
    │       └── Tier 3: оригинальное фото 1080×1080 WebP
    │
    └─ buildMarketplaceInfographic()  ← image-service.ts  (SVG overlay, если tier=3)
         └── buildMarketplaceOverlaySvg()  (sharp + SVG composite)
```

**Rate limit:** 10 запросов/минуту на пользователя (общий бакет с `/generate-description`), реализован через in-memory Map в `routes/ai.ts` (строки 36–60).

---

## 2. Генерация буллетов (ai-service.ts)

### Функции

| Функция | Строки | Назначение |
|---|---|---|
| `generateInfographicBullets()` | ~602–899 | 3 буллета для classic/horizontal |
| `generateMarketplaceContent()` | ~973–1100 | Структурированный JSON для marketplace |

### Провайдеры буллетов

| Провайдер | Env var | Модель | Таймаут |
|---|---|---|---|
| `openrouter` (default) | `OPENROUTER_API_KEY` | `deepseek/deepseek-chat` (env: `OPENROUTER_MODEL`) | 30 сек |
| `gemini` | `OPENROUTER_API_KEY` | `google/gemini-flash-1.5` (env: `OPENROUTER_GEMINI_MODEL`) | 30 сек |
| `amvera` | `AMVERA_API_TOKEN` | DeepSeek-V3 через amvera.ru | 30 сек |
| `deepseek-direct` | `DEEPSEEK_API_KEY` | `deepseek-chat` | 30 сек |
| `mock` | — | Hardcoded банк по категориям | 0 мс |

**Kill-switch:** если DB `platform_settings.aiProvider = 'mock'` — реальные API не вызываются.

### Промпт для буллетов

- `generateInfographicBullets`: «Ты эксперт по маркетплейс-текстам... сгенерируй ровно 3 ключевых преимущества для аренды»
- `generateMarketplaceContent`: строгий JSON-формат → `{title, leftTitle, leftItems[3-4], rightTitle, rightItems[3-4]}`
  - leftTitle/rightTitle: до 20–26 символов, только ЗАГЛАВНЫМИ
  - Каждый пункт: 2–4 слова, до 22–25 символов — **жёсткое ограничение**
  - leftItems: комплект/аксессуары; rightItems: характеристики/преимущества

### Кэш буллетов (Stage 33.1)

- **Тип:** in-memory `Map<string, BulletsEntry>` (`BULLETS_CACHE`, строка ~867)
- **TTL:** 24 часа (`BULLETS_CACHE_TTL_MS = 24 * 60 * 60 * 1000`)
- **Ключ:** SHA-256(title + "|" + category + "|" + provider)
- **Очистка:** ленивая (при обращении проверяется `cachedAt`)
- **⚠️ Проблема:** сбрасывается при рестарте сервера

---

## 3. Композитинг изображения (image-service.ts)

### Шаблоны

| Шаблон | Функция | Размер | Назначение |
|---|---|---|---|
| Classic square | `buildInfographicImage()` | 1080×1080 | Фото справа, 3 буллета слева |
| Horizontal | `buildHorizontalImage()` | 1200×630 | Фото слева, 3 буллета справа (OG/Telegram) |
| Marketplace | `buildMarketplaceInfographic()` | 1080×1080 | Фото как фон, 2 панели overlay |

### Обработка фото (sharp pipeline)

```typescript
// Classic:
sharp(imageBuffer).rotate().resize(648, 648, {fit:"cover", position:"centre"}).png()
// + rounded mask (SVG clipPath, radius=24px)

// Marketplace:
sharp(imageBuffer).rotate().resize(1080, 1080, {fit:"cover", position:"centre"})
  .modulate({ brightness: 0.80 }).png()
// + SVG overlay composite
```

### SVG-структура (Marketplace)

```
1080×1080
├── Градиент top: rgba(0,0,0,0.82→0)   — для читаемости заголовка
├── Градиент bottom: rgba(0,0,0,0→0.74) — для читаемости буллетов
├── Заголовок: Montserrat Bold 68px, white, center top
├── Левая панель: white/91% opacity, rounded 18px
│   └── Буллеты: до 4 строк, Terracotta circle + Inter 27px
├── Правая панель: #1c1c1c/87%, rounded 18px
│   └── Буллеты: до 4 строк, white text
├── Ценовая пилюля: rect #C65D3B, Montserrat Bold 35px
└── Брендинг: "Хочу_То" внизу справа
```

### Шрифты

- **Montserrat-Bold.ttf** и **Inter-Regular.ttf** — загружаются из `src/assets/fonts/`, встраиваются в SVG как base64 `@font-face`
- **Fallback:** DejaVu Sans (из Dockerfile/Amvera образа)
- Шрифты кэшируются in-memory (`_fontFaceBlock`, строка ~71)

### Кэш финальных изображений (image-service.ts)

- **Тип:** disk `/tmp/infographic-cache/*.webp`
- **TTL:** 24 часа, очистка при старте модуля (`initCache()`)
- **Ключ:** SHA-256(`prefix` + photoBuffer + bullets/content)
- **⚠️ Проблема:** очищается при перезапуске контейнера

---

## 4. Ограничения и проблемы текущего подхода

### Критичные

| Проблема | Описание |
|---|---|
| **Жёсткая привязка координат** | Все X/Y, размеры шрифтов, отступы — хардкод константами (MKT_LEFT_X=24, MKT_ITEM_FONT=27 и т.д.). Любое изменение дизайна = правка кода. |
| **Обрезание длинных текстов** | `truncStr(item, 24)` — обрезает до 24 символов. Длинные названия на рус. теряют смысл (напр. «Профессиональный видеоп…»). Переносы строк ограничены 2 вариантами. |
| **Нет улучшения качества фото** | sharp только `.rotate()` + `.resize()`. Нет: удаления фона, улучшения экспозиции, денойзинга. Плохое фото → плохая карточка. |
| **Нет кириллицы через librsvg** | librsvg (используется sharp для SVG rasterization) плохо работает с кастомными шрифтами без fontconfig. Montserrat может отрендериться как DejaVu → другой вид. |
| **Стиль не адаптируется к товару** | Один шаблон для всех категорий: мангал и дрон выглядят одинаково. |

### Менее критичные

| Проблема | Описание |
|---|---|
| Кэш буллетов сбрасывается при рестарте | In-memory Map — не persistent. Повторные LLM-вызовы после деплоя. |
| Кэш изображений в /tmp | Очищается при рестарте контейнера на Amvera. Каждый деплой = регенерация. |
| Нет preview перед добавлением | Пользователь видит результат только после загрузки, не может выбрать лучший вариант из нескольких. |
| Ограничение 10 req/min (общее) | Пользователь с активным добавлением объявлений быстро исчерпывает лимит. |

---

## 5. Зависимости и конфигурация

### Переменные окружения

| Переменная | Используется в | Обязательна |
|---|---|---|
| `OPENROUTER_API_KEY` | `ai-service.ts` (буллеты), `infographic.ts` (Tier 1 /images/generate) | Для реального AI |
| `OPENROUTER_MODEL` | `ai-service.ts` строка 53 | Нет (default: `deepseek/deepseek-chat`) |
| `OPENROUTER_GEMINI_MODEL` | `ai-service.ts` строка 55 | Нет (default: `google/gemini-flash-1.5`) |
| `GEMINI_API_KEY` | `infographic.ts` (Tier 2), `ai-service.ts` (арбитраж) | Для Tier 2 fallback |
| `AMVERA_API_TOKEN` | `ai-service.ts` (буллеты провайдер amvera) | Нет |
| `DEEPSEEK_API_KEY` | `ai-service.ts` строка ~167 | Нет |
| `AUTH_JWT_SECRET` | `lib/auth-token.ts` | ✅ Установлен в этой сессии |

### NPM-зависимости генерации изображений

| Пакет | Версия | Роль |
|---|---|---|
| `sharp` | ^0.33 | SVG rasterization, resize, composite, WebP encode |
| `multer` | ^2 | multipart upload в памяти (memoryStorage) |
| `crypto` (Node.js built-in) | — | SHA-256 для cache keys |

### Таймауты

| Операция | Таймаут |
|---|---|
| OpenRouter буллеты | 30 сек (`OPENROUTER_TIMEOUT_MS`) |
| Tier 1 OpenRouter /images/generate | 60 сек (per model) |
| Tier 2 Gemini multimodal | 90 сек (per model) |
| Imagen 3 sub-fallback | 45 сек |
| Rate limit window | 60 сек / 10 req |

---

## 6. Места для изменений при переходе на полностью генеративные модели

### Файлы и функции

| Файл | Функция/Секция | Действие при Stage 42 |
|---|---|---|
| `lib/infographic.ts` | `tryOpenRouter()` | ✅ Уже переписан на `/images/generate`. Улучшить промпт, добавить более новые модели. |
| `lib/infographic.ts` | `tryGeminiImageGen()` | ✅ Уже переписан с правильными моделями. Проверить доступность `gemini-2.0-flash-exp` image gen. |
| `lib/infographic.ts` | `buildImagePrompt()` | 🔄 Улучшить промпт: добавить категорийные стили (outdoor/electronics/tools), добавить ссылку на цветовую схему #C65D3B. |
| `lib/image-service.ts` | `buildMarketplaceInfographic()` | ⚠️ Оставить как Tier 2.5 SVG fallback. Можно улучшить дизайн (градиенты, тени). |
| `lib/image-service.ts` | `buildInfographicImage()` | ℹ️ Оставить для `template=classic` (не используется по умолчанию). |
| `lib/image-service.ts` | `buildHorizontalImage()` | ℹ️ Оставить для `template=horizontal` (OG-формат). |
| `lib/ai-service.ts` | `generateMarketplaceContent()` | ✅ Оставить — буллеты по-прежнему нужны для промпта генеративных моделей. |
| `routes/ai.ts` | `template === "marketplace"` блок | 🔄 Логику `generativeTier` можно упростить после валидации Tier 1/2. |
| `pages/ListingForm.tsx` | кнопка «Создать инфографику» | 🔄 Добавить индикатор качества генерации (badge "AI" / "SVG"). Добавить возможность регенерации. |

### Что можно удалить при полной переработке

- Все SVG-строители в `image-service.ts` (строки 185–400): `buildMarketplaceOverlaySvg`, `buildBulletsSvg`, `buildHorizontalBulletsSvg`
- Функции работы со шрифтами: `getFontFaceBlock`, `wrapBullet`, `wrapMarketplaceTitle`
- Константы макета: `MKT_W/H/PANEL_Y/...`, `CANVAS/PHOTO_W/PHOTO_H/...`
- Зависимость от `sharp` для SVG-composite (оставить только для resize/encode)

### Что обязательно оставить

- `multer` + in-memory upload (загрузка фото для референса остаётся нужной для Tier 2 Gemini)
- `generateMarketplaceContent()` — буллеты нужны для промптов generative tier
- Disk-cache в `/tmp/infographic-cache/` — существенно экономит API-расходы
- Rate limiter (10 req/min/user)
- `preprocessForAI()` — помогает Gemini лучше распознавать детали

---

## 7. Рекомендации для Stage 42 (OpenRouter + Gemini fallback)

### Архитектура пайплайна (рекомендуемая)

```
POST /api/ai/generate-infographic
    │
    ├─ 1. generateMarketplaceContent()  →  title, bullets, price
    │         (LLM text, cached 24h in-memory)
    │
    ├─ 2. buildImagePrompt()            →  детальный промпт
    │         с категорийным стилем + характеристиками + ценой
    │
    ├─ 3. Tier 1: OpenRouter /images/generate
    │         Модели: openai/dall-e-3 → black-forest-labs/flux-1.1-pro
    │         Вход: текстовый промпт (text-to-image)
    │         Кэш: disk SHA-256(prompt) 24h
    │
    ├─ 4. Tier 2: Gemini 2.0 Flash multimodal
    │         Модели: gemini-2.0-flash-exp → imagen-3.0-generate-001
    │         Вход: фото-референс + промпт (image-to-image / text-to-image)
    │         Кэш: disk SHA-256(photo+prompt) 24h
    │
    └─ 5. Tier 2.5: buildMarketplaceInfographic() (SVG overlay)
              Всегда работает, не зависит от внешних API
              Disk-кэш SHA-256(photo+content) 24h
```

### Промпт для generative tier

Текущий промпт (в `buildImagePrompt`) уже хороший, но стоит добавить:

1. **Категорийный стиль фона:**
   - `electronics/tools` → минималистичный серый/белый стол
   - `leisure/sports` → природа/outdoor, динамика
   - `special_machinery` → промышленный, серьёзный фон
   
2. **Явное указание брендовых цветов:**
   ```
   Brand accent color: #C65D3B (terracotta orange) for badges and highlights
   ```

3. **Запрет артефактов:**
   ```
   NO watermarks, NO device frames, NO lorem ipsum, NO broken Cyrillic
   ```

### Форматы

| Формат | Размер | Модель target |
|---|---|---|
| Основной | 1024×1024 → resize 1080×1080 | DALL-E 3, Flux 1.1 Pro |
| OG/соцсети | текущий horizontal 1200×630 | Оставить SVG шаблон (stable) |

### Риски и митигация

| Риск | Вероятность | Митигация |
|---|---|---|
| Кириллический текст нечитаем | 🔴 Высокая (DALL-E 3, Flux плохо рендерят русский) | Генерировать фото без текста → накладывать текст через SVG-overlay поверх |
| Задержка 15–60 сек | 🟠 Средняя | UX: прогресс-бар, skeleton-preview; disk-кэш для повторных запросов |
| Стоимость ($0.04–0.08 за DALL-E 3) | 🟡 Низкая в бета | Rate limit 10/min; кэш 24ч снижает реальное число вызовов |
| Референс-фото не используется в Tier 1 | 🟡 Приемлемо | Tier 2 (Gemini) использует фото; промпт Tier 1 детально описывает товар |
| Flux/DALL-E недоступны через OpenRouter | 🟡 Иногда | Fallback-цепочка из 3 моделей уже реализована |

### Ключевая рекомендация — гибридный подход

> Наиболее надёжное решение для бета — **генерировать фоновое изображение через AI (Tier 1/2), затем накладывать текст через SVG-overlay**. Это решает проблему нечитаемого кириллического текста от генеративных моделей и сохраняет качество дизайна карточки.

Реализация:
1. AI генерирует **красивое фото товара** (без текста) — промпт: *"Professional product photo, clean studio background, no text, no watermarks"*
2. `buildMarketplaceOverlaySvg()` накладывает заголовок, буллеты, цену, бренд

Это сочетает лучшее из обоих подходов: качество AI-изображения + читаемость русского текста.

---

*Файл создан автоматически агентом. Следующий этап: Stage 42 — Full Generative Infographics.*
