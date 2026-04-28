/**
 * Stage 30B — AI Visual Magic: генератор инфографики.
 *
 * Превращает обычное фото вещи в маркетплейс-карточку 1080×1080 с тремя
 * буллетами-преимуществами в фирменных цветах «Хочу_То».
 *
 * Используется библиотека sharp (нативная, externalized в build.mjs).
 *
 * Палитра:
 *   #F2EEE3 — фоновый кремовый
 *   #C65D3B — терракотовый акцент (галочки, плашка бренда)
 *   #2B2B2B — основной текст
 *
 * Шрифт: расширенный system-стек (Stage 30B-Fix) — librsvg/fontconfig в минимальном
 * контейнере Amvera (`node:20-slim`) подбирает первый доступный шрифт с поддержкой
 * кириллицы и не падает в "tofu" (□□□) для русских символов.
 */
import sharp from "sharp";

// Stage 30B-Fix (heavy plan): "DejaVu Sans" и "Liberation Sans" ставятся в Dockerfile
// (fonts-dejavu-core + fonts-liberation) — они гарантированно содержат полный набор
// кириллических глифов. Остальные имена в стеке — фоллбэк для локальной разработки
// (NixOS / macOS / Windows). librsvg/fontconfig идёт по списку слева направо.
const FONT_STACK =
  "'DejaVu Sans', 'Liberation Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Ubuntu, 'Helvetica Neue', sans-serif";

const CANVAS = 1080;
const PHOTO_X = 500;
const PHOTO_Y = 120;
const PHOTO_W = 540;
const PHOTO_H = 840;
const PHOTO_RADIUS = 36;

const TEXT_X = 60;
const TEXT_Y = 120;
const TEXT_W = 420;
const TEXT_H = 840;

// Stage 30B-Fix v2: уменьшили шрифт и max-chars, чтобы кириллица гарантированно
// помещалась в текстовую колонку без обрезки. Раньше 32px / 24 символа на строку
// давали overflow по ширине (DejaVu Sans Bold cyrillic ~ 18px на символ).
//
// MAX_CHARS=16 — эмпирически безопасно для кириллицы 28px при ширине колонки
// TEXT_W-BULLET_TEXT_X = 320px. Шире — широкие глифы «щ»/«ы»/«м» обрезаются
// (из-за того что SVG-композит ограничен width=420 и текст за границей клипается).
const BULLET_FONT_SIZE = 28;
const BULLET_LINE_HEIGHT = 36;
const BULLET_TEXT_X = 100;
const BULLET_MAX_CHARS = 16;

/** Защита от XML-инъекций через буллеты. */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Аккуратный перенос длинной строки на 2 строки по словам (≤BULLET_MAX_CHARS на строку). */
function wrapBullet(s: string, maxChars = BULLET_MAX_CHARS): string[] {
  if (s.length <= maxChars) return [s];
  const words = s.split(/\s+/);
  if (words.length === 1) return [s];

  type Split = { line1: string; line2: string; score: number };
  let best: Split | null = null;

  for (let i = 1; i < words.length; i++) {
    const line1 = words.slice(0, i).join(" ");
    const line2 = words.slice(i).join(" ");
    if (line1.length > maxChars) break;
    if (line2.length > maxChars) continue;

    const lastW1 = words[i - 1].toLowerCase();
    const stickyPenalty = STICKY_NEXT.has(lastW1) ? 1000 : 0;
    const balance = Math.abs(line1.length - line2.length);
    const score = balance + stickyPenalty;

    if (!best || score < best.score) best = { line1, line2, score };
  }

  if (best) return [best.line1, best.line2];
  return [words[0], words.slice(1).join(" ")];
}

/**
 * Короткие предлоги/союзы, которые нельзя оставлять в конце строки —
 * иначе они «осиротеют», а следующее слово уедет на новую строку отдельно
 * («Идеально для и / туризм спорт»).
 */
const STICKY_NEXT = new Set([
  "в", "и", "к", "с", "у", "о", "а",
  "от", "по", "до", "на", "за", "из",
  "для", "под", "над", "при", "без",
  "не", "ни", "но", "же", "ли",
]);

