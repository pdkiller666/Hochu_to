/**
 * Stage 30B — AI Visual Magic: генератор инфографики.
 *
 * Stage 32-B followup:
 *   - Шрифты Montserrat-Bold + Inter-Regular встроены прямо в SVG через @font-face
 *     data URI (base64). librsvg подхватывает их без системного fontconfig.
 *     Фоллбэк: DejaVu Sans (установлен в Dockerfile) при ошибке загрузки файлов.
 *   - Disk-кэш готовых WebP в /tmp/infographic-cache/ по SHA-256(photo+bullets).
 *     Повторная генерация одной и той же инфографики: 0 мс (fs.readFile).
 *     Кэш живёт 24 часа, очищается при старте модуля.
 *   - Горизонтальный шаблон 1200×630 (OpenGraph / соцсети): buildHorizontalImage().
 *
 * Палитра: #F2EEE3 кремовый · #C65D3B терракотовый · #2B2B2B текст
 */
import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Шрифты лежат в src/assets/fonts/. Путь работает и из dist/lib/ (скомпилировано),
// и из src/lib/ (если запуск напрямую): оба на 2 уровня выше project-root, затем src/.
const FONTS_DIR = path.join(__dirname, "../../src/assets/fonts");

// ─── Disk cache ───────────────────────────────────────────────────────────────

const CACHE_DIR = "/tmp/infographic-cache";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function initCache(): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  try {
    const files = await fs.readdir(CACHE_DIR);
    const now = Date.now();
    await Promise.all(
      files.map(async (f) => {
        const fp = path.join(CACHE_DIR, f);
        const stat = await fs.stat(fp);
        if (now - stat.mtimeMs > CACHE_TTL_MS) await fs.unlink(fp).catch(() => {});
      }),
    );
  } catch { /* ignore */ }
}
initCache().catch(() => {});

function makeCacheKey(prefix: string, photoBuffer: Buffer, bullets: string[]): string {
  return prefix + "_" + createHash("sha256")
    .update(photoBuffer)
    .update("|")
    .update(bullets.join("|"))
    .digest("hex");
}

async function getCached(key: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(CACHE_DIR, `${key}.webp`));
  } catch { return null; }
}

async function putCached(key: string, data: Buffer): Promise<void> {
  try {
    await fs.writeFile(path.join(CACHE_DIR, `${key}.webp`), data);
  } catch { /* ignore */ }
}

// ─── Font loading (lazy, cached in memory) ────────────────────────────────────

let _fontFaceBlock: string | null = null;

async function getFontFaceBlock(): Promise<string> {
  if (_fontFaceBlock !== null) return _fontFaceBlock;
  try {
    const [montserratBuf, interBuf] = await Promise.all([
      fs.readFile(path.join(FONTS_DIR, "Montserrat-Bold.ttf")),
      fs.readFile(path.join(FONTS_DIR, "Inter-Regular.ttf")),
    ]);
    const mb64 = montserratBuf.toString("base64");
    const ib64 = interBuf.toString("base64");
    _fontFaceBlock = `
    @font-face {
      font-family: 'Montserrat';
      font-weight: 700;
      src: url('data:font/truetype;base64,${mb64}') format('truetype');
    }
    @font-face {
      font-family: 'Inter';
      font-weight: 400;
      src: url('data:font/truetype;base64,${ib64}') format('truetype');
    }`;
  } catch {
    // Шрифты не найдены — пустой блок, librsvg использует DejaVu (установлен в Dockerfile)
    _fontFaceBlock = "";
  }
  return _fontFaceBlock;
}

// ─── Font stacks ──────────────────────────────────────────────────────────────

const FONT_HEADING = "'Montserrat', 'DejaVu Sans', 'Liberation Sans', sans-serif";
const FONT_BODY = "'Inter', 'DejaVu Sans', 'Liberation Sans', sans-serif";

