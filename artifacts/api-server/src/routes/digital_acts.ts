import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import {
  db,
  digitalActsTable,
  bookingsTable,
  insertDigitalActSchema,
  type DigitalActType,
} from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

const router = Router();

// Stage 22b — формат подписи. PNG data-URL, base64 alphabet only,
// до ~300КБ (типичная подпись 800×180 = 10–60КБ; 300К — запас на ретину).
// Без зависимости от zod/v4: ручная проверка regex + длины проще и не тянет
// внешний модуль в bundle (api-server использует только @workspace/api-zod).
const SIGNATURE_RE = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;
const MAX_SIGNATURE_LEN = 300_000;
// Базовый префикс base64 для magic-байт PNG (0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A) = "iVBORw0KGgo".
// Это исключает «PNG»-фейки с другим форматом данных под видом mime.
const PNG_BASE64_MAGIC_PREFIX = "iVBORw0KGgo";

function validateSignature(raw: unknown): { ok: true; value: string } | { ok: false; message: string } {
  if (typeof raw !== "string" || raw.length === 0) {
    return { ok: false, message: "Подпись обязательна — нарисуйте её в модалке акта." };
  }
  if (raw.length > MAX_SIGNATURE_LEN) {
    return { ok: false, message: "Подпись слишком большая (>300КБ)." };
  }
  if (!SIGNATURE_RE.test(raw)) {
    return { ok: false, message: "Подпись должна быть PNG в формате data:image/png;base64,…" };
  }
  // Проверка реальных PNG-магик-байт (не просто mime-приписка).
  const base64Body = raw.slice("data:image/png;base64,".length);
  if (!base64Body.startsWith(PNG_BASE64_MAGIC_PREFIX)) {
    return { ok: false, message: "Подпись повреждена: ожидаются настоящие PNG-данные." };
  }
  return { ok: true, value: raw };
}

/**
 * Stage 22a — Цифровой Акт.
 *
 * GET  /api/bookings/:bookingId/digital-acts        — список актов брони
 * POST /api/bookings/:bookingId/digital-acts        — создать акт (check_in | check_out)
 *
 * Проверки доступа:
 *  - Только участник брони (owner | renter) или admin.
 *  - check_in:  бронь должна быть в статусе confirmed (или active — для перезагрузки).
 *  - check_out: бронь должна быть в статусе active (или return_pending).
 */

router.get("/bookings/:bookingId/digital-acts", requireAuth, async (req: AuthRequest, res) => {
  const bookingId = Number.parseInt(req.params.bookingId as string, 10);
  if (!Number.isFinite(bookingId)) {
    res.status(400).json({ error: "bad_request", message: "Некорректный bookingId" });
    return;
  }

  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, bookingId))
    .limit(1);

  if (!booking) {
    res.status(404).json({ error: "not_found", message: "Бронирование не найдено" });
    return;
  }

  const isParticipant = booking.renterId === req.userId || booking.ownerId === req.userId;
  const isAdmin = req.userRole === "admin";
  if (!isParticipant && !isAdmin) {
    res.status(403).json({ error: "forbidden", message: "Нет доступа" });
    return;
  }

  const acts = await db
    .select()
    .from(digitalActsTable)
    .where(eq(digitalActsTable.bookingId, bookingId))
    .orderBy(desc(digitalActsTable.createdAt));

  res.json({ items: acts });
});

