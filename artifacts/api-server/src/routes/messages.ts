import { Router } from "express";
import { db, bookingMessagesTable, bookingsTable } from "@workspace/db";
import { ne, and, inArray, eq, sql } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

const router = Router();

// ── GET /api/messages/unread-counts ──────────────────────────────────────
// Returns { [bookingId]: unreadCount } for all bookings of the current user
router.get("/unread-counts", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;

  const userBookings = await db
    .select({ id: bookingsTable.id })
    .from(bookingsTable)
    .where(sql`(${bookingsTable.ownerId} = ${userId} OR ${bookingsTable.renterId} = ${userId})`);

  if (userBookings.length === 0) {
    res.json({});
    return;
  }

  const bookingIds = userBookings.map((b) => b.id);

  const unreadRows = await db
    .select({
      bookingId: bookingMessagesTable.bookingId,
      count: sql<number>`count(*)::int`,
    })
    .from(bookingMessagesTable)
    .where(
      and(
        inArray(bookingMessagesTable.bookingId, bookingIds),
        ne(bookingMessagesTable.senderId, userId),
        eq(bookingMessagesTable.isRead, false),
      ),
    )
    .groupBy(bookingMessagesTable.bookingId);

  const counts: Record<number, number> = {};
  for (const row of unreadRows) {
    counts[row.bookingId] = row.count;
  }

  res.json(counts);
});

export default router;
