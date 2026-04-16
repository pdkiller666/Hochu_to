import { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
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
        message: `Аккаунт заблокирован${user.banReason ? `: ${user.banReason}` : ". Обратитесь в поддержку."}`,
      });
      return;
    }

    req.userId = user.id;
    req.userRole = user.role;
    next();
  } catch {
    res.status(401).json({ error: "unauthorized", message: "Недействительный токен" });
  }
}
