/**
 * Admin routes — portal managers only (role = 'admin').
 * Expanded: user/listing edit, booking override, notifications, reports, audit log.
 */
import { Router } from "express";
import {
  db, bookingsTable, bookingEventsTable, listingsTable, usersTable,
  notificationsTable, supportTicketsTable, supportMessagesTable,
  reviewsTable,
} from "@workspace/db";
import { eq, desc, ilike, or, sql, and, lt, gte } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

const router = Router();

function requireAdmin(req: AuthRequest, res: any, next: any) {
  if (!req.userRole || req.userRole !== "admin") {
    res.status(403).json({ error: "forbidden", message: "Только для менеджеров портала" });
    return;
  }
  next();
}

// Helper: write audit log
async function audit(adminId: number, entityType: string, entityId: number | null, action: string, detail?: string) {
  await db.execute(sql`
    INSERT INTO admin_audit_log (admin_id, entity_type, entity_id, action, detail)
    VALUES (${adminId}, ${entityType}, ${entityId}, ${action}, ${detail ?? null})
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// STATS + ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────

router.get("/stats", requireAuth, requireAdmin, async (_req, res) => {
  const [bStats] = await db.select({
    totalBookings: sql<number>`COUNT(*)`,
    pending: sql<number>`COUNT(*) FILTER (WHERE status = 'pending')`,
    active: sql<number>`COUNT(*) FILTER (WHERE status = 'active')`,
    completed: sql<number>`COUNT(*) FILTER (WHERE status = 'completed')`,
    return_pending: sql<number>`COUNT(*) FILTER (WHERE status = 'return_pending')`,
    cancelled: sql<number>`COUNT(*) FILTER (WHERE status IN ('cancelled','rejected'))`,
  }).from(bookingsTable);

  const [uStats] = await db.select({
    totalUsers: sql<number>`COUNT(*)`,
    banned: sql<number>`COUNT(*) FILTER (WHERE is_banned = true)`,
    admins: sql<number>`COUNT(*) FILTER (WHERE role = 'admin')`,
    owners: sql<number>`COUNT(*) FILTER (WHERE role = 'owner')`,
    newThisWeek: sql<number>`COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')`,
  }).from(usersTable);

  const [lStats] = await db.select({
    totalListings: sql<number>`COUNT(*)`,
    active: sql<number>`COUNT(*) FILTER (WHERE is_available = true)`,
    hidden: sql<number>`COUNT(*) FILTER (WHERE is_available = false)`,
    newThisWeek: sql<number>`COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')`,
  }).from(listingsTable);

  const [tStats] = await db.select({
    totalTickets: sql<number>`COUNT(*)`,
    open: sql<number>`COUNT(*) FILTER (WHERE status = 'open')`,
    in_progress: sql<number>`COUNT(*) FILTER (WHERE status = 'in_progress')`,
    resolved: sql<number>`COUNT(*) FILTER (WHERE status IN ('resolved','closed'))`,
  }).from(supportTicketsTable);

  const [rStats] = await db.execute(sql`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status = 'pending') AS pending,
           COUNT(*) FILTER (WHERE status = 'resolved') AS resolved
    FROM reports
  `).then(r => r.rows as any[]);

  const [revenue] = await db.select({
    total: sql<number>`COALESCE(SUM(total_price), 0)`,
    completed: sql<number>`COALESCE(SUM(total_price) FILTER (WHERE status = 'completed'), 0)`,
  }).from(bookingsTable).where(sql`status IN ('completed','active')`);

  res.json({
    bookings: bStats, users: uStats, listings: lStats,
    tickets: tStats, reports: rStats,
    revenue: { total: Number(revenue.total), completed: Number(revenue.completed) },
  });
});

