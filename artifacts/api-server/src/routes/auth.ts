import { Router, type Response } from "express";
import bcrypt from "bcryptjs";
import {
  db,
  usersTable,
  regionsTable,
  authSessionsTable,
} from "@workspace/db";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { RegisterUserBody, LoginUserBody } from "@workspace/api-zod";
import { issueAccessToken, verifyAccessToken } from "../lib/auth-token";
import {
  generateRefreshToken,
  getRefreshExpiresAt,
  hashRefreshToken,
  REFRESH_TOKEN_COOKIE,
} from "../lib/refresh-token";

const router = Router();

const isProduction = process.env.NODE_ENV === "production";

/**
 * Настройки refresh-cookie зависят от окружения:
 *
 * PRODUCTION (Amvera через HTTPS, фронт в iframe-preview):
 *   secure: true + sameSite: "none" — обязательны: HTTPS-only кука, разрешено
 *   передавать через cross-origin прокси (без этого preview-pane Replit и
 *   webview-iframes не получат куку при cross-site запросах).
 *
 * DEVELOPMENT (curl/браузер на http://localhost:8080):
 *   secure: false + sameSite: "lax" — Secure-куки тихо отбрасываются на HTTP,
 *   что ломает auth в curl-смоках и в локальных dev-сценариях. Lax работает
 *   для same-site запросов, что покрывает vite-proxy `/api → :8080`.
 *
 * До Stage 32 в этом блоке `isProduction` была объявлена, но НЕ применялась —
 * `secure: true` стояло хардкодом, что ломало auth при curl-отладке на dev.
 */
function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 дней
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  });
}

function formatUser(user: typeof usersTable.$inferSelect, regionName?: string) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone ?? undefined,
    avatar: user.avatar ?? undefined,
    regionId: user.regionId ?? undefined,
    regionName: regionName ?? undefined,
    // Stage 19g — Trust & Verification: владелец видит свой статус в личном кабинете.
    isVerified: user.isVerified ?? false,
    verifiedAt: user.verifiedAt ? user.verifiedAt.toISOString() : null,
    // Stage 29 — Trust Score: 0..100, NULL пока ещё не вычислялось.
    trustScore: user.trustScore ?? null,
    trustScoreUpdatedAt: user.trustScoreUpdatedAt ? user.trustScoreUpdatedAt.toISOString() : null,
    emailVerified: (user as any).emailVerified ?? false,
    createdAt: user.createdAt.toISOString(),
  };
}

// Роут регистрации
router.post("/register", async (req, res) => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const { name, email, password, role, phone, regionId } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "conflict", message: "Пользователь с таким email уже существует" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [newUser] = await db.insert(usersTable).values({
    name,
    email,
    passwordHash,
    role: role as "renter" | "owner",
    phone: phone ?? null,
    regionId: regionId ?? null,
  }).returning();

  let regionName: string | undefined;
  if (newUser.regionId) {
    const [region] = await db.select().from(regionsTable).where(eq(regionsTable.id, newUser.regionId)).limit(1);
    regionName = region?.name;
  }

  const token = issueAccessToken(newUser.id);
  const refreshToken = generateRefreshToken();
  
  await db.insert(authSessionsTable).values({
    userId: newUser.id,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: getRefreshExpiresAt(),
  });

  setRefreshCookie(res, refreshToken);
  res.status(201).json({ user: formatUser(newUser, regionName), token });
});

// Роут логина
router.post("/login", async (req, res) => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

  if (!user) {
    res.status(401).json({ error: "unauthorized", message: "Неверный email или пароль" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "unauthorized", message: "Неверный email или пароль" });
    return;
  }

  if (user.isBanned) {
    res.status(403).json({
      error: "banned",
      message: `Ваш аккаунт заблокирован${user.banReason ? `: ${user.banReason}` : ". Обратитесь в поддержку."}`,
    });
    return;
  }

  let regionName: string | undefined;
  if (user.regionId) {
    const [region] = await db.select().from(regionsTable).where(eq(regionsTable.id, user.regionId)).limit(1);
    regionName = region?.name;
  }

  const token = issueAccessToken(user.id);
  const refreshToken = generateRefreshToken();

  await db.insert(authSessionsTable).values({
    userId: user.id,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: getRefreshExpiresAt(),
  });

  setRefreshCookie(res, refreshToken);
  res.json({ user: formatUser(user, regionName), token });
});

