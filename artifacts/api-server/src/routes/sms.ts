/**
 * SMS routes — Stage 38-UE Universal SMS Adapter
 * POST /sms/send-phone-otp   — send OTP to verify phone number
 * POST /sms/verify-phone-otp — verify the OTP and mark phone_verified=true
 * POST /sms/send-financial-otp — send critical-operation OTP (financial actions)
 * POST /sms/verify-financial-otp — verify financial OTP
 */
import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { getSmsProvider } from "../lib/sms/factory.js";
import { getPlatformSettings } from "../lib/platform-settings.js";

const router = Router();

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

function generateOtp(length: 4 | 6 = 6): string {
  const max = 10 ** length;
  return String(Math.floor(Math.random() * max)).padStart(length, "0");
}

// ─── Phone Verification ───────────────────────────────────────────────────────

router.post("/send-phone-otp", requireAuth, async (req: AuthRequest, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) return res.status(404).json({ error: "user_not_found" });
  if (!user.phone) return res.status(400).json({ error: "no_phone", message: "Телефон не указан в профиле" });
  if (user.phoneVerified) return res.status(400).json({ error: "already_verified", message: "Телефон уже верифицирован" });

  const settings = await getPlatformSettings();
  if (!settings.smsEnabled) return res.status(503).json({ error: "sms_disabled", message: "SMS-уведомления отключены" });

  const provider = getSmsProvider();
  if (!provider) return res.status(503).json({ error: "no_provider", message: "SMS-провайдер не настроен" });

  const otp = generateOtp(6);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await db.update(usersTable)
    .set({ phoneOtp: otp, phoneOtpExpiresAt: expiresAt })
    .where(eq(usersTable.id, user.id));

  const result = await provider.send(user.phone, `Хочу_То: код подтверждения ${otp}. Действителен 5 минут.`);
  if (!result.ok) {
    return res.status(502).json({ error: "sms_failed", message: result.error ?? "Ошибка отправки SMS" });
  }

  res.json({ ok: true, expiresAt: expiresAt.toISOString(), maskedPhone: maskPhone(user.phone) });
});

router.post("/verify-phone-otp", requireAuth, async (req: AuthRequest, res) => {
  const { otp } = req.body ?? {};
  if (!otp || typeof otp !== "string") return res.status(400).json({ error: "otp_required" });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) return res.status(404).json({ error: "user_not_found" });
  if (!user.phoneOtp || !user.phoneOtpExpiresAt) return res.status(400).json({ error: "no_otp", message: "OTP не был запрошен" });
  if (new Date() > user.phoneOtpExpiresAt) return res.status(400).json({ error: "otp_expired", message: "OTP истёк, запросите новый" });
  if (user.phoneOtp !== otp.trim()) return res.status(400).json({ error: "otp_invalid", message: "Неверный код" });

  await db.update(usersTable)
    .set({ phoneVerified: true, phoneOtp: null, phoneOtpExpiresAt: null })
    .where(eq(usersTable.id, user.id));

  res.json({ ok: true, phoneVerified: true });
});

// ─── Financial OTP (критические операции) ────────────────────────────────────

router.post("/send-financial-otp", requireAuth, async (req: AuthRequest, res) => {
  const { operation } = req.body ?? {};
  if (!operation || typeof operation !== "string") {
    return res.status(400).json({ error: "operation_required", message: "Укажите операцию" });
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) return res.status(404).json({ error: "user_not_found" });
  if (!user.phone) return res.status(400).json({ error: "no_phone", message: "Телефон не указан. Добавьте телефон в профиле." });
  if (!user.phoneVerified) return res.status(400).json({ error: "phone_not_verified", message: "Сначала верифицируйте номер телефона" });

  const settings = await getPlatformSettings();
  if (!settings.smsEnabled) return res.status(503).json({ error: "sms_disabled", message: "SMS-уведомления отключены" });

  const provider = getSmsProvider();
  if (!provider) return res.status(503).json({ error: "no_provider", message: "SMS-провайдер не настроен" });

  const otp = generateOtp(6);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await db.update(usersTable)
    .set({ phoneOtp: otp, phoneOtpExpiresAt: expiresAt })
    .where(eq(usersTable.id, user.id));

  const OPERATION_LABELS: Record<string, string> = {
    login: "Вход в аккаунт",
    payout: "Запрос выплаты",
    deal_confirm: "Подтверждение сделки",
    account_delete: "Удаление аккаунта",
  };
  const label = OPERATION_LABELS[operation] ?? operation;

  const result = await provider.send(
    user.phone,
    `Хочу_То: код для операции «${label}» — ${otp}. Действителен 5 минут. Не сообщайте никому.`,
  );

  if (!result.ok) {
    return res.status(502).json({ error: "sms_failed", message: result.error ?? "Ошибка отправки SMS" });
  }

  res.json({ ok: true, expiresAt: expiresAt.toISOString(), maskedPhone: maskPhone(user.phone) });
});

router.post("/verify-financial-otp", requireAuth, async (req: AuthRequest, res) => {
  const { otp } = req.body ?? {};
  if (!otp || typeof otp !== "string") return res.status(400).json({ error: "otp_required" });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) return res.status(404).json({ error: "user_not_found" });
  if (!user.phoneOtp || !user.phoneOtpExpiresAt) return res.status(400).json({ error: "no_otp" });
  if (new Date() > user.phoneOtpExpiresAt) return res.status(400).json({ error: "otp_expired" });
  if (user.phoneOtp !== otp.trim()) return res.status(400).json({ error: "otp_invalid" });

  // Сразу очищаем OTP чтобы нельзя было использовать дважды
  await db.update(usersTable)
    .set({ phoneOtp: null, phoneOtpExpiresAt: null })
    .where(eq(usersTable.id, user.id));

  res.json({ ok: true });
});

// ─── Status ───────────────────────────────────────────────────────────────────

router.get("/status", requireAuth, async (req: AuthRequest, res) => {
  const [user] = await db.select({
    phone: usersTable.phone,
    phoneVerified: usersTable.phoneVerified,
    phoneOtp: usersTable.phoneOtp,
    phoneOtpExpiresAt: usersTable.phoneOtpExpiresAt,
  }).from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) return res.status(404).json({ error: "user_not_found" });

  const settings = await getPlatformSettings();
  res.json({
    hasPhone: !!user.phone,
    maskedPhone: user.phone ? maskPhone(user.phone) : null,
    phoneVerified: user.phoneVerified,
    hasOtp: !!user.phoneOtp && !!user.phoneOtpExpiresAt && new Date() < user.phoneOtpExpiresAt!,
    otpExpiresAt: user.phoneOtpExpiresAt?.toISOString() ?? null,
    smsEnabled: settings.smsEnabled,
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return phone;
  return `+7 *** ***-${digits.slice(-4, -2)}-${digits.slice(-2)}`;
}

export default router;
