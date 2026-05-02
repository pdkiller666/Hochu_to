/**
 * Stage 38 — Telegram linking routes
 * POST /api/telegram/generate-otp  — генерация OTP для привязки
 * POST /api/telegram/unlink        — отвязать Telegram от аккаунта
 * PATCH /api/telegram/preferences  — обновить настройки уведомлений
 * GET  /api/telegram/status        — возвращает telegramChatId + prefs текущего пользователя
 */
import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import type { AuthRequest } from "../middleware/auth.js";

const router = Router();

/** Генерация 6-значного OTP. Действителен 10 минут. */
router.post("/generate-otp", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db
    .update(usersTable)
    .set({ telegramOtp: otp, telegramOtpExpiresAt: expiresAt })
    .where(eq(usersTable.id, userId));

  res.json({ otp, expiresAt: expiresAt.toISOString() });
});

/** Статус привязки и настройки уведомлений для текущего пользователя. */
router.get("/status", requireAuth, async (req: AuthRequest, res) => {
  const [u] = await db
    .select({
      telegramChatId: usersTable.telegramChatId,
      telegramNotifications: usersTable.telegramNotifications,
      telegramOtp: usersTable.telegramOtp,
      telegramOtpExpiresAt: usersTable.telegramOtpExpiresAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);

  res.json({
    linked: !!u?.telegramChatId,
    preferences: u?.telegramNotifications ?? { bookings: true, system: true, chats: true },
    hasOtp: !!u?.telegramOtp && (!u.telegramOtpExpiresAt || new Date(u.telegramOtpExpiresAt) > new Date()),
    otpExpiresAt: u?.telegramOtpExpiresAt ?? null,
  });
});

/** Отвязать Telegram-аккаунт. */
router.post("/unlink", requireAuth, async (req: AuthRequest, res) => {
  await db
    .update(usersTable)
    .set({ telegramChatId: null, telegramOtp: null, telegramOtpExpiresAt: null })
    .where(eq(usersTable.id, req.userId!));

  res.json({ ok: true });
});

/** Обновить настройки уведомлений (чек-боксы). */
router.patch("/preferences", requireAuth, async (req: AuthRequest, res) => {
  const { bookings, system, chats } = req.body;
  const patch: Record<string, boolean> = {};
  if (typeof bookings === "boolean") patch.bookings = bookings;
  if (typeof system === "boolean") patch.system = system;
  if (typeof chats === "boolean") patch.chats = chats;

  if (!Object.keys(patch).length) {
    return res.status(400).json({ error: "bad_request", message: "Нет валидных полей" });
  }

  const [u] = await db
    .select({ telegramNotifications: usersTable.telegramNotifications })
    .from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);

  const current = (u?.telegramNotifications as any) ?? { bookings: true, system: true, chats: true };
  const merged = { ...current, ...patch };

  await db.update(usersTable).set({ telegramNotifications: merged }).where(eq(usersTable.id, req.userId!));
  res.json({ preferences: merged });
});

export default router;