// Роут обновления токена (Refresh)
router.post("/refresh", async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
  
  if (typeof refreshToken !== "string" || refreshToken.length === 0) {
    res.status(401).json({ error: "unauthorized", message: "Refresh token отсутствует" });
    return;
  }

  const refreshHash = hashRefreshToken(refreshToken);
  const [session] = await db
    .select()
    .from(authSessionsTable)
    .where(
      and(
        eq(authSessionsTable.tokenHash, refreshHash),
        isNull(authSessionsTable.revokedAt),
        gt(authSessionsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!session) {
    clearRefreshCookie(res);
    res.status(401).json({ error: "unauthorized", message: "Refresh token недействителен" });
    return;
  }

  await db
    .update(authSessionsTable)
    .set({ revokedAt: new Date() })
    .where(eq(authSessionsTable.id, session.id));

  const nextRefreshToken = generateRefreshToken();
  await db.insert(authSessionsTable).values({
    userId: session.userId,
    tokenHash: hashRefreshToken(nextRefreshToken),
    expiresAt: getRefreshExpiresAt(),
  });

  const accessToken = issueAccessToken(session.userId);
  setRefreshCookie(res, nextRefreshToken);
  res.json({ token: accessToken });
});

// Роут выхода
router.post("/logout", async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
  if (typeof refreshToken === "string" && refreshToken.length > 0) {
    await db
      .update(authSessionsTable)
      .set({ revokedAt: new Date() })
      .where(eq(authSessionsTable.tokenHash, hashRefreshToken(refreshToken)));
  }
  clearRefreshCookie(res);
  res.json({ success: true, message: "Вы вышли из системы" });
});

// Роут проверки текущего пользователя
router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthorized", message: "Требуется авторизация" });
    return;
  }

  try {
    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);
    if (!payload) {
      res.status(401).json({ error: "unauthorized", message: "Недействительный токен" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);

    if (!user) {
      res.status(401).json({ error: "unauthorized", message: "Пользователь не найден" });
      return;
    }

    if (user.isBanned) {
      res.status(403).json({
        error: "banned",
        message: `Ваш аккаунт заблокирован${user.banReason ? `: ${user.banReason}` : ". Обратитесь в поддержку."}`,
      });
      return;
    }

    let regionName: string | undefined;
    if (user.regionId) {
      const [region] = await db.select().from(regionsTable).where(eq(regionsTable.id, user.regionId)).limit(1);
      regionName = region?.name;
    }

    res.json(formatUser(user, regionName));
  } catch {
    res.status(401).json({ error: "unauthorized", message: "Недействительный токен" });
  }
});

// ─── POST /auth/send-verify-email — отправляет (мок) ссылку верификации ────
router.post("/send-verify-email", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) { res.status(401).json({ error: "unauthorized" }); return; }
    const payload = verifyAccessToken(token);
    if (!payload) { res.status(401).json({ error: "unauthorized" }); return; }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
    if (!user) { res.status(401).json({ error: "unauthorized" }); return; }

    if ((user as any).emailVerified) {
      res.json({ alreadyVerified: true });
      return;
    }

    // Мок-режим: генерируем токен, сразу возвращаем ссылку (в production отправлялась бы почта)
    const { randomUUID } = await import("crypto");
    const vToken = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24ч

    await db.update(usersTable).set({
      emailVerifyToken: vToken,
      emailVerifyTokenExpiresAt: expiresAt,
    } as any).where(eq(usersTable.id, user.id));

    res.json({
      sent: true,
      // В dev-режиме возвращаем токен прямо в ответе для мок-верификации
      mockVerifyToken: process.env.NODE_ENV !== "production" ? vToken : undefined,
    });
  } catch {
    res.status(500).json({ error: "server_error" });
  }
});

// ─── POST /auth/verify-email — верифицирует email по токену ─────────────────
router.post("/verify-email", async (req, res) => {
  try {
    const { token: vToken } = req.body as { token?: string };
    if (!vToken) { res.status(400).json({ error: "token_required" }); return; }

    const [user] = await db.select().from(usersTable)
      .where(eq(usersTable.emailVerifyToken as any, vToken))
      .limit(1);

    if (!user) { res.status(400).json({ error: "invalid_token", message: "Ссылка недействительна или уже использована" }); return; }

    const expiresAt: Date | null = (user as any).emailVerifyTokenExpiresAt;
    if (expiresAt && new Date() > expiresAt) {
      res.status(400).json({ error: "token_expired", message: "Ссылка истекла. Запросите новую." });
      return;
    }

    await db.update(usersTable).set({
      emailVerified: true,
      emailVerifyToken: null,
      emailVerifyTokenExpiresAt: null,
    } as any).where(eq(usersTable.id, user.id));

    res.json({ verified: true });
  } catch {
    res.status(500).json({ error: "server_error" });
  }
});

export default router;