router.get("/analytics", requireAuth, requireAdmin, async (_req, res) => {
  // Last 30 days — bookings created per day
  const bookingsByDay = await db.execute(sql`
    SELECT DATE(created_at) AS day, COUNT(*) AS count,
           COALESCE(SUM(total_price), 0) AS revenue
    FROM bookings
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY day ORDER BY day
  `).then(r => r.rows as any[]);

  // Registrations per day
  const usersByDay = await db.execute(sql`
    SELECT DATE(created_at) AS day, COUNT(*) AS count
    FROM users
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY day ORDER BY day
  `).then(r => r.rows as any[]);

  // Top listings by booking count
  const topListings = await db.execute(sql`
    SELECT l.id, l.title, COUNT(b.id) AS bookings,
           COALESCE(SUM(b.total_price), 0) AS revenue
    FROM listings l
    LEFT JOIN bookings b ON b.listing_id = l.id
    GROUP BY l.id, l.title
    ORDER BY bookings DESC LIMIT 10
  `).then(r => r.rows as any[]);

  // Top owners by revenue
  const topOwners = await db.execute(sql`
    SELECT u.id, u.name, u.email, COUNT(b.id) AS bookings,
           COALESCE(SUM(b.total_price), 0) AS revenue
    FROM users u
    LEFT JOIN bookings b ON b.owner_id = u.id AND b.status IN ('completed','active')
    GROUP BY u.id, u.name, u.email
    ORDER BY revenue DESC LIMIT 10
  `).then(r => r.rows as any[]);

  // Bookings by status (pie)
  const byStatus = await db.execute(sql`
    SELECT status, COUNT(*) AS count FROM bookings GROUP BY status
  `).then(r => r.rows as any[]);

  // Category breakdown
  const byCategory = await db.execute(sql`
    SELECT c.name, COUNT(l.id) AS listings, COUNT(b.id) AS bookings
    FROM categories c
    LEFT JOIN listings l ON l.category_id = c.id
    LEFT JOIN bookings b ON b.listing_id = l.id
    GROUP BY c.name ORDER BY listings DESC
  `).then(r => r.rows as any[]);

  res.json({ bookingsByDay, usersByDay, topListings, topOwners, byStatus, byCategory });
});

// ─────────────────────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────────────────────

router.get("/users", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  const role = req.query.role as string | undefined;
  const banned = req.query.banned as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
  const offset = (page - 1) * limit;

  const conditions = [];
  if (q) conditions.push(or(ilike(usersTable.name, `%${q}%`), ilike(usersTable.email, `%${q}%`)));
  if (role) conditions.push(sql`${usersTable.role}::text = ${role}`);
  if (banned === "true") conditions.push(eq(usersTable.isBanned, true));
  if (banned === "false") conditions.push(eq(usersTable.isBanned, false));

  const users = await db.select({
    id: usersTable.id, name: usersTable.name, email: usersTable.email,
    role: usersTable.role, phone: usersTable.phone, avatar: usersTable.avatar,
    bio: usersTable.bio, telegram: usersTable.telegram,
    isBanned: usersTable.isBanned, banReason: usersTable.banReason,
    createdAt: usersTable.createdAt, regionId: usersTable.regionId,
    listingCount: sql<number>`(SELECT COUNT(*) FROM listings WHERE owner_id = ${usersTable.id})`,
    bookingCount: sql<number>`(SELECT COUNT(*) FROM bookings WHERE renter_id = ${usersTable.id})`,
    reviewCount: sql<number>`(SELECT COUNT(*) FROM reviews WHERE reviewee_id = ${usersTable.id})`,
    avgRating: sql<number>`(SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE reviewee_id = ${usersTable.id})`,
  })
    .from(usersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(usersTable.createdAt))
    .limit(limit).offset(offset);

  const [{ count }] = await db.select({ count: sql<number>`COUNT(*)` })
    .from(usersTable).where(conditions.length > 0 ? and(...conditions) : undefined);

  res.json({
    users: users.map(u => ({ ...u, createdAt: u.createdAt.toISOString() })),
    pagination: { page, limit, total: Number(count), pages: Math.ceil(Number(count) / limit) },
  });
});