/** Генерация SVG-наклейки с 3 буллетами (галочка + текст). */
function buildBulletsSvg(bullets: string[]): string {
  const safe = bullets.slice(0, 3).map(escapeXml);
  // Распределяем 3 строки в колонке высотой TEXT_H, начиная сверху после плашки бренда
  const rowYs = [240, 440, 640];
  const rows = safe
    .map((b, idx) => {
      const lines = wrapBullet(b);
      const y = rowYs[idx] ?? 240 + idx * 200;
      const textNodes = lines
        .map(
          (line, li) =>
            `<text x="${BULLET_TEXT_X}" y="${y + 12 + li * BULLET_LINE_HEIGHT}" class="bullet" font-family="${FONT_STACK}" text-anchor="start">${line}</text>`,
        )
        .join("");
      return `
        <g>
          <circle cx="44" cy="${y}" r="34" fill="#C65D3B" />
          <path d="M28 ${y} L40 ${y + 12} L60 ${y - 12}"
                stroke="white" stroke-width="6"
                stroke-linecap="round" stroke-linejoin="round" fill="none" />
          ${textNodes}
        </g>`;
    })
    .join("");

  return `<svg width="${TEXT_W}" height="${TEXT_H}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .brand { font-weight: 800; font-size: 44px; fill: #2B2B2B; }
    .brand-accent { fill: #C65D3B; }
    .tagline { font-weight: 600; font-size: 18px; fill: #6B5E50; letter-spacing: 1px; }
    .bullet { font-weight: 700; font-size: ${BULLET_FONT_SIZE}px; fill: #2B2B2B; }
  </style>
  <text x="0" y="60" class="brand" font-family="${FONT_STACK}" text-anchor="start">Хочу<tspan class="brand-accent">_То</tspan></text>
  <text x="0" y="92" class="tagline" font-family="${FONT_STACK}" text-anchor="start">МАРКЕТПЛЕЙС АРЕНДЫ</text>
  ${rows}
  <line x1="0" y1="${TEXT_H - 30}" x2="${TEXT_W - 40}" y2="${TEXT_H - 30}" stroke="#C65D3B" stroke-width="3" />
</svg>`;
}

/** SVG-маска со скруглением углов для фото. */
function buildPhotoMaskSvg(w: number, h: number, r: number): string {
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="white" />
  </svg>`;
}

/**
 * Главная функция Stage 30B: собрать инфографику 1080×1080.
 *
 * @param imageBuffer  исходное фото пользователя (любой формат, любой размер)
 * @param bullets      ровно 3 коротких буллета (если меньше — добиваем плейсхолдерами)
 * @returns Buffer формата WebP (качество 88) — компактный, поддержка прозрачности.
 */
export async function buildInfographicImage(
  imageBuffer: Buffer,
  bullets: string[],
): Promise<Buffer> {
  const safeBullets = [...bullets];
  while (safeBullets.length < 3) safeBullets.push("Готово к работе");

  // 1) Базовый кремовый холст 1080×1080
  const base = sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 4,
      background: { r: 0xf2, g: 0xee, b: 0xe3, alpha: 1 },
    },
  });

  // 2) Подготовка фото: автоповорот по EXIF, contain-fit в PHOTO_W×PHOTO_H
  //    (с белыми полосами при необходимости), скруглённые углы через маску.
  const fittedPhoto = await sharp(imageBuffer)
    .rotate() // EXIF auto-rotate
    .resize(PHOTO_W, PHOTO_H, {
      fit: "cover",
      position: "centre",
    })
    .png()
    .toBuffer();

  const maskedPhoto = await sharp(fittedPhoto)
    .composite([
      {
        input: Buffer.from(buildPhotoMaskSvg(PHOTO_W, PHOTO_H, PHOTO_RADIUS)),
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();

  // 3) SVG с буллетами
  const textSvg = Buffer.from(buildBulletsSvg(safeBullets));

  // 4) Финальный композит → WebP
  const out = await base
    .composite([
      { input: maskedPhoto, top: PHOTO_Y, left: PHOTO_X },
      { input: textSvg, top: TEXT_Y, left: TEXT_X },
    ])
    .webp({ quality: 88 })
    .toBuffer();

  return out;
}
