/**
 * Reports — users can report listings or other users.
 */
import { Router } from "express";
import { db, listingsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

const router = Router();

// POST /api/reports — submit a report
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const { reportType, reportedListingId, reportedUserId, reason, detail } = req.body;

  if (!["listing", "user"].includes(reportType)) {
    res.status(400).json({ error: "bad_request", message: "Тип жалобы: listing или user" });
    return;
  }
  if (!reason?.trim()) {
    res.status(400).json({ error: "bad_request", message: "Причина обязательна" });
    return;
  }
  if (reportType === "listing" && !reportedListingId) {
    res.status(400).json({ error: "bad_request", message: "Укажите объявление" });
    return;
  }
  if (reportType === "user" && !reportedUserId) {
    res.status(400).json({ error: "bad_request", message: "Укажите пользователя" });
    return;
  }
  if (reportType === "user" && reportedUserId === req.userId) {
    res.status(400).json({ error: "bad_request", message: "Нельзя пожаловаться на самого себя" });
    return;
  }

  // Prevent duplicate pending reports
  const [existing] = await db.execute(sql`
    SELECT id FROM reports
    WHERE reporter_user_id = ${req.userId}
      AND report_type = ${reportType}
      AND COALESCE(reported_listing_id, 0) = ${reportedListingId ?? 0}
      AND COALESCE(reported_user_id, 0) = ${reportedUserId ?? 0}
      AND status = 'pending'
    LIMIT 1
  `).then(r => r.rows as any[]);

  if (existing) {
    res.status(409).json({ error: "duplicate", message: "Вы уже подавали жалобу, она на рассмотрении" });
    return;
  }

  await db.execute(sql`
    INSERT INTO reports (reporter_user_id, report_type, reported_listing_id, reported_user_id, reason, detail, status)
    VALUES (${req.userId}, ${reportType}, ${reportedListingId ?? null}, ${reportedUserId ?? null}, ${reason.trim()}, ${detail?.trim() ?? null}, 'pending')
  `);

  res.status(201).json({ ok: true });
});

export default router;