// GET single user with full details
router.get("/users/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) { res.status(404).json({ error: "not_found" }); return; }

  const listings = await db.execute(sql`
    SELECT id, title, price_per_day, is_available, created_at,
           (SELECT COUNT(*) FROM bookings WHERE listing_id = listings.id) AS booking_count
    FROM listings WHERE owner_id = ${id} ORDER BY created_at DESC LIMIT 20
  `).then(r => r.rows as any[]);

  const bookings = await db.execute(sql`
    SELECT b.id, b.booking_number, b.start_date, b.end_date, b.total_price, b.status,
           l.title AS listing_title, l.id AS listing_id
    FROM bookings b LEFT JOIN listings l ON l.id = b.listing_id
    WHERE b.renter_id = ${id} ORDER BY b.created_at DESC LIMIT 20
  `).then(r => r.rows as any[]);

  const reviews = await db.execute(sql`
    SELECT r.rating, r.text, r.created_at, u.name AS author_name
    FROM reviews r LEFT JOIN users u ON u.id = r.author_id
    WHERE r.reviewee_id = ${id} ORDER BY r.created_at DESC LIMIT 20
  `).then(r => r.rows as any[]);

  const stats = await db.execute(sql`
    SELECT
      ROUND(AVG(r.rating)::numeric, 1) AS avg_rating,
      COUNT(DISTINCT r.id) AS review_count,
      COUNT(DISTINCT l.id) AS listing_count,
      COUNT(DISTINCT b.id) AS booking_count,
      COALESCE(SUM(bo.total_price) FILTER (WHERE bo.status = 'completed'), 0) AS revenue_earned
    FROM users u
    LEFT JOIN reviews r ON r.reviewee_id = u.id
    LEFT JOIN listings l ON l.owner_id = u.id
    LEFT JOIN bookings b ON b.renter_id = u.id
    LEFT JOIN bookings bo ON bo.owner_id = u.id
    WHERE u.id = ${id}
  `).then(r => r.rows[0] as any);

  res.json({
    user: { ...user, createdAt: user.createdAt.toISOString() },
    listings, bookings, reviews, stats,
  });
});

// Update user (role, name, email, phone, bio, ban status, etc.)
router.patch("/users/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { role, isBanned, banReason, name, email, phone, bio, telegram } = req.body;

  if (id === req.userId) {
    res.status(400).json({ error: "bad_request", message: "Нельзя изменить собственный аккаунт через эту форму" });
    return;
  }

  const updates: Record<string, any> = {};
  if (role !== undefined) updates.role = role;
  if (isBanned !== undefined) updates.isBanned = isBanned;
  if (banReason !== undefined) updates.banReason = banReason || null;
  if (name !== undefined) updates.name = name.trim();
  if (email !== undefined) updates.email = email.trim();
  if (phone !== undefined) updates.phone = phone.trim() || null;
  if (bio !== undefined) updates.bio = bio.trim() || null;
  if (telegram !== undefined) updates.telegram = telegram.trim() || null;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "bad_request", message: "Нечего обновлять" });
    return;
  }

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "not_found" }); return; }

  const changedFields = Object.keys(updates).join(", ");
  await audit(req.userId!, "user", id, isBanned === true ? "ban_user" : isBanned === false ? "unban_user" : "edit_user",
    `Changed: ${changedFields}${banReason ? `. Reason: ${banReason}` : ""}`);

  res.json({ id: updated.id, role: updated.role, isBanned: updated.isBanned, name: updated.name, email: updated.email });
});

// Send notification to a user
router.post("/users/:id/notify", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { title, body, link } = req.body;
  if (!title?.trim() || !body?.trim()) {
    res.status(400).json({ error: "bad_request", message: "Тема и текст обязательны" });
    return;
  }

  await db.insert(notificationsTable).values({
    userId: id, type: "system", title: title.trim(), body: body.trim(), link: link ?? null,
  });

  await audit(req.userId!, "user", id, "send_notification", `"${title}"`);
  res.json({ ok: true });
});

