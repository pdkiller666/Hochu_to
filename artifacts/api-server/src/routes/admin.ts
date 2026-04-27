/**
 * Admin routes — portal managers only (role = 'admin').
 * Expanded: user/listing edit, booking override, notifications, reports, audit log.
 */
import { Router } from "express";
import {
  db, bookingsTable, bookingEventsTable, listingsTable, usersTable,
  notificationsTable, supportTicketsTable, supportMessagesTable,
  reviewsTable, regionsTable, categoriesTable,
} from "@workspace/db";
import { eq, desc, or, sql, and, lt, gte } from "drizzle-orm";
import { requireAuth, requireAdmin, AuthRequest } from "../middleware/auth.js";
import bcrypt from "bcryptjs";
import { getPlatformSettings, updatePlatformSettings } from "../lib/platform-settings.js";
import { seedTestListings } from "../lib/seed-test-listings.js";
import { calculateAndUpdateTrustScore } from "../lib/trust-score.js";

/**
 * Кириллично-безопасный поиск: PostgreSQL с locale=C игнорирует регистр кириллицы в ILIKE.
 * Обходим это, генерируя LIKE-варианты с разным регистром на стороне Node.js.
 */
function cyrillicLike(column: any, q: string): ReturnType<typeof or> {
  const lower = q.toLowerCase();
  const upper = q.toUpperCase();
  const cap = lower.charAt(0).toUpperCase() + lower.slice(1);
  const variants = Array.from(new Set([q, lower, upper, cap]));
  const conds: any[] = [];
  for (const v of variants) {
    conds.push(sql`${column} LIKE ${"%" + v + "%"}`);
  }
  return or(...conds);
}

const router = Router();

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
// STATS — EXTENDED (Этап 7): аналитика по периоду с кэшем 60с
// ─────────────────────────────────────────────────────────────────────────────

const extendedStatsCache = new Map<string, { ts: number; data: any }>();
const EXT_STATS_TTL_MS = 60 * 1000;

