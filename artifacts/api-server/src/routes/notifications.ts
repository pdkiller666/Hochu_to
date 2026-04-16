import { Router } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

const router = Router();

// GET /api/notifications — current user's notifications (last 50)
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const rows = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, req.userId!))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);
  res.json(rows);
});

// PATCH /api/notifications/:id/read — mark one as read
router.patch("/:id/read", requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.userId!)));
  res.json({ ok: true });
});

// POST /api/notifications/read-all — mark all as read
router.post("/read-all", requireAuth, async (req: AuthRequest, res) => {
  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.userId, req.userId!));
  res.json({ ok: true });
});

export default router;