// Broadcast notification to all users
router.post("/broadcast", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const { title, body, link, roles } = req.body;
  if (!title?.trim() || !body?.trim()) {
    res.status(400).json({ error: "bad_request", message: "Тема и текст обязательны" });
    return;
  }

  const conditions = [];
  if (roles && Array.isArray(roles) && roles.length > 0) {
    conditions.push(sql`${usersTable.role}::text = ANY(ARRAY[${sql.join(roles.map((r: string) => sql`${r}`), sql`,`)}])`);
  }
  conditions.push(eq(usersTable.isBanned, false));

  const users = await db.select({ id: usersTable.id }).from(usersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  if (users.length > 0) {
    const rows = users.map(u => ({
      userId: u.id, type: "system" as const, title: title.trim(), body: body.trim(), link: link ?? null,
    }));
    for (let i = 0; i < rows.length; i += 50) {
      await db.insert(notificationsTable).values(rows.slice(i, i + 50));
    }
  }

  await audit(req.userId!, "system", null, "broadcast_notification",
    `"${title}" → ${users.length} users${roles?.length ? ` (roles: ${roles.join(",")})` : ""}`);
  res.json({ ok: true, sent: users.length });
});

// ─────────────────────────────────────────────────────────────────────────────
// LISTINGS
// ─────────────────────────────────────────────────────────────────────────────

router.get("/listings", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  const available = req.query.available as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
  const offset = (page - 1) * limit;

  const conditions = [];
  if (q) conditions.push(ilike(listingsTable.title, `%${q}%`));
  if (available === "true") conditions.push(eq(listingsTable.isAvailable, true));
  if (available === "false") conditions.push(eq(listingsTable.isAvailable, false));

  const rows = await db.select({
    id: listingsTable.id, title: listingsTable.title,
    photos: listingsTable.photos, pricePerDay: listingsTable.pricePerDay,
    isActive: listingsTable.isAvailable, createdAt: listingsTable.createdAt,
    ownerName: sql<string>`u.name`, ownerEmail: sql<string>`u.email`, ownerId: listingsTable.ownerId,
    regionId: listingsTable.regionId, categoryId: listingsTable.categoryId,
    city: listingsTable.city,
    bookingCount: sql<number>`(SELECT COUNT(*) FROM bookings WHERE listing_id = ${listingsTable.id})`,
    activeBookings: sql<number>`(SELECT COUNT(*) FROM bookings WHERE listing_id = ${listingsTable.id} AND status IN ('pending','confirmed','active','return_pending'))`,
  })
    .from(listingsTable)
    .leftJoin(sql`${usersTable} AS u`, sql`u.id = ${listingsTable.ownerId}`)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(listingsTable.createdAt))
    .limit(limit).offset(offset);

  const [{ count }] = await db.select({ count: sql<number>`COUNT(*)` })
    .from(listingsTable).where(conditions.length > 0 ? and(...conditions) : undefined);

  res.json({
    listings: rows.map(r => ({ ...r, pricePerDay: parseFloat(r.pricePerDay as unknown as string), createdAt: r.createdAt.toISOString() })),
    pagination: { page, limit, total: Number(count), pages: Math.ceil(Number(count) / limit) },
  });
});

// GET full listing detail
router.get("/listings/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);

  const listing = await db.execute(sql`
    SELECT l.*, u.name AS owner_name, u.email AS owner_email, u.phone AS owner_phone,
           c.name AS category_name, r.name AS region_name
    FROM listings l
    LEFT JOIN users u ON u.id = l.owner_id
    LEFT JOIN categories c ON c.id = l.category_id
    LEFT JOIN regions r ON r.id = l.region_id
    WHERE l.id = ${id}
  `).then(r => r.rows[0] as any);

  if (!listing) { res.status(404).json({ error: "not_found" }); return; }

  const bookings = await db.execute(sql`
    SELECT b.id, b.booking_number, b.start_date, b.end_date, b.total_price, b.status, b.created_at,
           u.name AS renter_name, u.email AS renter_email
    FROM bookings b LEFT JOIN users u ON u.id = b.renter_id
    WHERE b.listing_id = ${id} ORDER BY b.created_at DESC LIMIT 20
  `).then(r => r.rows as any[]);

  const reviews = await db.execute(sql`
    SELECT r.rating, r.text, r.created_at, u.name AS author_name
    FROM reviews r LEFT JOIN users u ON u.id = r.author_id
    WHERE r.listing_id = ${id} ORDER BY r.created_at DESC LIMIT 20
  `).then(r => r.rows as any[]);

  res.json({ listing, bookings, reviews });
});