function parseDateOnly(s: unknown, fallback: string): string {
  if (typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return fallback;
}

router.get("/stats/extended", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  // Период по умолчанию — последние 30 дней
  const today = new Date();
  const defaultTo = today.toISOString().slice(0, 10);
  const defaultFrom = new Date(today.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);

  const from = parseDateOnly(req.query.from, defaultFrom);
  const to = parseDateOnly(req.query.to, defaultTo);

  if (from > to) {
    res.status(400).json({ error: "validation_error", message: "from должен быть ≤ to" });
    return;
  }

  const cacheKey = `${from}|${to}`;
  const cached = extendedStatsCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < EXT_STATS_TTL_MS) {
    res.set("X-Cache", "HIT").json(cached.data);
    return;
  }

  // ─── 1. ОБЪЯВЛЕНИЯ ────────────────────────────────────────────────────────
  const [listingsTotals] = (await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE is_available = true) AS active_total,
      COUNT(*) FILTER (WHERE is_available = true AND owner_protection_enabled = true)  AS active_premium,
      COUNT(*) FILTER (WHERE is_available = true AND owner_protection_enabled = false) AS active_free,
      COUNT(*) FILTER (WHERE created_at::date BETWEEN ${from}::date AND ${to}::date) AS new_in_period
    FROM listings
  `)).rows as any[];

  // Конверсия Free → Premium: брони на Free-объявлениях, где арендатор включил защиту
  // (renterUpgradedFromFree = listing.owner_protection_enabled=false AND booking.protection_enabled=true)
  const [freeUpgradeRow] = (await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE l.owner_protection_enabled = false) AS bookings_on_free,
      COUNT(*) FILTER (WHERE l.owner_protection_enabled = false AND b.protection_enabled = true) AS upgraded_to_premium
    FROM bookings b
    JOIN listings l ON l.id = b.listing_id
    WHERE b.created_at::date BETWEEN ${from}::date AND ${to}::date
  `)).rows as any[];

  const topCategories = (await db.execute(sql`
    SELECT c.id, c.name,
           COUNT(l.id) FILTER (WHERE l.is_available = true) AS active,
           COUNT(l.id) FILTER (WHERE l.is_available = true AND l.owner_protection_enabled = true)  AS premium,
           COUNT(l.id) FILTER (WHERE l.is_available = true AND l.owner_protection_enabled = false) AS free
    FROM categories c
    LEFT JOIN listings l ON l.category_id = c.id
    GROUP BY c.id, c.name
    ORDER BY active DESC
    LIMIT 10
  `)).rows as any[];

  // ─── 2. СДЕЛКИ ────────────────────────────────────────────────────────────
  const [bookingsTotals] = (await db.execute(sql`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE protection_enabled = true)  AS premium,
      COUNT(*) FILTER (WHERE protection_enabled = false) AS free,
      COUNT(*) FILTER (WHERE status = 'completed') AS completed,
      COUNT(*) FILTER (WHERE status IN ('cancelled','rejected')) AS cancelled,
      COUNT(*) FILTER (WHERE claim_status IN ('open','approved','rejected')) AS disputed,
      COALESCE(AVG(total_price)::float, 0) AS avg_ticket,
      COALESCE(AVG(total_price) FILTER (WHERE protection_enabled = true)::float, 0)  AS avg_ticket_premium,
      COALESCE(AVG(total_price) FILTER (WHERE protection_enabled = false)::float, 0) AS avg_ticket_free
    FROM bookings
    WHERE created_at::date BETWEEN ${from}::date AND ${to}::date
  `)).rows as any[];

  // Среднее время от заявки (created) до подтверждения (status='confirmed')
  // Используем booking_events: первое событие to_status='confirmed' после created.
  const [confirmTime] = (await db.execute(sql`
    WITH first_confirm AS (
      SELECT booking_id, MIN(created_at) AS confirmed_at
      FROM booking_events
      WHERE to_status = 'confirmed'
      GROUP BY booking_id
    )
    SELECT COALESCE(
      AVG(EXTRACT(EPOCH FROM (fc.confirmed_at - b.created_at)) / 3600.0)::float,
      0
    ) AS avg_hours_to_confirm
    FROM bookings b
    JOIN first_confirm fc ON fc.booking_id = b.id
    WHERE b.created_at::date BETWEEN ${from}::date AND ${to}::date
  `)).rows as any[];

  // ─── 3. КОНТАКТЫ ──────────────────────────────────────────────────────────
  const [contactsTotals] = (await db.execute(sql`
    SELECT
      COUNT(*) AS purchases,
      COUNT(DISTINCT user_id) AS unique_buyers,
      COALESCE(SUM(amount_rub)::int, 0) AS revenue
    FROM contact_purchases
    WHERE created_at::date BETWEEN ${from}::date AND ${to}::date
      AND refunded_at IS NULL
  `)).rows as any[];

  const [unlocksRow] = (await db.execute(sql`
    SELECT COUNT(*) AS unlocks
    FROM contact_unlocks
    WHERE unlocked_at::date BETWEEN ${from}::date AND ${to}::date
  `)).rows as any[];

  const topUnlockedListings = (await db.execute(sql`
    SELECT l.id, l.title, COUNT(cu.id) AS unlocks
    FROM contact_unlocks cu
    JOIN listings l ON l.id = cu.listing_id
    WHERE cu.unlocked_at::date BETWEEN ${from}::date AND ${to}::date
    GROUP BY l.id, l.title
    ORDER BY unlocks DESC
    LIMIT 20
  `)).rows as any[];

  // ─── 4. ПОЛЬЗОВАТЕЛИ ──────────────────────────────────────────────────────
  const [usersTotals] = (await db.execute(sql`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE created_at::date BETWEEN ${from}::date AND ${to}::date) AS registrations_in_period,
      COUNT(*) FILTER (WHERE role = 'owner') AS total_owners,
      COUNT(*) FILTER (WHERE role = 'renter') AS total_renters
    FROM users
  `)).rows as any[];

  // Активные арендаторы за период — оставили хотя бы одну бронь
  const [activeRentersRow] = (await db.execute(sql`
    SELECT COUNT(DISTINCT renter_id) AS active_renters
    FROM bookings
    WHERE created_at::date BETWEEN ${from}::date AND ${to}::date
  `)).rows as any[];

  // Активные владельцы за период — получили хотя бы одну бронь
  const [activeOwnersRow] = (await db.execute(sql`
    SELECT COUNT(DISTINCT owner_id) AS active_owners
    FROM bookings
    WHERE created_at::date BETWEEN ${from}::date AND ${to}::date
  `)).rows as any[];

  // DAU за последние 30 дней (как 30-дневное окно безотносительно выбранного периода — нужно для контекста)
  const [dauMauRow] = (await db.execute(sql`
    SELECT
      COUNT(DISTINCT renter_id) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day')  AS dau,
      COUNT(DISTINCT renter_id) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS mau
    FROM bookings
  `)).rows as any[];

  const purchases = Number(contactsTotals?.purchases ?? 0);
  const uniqueBuyers = Number(contactsTotals?.unique_buyers ?? 0);
  const contactsRevenue = Number(contactsTotals?.revenue ?? 0);
  const unlocks = Number(unlocksRow?.unlocks ?? 0);
  const bookingsOnFree = Number(freeUpgradeRow?.bookings_on_free ?? 0);
  const upgradedToPremium = Number(freeUpgradeRow?.upgraded_to_premium ?? 0);
  const totalBookingsInPeriod = Number(bookingsTotals?.total ?? 0);

  const data = {
    period: { from, to },
    listings: {
      activeTotal: Number(listingsTotals?.active_total ?? 0),
      activePremium: Number(listingsTotals?.active_premium ?? 0),
      activeFree: Number(listingsTotals?.active_free ?? 0),
      newInPeriod: Number(listingsTotals?.new_in_period ?? 0),
      conversionFreeToPremiumPct: bookingsOnFree > 0
        ? Math.round((upgradedToPremium / bookingsOnFree) * 1000) / 10
        : 0,
      topCategories: topCategories.map(r => ({
        id: Number(r.id),
        name: String(r.name),
        active: Number(r.active),
        premium: Number(r.premium),
        free: Number(r.free),
      })),
    },
    bookings: {
      total: totalBookingsInPeriod,
      premium: Number(bookingsTotals?.premium ?? 0),
      free: Number(bookingsTotals?.free ?? 0),
      completed: Number(bookingsTotals?.completed ?? 0),
      cancelled: Number(bookingsTotals?.cancelled ?? 0),
      disputed: Number(bookingsTotals?.disputed ?? 0),
      completedPct: totalBookingsInPeriod > 0
        ? Math.round((Number(bookingsTotals?.completed ?? 0) / totalBookingsInPeriod) * 1000) / 10
        : 0,
      cancelledPct: totalBookingsInPeriod > 0
        ? Math.round((Number(bookingsTotals?.cancelled ?? 0) / totalBookingsInPeriod) * 1000) / 10
        : 0,
      disputedPct: totalBookingsInPeriod > 0
        ? Math.round((Number(bookingsTotals?.disputed ?? 0) / totalBookingsInPeriod) * 1000) / 10
        : 0,
      avgTicket: Math.round(Number(bookingsTotals?.avg_ticket ?? 0)),
      avgTicketPremium: Math.round(Number(bookingsTotals?.avg_ticket_premium ?? 0)),
      avgTicketFree: Math.round(Number(bookingsTotals?.avg_ticket_free ?? 0)),
      avgHoursToConfirm: Math.round(Number(confirmTime?.avg_hours_to_confirm ?? 0) * 10) / 10,
    },
    contacts: {
      purchases,
      uniqueBuyers,
      revenue: contactsRevenue,
      arpu: uniqueBuyers > 0 ? Math.round(contactsRevenue / uniqueBuyers) : 0,
      unlocks,
      conversionUnlockPerPurchasePct: purchases > 0
        ? Math.round((unlocks / purchases) * 1000) / 10
        : 0,
      topUnlockedListings: topUnlockedListings.map(r => ({
        id: Number(r.id),
        title: String(r.title),
        unlocks: Number(r.unlocks),
      })),
    },
    users: {
      total: Number(usersTotals?.total ?? 0),
      totalOwners: Number(usersTotals?.total_owners ?? 0),
      totalRenters: Number(usersTotals?.total_renters ?? 0),
      registrationsInPeriod: Number(usersTotals?.registrations_in_period ?? 0),
      activeRenters: Number(activeRentersRow?.active_renters ?? 0),
      activeOwners: Number(activeOwnersRow?.active_owners ?? 0),
      dau: Number(dauMauRow?.dau ?? 0),
      mau: Number(dauMauRow?.mau ?? 0),
    },
  };

  extendedStatsCache.set(cacheKey, { ts: Date.now(), data });
  res.set("X-Cache", "MISS").json(data);
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
  if (q) conditions.push(or(cyrillicLike(usersTable.name, q), sql`${usersTable.email} LIKE ${"%" + q.toLowerCase() + "%"}`));
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
  const id = parseInt(req.params.id as string);
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
  const id = parseInt(req.params.id as string);
  const { role, isBanned, banReason, name, email, phone, bio, telegram, isVerified, verificationNote } = req.body;

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
  // Stage 19g — Trust & Verification (Уровень 1: бинарный «Проверенный владелец»).
  // Бессрочно: верификация снимается только повторной правкой админа (см. AGENT_INSTRUCTIONS.md §11d).
  if (isVerified !== undefined) {
    updates.isVerified = !!isVerified;
    if (isVerified) {
      updates.verifiedAt = new Date();
      updates.verifiedByAdminId = req.userId!;
    } else {
      updates.verifiedAt = null;
      updates.verifiedByAdminId = null;
    }
  }
  if (verificationNote !== undefined) {
    const trimmed = typeof verificationNote === "string" ? verificationNote.trim() : "";
    updates.verificationNote = trimmed || null;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "bad_request", message: "Нечего обновлять" });
    return;
  }

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "not_found" }); return; }

  const changedFields = Object.keys(updates).join(", ");
  const action = isBanned === true
    ? "ban_user"
    : isBanned === false
      ? "unban_user"
      : isVerified === true
        ? "verify_user"
        : isVerified === false
          ? "unverify_user"
          : "edit_user";
  await audit(req.userId!, "user", id, action,
    `Changed: ${changedFields}${banReason ? `. Reason: ${banReason}` : ""}`);

  // Stage 29 — Trust Score: верификация даёт +20, снятие — обнуляет бонус.
  if (isVerified !== undefined) {
    void calculateAndUpdateTrustScore(id, req.userId!, `admin_verified_changed:${isVerified ? "on" : "off"}`);
  }

  res.json({ id: updated.id, role: updated.role, isBanned: updated.isBanned, isVerified: updated.isVerified, verifiedAt: updated.verifiedAt?.toISOString() ?? null, verificationNote: updated.verificationNote, name: updated.name, email: updated.email });
});