// ─── Constants: 1080×1080 (квадрат) ─────────────────────────────────────────

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
const BULLET_FONT_SIZE = 28;
const BULLET_LINE_HEIGHT = 36;
const BULLET_TEXT_X = 100;
const BULLET_MAX_CHARS = 16;

// ─── Constants: 1200×630 (горизонталь / OG) ──────────────────────────────────

const H_W = 1200;
const H_H = 630;
const H_PHOTO_X = 600;
const H_PHOTO_Y = 0;
const H_PHOTO_W = 600;
const H_PHOTO_H = 630;
const H_TEXT_W = 560;
const H_TEXT_H = 630;
const H_BULLET_TEXT_X = 80;
const H_BULLET_MAX_CHARS = 22;
const H_BULLET_FONT_SIZE = 24;
const H_BULLET_LINE_HEIGHT = 30;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const STICKY_NEXT = new Set([
  "в", "и", "к", "с", "у", "о", "а",
  "от", "по", "до", "на", "за", "из",
  "для", "под", "над", "при", "без",
  "не", "ни", "но", "же", "ли",
]);

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

function buildPhotoMaskSvg(w: number, h: number, r: number): string {
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="white" />
  </svg>`;
}

// ─── SVG builders ─────────────────────────────────────────────────────────────

function buildBulletsSvg(bullets: string[], fontFaceBlock: string): string {
  const safe = bullets.slice(0, 3).map(escapeXml);
  const rowYs = [240, 440, 640];
  const rows = safe
    .map((b, idx) => {
      const lines = wrapBullet(b, BULLET_MAX_CHARS);
      const y = rowYs[idx] ?? 240 + idx * 200;
      const textNodes = lines
        .map(
          (line, li) =>
            `<text x="${BULLET_TEXT_X}" y="${y + 12 + li * BULLET_LINE_HEIGHT}" class="bullet" text-anchor="start">${line}</text>`,
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
    ${fontFaceBlock}
    .brand   { font-family: ${FONT_HEADING}; font-weight: 700; font-size: 44px; fill: #2B2B2B; }
    .accent  { fill: #C65D3B; }
    .tagline { font-family: ${FONT_BODY}; font-weight: 400; font-size: 18px; fill: #6B5E50; letter-spacing: 1px; }
    .bullet  { font-family: ${FONT_BODY}; font-weight: 400; font-size: ${BULLET_FONT_SIZE}px; fill: #2B2B2B; }
  </style>
  <text x="0" y="60" class="brand" text-anchor="start">Хочу<tspan class="accent">_То</tspan></text>
  <text x="0" y="92" class="tagline" text-anchor="start">МАРКЕТПЛЕЙС АРЕНДЫ</text>
  ${rows}
  <line x1="0" y1="${TEXT_H - 30}" x2="${TEXT_W - 40}" y2="${TEXT_H - 30}" stroke="#C65D3B" stroke-width="3" />
</svg>`;
}