// Update listing (title, description, price, deposit, isAvailable, ownerId, etc.)
router.patch("/listings/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { title, description, pricePerDay, deposit, isActive, categoryId, regionId, city, meetingAddress } = req.body;

  const updates: Record<string, any> = {};
  if (title !== undefined) updates.title = title.trim();
  if (description !== undefined) updates.description = description.trim() || null;
  if (pricePerDay !== undefined) updates.pricePerDay = String(pricePerDay);
  if (deposit !== undefined) updates.deposit = deposit ? String(deposit) : null;
  if (isActive !== undefined) updates.isAvailable = isActive;
  if (categoryId !== undefined) updates.categoryId = categoryId;
  if (regionId !== undefined) updates.regionId = regionId;
  if (city !== undefined) updates.city = city.trim() || null;
  if (meetingAddress !== undefined) updates.meetingAddress = meetingAddress.trim() || null;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "bad_request" }); return;
  }

  const [updated] = await db.update(listingsTable).set(updates).where(eq(listingsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "not_found" }); return; }

  await audit(req.userId!, "listing", id, "edit_listing",
    `Changed: ${Object.keys(updates).join(", ")}`);

  res.json({ id: updated.id, isAvailable: updated.isAvailable, title: updated.title });
});

// Delete listing (admin only)
router.delete("/listings/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);

  const [listing] = await db.select({ title: listingsTable.title }).from(listingsTable)
    .where(eq(listingsTable.id, id)).limit(1);
  if (!listing) { res.status(404).json({ error: "not_found" }); return; }

  await db.delete(listingsTable).where(eq(listingsTable.id, id));
  await audit(req.userId!, "listing", id, "delete_listing", `"${listing.title}"`);
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// BOOKINGS
// ─────────────────────────────────────────────────────────────────────────────

router.get("/bookings", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  const status = req.query.status as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
  const offset = (page - 1) * limit;

  const conditions = [];
  if (q) conditions.push(or(ilike(bookingsTable.bookingNumber, `%${q}%`), sql`${bookingsTable.id}::text ILIKE ${`%${q}%`}`));
  if (status) conditions.push(sql`${bookingsTable.status}::text = ${status}`);

  const rows = await db.select({
    booking: bookingsTable,
    listingTitle: listingsTable.title,
    renterName: sql<string>`renter.name`, renterEmail: sql<string>`renter.email`,
    ownerName: sql<string>`owner.name`, ownerEmail: sql<string>`owner.email`,
  })
    .from(bookingsTable)
    .leftJoin(listingsTable, eq(bookingsTable.listingId, listingsTable.id))
    .leftJoin(sql`${usersTable} AS renter`, sql`renter.id = ${bookingsTable.renterId}`)
    .leftJoin(sql`${usersTable} AS owner`, sql`owner.id = ${bookingsTable.ownerId}`)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(bookingsTable.createdAt))
    .limit(limit).offset(offset);

  const [{ count }] = await db.select({ count: sql<number>`COUNT(*)` })
    .from(bookingsTable).where(conditions.length > 0 ? and(...conditions) : undefined);

  res.json({
    bookings: rows.map(r => ({
      id: r.booking.id, bookingNumber: r.booking.bookingNumber,
      listingId: r.booking.listingId, listingTitle: r.listingTitle,
      renterId: r.booking.renterId, renterName: r.renterName, renterEmail: r.renterEmail,
      ownerId: r.booking.ownerId, ownerName: r.ownerName, ownerEmail: r.ownerEmail,
      startDate: r.booking.startDate, endDate: r.booking.endDate, totalDays: r.booking.totalDays,
      totalPrice: parseFloat(r.booking.totalPrice as unknown as string),
      status: r.booking.status, message: r.booking.message, createdAt: r.booking.createdAt.toISOString(),
    })),
    pagination: { page, limit, total: Number(count), pages: Math.ceil(Number(count) / limit) },
  });
});

