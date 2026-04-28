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
 * Шрифт: системный sans-serif (DejaVu Sans на NixOS) — поддерживает кириллицу.
 */
import sharp from "sharp";

const CANVAS = 1080;
const PHOTO_X = 480;
const PHOTO_Y = 120;
const PHOTO_W = 560;
const PHOTO_H = 840;
const PHOTO_RADIUS = 36;

const TEXT_X = 60;
const TEXT_Y = 120;
const TEXT_W = 380;
const TEXT_H = 840;

/** Защита от XML-инъекций через буллеты. */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Аккуратный перенос длинной строки на 2 строки по словам (≤24 симв на строку). */
function wrapBullet(s: string, maxChars = 24): string[] {
  if (s.length <= maxChars) return [s];
  const words = s.split(/\s+/);
  let line1 = "";
  let line2 = "";
  for (const w of words) {
    const candidate = line1 ? `${line1} ${w}` : w;
    if (candidate.length <= maxChars) {
      line1 = candidate;
    } else {
      line2 = line2 ? `${line2} ${w}` : w;
    }
  }
  return line2 ? [line1, line2] : [line1];
}

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
            `<text x="100" y="${y + 14 + li * 44}" class="bullet">${line}</text>`,
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
    .brand { font-family: sans-serif; font-weight: 800; font-size: 44px; fill: #2B2B2B; }
    .brand-accent { fill: #C65D3B; }
    .tagline { font-family: sans-serif; font-weight: 600; font-size: 18px; fill: #6B5E50; letter-spacing: 1px; }
    .bullet { font-family: sans-serif; font-weight: 700; font-size: 32px; fill: #2B2B2B; }
  </style>
  <text x="0" y="60" class="brand">Хочу<tspan class="brand-accent">_То</tspan></text>
  <text x="0" y="92" class="tagline">МАРКЕТПЛЕЙС АРЕНДЫ</text>
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