// Send notification to a user
router.post("/users/:id/notify", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
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
  if (q) conditions.push(cyrillicLike(listingsTable.title, q));
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
  const id = parseInt(req.params.id as string);

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
  const id = parseInt(req.params.id as string);
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
  const id = parseInt(req.params.id as string);

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
  if (q) conditions.push(or(cyrillicLike(bookingsTable.bookingNumber, q), sql`${bookingsTable.id}::text LIKE ${`%${q}%`}`));
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
  const id = parseInt(req.params.id as string);
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
  if (q) conditions.push(cyrillicLike(supportTicketsTable.subject, q));

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
  const id = parseInt(req.params.id as string);
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
  const id = parseInt(req.params.id as string);
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
  const id = parseInt(req.params.id as string);
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

  const [countRow] = await db.execute(sql`SELECT COUNT(*) AS total FROM reports WHERE status = ${status}`)
    .then(r => r.rows as any[]);
  const total = Number(countRow?.total ?? 0);

  res.json({
    reports: rows,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

router.patch("/reports/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
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

  const [countRow] = await db.execute(sql`SELECT COUNT(*) AS total FROM admin_audit_log`)
    .then(r => r.rows as any[]);
  const total = Number(countRow?.total ?? 0);

  res.json({
    entries: rows,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// ─── SEED ──────────────────────────────────────────────────────────────────────
// POST /api/admin/seed — полный сброс и повторное заполнение БД тестовыми данными.
// Самодостаточный: не зависит от скомпилированного seed.mjs.
const REGIONS_DATA = [
  { name: "Москва", slug: "moscow" }, { name: "Санкт-Петербург", slug: "spb" }, { name: "Севастополь", slug: "sevastopol" },
  { name: "Республика Адыгея", slug: "adygea" }, { name: "Республика Алтай", slug: "altai-rep" }, { name: "Республика Башкортостан", slug: "bashkortostan" },
  { name: "Республика Бурятия", slug: "buryatia" }, { name: "Республика Дагестан", slug: "dagestan" }, { name: "Республика Ингушетия", slug: "ingushetia" },
  { name: "Кабардино-Балкарская Республика", slug: "kabardino-balkaria" }, { name: "Республика Калмыкия", slug: "kalmykia" },
  { name: "Карачаево-Черкесская Республика", slug: "karachay-cherkessia" }, { name: "Республика Карелия", slug: "karelia" },
  { name: "Республика Коми", slug: "komi" }, { name: "Республика Крым", slug: "crimea" }, { name: "Республика Марий Эл", slug: "mari-el" },
  { name: "Республика Мордовия", slug: "mordovia" }, { name: "Республика Саха (Якутия)", slug: "sakha" },
  { name: "Республика Северная Осетия — Алания", slug: "north-ossetia" }, { name: "Республика Татарстан", slug: "tatarstan" },
  { name: "Республика Тыва", slug: "tuva" }, { name: "Удмуртская Республика", slug: "udmurtia" }, { name: "Республика Хакасия", slug: "khakassia" },
  { name: "Чеченская Республика", slug: "chechnya" }, { name: "Чувашская Республика", slug: "chuvashia" },
  { name: "Алтайский край", slug: "altai-krai" }, { name: "Забайкальский край", slug: "zabaykalsky" }, { name: "Камчатский край", slug: "kamchatka" },
  { name: "Краснодарский край", slug: "krasnodar" }, { name: "Красноярский край", slug: "krasnoyarsk" }, { name: "Пермский край", slug: "perm" },
  { name: "Приморский край", slug: "primorsky" }, { name: "Ставропольский край", slug: "stavropol" }, { name: "Хабаровский край", slug: "khabarovsk" },
  { name: "Амурская область", slug: "amur" }, { name: "Архангельская область", slug: "arkhangelsk" }, { name: "Астраханская область", slug: "astrakhan" },
  { name: "Белгородская область", slug: "belgorod" }, { name: "Брянская область", slug: "bryansk" }, { name: "Владимирская область", slug: "vladimir" },
  { name: "Волгоградская область", slug: "volgograd" }, { name: "Вологодская область", slug: "vologda" }, { name: "Воронежская область", slug: "voronezh" },
  { name: "Ивановская область", slug: "ivanovo" }, { name: "Иркутская область", slug: "irkutsk" }, { name: "Калининградская область", slug: "kaliningrad" },
  { name: "Калужская область", slug: "kaluga" }, { name: "Кемеровская область", slug: "kemerovo" }, { name: "Кировская область", slug: "kirov" },
  { name: "Костромская область", slug: "kostroma" }, { name: "Курганская область", slug: "kurgan" }, { name: "Курская область", slug: "kursk" },
  { name: "Ленинградская область", slug: "leningrad-obl" }, { name: "Липецкая область", slug: "lipetsk" }, { name: "Магаданская область", slug: "magadan" },
  { name: "Московская область", slug: "moscow-obl" }, { name: "Мурманская область", slug: "murmansk" }, { name: "Нижегородская область", slug: "nizhny-novgorod" },
  { name: "Новгородская область", slug: "novgorod-obl" }, { name: "Новосибирская область", slug: "novosibirsk" }, { name: "Омская область", slug: "omsk" },
  { name: "Оренбургская область", slug: "orenburg" }, { name: "Орловская область", slug: "oryol" }, { name: "Пензенская область", slug: "penza" },
  { name: "Псковская область", slug: "pskov" }, { name: "Ростовская область", slug: "rostov" }, { name: "Рязанская область", slug: "ryazan" },
  { name: "Самарская область", slug: "samara" }, { name: "Саратовская область", slug: "saratov" }, { name: "Сахалинская область", slug: "sakhalin" },
  { name: "Свердловская область", slug: "sverdlovsk" }, { name: "Смоленская область", slug: "smolensk" }, { name: "Тамбовская область", slug: "tambov" },
  { name: "Тверская область", slug: "tver" }, { name: "Томская область", slug: "tomsk" }, { name: "Тульская область", slug: "tula" },
  { name: "Тюменская область", slug: "tyumen" }, { name: "Ульяновская область", slug: "ulyanovsk" }, { name: "Челябинская область", slug: "chelyabinsk" },
  { name: "Ярославская область", slug: "yaroslavl" }, { name: "Еврейская автономная область", slug: "jewish-ao" },
  { name: "Ненецкий автономный округ", slug: "nenets" }, { name: "Ханты-Мансийский автономный округ", slug: "khanty-mansiysk" },
  { name: "Чукотский автономный округ", slug: "chukotka" }, { name: "Ямало-Ненецкий автономный округ", slug: "yamal" },
];

const CATEGORIES_DATA = [
  { name: "Стройка и ремонт", slug: "construction", icon: "🔨" },
  { name: "Туризм и спорт",   slug: "tourism",      icon: "⛺" },
  { name: "Сад и огород",     slug: "garden",       icon: "🌱" },
  { name: "Праздники",        slug: "holidays",     icon: "🎉" },
  { name: "Детские товары",   slug: "children",     icon: "👶" },
  { name: "Электроника",      slug: "electronics",  icon: "💻" },
  { name: "Авто и мото",      slug: "auto",         icon: "🚗" },
  { name: "Одежда и обувь",   slug: "clothing",     icon: "👗" },
  { name: "Фото и видео",     slug: "photo",        icon: "📷" },
  { name: "Книги и учёба",    slug: "books",        icon: "📚" },
];

router.post("/seed", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const log: string[] = [];

    // 1. Очищаем данные
    await db.delete(listingsTable);
    await db.delete(categoriesTable);
    await db.execute(sql`UPDATE users SET region_id = NULL WHERE region_id IS NOT NULL`);
    await db.delete(regionsTable);
    log.push(`🗑️ Старые данные удалены`);

    // 2. Регионы — все 85 субъектов РФ
    await db.insert(regionsTable).values(REGIONS_DATA);
    log.push(`✅ Регионы: ${REGIONS_DATA.length} шт.`);

    // 3. Категории
    await db.insert(categoriesTable).values(CATEGORIES_DATA);
    log.push(`✅ Категории: ${CATEGORIES_DATA.length} шт.`);

    // Получаем ID
    const regions    = await db.select().from(regionsTable);
    const categories = await db.select().from(categoriesTable);
    const r = (slug: string) => regions.find(x => x.slug === slug)!.id;
    const c = (slug: string) => categories.find(x => x.slug === slug)!.id;

    // 4. Обновляем регион пользователей
    await db.execute(sql`UPDATE users SET region_id = ${r("moscow")} WHERE region_id IS NULL`);
    log.push(`✅ Пользователи: region_id → Москва`);

    // 5. Тестовые пользователи (если <= 1)
    const [{ cnt }] = await db.execute(sql`SELECT count(*)::int as cnt FROM users`)
      .then(r2 => r2.rows as { cnt: number }[]);
    let ownerId1: number, ownerId2: number, ownerId3: number;
    if (cnt <= 1) {
      const h = (pw: string) => bcrypt.hash(pw, 10);
      const [o1] = await db.insert(usersTable).values({ name: "Алексей Петров", email: "alexey@example.com", passwordHash: await h("Test1234!"), role: "owner", phone: "+7 (916) 123-45-67", regionId: r("moscow"), bio: "Сдаю технику и инструменты уже 3 года.", telegram: "@alexey_rents" }).returning();
      const [o2] = await db.insert(usersTable).values({ name: "Мария Соколова", email: "maria@example.com", passwordHash: await h("Test1234!"), role: "owner", phone: "+7 (812) 987-65-43", regionId: r("spb"), bio: "Фотограф. Сдаю профессиональное оборудование.", telegram: "@maria_photo" }).returning();
      const [o3] = await db.insert(usersTable).values({ name: "Дмитрий Захаров", email: "dmitry@example.com", passwordHash: await h("Test1234!"), role: "owner", phone: "+7 (343) 555-44-33", regionId: r("sverdlovsk"), bio: "Сдаю спортивное снаряжение и товары для природы." }).returning();
      await db.insert(usersTable).values([
        { name: "Ирина Новикова", email: "irina@example.com", passwordHash: await h("Test1234!"), role: "renter", phone: "+7 (963) 111-22-33", regionId: r("moscow") },
        { name: "Сергей Волков", email: "sergey@example.com", passwordHash: await h("Test1234!"), role: "renter", phone: "+7 (921) 444-55-66", regionId: r("spb") },
        { name: "Анна Козлова", email: "anna@example.com", passwordHash: await h("Test1234!"), role: "renter", phone: "+7 (383) 777-88-99", regionId: r("novosibirsk") },
      ]);
      ownerId1 = o1.id; ownerId2 = o2.id; ownerId3 = o3.id;
      log.push(`✅ Тестовые пользователи добавлены`);
    } else {
      const owners = await db.select().from(usersTable).where(eq(usersTable.role, "owner")).limit(3);
      ownerId1 = owners[0]?.id ?? 1; ownerId2 = owners[1]?.id ?? 1; ownerId3 = owners[2]?.id ?? 1;
      log.push(`⏭️ Пользователи уже есть (${cnt})`);
    }

    // 6. Объявления
    await db.insert(listingsTable).values([
      { title: "DJI Mini 3 Pro — дрон для аэросъёмки", description: "4K/60fps, 3 акб, кейс. Для путешествий и съёмки мероприятий.", pricePerDay: "2500", deposit: "15000", categoryId: c("electronics"), regionId: r("moscow"), city: "Москва", ownerId: ownerId1, isAvailable: true },
      { title: "MacBook Pro 16\" M3", description: "M3 Pro, 36 ГБ RAM, 1 ТБ SSD. Для разработки и дизайна.", pricePerDay: "3000", deposit: "120000", categoryId: c("electronics"), regionId: r("moscow"), city: "Москва", ownerId: ownerId1, isAvailable: true },
      { title: "Проектор Epson + экран 120\"", description: "3600 люмен, HDMI+USB. Для конференций и кино.", pricePerDay: "1500", deposit: "10000", categoryId: c("electronics"), regionId: r("moscow"), city: "Москва", ownerId: ownerId1, isAvailable: true },
      { title: "Sony A7 IV + объектив 24-70mm f/2.8", description: "33 МП, 2 акб, сумка. Профессиональная съёмка.", pricePerDay: "3500", deposit: "80000", categoryId: c("photo"), regionId: r("spb"), city: "Санкт-Петербург", ownerId: ownerId2, isAvailable: true },
      { title: "Студийный свет — 3 моноблока 400 Вт", description: "Стойки, зонты, октабокс 80×80, синхронизатор.", pricePerDay: "2000", deposit: "20000", categoryId: c("photo"), regionId: r("spb"), city: "Санкт-Петербург", ownerId: ownerId2, isAvailable: true },
      { title: "Стабилизатор DJI RS 3", description: "3-осевой гимбал, нагрузка до 3 кг, Bluetooth.", pricePerDay: "800", deposit: "12000", categoryId: c("photo"), regionId: r("spb"), city: "Санкт-Петербург", ownerId: ownerId2, isAvailable: true },
      { title: "Горные лыжи Rossignol + ботинки (р.43-44)", description: "170 см, Look SPX 12. Состояние хорошее.", pricePerDay: "700", deposit: "8000", categoryId: c("tourism"), regionId: r("sverdlovsk"), city: "Екатеринбург", ownerId: ownerId3, isAvailable: true },
      { title: "Туристическая палатка на 4 человека", description: "MSR Habitude 4, 3,5 кг, водостойкость 3000 мм.", pricePerDay: "600", deposit: "5000", categoryId: c("tourism"), regionId: r("sverdlovsk"), city: "Екатеринбург", ownerId: ownerId3, isAvailable: true },
      { title: "SUP-доска надувная 11 футов", description: "Весло, насос, рюкзак. Для рек и озёр.", pricePerDay: "900", deposit: "6000", categoryId: c("tourism"), regionId: r("sverdlovsk"), city: "Екатеринбург", ownerId: ownerId3, isAvailable: true },
      { title: "Перфоратор Bosch GBH 2-28 F", description: "880 Вт, 3,2 Дж удар, SDS-plus, набор бит.", pricePerDay: "500", deposit: "3000", categoryId: c("construction"), regionId: r("moscow"), city: "Москва", ownerId: ownerId1, isAvailable: true },
      { title: "Лазерный уровень Bosch GLL 3-80", description: "3-плоскостной, 80 м, штатив в комплекте.", pricePerDay: "700", deposit: "5000", categoryId: c("construction"), regionId: r("moscow"), city: "Москва", ownerId: ownerId1, isAvailable: true },
      { title: "Фотобудка с принтером", description: "Автоматическая, печать за 10 сек. Для свадеб и корпоративов.", pricePerDay: "5000", deposit: "30000", categoryId: c("holidays"), regionId: r("spb"), city: "Санкт-Петербург", ownerId: ownerId2, isAvailable: true },
      { title: "Детский велосипед 16\" (рост 100-120 см)", description: "Боковые колёса, регулируемые сиденье и руль. Возраст 4-7 лет.", pricePerDay: "200", deposit: "2000", categoryId: c("children"), regionId: r("tatarstan"), city: "Казань", ownerId: ownerId3, isAvailable: true },
      { title: "Детская коляска Bugaboo Fox 3", description: "2в1: люлька + прогулочный блок. От рождения до 22 кг.", pricePerDay: "350", deposit: "30000", categoryId: c("children"), regionId: r("tatarstan"), city: "Казань", ownerId: ownerId3, isAvailable: true },
    ]);
    log.push(`✅ Объявления: 14 шт.`);

    res.json({ ok: true, log });
  } catch (err: any) {
    console.error("Seed error:", err);
    res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

// POST /api/admin/seed-test-listings — доливает по N (по умолчанию 15) объявлений в каждую категорию.
// Идемпотентно: если в категории уже >=N тестовых, ничего не добавляет. Не трогает живые данные.
router.post("/seed-test-listings", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const perCategory = Number((req.body as any)?.perCategory) || 15;
    const result = await seedTestListings({ perCategory });
    res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("Seed test listings error:", err);
    res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM SETTINGS — управление экономикой и монетизацией
// ─────────────────────────────────────────────────────────────────────────────

router.get("/settings", requireAuth, requireAdmin, async (_req, res) => {
  const s = await getPlatformSettings();
  res.json(s);
});

router.put("/settings", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const allowed = [
    "serviceFeePercent", "taxFeePercent", "shieldFeePercent", "shieldFeeMin",
    "riskCoveragePercent", "riskCoverageMin", "depositMultiplier", "depositMin",
    "protMultElectronics", "protMultTools", "protMultLeisure", "protMultSpecialMachinery",
    "newUserProtectionCap", "newUserDealsThreshold",
    "vipPrice7d", "vipPrice14d", "vipPrice30d",
    "urgentPrice3d", "urgentPrice7d", "boostPrice24h",
    "subscriptionProMonthly", "subscriptionBusinessMonthly", "subscriptionBusinessCommissionPercent",
    "jointPurchaseFeePercent",
    // ── Stage 23a: Co-Sharing ───────────────────────────────────────────
    "poolFeeSelfManagedPercent", "poolFeeConciergePercent", "coOwnerDailyFeeRub",
    // ── Stage 26: Wear and Tear ─────────────────────────────────────────
    "depreciationPerRentalPercent",
    "paymentMode",
    "yookassaEnabled", "yookassaShopId", "yookassaSecretKey", "yookassaTestMode",
    "sbpEnabled", "sbpMerchantId",
    "cloudpaymentsEnabled", "cloudpaymentsPublicId",
    // ── Stage 2: Free + контакты + витрина ──────────────────────────────
    "freeListingsEnabled", "freeListingsMaxPerOwner", "freeListingsRequirePhone", "freeShowOwnerPhoneMode",
    "contactPriceSingle", "contactPricePack10", "contactPriceUnlimited30d",
    "freeContactsBonus", "contactLifetimeDays",
    "contactPackRefundEnabled", "contactPackRefundWindowDays",
    "freeToPremiumUpgradeEnabled",
    "defaultCatalogSort", "minPremiumShareInResults", "showFormatBadges",
    // ── Stage 21a: master-toggle коммерческого режима ───────────────────
    "isCommercialMode",
    // ── Stage 30A: AI Gateway ───────────────────────────────────────────
    "activeAiProvider",
  ] as const;
  const body = req.body ?? {};
  const patch: Record<string, any> = {};
  for (const k of allowed) {
    if (k in body) patch[k] = body[k];
  }
  // ─── Валидация ────────────────────────────────────────────────────────────
  const PERCENT_FIELDS = [
    "serviceFeePercent", "taxFeePercent", "shieldFeePercent", "riskCoveragePercent",
    "subscriptionBusinessCommissionPercent", "jointPurchaseFeePercent",
    // Stage 23a
    "poolFeeSelfManagedPercent", "poolFeeConciergePercent",
  ] as const;
  const DECIMAL_FIELDS = ["depositMultiplier"] as const;
  const NON_NEG_INT_FIELDS = [
    "shieldFeeMin", "riskCoverageMin", "depositMin",
    "protMultElectronics", "protMultTools", "protMultLeisure", "protMultSpecialMachinery",
    "newUserProtectionCap", "newUserDealsThreshold",
    "vipPrice7d", "vipPrice14d", "vipPrice30d",
    "urgentPrice3d", "urgentPrice7d", "boostPrice24h",
    "subscriptionProMonthly", "subscriptionBusinessMonthly",
    // Stage 2
    "freeListingsMaxPerOwner",
    "contactPriceSingle", "contactPricePack10", "contactPriceUnlimited30d",
    "freeContactsBonus", "contactLifetimeDays", "contactPackRefundWindowDays",
    // Stage 23a
    "coOwnerDailyFeeRub",
    // Stage 26
    "depreciationPerRentalPercent",
  ] as const;
  const PERCENT_INT_FIELDS = ["minPremiumShareInResults"] as const;
  const BOOL_FIELDS = [
    "yookassaEnabled", "yookassaTestMode", "sbpEnabled", "cloudpaymentsEnabled",
    // Stage 2
    "freeListingsEnabled", "freeListingsRequirePhone",
    "contactPackRefundEnabled", "freeToPremiumUpgradeEnabled", "showFormatBadges",
    // Stage 21a
    "isCommercialMode",
  ] as const;
  const NULLABLE_STR_FIELDS = [
    "yookassaShopId", "yookassaSecretKey", "sbpMerchantId", "cloudpaymentsPublicId",
  ] as const;

  for (const k of PERCENT_FIELDS) {
    if (k in patch) {
      const v = parseFloat(String(patch[k]));
      if (!isFinite(v) || v < 0 || v > 100) {
        return res.status(400).json({ error: "invalid_value", field: k, message: "Должно быть число от 0 до 100" });
      }
      patch[k] = String(v);
    }
  }
  for (const k of DECIMAL_FIELDS) {
    if (k in patch) {
      const v = parseFloat(String(patch[k]));
      if (!isFinite(v) || v < 0) {
        return res.status(400).json({ error: "invalid_value", field: k, message: "Должно быть неотрицательное число" });
      }
      patch[k] = String(v);
    }
  }
  for (const k of NON_NEG_INT_FIELDS) {
    if (k in patch) {
      const raw = patch[k];
      if (raw === "" || raw === null || raw === undefined) {
        return res.status(400).json({ error: "invalid_value", field: k, message: "Поле обязательно" });
      }
      const v = Number(raw);
      if (!Number.isFinite(v) || !Number.isInteger(v) || v < 0) {
        return res.status(400).json({ error: "invalid_value", field: k, message: "Должно быть целое неотрицательное число" });
      }
      patch[k] = v;
    }
  }
  for (const k of BOOL_FIELDS) {
    if (k in patch) {
      if (typeof patch[k] !== "boolean") {
        return res.status(400).json({ error: "invalid_value", field: k, message: "Должно быть true/false" });
      }
    }
  }
  for (const k of NULLABLE_STR_FIELDS) {
    if (k in patch) {
      const v = patch[k];
      if (v === "" || v === undefined) patch[k] = null;
      else if (v !== null && typeof v !== "string") {
        return res.status(400).json({ error: "invalid_value", field: k });
      } else if (typeof v === "string" && v.length > 255) {
        return res.status(400).json({ error: "invalid_value", field: k, message: "Слишком длинное значение" });
      }
    }
  }
  if ("paymentMode" in patch && !["self_employed", "ip", "ooo"].includes(patch.paymentMode)) {
    return res.status(400).json({ error: "invalid_value", field: "paymentMode" });
  }
  // Stage 30A: AI provider — допустимы только три значения
  if ("activeAiProvider" in patch && !["mock", "openai", "amvera"].includes(patch.activeAiProvider)) {
    return res.status(400).json({
      error: "invalid_value",
      field: "activeAiProvider",
      message: "Допустимо: mock | openai | amvera",
    });
  }

  // ── Stage 2: PERCENT_INT (0..100) ────────────────────────────────────
  for (const k of PERCENT_INT_FIELDS) {
    if (k in patch) {
      const v = Number(patch[k]);
      if (!Number.isFinite(v) || !Number.isInteger(v) || v < 0 || v > 100) {
        return res.status(400).json({ error: "invalid_value", field: k, message: "Должно быть целое от 0 до 100" });
      }
      patch[k] = v;
    }
  }
  // ── Stage 2: enum-поля ──────────────────────────────────────────────
  if ("freeShowOwnerPhoneMode" in patch && !["instant", "after_payment"].includes(patch.freeShowOwnerPhoneMode)) {
    return res.status(400).json({ error: "invalid_value", field: "freeShowOwnerPhoneMode", message: "Допустимо: instant | after_payment" });
  }
  if ("defaultCatalogSort" in patch && !["protected_first", "newest", "price_asc", "price_desc"].includes(patch.defaultCatalogSort)) {
    return res.status(400).json({ error: "invalid_value", field: "defaultCatalogSort", message: "Допустимо: protected_first | newest | price_asc | price_desc" });
  }

  // Семантическая проверка: shieldFeeMin/riskCoverageMin не могут быть слишком большими
  if (typeof patch.shieldFeeMin === "number" && patch.shieldFeeMin > 1_000_000) {
    return res.status(400).json({ error: "invalid_value", field: "shieldFeeMin", message: "Слишком большое значение" });
  }
  if (typeof patch.riskCoverageMin === "number" && patch.riskCoverageMin > 1_000_000) {
    return res.status(400).json({ error: "invalid_value", field: "riskCoverageMin", message: "Слишком большое значение" });
  }

  // ── Модель А: Гарантийный фонд — одна доля для обеих сторон.
  // Зеркалируем shieldFee↔riskCoverage, чтобы устаревшие потребители (publicSettings,
  // legacy-импорты) не показывали расходящиеся цифры с реальной формулой расчёта.
  if ("shieldFeePercent" in patch && !("riskCoveragePercent" in patch)) {
    patch.riskCoveragePercent = patch.shieldFeePercent;
  } else if ("riskCoveragePercent" in patch && !("shieldFeePercent" in patch)) {
    patch.shieldFeePercent = patch.riskCoveragePercent;
  }
  if ("shieldFeeMin" in patch && !("riskCoverageMin" in patch)) {
    patch.riskCoverageMin = patch.shieldFeeMin;
  } else if ("riskCoverageMin" in patch && !("shieldFeeMin" in patch)) {
    patch.shieldFeeMin = patch.riskCoverageMin;
  }

  const updated = await updatePlatformSettings(patch, req.userId);
  if (req.userId) {
    await audit(req.userId, "platform_settings", updated.id, "update", JSON.stringify(Object.keys(patch)));
  }
  res.json(updated);
});

// ─── Stage 30A: AI Gateway — выделенный endpoint для смены провайдера ──────
router.put(
  "/settings/ai-provider",
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res) => {
    const { activeAiProvider } = req.body ?? {};
    if (!["mock", "openai", "amvera"].includes(activeAiProvider)) {
      return res.status(400).json({
        error: "invalid_value",
        field: "activeAiProvider",
        message: "Допустимо: mock | openai | amvera",
      });
    }
    const updated = await updatePlatformSettings(
      { activeAiProvider } as any,
      req.userId,
    );
    if (req.userId) {
      await audit(
        req.userId,
        "platform_settings",
        updated.id,
        "update",
        `ai_provider:${activeAiProvider}`,
      );
    }
    res.json({ activeAiProvider: updated.activeAiProvider });
  },
);

export default router;