router.get("/bookings/:number", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const { number } = req.params;
  const [row] = await db.select({
    booking: bookingsTable, listingTitle: listingsTable.title,
    listingPhotos: listingsTable.photos, listingPricePerDay: listingsTable.pricePerDay,
    renterName: sql<string>`renter.name`, renterEmail: sql<string>`renter.email`, renterPhone: sql<string>`renter.phone`,
    ownerName: sql<string>`owner.name`, ownerEmail: sql<string>`owner.email`, ownerPhone: sql<string>`owner.phone`,
  })
    .from(bookingsTable)
    .leftJoin(listingsTable, eq(bookingsTable.listingId, listingsTable.id))
    .leftJoin(sql`${usersTable} AS renter`, sql`renter.id = ${bookingsTable.renterId}`)
    .leftJoin(sql`${usersTable} AS owner`, sql`owner.id = ${bookingsTable.ownerId}`)
    .where(or(eq(bookingsTable.bookingNumber, number), sql`${bookingsTable.id}::text = ${number}`))
    .limit(1);

  if (!row) { res.status(404).json({ error: "not_found" }); return; }

  const events = await db.select({
    event: bookingEventsTable, actorName: sql<string>`actor.name`, actorEmail: sql<string>`actor.email`,
  })
    .from(bookingEventsTable)
    .leftJoin(sql`${usersTable} AS actor`, sql`actor.id = ${bookingEventsTable.actorId}`)
    .where(eq(bookingEventsTable.bookingId, row.booking.id))
    .orderBy(bookingEventsTable.createdAt);

  res.json({
    booking: {
      id: row.booking.id, bookingNumber: row.booking.bookingNumber,
      listingId: row.booking.listingId, listingTitle: row.listingTitle,
      listingPhoto: row.listingPhotos?.[0], pricePerDay: parseFloat(row.listingPricePerDay as unknown as string),
      renterId: row.booking.renterId, renterName: row.renterName, renterEmail: row.renterEmail, renterPhone: row.renterPhone,
      ownerId: row.booking.ownerId, ownerName: row.ownerName, ownerEmail: row.ownerEmail, ownerPhone: row.ownerPhone,
      startDate: row.booking.startDate, endDate: row.booking.endDate, totalDays: row.booking.totalDays,
      totalPrice: parseFloat(row.booking.totalPrice as unknown as string),
      status: row.booking.status, message: row.booking.message, createdAt: row.booking.createdAt.toISOString(),
    },
    auditTrail: events.map(e => ({
      id: e.event.id, actorId: e.event.actorId, actorName: e.actorName ?? "система", actorEmail: e.actorEmail ?? null,
      actorRole: e.event.actorRole, eventType: e.event.eventType,
      fromStatus: e.event.fromStatus, toStatus: e.event.toStatus,
      comment: e.event.comment, createdAt: e.event.createdAt.toISOString(),
    })),
  });
});

// Admin: force-override booking status
router.post("/bookings/:id/override", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { newStatus, comment } = req.body;

  const VALID_STATUSES = ["pending", "confirmed", "active", "return_pending", "completed", "cancelled", "rejected"];
  if (!VALID_STATUSES.includes(newStatus)) {
    res.status(400).json({ error: "bad_request", message: "Неверный статус" }); return;
  }

  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);
  if (!booking) { res.status(404).json({ error: "not_found" }); return; }

  const prevStatus = booking.status;
  await db.update(bookingsTable).set({ status: newStatus as any }).where(eq(bookingsTable.id, id));

  await db.insert(bookingEventsTable).values({
    bookingId: id, bookingNumber: booking.bookingNumber ?? String(id),
    actorId: req.userId!, actorRole: "admin", eventType: "admin_override",
    fromStatus: prevStatus, toStatus: newStatus as any,
    comment: comment?.trim() || `Статус изменён администратором: ${prevStatus} → ${newStatus}`,
  });

  // Notify both parties
  const notifBase = { type: "system" as const, title: `Статус бронирования изменён`, body: `${booking.bookingNumber}: ${prevStatus} → ${newStatus}${comment ? `. ${comment}` : ""}` };
  await db.insert(notificationsTable).values([
    { ...notifBase, userId: booking.renterId },
    { ...notifBase, userId: booking.ownerId },
  ]);

  await audit(req.userId!, "booking", id, "override_booking",
    `${booking.bookingNumber}: ${prevStatus} → ${newStatus}${comment ? `. ${comment}` : ""}`);

  res.json({ ok: true, prevStatus, newStatus });
});

