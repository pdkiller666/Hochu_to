import { Router } from "express";
import { db, claimsTable, bookingsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

const router = Router();

// ─── GET /claims — список всех заявок (только admin) ─────────────────────────
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const [actor] = await db.select({ role: usersTable.role })
    .from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (actor?.role !== "admin") {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  const claims = await db.select().from(claimsTable).orderBy(desc(claimsTable.createdAt));
  res.json(claims);
});

// ─── GET /claims/my — заявки текущего пользователя ──────────────────────────
router.get("/my", requireAuth, async (req: AuthRequest, res) => {
  const claims = await db.select().from(claimsTable)
    .where(eq(claimsTable.claimantId, req.userId!))
    .orderBy(desc(claimsTable.createdAt));
  res.json(claims);
});

// ─── POST /claims — создать заявку ──────────────────────────────────────────
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const { bookingId, type, description, evidenceUrl, requestedAmount } = req.body;

  if (!bookingId || !type || !description) {
    res.status(400).json({ error: "validation_error", message: "bookingId, type, description обязательны" });
    return;
  }

  if (!["damage", "theft"].includes(type)) {
    res.status(400).json({ error: "invalid_type", message: "type must be damage or theft" });
    return;
  }

  // Проверяем, что бронирование принадлежит этому пользователю
  const [booking] = await db.select({ renterId: bookingsTable.renterId, ownerId: bookingsTable.ownerId, status: bookingsTable.status })
    .from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);

  if (!booking) {
    res.status(404).json({ error: "not_found", message: "Бронирование не найдено" });
    return;
  }

  const userId = req.userId!;
  if (booking.renterId !== userId && booking.ownerId !== userId) {
    res.status(403).json({ error: "forbidden", message: "Вы не участник этого бронирования" });
    return;
  }

  // Заявку можно подать только для active/return_pending/completed бронирований
  if (!["active", "return_pending", "completed"].includes(booking.status)) {
    res.status(400).json({ error: "invalid_status", message: "Заявку можно подать только для активных или завершённых бронирований" });
    return;
  }

  const [claim] = await db.insert(claimsTable).values({
    bookingId: parseInt(bookingId, 10),
    claimantId: userId,
    type,
    description,
    evidenceUrl: evidenceUrl ?? null,
    requestedAmount: requestedAmount ? requestedAmount.toString() : null,
    status: "pending",
  }).returning();

  res.status(201).json(claim);
});

// ─── PATCH /claims/:id — обновить заявку (admin: approve/reject; user: добавить доказательство) ──
router.patch("/:id", requireAuth, async (req: AuthRequest, res) => {
  const claimId = parseInt(req.params.id as string, 10);
  const [actor] = await db.select({ role: usersTable.role })
    .from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);

  const [existing] = await db.select().from(claimsTable).where(eq(claimsTable.id, claimId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  if (actor?.role === "admin") {
    // Admin может: изменить статус, добавить adminNote, одобренную сумму
    const { status, adminNote, approvedAmount } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (adminNote !== undefined) updates.adminNote = adminNote;
    if (approvedAmount !== undefined) updates.approvedAmount = approvedAmount?.toString() ?? null;
    if (status === "approved" || status === "paid" || status === "rejected") {
      updates.resolvedAt = new Date();
    }

    const [updated] = await db.update(claimsTable).set(updates)
      .where(eq(claimsTable.id, claimId)).returning();
    res.json(updated);
  } else if (existing.claimantId === req.userId!) {
    // Пользователь может только добавить/обновить доказательство пока статус pending
    if (existing.status !== "pending") {
      res.status(400).json({ error: "not_editable", message: "Заявка уже передана в обработку" });
      return;
    }
    const { evidenceUrl, description } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (evidenceUrl !== undefined) updates.evidenceUrl = evidenceUrl;
    if (description !== undefined) updates.description = description;

    const [updated] = await db.update(claimsTable).set(updates)
      .where(eq(claimsTable.id, claimId)).returning();
    res.json(updated);
  } else {
    res.status(403).json({ error: "forbidden" });
  }
});

export default router;
