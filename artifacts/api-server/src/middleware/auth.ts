import { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyAccessToken } from "../lib/auth-token";

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

const ADMIN_ROLES = ["admin", "superadmin", "moderator", "support", "arbiter"] as const;

/**
 * RBAC middleware: разрешает доступ только пользователям с role IN (admin, superadmin).
 * Должен ставиться ПОСЛЕ requireAuth (читает req.userRole, выставленный requireAuth).
 *
 * Пример:  router.get("/admin/x", requireAuth, requireAdmin, handler)
 */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userRole || !["admin", "superadmin"].includes(req.userRole)) {
    res.status(403).json({ error: "forbidden", message: "Только для администраторов портала" });
    return;
  }
  next();
}

/**
 * Гибкий RBAC middleware: разрешает доступ только пользователям с role IN allowedRoles.
 * Должен ставиться ПОСЛЕ requireAuth.
 *
 * Пример:  router.get("/admin/settings", requireAuth, requireRole("superadmin"), handler)
 * Пример:  router.get("/admin/users", requireAuth, requireRole("superadmin", "admin"), handler)
 */
export function requireRole(...allowedRoles: string[]) {
  return function (req: AuthRequest, res: Response, next: NextFunction) {
    if (!req.userRole || !allowedRoles.includes(req.userRole)) {
      res.status(403).json({
        error: "forbidden",
        message: `Доступ ограничен. Требуется роль: ${allowedRoles.join(" | ")}`,
      });
      return;
    }
    next();
  };
}

export { ADMIN_ROLES };