// Add manager note to booking
router.post("/bookings/:number/comment", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const { number } = req.params;
  const { comment } = req.body;
  if (!comment?.trim()) { res.status(400).json({ error: "bad_request" }); return; }

  const [booking] = await db.select({ id: bookingsTable.id, bookingNumber: bookingsTable.bookingNumber })
    .from(bookingsTable).where(eq(bookingsTable.bookingNumber, number)).limit(1);
  if (!booking) { res.status(404).json({ error: "not_found" }); return; }

  await db.insert(bookingEventsTable).values({
    bookingId: booking.id, bookingNumber: booking.bookingNumber ?? number,
    actorId: req.userId!, actorRole: "admin", eventType: "manager_note", comment: comment.trim(),
  });
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUPPORT TICKETS (admin)
// ─────────────────────────────────────────────────────────────────────────────

router.get("/tickets", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const status = req.query.status as string | undefined;
  const q = (req.query.q as string | undefined)?.trim();
  const priority = req.query.priority as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
  const offset = (page - 1) * limit;

  const conditions = [];
  if (status) conditions.push(sql`${supportTicketsTable.status}::text = ${status}`);
  if (priority) conditions.push(sql`${supportTicketsTable.priority}::text = ${priority}`);
  if (q) conditions.push(ilike(supportTicketsTable.subject, `%${q}%`));

  const tickets = await db.select({
    id: supportTicketsTable.id, ticketNumber: supportTicketsTable.ticketNumber,
    subject: supportTicketsTable.subject, category: supportTicketsTable.category,
    status: supportTicketsTable.status, priority: supportTicketsTable.priority,
    userId: supportTicketsTable.userId,
    userName: sql<string>`u.name`, userEmail: sql<string>`u.email`,
    assignedToId: supportTicketsTable.assignedToId,
    createdAt: supportTicketsTable.createdAt, updatedAt: supportTicketsTable.updatedAt,
    messageCount: sql<number>`(SELECT COUNT(*) FROM support_messages WHERE ticket_id = ${supportTicketsTable.id})`,
  })
    .from(supportTicketsTable)
    .leftJoin(sql`${usersTable} AS u`, sql`u.id = ${supportTicketsTable.userId}`)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(supportTicketsTable.updatedAt))
    .limit(limit).offset(offset);

  const [{ count }] = await db.select({ count: sql<number>`COUNT(*)` })
    .from(supportTicketsTable).where(conditions.length > 0 ? and(...conditions) : undefined);

  res.json({
    tickets: tickets.map(t => ({ ...t, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString() })),
    pagination: { page, limit, total: Number(count), pages: Math.ceil(Number(count) / limit) },
  });
});

router.get("/tickets/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const [ticket] = await db.select({
    ticket: supportTicketsTable, userName: sql<string>`u.name`,
    userEmail: sql<string>`u.email`, userAvatar: sql<string>`u.avatar`,
  })
    .from(supportTicketsTable)
    .leftJoin(sql`${usersTable} AS u`, sql`u.id = ${supportTicketsTable.userId}`)
    .where(eq(supportTicketsTable.id, id)).limit(1);

  if (!ticket) { res.status(404).json({ error: "not_found" }); return; }

  const messages = await db.select({
    id: supportMessagesTable.id, body: supportMessagesTable.body,
    isAdmin: supportMessagesTable.isAdmin, authorId: supportMessagesTable.authorId,
    authorName: usersTable.name, authorAvatar: usersTable.avatar,
    createdAt: supportMessagesTable.createdAt,
  })
    .from(supportMessagesTable)
    .leftJoin(usersTable, eq(supportMessagesTable.authorId, usersTable.id))
    .where(eq(supportMessagesTable.ticketId, id))
    .orderBy(supportMessagesTable.createdAt);

  res.json({
    ticket: {
      ...ticket.ticket, userName: ticket.userName, userEmail: ticket.userEmail, userAvatar: ticket.userAvatar,
      createdAt: ticket.ticket.createdAt.toISOString(), updatedAt: ticket.ticket.updatedAt.toISOString(),
    },
    messages: messages.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })),
  });
});

