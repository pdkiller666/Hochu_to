/**
 * Stage 38 — Telegram Bot Integration (lib/telegram.ts)
 *
 * Возможности:
 *  - Динамическая инициализация бота из platform_settings.telegramBotToken
 *  - Hot-swap токена без перезапуска сервера
 *  - OTP-привязка аккаунта через /start или /link <code>
 *  - Ролевая рассылка персоналу (notifyStaffByRole)
 *  - Массовая рассылка (broadcastToAll) с логированием в audit_events
 *  - Dev-режим: рассылка только superadmin'ам (telegramEnv = 'dev')
 *  - 3 попытки повторной отправки, truncate до 4096 символов
 */

import { Telegraf } from "telegraf";
import { db, usersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { getPlatformSettings } from "./platform-settings.js";
import { logger } from "./logger.js";
import { recordAuditEvent } from "./audit-events.js";

const TG_MAX_LEN = 4096;
const TG_RETRIES = 3;
const TG_RETRY_BASE_MS = 800;

type NotifPrefs = { bookings: boolean; system: boolean; chats: boolean };
const DEFAULT_PREFS: NotifPrefs = { bookings: true, system: true, chats: true };

let bot: Telegraf | null = null;
let activeToken: string | null = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncate(text: string): string {
  return text.length <= TG_MAX_LEN ? text : text.slice(0, TG_MAX_LEN - 3) + "...";
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

async function sendMsg(
  chatId: string,
  text: string,
  link?: string,
): Promise<boolean> {
  if (!bot) return false;
  const body = truncate(text);
  for (let i = 0; i <= TG_RETRIES; i++) {
    try {
      const extra: any = { parse_mode: "HTML" };
      if (link) extra.reply_markup = { inline_keyboard: [[{ text: "Открыть →", url: link }]] };
      await bot.telegram.sendMessage(chatId, body, extra);
      return true;
    } catch (err: any) {
      const code: number = err?.response?.error_code ?? 0;
      const retryable = err?.code === "ETIMEOUT" || err?.code === "ECONNREFUSED" || [429, 500, 502, 503].includes(code);
      if (i < TG_RETRIES && retryable) {
        await sleep(TG_RETRY_BASE_MS * 2 ** i);
        continue;
      }
      logger.warn({ chatId, attempt: i, code, msg: err?.message }, "[tg] sendMsg failed");
      return false;
    }
  }
  return false;
}

// ── OTP linking handler ────────────────────────────────────────────────────────

async function handleOtp(ctx: any, otp: string) {
  const chatId = String(ctx.chat?.id ?? ctx.from?.id);
  if (!/^\d{6}$/.test(otp)) {
    await ctx.reply("❌ Код должен быть 6-значным числом. Получи его в настройках профиля Хочу_То.");
    return;
  }
  try {
    const [u] = await db
      .select({
        id: usersTable.id, name: usersTable.name,
        telegramOtp: usersTable.telegramOtp,
        telegramOtpExpiresAt: usersTable.telegramOtpExpiresAt,
      })
      .from(usersTable)
      .where(eq(usersTable.telegramOtp, otp))
      .limit(1);

    if (!u) { await ctx.reply("❌ Неверный код. Попробуй ещё раз или сгенерируй новый."); return; }
    if (u.telegramOtpExpiresAt && new Date(u.telegramOtpExpiresAt) < new Date()) {
      await ctx.reply("⏰ Код устарел (10 мин). Сгенерируй новый в настройках профиля."); return;
    }

    await db.update(usersTable).set({
      telegramChatId: chatId,
      telegramOtp: null,
      telegramOtpExpiresAt: null,
      telegramNotifications: DEFAULT_PREFS,
    }).where(eq(usersTable.id, u.id));

    await ctx.reply(`✅ Аккаунт привязан!\n\nПривет, ${u.name}! Теперь уведомления от Хочу_То будут приходить сюда. 🎉`);
    logger.info({ userId: u.id, chatId }, "[tg] account linked");
  } catch (err) {
    logger.error({ err }, "[tg] OTP handler error");
    await ctx.reply("😕 Произошла ошибка. Попробуй позже.");
  }
}

// ── Bot lifecycle ──────────────────────────────────────────────────────────────

async function startBot(token: string): Promise<void> {
  // Stop existing bot gracefully
  if (bot) {
    try { await (bot as any).stop("new_token"); } catch {}
    bot = null; activeToken = null;
  }

  const b = new Telegraf(token);

  // Validate token
  const me = await b.telegram.getMe(); // throws if invalid
  logger.info({ username: me.username }, "[tg] bot connected");

  // /start <otp>
  b.start(async (ctx) => {
    const parts = (ctx.message?.text ?? "").split(" ");
    if (parts[1]) { await handleOtp(ctx, parts[1]); return; }
    await ctx.reply("👋 Привет! Чтобы привязать аккаунт Хочу_То, напиши:\n/link 123456\n\nКод получи в настройках профиля на сайте.");
  });

  // /link <otp>
  b.command("link", async (ctx) => {
    const otp = (ctx.message?.text ?? "").split(" ")[1] ?? "";
    if (!otp) { await ctx.reply("❌ Укажи код: /link 123456\n\nКод можно получить в настройках профиля."); return; }
    await handleOtp(ctx, otp);
  });

  b.launch().catch((err: any) => {
    if (err?.message?.includes("new_token") || err?.message?.includes("graceful_shutdown")) return;
    logger.error({ err }, "[tg] polling error");
  });

  bot = b;
  activeToken = token;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Инициализация при старте сервера — читает токен из platform_settings, fallback на env. */
export async function initTelegramBot(): Promise<void> {
  try {
    const s = await getPlatformSettings();
    const token = s.telegramBotToken ?? process.env["TELEGRAM_BOT_TOKEN"] ?? null;
    if (!token) { logger.info("[tg] no token configured"); return; }
    await startBot(token);
  } catch (err) {
    logger.error({ err }, "[tg] init failed (non-fatal)");
  }
}

/** Горячая смена токена через AdminPage. */
export async function hotSwapToken(
  newToken: string,
  adminId?: number,
): Promise<{ ok: true; username: string } | { ok: false; error: string }> {
  try {
    await startBot(newToken);
    const me = await bot!.telegram.getMe();
    logger.info({ username: me.username, adminId }, "[tg] hot-swap success");
    return { ok: true, username: me.username ?? "" };
  } catch (err: any) {
    const error = err?.message ?? "Unknown error";
    logger.error({ err, adminId }, "[tg] hot-swap failed");
    if (adminId) {
      await recordAuditEvent({ entityType: "user", entityId: adminId, actorId: adminId, eventType: "telegram_token_invalid", metadata: { error } }).catch(() => {});
    }
    return { ok: false, error };
  }
}

/** Статус бота для AdminPage (Online / Offline). */
export async function getBotStatus(): Promise<{ online: true; username: string } | { online: false; error?: string }> {
  if (!bot || !activeToken) return { online: false };
  try {
    const me = await bot.telegram.getMe();
    return { online: true, username: me.username ?? "" };
  } catch (err: any) {
    return { online: false, error: err?.message };
  }
}

/**
 * Отправить уведомление конкретному пользователю.
 * В режиме dev — только superadmin'ам.
 * Учитывает preferences.
 */
export async function sendTelegramToUser(
  userId: number,
  category: keyof NotifPrefs,
  text: string,
  link?: string,
): Promise<boolean> {
  if (!bot) return false;
  try {
    const s = await getPlatformSettings();
    const [u] = await db
      .select({ telegramChatId: usersTable.telegramChatId, telegramNotifications: usersTable.telegramNotifications, role: usersTable.role })
      .from(usersTable).where(eq(usersTable.id, userId)).limit(1);

    if (!u?.telegramChatId) return false;
    if (s.telegramEnv === "dev" && u.role !== "superadmin") return false;

    const prefs = (u.telegramNotifications as NotifPrefs | null) ?? DEFAULT_PREFS;
    if (!prefs[category]) return false;

    const ok = await sendMsg(u.telegramChatId, text, link);
    if (ok) {
      await recordAuditEvent({ entityType: "user", entityId: userId, eventType: "telegram_notification_sent", metadata: { category, preview: text.slice(0, 100) } }).catch(() => {});
    }
    return ok;
  } catch (err) {
    logger.error({ err, userId }, "[tg] sendTelegramToUser error");
    return false;
  }
}

/**
 * Ролевая рассылка сотрудникам (arbiter, moderator, support, …).
 */
export async function notifyStaffByRole(
  roles: string[],
  text: string,
  link?: string,
): Promise<number> {
  if (!bot) return 0;
  try {
    const s = await getPlatformSettings();
    const staff = await db
      .select({ telegramChatId: usersTable.telegramChatId, role: usersTable.role })
      .from(usersTable)
      .where(inArray(usersTable.role as any, roles as any));

    let sent = 0;
    for (const u of staff) {
      if (!u.telegramChatId) continue;
      if (s.telegramEnv === "dev" && u.role !== "superadmin") continue;
      if (await sendMsg(u.telegramChatId, text, link)) sent++;
    }
    return sent;
  } catch (err) {
    logger.error({ err }, "[tg] notifyStaffByRole error");
    return 0;
  }
}

const VALID_ROLES = ["user", "owner", "moderator", "admin", "superadmin", "support", "arbiter", "staff"] as const;
export type TgBroadcastRole = typeof VALID_ROLES[number];
export function isValidBroadcastRole(r: string): r is TgBroadcastRole {
  return (VALID_ROLES as readonly string[]).includes(r);
}

/**
 * Массовая рассылка всем пользователям с привязанным Telegram.
 * Если role указана — только пользователи с этой ролью.
 * Логирует событие в audit_events (тип: notification_broadcast_sent).
 */
export async function broadcastToAll(
  text: string,
  link?: string,
  adminId?: number,
  role?: TgBroadcastRole,
): Promise<{ sent: number; failed: number }> {
  if (!bot) return { sent: 0, failed: 0 };
  try {
    const s = await getPlatformSettings();
    const users = await db
      .select({ id: usersTable.id, telegramChatId: usersTable.telegramChatId, role: usersTable.role })
      .from(usersTable);

    let sent = 0, failed = 0;
    for (const u of users) {
      if (!u.telegramChatId) continue;
      if (s.telegramEnv === "dev" && u.role !== "superadmin") continue;
      if (role && u.role !== role) continue;
      const ok = await sendMsg(u.telegramChatId, text, link);
      ok ? sent++ : failed++;
      await sleep(50); // ~20 msg/sec — safe Telegram rate
    }

    await recordAuditEvent({
      entityType: "user", entityId: adminId ?? 0, actorId: adminId,
      eventType: "notification_broadcast_sent",
      metadata: { sent, failed, preview: text.slice(0, 200), link, env: s.telegramEnv },
    }).catch(() => {});

    return { sent, failed };
  } catch (err) {
    logger.error({ err }, "[tg] broadcastToAll error");
    return { sent: 0, failed: 0 };
  }
}

export function stopBot() {
  if (bot) {
    (bot as any).stop("graceful_shutdown").catch(() => {});
    bot = null; activeToken = null;
  }
}