router.post("/bookings/:bookingId/digital-acts", requireAuth, async (req: AuthRequest, res) => {
  const bookingId = Number.parseInt(req.params.bookingId as string, 10);
  if (!Number.isFinite(bookingId)) {
    res.status(400).json({ error: "bad_request", message: "Некорректный bookingId" });
    return;
  }

  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, bookingId))
    .limit(1);

  if (!booking) {
    res.status(404).json({ error: "not_found", message: "Бронирование не найдено" });
    return;
  }

  const isParticipant = booking.renterId === req.userId || booking.ownerId === req.userId;
  if (!isParticipant) {
    res.status(403).json({ error: "forbidden", message: "Только участники брони могут создавать акт" });
    return;
  }

  const parsed = insertDigitalActSchema.safeParse({
    bookingId,
    type: req.body?.type,
    photos: req.body?.photos,
    videoUrl: req.body?.videoUrl ?? null,
    metadata: req.body?.metadata ?? null,
    createdByUserId: req.userId!,
  });

  if (!parsed.success) {
    res.status(400).json({
      error: "validation_failed",
      message: parsed.error.issues[0]?.message ?? "Некорректные данные",
      issues: parsed.error.issues,
    });
    return;
  }

  // Hardening (Stage 22a, post-review): photos должны быть путями /uploads/<file>,
  // выданные нашим upload-эндпоинтом. Без этого участник мог бы прислать
  // произвольный URL и подделать доказательную базу.
  const SAFE_UPLOAD_RE = /^\/uploads\/[A-Za-z0-9._-]+\.(jpe?g|png|webp|heic|heif)$/i;
  const badPhoto = parsed.data.photos.find((p: string) => !SAFE_UPLOAD_RE.test(p));
  if (badPhoto) {
    res.status(400).json({
      error: "invalid_photo_url",
      message: `Фото должно быть загружено через нашу загрузку (/uploads/...): ${badPhoto}`,
    });
    return;
  }

  // Stage 22b-followup: видео — либо внутренний /uploads/<uuid>.<видео-ext>,
  // либо внешний http(s) URL. data:-URI и path-traversal запрещены.
  const SAFE_UPLOAD_VIDEO_RE = /^\/uploads\/[A-Za-z0-9._-]+\.(mp4|webm|mov|m4v)$/i;
  const rawVideo = parsed.data.videoUrl;
  if (rawVideo) {
    const isInternal = SAFE_UPLOAD_VIDEO_RE.test(rawVideo);
    let isExternal = false;
    try {
      const u = new URL(rawVideo);
      isExternal = u.protocol === "https:" || u.protocol === "http:";
    } catch {
      isExternal = false;
    }
    if (!isInternal && !isExternal) {
      res.status(400).json({
        error: "invalid_video_url",
        message:
          "Видео должно быть загружено через нашу загрузку (/uploads/...) или быть полной ссылкой http(s)://...",
      });
      return;
    }
  }

  // Stage 22b — обязательная электронная подпись участника. Хранится в metadata.
  const sig = validateSignature((parsed.data.metadata as any)?.signature);
  if (!sig.ok) {
    res.status(400).json({ error: "signature_required", message: sig.message });
    return;
  }

  const type = parsed.data.type as DigitalActType;

  // Statе-машина: какой акт уместен в каком статусе брони
  const allowedStatusByType: Record<DigitalActType, string[]> = {
    check_in: ["confirmed", "active"],
    check_out: ["active", "return_pending"],
  };
  if (!allowedStatusByType[type].includes(booking.status)) {
    res.status(422).json({
      error: "invalid_state",
      message:
        type === "check_in"
          ? "Check-in акт можно создать только для подтверждённой брони"
          : "Check-out акт можно создать только для активной аренды",
    });
    return;
  }

  try {
    const [created] = await db.insert(digitalActsTable).values(parsed.data).returning();
    res.status(201).json(created);
  } catch (e: any) {
    // 23505 — UNIQUE(booking_id, type) violation. Иммутабельность акта.
    const pgCode = e?.cause?.code ?? e?.code;
    if (pgCode === "23505") {
      res.status(409).json({
        error: "act_already_exists",
        message:
          type === "check_in"
            ? "Акт приёмки уже существует для этой брони. Изменение запрещено."
            : "Акт возврата уже существует для этой брони. Изменение запрещено.",
      });
      return;
    }
    throw e;
  }
});

export default router;
