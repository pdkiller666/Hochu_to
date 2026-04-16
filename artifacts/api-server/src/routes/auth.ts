import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, regionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { RegisterUserBody, LoginUserBody } from "@workspace/api-zod";

const router = Router();

function generateToken(userId: number): string {
  const payload = { userId, iat: Date.now() };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
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
    createdAt: user.createdAt.toISOString(),
  };
}

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

  const token = generateToken(newUser.id);
  res.status(201).json({ user: formatUser(newUser, regionName), token });
});

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

  const token = generateToken(user.id);
  res.json({ user: formatUser(user, regionName), token });
});

router.post("/logout", (_req, res) => {
  res.json({ success: true, message: "Вы вышли из системы" });
});

router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthorized", message: "Требуется авторизация" });
    return;
  }

  try {
    const token = authHeader.slice(7);
    const payload = JSON.parse(Buffer.from(token, "base64").toString());
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

export default router;
