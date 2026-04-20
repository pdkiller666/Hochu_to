/**
 * Support routes — accessible to all authenticated users.
 * Users can create tickets, view their own, and reply.
 */
import { Router } from "express";
import { db, supportTicketsTable, supportMessagesTable, usersTable, notificationsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

const router = Router();

function genTicketNumber(id: number): string {
  return `TKT-${new Date().getFullYear()}-${String(id).padStart(6, "0")}`;
}

// ─── POST /api/support/tickets — create ticket ────────────────────────────────
router.post("/tickets", requireAuth, async (req: AuthRequest, res) => {
  const { subject, category, body } = req.body;
  if (!subject?.trim() || !body?.trim()) {
    res.status(400).json({ error: "bad_request", message: "Тема и сообщение обязательны" });
    return;
  }

  const [ticket] = await db.insert(supportTicketsTable).values({
    userId: req.userId!,
    subject: subject.trim(),
    category: category ?? "general",
    status: "open",
  }).returning();

  const number = genTicketNumber(ticket.id);
  await db.update(supportTicketsTable)
    .set({ ticketNumber: number })
    .where(eq(supportTicketsTable.id, ticket.id));

  await db.insert(supportMessagesTable).values({
    ticketId: ticket.id,
    authorId: req.userId!,
    body: body.trim(),
    isAdmin: false,
  });

  res.status(201).json({ ...ticket, ticketNumber: number });
});

// ─── GET /api/support/tickets — my tickets ────────────────────────────────────
router.get("/tickets", requireAuth, async (req: AuthRequest, res) => {
  const tickets = await db
    .select({
      id: supportTicketsTable.id,
      ticketNumber: supportTicketsTable.ticketNumber,
      subject: supportTicketsTable.subject,
      category: supportTicketsTable.category,
      status: supportTicketsTable.status,
      priority: supportTicketsTable.priority,
      createdAt: supportTicketsTable.createdAt,
      updatedAt: supportTicketsTable.updatedAt,
      messageCount: sql<number>`(SELECT COUNT(*) FROM support_messages WHERE ticket_id = ${supportTicketsTable.id})`,
    })
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.userId, req.userId!))
    .orderBy(desc(supportTicketsTable.updatedAt));

  res.json(tickets);
});

// ─── GET /api/support/tickets/:id — ticket detail + messages ──────────────────
router.get("/tickets/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const [ticket] = await db
    .select()
    .from(supportTicketsTable)
    .where(and(eq(supportTicketsTable.id, id), eq(supportTicketsTable.userId, req.userId!)))
    .limit(1);

  if (!ticket) {
    res.status(404).json({ error: "not_found", message: "Тикет не найден" });
    return;
  }

  const messages = await db
    .select({
      id: supportMessagesTable.id,
      body: supportMessagesTable.body,
      isAdmin: supportMessagesTable.isAdmin,
      authorId: supportMessagesTable.authorId,
      authorName: usersTable.name,
      authorAvatar: usersTable.avatar,
      createdAt: supportMessagesTable.createdAt,
    })
    .from(supportMessagesTable)
    .leftJoin(usersTable, eq(supportMessagesTable.authorId, usersTable.id))
    .where(eq(supportMessagesTable.ticketId, id))
    .orderBy(supportMessagesTable.createdAt);

  res.json({ ticket, messages });
});

// ─── POST /api/support/tickets/:id/reply — reply to ticket ───────────────────
router.post("/tickets/:id/reply", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const { body } = req.body;
  if (!body?.trim()) {
    res.status(400).json({ error: "bad_request", message: "Сообщение не может быть пустым" });
    return;
  }

  const [ticket] = await db
    .select()
    .from(supportTicketsTable)
    .where(and(eq(supportTicketsTable.id, id), eq(supportTicketsTable.userId, req.userId!)))
    .limit(1);

  if (!ticket) {
    res.status(404).json({ error: "not_found", message: "Тикет не найден" });
    return;
  }

  if (ticket.status === "closed") {
    res.status(400).json({ error: "closed", message: "Тикет закрыт" });
    return;
  }

  const [msg] = await db.insert(supportMessagesTable).values({
    ticketId: id,
    authorId: req.userId!,
    body: body.trim(),
    isAdmin: false,
  }).returning();

  await db.update(supportTicketsTable)
    .set({ updatedAt: new Date(), status: "open" })
    .where(eq(supportTicketsTable.id, id));

  res.status(201).json(msg);
});

export default router;