router.patch("/tickets/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { status, priority, assignedToId } = req.body;
  const updates: Record<string, any> = { updatedAt: new Date() };
  if (status) updates.status = status;
  if (priority) updates.priority = priority;
  if (assignedToId !== undefined) updates.assignedToId = assignedToId;
  if (status === "resolved" || status === "closed") updates.closedAt = new Date();
  const [updated] = await db.update(supportTicketsTable).set(updates).where(eq(supportTicketsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "not_found" }); return; }
  res.json(updated);
});

router.post("/tickets/:id/reply", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { body, status } = req.body;
  if (!body?.trim()) { res.status(400).json({ error: "bad_request" }); return; }

  const [ticket] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id)).limit(1);
  if (!ticket) { res.status(404).json({ error: "not_found" }); return; }

  const [msg] = await db.insert(supportMessagesTable).values({
    ticketId: id, authorId: req.userId!, body: body.trim(), isAdmin: true,
  }).returning();

  const newStatus = status ?? "in_progress";
  const updates: Record<string, any> = { updatedAt: new Date(), status: newStatus };
  if (newStatus === "resolved" || newStatus === "closed") updates.closedAt = new Date();
  await db.update(supportTicketsTable).set(updates).where(eq(supportTicketsTable.id, id));

  await db.insert(notificationsTable).values({
    userId: ticket.userId, type: "system",
    title: `Ответ по тикету ${ticket.ticketNumber}`,
    body: body.trim().slice(0, 120),
    link: `/dashboard?tab=support&ticket=${id}`,
  });

  res.status(201).json({ ...msg, createdAt: msg.createdAt.toISOString() });
});

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────────────────────────────────────────

router.get("/reports", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const status = (req.query.status as string) || "pending";
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
  const offset = (page - 1) * limit;

  const rows = await db.execute(sql`
    SELECT r.*,
           rep.name AS reporter_name, rep.email AS reporter_email,
           rl.title AS reported_listing_title,
           ru.name AS reported_user_name, ru.email AS reported_user_email,
           adm.name AS resolved_by_admin_name
    FROM reports r
    LEFT JOIN users rep ON rep.id = r.reporter_user_id
    LEFT JOIN listings rl ON rl.id = r.reported_listing_id
    LEFT JOIN users ru ON ru.id = r.reported_user_id
    LEFT JOIN users adm ON adm.id = r.resolved_by_admin_id
    WHERE r.status = ${status}
    ORDER BY r.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `).then(r => r.rows as any[]);

  const [{ count }] = await db.execute(sql`SELECT COUNT(*) FROM reports WHERE status = ${status}`)
    .then(r => r.rows as any[]);

  res.json({
    reports: rows,
    pagination: { page, limit, total: Number(count.count), pages: Math.ceil(Number(count.count) / limit) },
  });
});

router.patch("/reports/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { status, resolvedNote } = req.body;
  if (!["resolved", "dismissed"].includes(status)) {
    res.status(400).json({ error: "bad_request" }); return;
  }

  await db.execute(sql`
    UPDATE reports SET status = ${status}, resolved_by_admin_id = ${req.userId},
    resolved_note = ${resolvedNote ?? null}, resolved_at = NOW()
    WHERE id = ${id}
  `);

  await audit(req.userId!, "report", id, `${status}_report`, resolvedNote ?? "");
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────────────────────────────────────────

router.get("/audit-log", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 30);
  const offset = (page - 1) * limit;

  const rows = await db.execute(sql`
    SELECT al.*, u.name AS admin_name, u.email AS admin_email
    FROM admin_audit_log al
    LEFT JOIN users u ON u.id = al.admin_id
    ORDER BY al.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `).then(r => r.rows as any[]);

  const [{ count }] = await db.execute(sql`SELECT COUNT(*) FROM admin_audit_log`)
    .then(r => r.rows as any[]);

  res.json({
    entries: rows,
    pagination: { page, limit, total: Number(count.count), pages: Math.ceil(Number(count.count) / limit) },
  });
});

export default router;
