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
  const { subject, body } = req.body;
  // Stage 19g — добавлена категория verification_request для заявок на бейдж «Проверенный владелец».
  const VALID_CATEGORIES = ["general", "dispute", "technical", "billing", "verification_request"] as const;
  const rawCategory = req.body.category;
  const category = VALID_CATEGORIES.includes(rawCategory) ? rawCategory : "general";
  if (!subject?.trim() || !body?.trim()) {
    res.status(400).json({ error: "bad_request", message: "Тема и сообщение обязательны" });
    return;
  }

  // Stage 19g — анти-спам для verification_request: не позволяем создать второй тикет,
  // если у пользователя уже есть открытая заявка на верификацию.
  if (category === "verification_request") {
    const [existing] = await db.select({ id: supportTicketsTable.id })
      .from(supportTicketsTable)
      .where(and(
        eq(supportTicketsTable.userId, req.userId!),
        eq(supportTicketsTable.category, "verification_request"),
        sql`${supportTicketsTable.status} IN ('open', 'in_progress')`,
      ))
      .limit(1);
    if (existing) {
      res.status(409).json({
        error: "verification_request_pending",
        message: "Ваша заявка на верификацию уже на рассмотрении. Дождитесь ответа администратора.",
        ticketId: existing.id,
      });
      return;
    }
  }

  // Stage 19g — двойная защита от race condition: помимо SELECT-проверки выше
  // у `support_tickets` есть partial unique index `support_tickets_verification_singleton_idx`
  // на (user_id) WHERE category='verification_request' AND status IN ('open','in_progress').
  // Параллельные запросы пройдут SELECT, но второй INSERT упадёт на 23505 → возвращаем 409.
  let ticket;
  try {
    [ticket] = await db.insert(supportTicketsTable).values({
      userId: req.userId!,
      subject: subject.trim(),
      category: category ?? "general",
      status: "open",
    }).returning();
  } catch (e: any) {
    // drizzle 0.45 оборачивает pg-error в DrizzleQueryError → реальный код в e.cause.code
    const code = e?.cause?.code ?? e?.code;
    if (category === "verification_request" && code === "23505") {
      const [existing] = await db.select({ id: supportTicketsTable.id })
        .from(supportTicketsTable)
        .where(and(
          eq(supportTicketsTable.userId, req.userId!),
          eq(supportTicketsTable.category, "verification_request"),
          sql`${supportTicketsTable.status} IN ('open', 'in_progress')`,
        ))
        .limit(1);
      res.status(409).json({
        error: "verification_request_pending",
        message: "Ваша заявка на верификацию уже на рассмотрении. Дождитесь ответа администратора.",
        ticketId: existing?.id,
      });
      return;
    }
    throw e;
  }

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

// ─── PATCH /api/support/tickets/:id/cancel — отозвать СВОЮ заявку ────────────
// Stage 20a — пользователь может закрыть свой собственный тикет (например,
// заявку на верификацию владельца), пока он не обработан админом.
// Закрывает только tickets со status IN ('open','in_progress') и принадлежащие пользователю.
router.patch("/tickets/:id/cancel", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string, 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "bad_request", message: "Некорректный id" });
    return;
  }

  // Stage 20a code-review fix: атомарный UPDATE с ownership + status guard в одном
  // SQL'е защищает от race с админом (например, mark-resolved параллельно с cancel).
  // Если UPDATE не вернул строку — определяем причину через отдельный SELECT.
  const [updated] = await db
    .update(supportTicketsTable)
    .set({ status: "closed", closedAt: new Date(), updatedAt: new Date() })
    .where(and(
      eq(supportTicketsTable.id, id),
      eq(supportTicketsTable.userId, req.userId!),
      sql`${supportTicketsTable.status} IN ('open', 'in_progress')`,
    ))
    .returning();

  if (!updated) {
    // Различаем 404 (нет тикета или не его) vs 400 (уже закрыт/обработан)
    const [ticket] = await db
      .select({ status: supportTicketsTable.status })
      .from(supportTicketsTable)
      .where(and(eq(supportTicketsTable.id, id), eq(supportTicketsTable.userId, req.userId!)))
      .limit(1);
    if (!ticket) {
      res.status(404).json({ error: "not_found", message: "Тикет не найден" });
      return;
    }
    res.status(400).json({
      error: "not_cancellable",
      message: "Тикет уже закрыт или обработан",
    });
    return;
  }

  // Системное сообщение в ленту тикета (видно админу при открытии)
  await db.insert(supportMessagesTable).values({
    ticketId: id,
    authorId: req.userId!,
    body: "[Заявка отозвана пользователем]",
    isAdmin: false,
  });

  res.json(updated);
});

export default router;