function buildHorizontalBulletsSvg(bullets: string[], fontFaceBlock: string): string {
  const safe = bullets.slice(0, 3).map(escapeXml);
  const rowYs = [200, 360, 510];
  const rows = safe
    .map((b, idx) => {
      const lines = wrapBullet(b, H_BULLET_MAX_CHARS);
      const y = rowYs[idx] ?? 200 + idx * 150;
      const textNodes = lines
        .map(
          (line, li) =>
            `<text x="${H_BULLET_TEXT_X}" y="${y + 10 + li * H_BULLET_LINE_HEIGHT}" class="bullet" text-anchor="start">${line}</text>`,
        )
        .join("");
      return `
        <g>
          <circle cx="34" cy="${y}" r="26" fill="#C65D3B" />
          <path d="M21 ${y} L31 ${y + 10} L47 ${y - 10}"
                stroke="white" stroke-width="5"
                stroke-linecap="round" stroke-linejoin="round" fill="none" />
          ${textNodes}
        </g>`;
    })
    .join("");

  return `<svg width="${H_TEXT_W}" height="${H_TEXT_H}" xmlns="http://www.w3.org/2000/svg">
  <style>
    ${fontFaceBlock}
    .brand   { font-family: ${FONT_HEADING}; font-weight: 700; font-size: 40px; fill: #2B2B2B; }
    .accent  { fill: #C65D3B; }
    .tagline { font-family: ${FONT_BODY}; font-weight: 400; font-size: 16px; fill: #6B5E50; letter-spacing: 1px; }
    .bullet  { font-family: ${FONT_BODY}; font-weight: 400; font-size: ${H_BULLET_FONT_SIZE}px; fill: #2B2B2B; }
  </style>
  <text x="30" y="64" class="brand" text-anchor="start">Хочу<tspan class="accent">_То</tspan></text>
  <text x="30" y="88" class="tagline" text-anchor="start">МАРКЕТПЛЕЙС АРЕНДЫ</text>
  ${rows}
  <line x1="30" y1="${H_TEXT_H - 20}" x2="${H_TEXT_W - 20}" y2="${H_TEXT_H - 20}" stroke="#C65D3B" stroke-width="2" />
</svg>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Собрать инфографику 1080×1080 (квадрат, Instagram/Avito).
 * Результат кэшируется на диске 24 ч по SHA-256(photo+bullets).
 */
export async function buildInfographicImage(
  imageBuffer: Buffer,
  bullets: string[],
): Promise<Buffer> {
  const safeBullets = [...bullets];
  while (safeBullets.length < 3) safeBullets.push("Готово к работе");

  const cacheKey = makeCacheKey("sq", imageBuffer, safeBullets);
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  const fontFaceBlock = await getFontFaceBlock();

  const base = sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 4,
      background: { r: 0xf2, g: 0xee, b: 0xe3, alpha: 1 },
    },
  });

  const fittedPhoto = await sharp(imageBuffer)
    .rotate()
    .resize(PHOTO_W, PHOTO_H, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();

  const maskedPhoto = await sharp(fittedPhoto)
    .composite([{
      input: Buffer.from(buildPhotoMaskSvg(PHOTO_W, PHOTO_H, PHOTO_RADIUS)),
      blend: "dest-in",
    }])
    .png()
    .toBuffer();

  const textSvg = Buffer.from(buildBulletsSvg(safeBullets, fontFaceBlock));

  const out = await base
    .composite([
      { input: maskedPhoto, top: PHOTO_Y, left: PHOTO_X },
      { input: textSvg, top: TEXT_Y, left: TEXT_X },
    ])
    .webp({ quality: 88 })
    .toBuffer();

  await putCached(cacheKey, out);
  return out;
}

/**
 * Собрать инфографику 1200×630 (горизонталь, OpenGraph / ВКонтакте / Telegram).
 * Кэш по тому же механизму (24 ч).
 */
export async function buildHorizontalImage(
  imageBuffer: Buffer,
  bullets: string[],
): Promise<Buffer> {
  const safeBullets = [...bullets];
  while (safeBullets.length < 3) safeBullets.push("Готово к работе");

  const cacheKey = makeCacheKey("hz", imageBuffer, safeBullets);
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  const fontFaceBlock = await getFontFaceBlock();

  const base = sharp({
    create: {
      width: H_W,
      height: H_H,
      channels: 4,
      background: { r: 0xf2, g: 0xee, b: 0xe3, alpha: 1 },
    },
  });

  const fittedPhoto = await sharp(imageBuffer)
    .rotate()
    .resize(H_PHOTO_W, H_PHOTO_H, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();

  const textSvg = Buffer.from(buildHorizontalBulletsSvg(safeBullets, fontFaceBlock));

  const out = await base
    .composite([
      { input: fittedPhoto, top: H_PHOTO_Y, left: H_PHOTO_X },
      { input: textSvg, top: 0, left: 0 },
    ])
    .webp({ quality: 88 })
    .toBuffer();

  await putCached(cacheKey, out);
  return out;
}
