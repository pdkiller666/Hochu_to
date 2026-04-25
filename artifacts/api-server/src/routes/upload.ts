import { Router } from "express";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import { open } from "fs/promises";
import { requireAuth } from "../middleware/auth.js";
import { UPLOADS_DIR } from "../lib/uploadsDir.js";

const router = Router();

// UPLOADS_DIR гарантированно создан при импорте uploadsDir.ts

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Только изображения"));
  },
});

router.post("/upload", requireAuth, upload.array("photos", 10), (req, res) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    res.status(400).json({ error: "Нет файлов" });
    return;
  }
  const urls = files.map(f => `/uploads/${f.filename}`);
  res.json({ urls });
});

// ─── Stage 22b-followup: загрузка видео для Цифровых Актов ────────────────────
// Отдельный endpoint, чтобы лимит 100МБ не «заражал» обычный фото-аплоад.
// Allowlist mime — только реальные видео-форматы, которые умеет HTML5 <video>.
const ALLOWED_VIDEO_MIME = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime", // .mov с iPhone
]);
const VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v)$/i;

const videoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    let ext = path.extname(file.originalname).toLowerCase();
    // Нормализуем расширение по mime, чтобы фронт всегда мог отрисовать <video>.
    if (!VIDEO_EXT_RE.test(ext)) {
      ext = file.mimetype === "video/webm" ? ".webm"
          : file.mimetype === "video/quicktime" ? ".mov"
          : ".mp4";
    }
    cb(null, `${randomUUID()}${ext}`);
  },
});

const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 МБ — короткое видео-доказательство
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_VIDEO_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error("Только MP4 / WebM / MOV"));
  },
});

/**
 * Server-side magic-byte sniff (Stage 22b-followup hardening, post code-review).
 * Полагаться только на client-supplied mimetype небезопасно — клиент может
 * прислать .mp4 с любым содержимым (даже исполняемым) и multer пропустит.
 *
 * Проверяем сигнатуры контейнеров без внешних зависимостей:
 *  - MP4/MOV/M4V (ISO BMFF): байты 4..7 = "ftyp" (0x66 0x74 0x79 0x70)
 *  - WebM (Matroska/EBML):   байты 0..3 = 0x1A 0x45 0xDF 0xA3
 */
async function isRealVideo(filePath: string): Promise<boolean> {
  const fh = await open(filePath, "r");
  try {
    const buf = Buffer.alloc(16);
    const { bytesRead } = await fh.read(buf, 0, 16, 0);
    if (bytesRead < 8) return false;
    // ISO BMFF: 4 байта длины бокса + "ftyp"
    const isFtyp = buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70;
    // EBML / Matroska / WebM
    const isEbml = buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
    return isFtyp || isEbml;
  } finally {
    await fh.close();
  }
}

router.post("/upload-video", requireAuth, (req, res) => {
  videoUpload.single("video")(req, res, async (err: any) => {
    if (err) {
      // multer fileFilter / size limit: вернуть JSON, а не HTML stack trace
      const isLimit = err?.code === "LIMIT_FILE_SIZE";
      res.status(400).json({
        error: isLimit ? "file_too_large" : "invalid_file",
        message: isLimit
          ? "Видео слишком большое. Лимит — 100МБ."
          : (err?.message || "Файл не принят"),
      });
      return;
    }
    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
      res.status(400).json({ error: "no_file", message: "Нет файла" });
      return;
    }
    // Magic-byte sniff: реальное видео или подмена под mimetype?
    const filePath = path.join(UPLOADS_DIR, file.filename);
    try {
      if (!(await isRealVideo(filePath))) {
        await fs.unlink(filePath).catch(() => {});
        res.status(400).json({
          error: "invalid_file",
          message: "Файл не похож на видео (MP4/MOV/WebM). Попробуйте другой.",
        });
        return;
      }
    } catch {
      // Если сами не смогли прочитать — на всякий случай удаляем и отклоняем
      await fs.unlink(filePath).catch(() => {});
      res.status(400).json({ error: "invalid_file", message: "Не удалось проверить файл" });
      return;
    }
    res.json({ url: `/uploads/${file.filename}` });
  });
});

export default router;
