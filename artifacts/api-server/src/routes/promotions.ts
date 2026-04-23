import { Router, type Response } from "express";
import { eq, desc, and, gt, sql } from "drizzle-orm";
import { db, listingsTable, listingPromotionsTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { getPlatformSettings } from "../lib/platform-settings.js";

const router = Router();

type PromoType = "vip" | "urgent" | "boost";
type PromoPlan = "7d" | "14d" | "30d" | "3d" | "24h";

const PLANS: Record<PromoType, Array<{ plan: PromoPlan; days: number; priceKey: keyof Awaited<ReturnType<typeof getPlatformSettings>> }>> = {
  vip: [
    { plan: "7d", days: 7, priceKey: "vipPrice7d" },
    { plan: "14d", days: 14, priceKey: "vipPrice14d" },
    { plan: "30d", days: 30, priceKey: "vipPrice30d" },
  ],
  urgent: [
    { plan: "3d", days: 3, priceKey: "urgentPrice3d" },
    { plan: "7d", days: 7, priceKey: "urgentPrice7d" },
  ],
  boost: [{ plan: "24h", days: 1, priceKey: "boostPrice24h" }],
};

// ─── GET /api/promotions/pricing — публичный прайс ─────────────────────
router.get("/pricing", async (_req, res) => {
  const s = await getPlatformSettings();
  res.json({
    vip: PLANS.vip.map(p => ({ plan: p.plan, days: p.days, priceRub: Number(s[p.priceKey] ?? 0) })),
    urgent: PLANS.urgent.map(p => ({ plan: p.plan, days: p.days, priceRub: Number(s[p.priceKey] ?? 0) })),
    boost: PLANS.boost.map(p => ({ plan: p.plan, days: p.days, priceRub: Number(s[p.priceKey] ?? 0) })),
  });
});

// ─── POST /api/promotions/listings/:id — купить пакет (имитация платежа) ─
router.post("/listings/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const listingId = Number(req.params.id);
  if (!Number.isFinite(listingId)) {
    res.status(400).json({ error: "invalid_input", message: "Неверный ID объявления" });
    return;
  }
  const { type, plan } = (req.body ?? {}) as { type?: PromoType; plan?: PromoPlan };
  if (!type || !PLANS[type]) {
    res.status(400).json({ error: "invalid_input", message: "Неверный тип продвижения" });
    return;
  }
  const planDef = PLANS[type].find(p => p.plan === plan);
  if (!planDef) {
    res.status(400).json({ error: "invalid_input", message: "Неверный план" });
    return;
  }

  const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, listingId));
  if (!listing) {
    res.status(404).json({ error: "not_found", message: "Объявление не найдено" });
    return;
  }
  if (listing.ownerId !== req.userId) {
    res.status(403).json({ error: "forbidden", message: "Можно продвигать только свои объявления" });
    return;
  }

  const settings = await getPlatformSettings();
  const priceRub = Number(settings[planDef.priceKey] ?? 0);
  if (priceRub <= 0) {
    res.status(400).json({ error: "invalid_state", message: "Цена для этого пакета не настроена" });
    return;
  }

  // Атомарно: продлеваем от GREATEST(текущий срок, NOW()) + N дней.
  // Заворачиваем UPDATE listings + INSERT в listing_promotions в транзакцию.
  const days = planDef.days;
  const result = await db.transaction(async (tx) => {
    const set: Record<string, any> = {};
    if (type === "vip") {
      set.isFeatured = true;
      set.featuredUntil = sql`GREATEST(COALESCE(${listingsTable.featuredUntil}, NOW()), NOW()) + (${days} || ' days')::interval`;
    } else if (type === "urgent") {
      set.isUrgent = true;
      set.urgentUntil = sql`GREATEST(COALESCE(${listingsTable.urgentUntil}, NOW()), NOW()) + (${days} || ' days')::interval`;
    } else {
      set.boostedUntil = sql`GREATEST(COALESCE(${listingsTable.boostedUntil}, NOW()), NOW()) + (${days} || ' days')::interval`;
    }

    const [updated] = await tx.update(listingsTable).set(set).where(eq(listingsTable.id, listingId)).returning();
    const newUntil =
      type === "vip" ? updated.featuredUntil :
      type === "urgent" ? updated.urgentUntil :
      updated.boostedUntil;

    const [promo] = await tx.insert(listingPromotionsTable).values({
      listingId,
      ownerId: req.userId!,
      type,
      plan: planDef.plan,
      days,
      priceRub: Math.round(priceRub),
      validUntil: newUntil!,
      paymentRef: `MANUAL-${Date.now()}`,
    }).returning();
    return { promo, newUntil };
  });

  res.status(201).json({ promotion: result.promo, validUntil: result.newUntil });
});

// ─── GET /api/promotions/me — журнал моих покупок ─────────────────────
router.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  const rows = await db
    .select({
      id: listingPromotionsTable.id,
      listingId: listingPromotionsTable.listingId,
      listingTitle: listingsTable.title,
      type: listingPromotionsTable.type,
      plan: listingPromotionsTable.plan,
      days: listingPromotionsTable.days,
      priceRub: listingPromotionsTable.priceRub,
      validUntil: listingPromotionsTable.validUntil,
      paidAt: listingPromotionsTable.paidAt,
    })
    .from(listingPromotionsTable)
    .leftJoin(listingsTable, eq(listingsTable.id, listingPromotionsTable.listingId))
    .where(eq(listingPromotionsTable.ownerId, req.userId!))
    .orderBy(desc(listingPromotionsTable.paidAt));
  res.json({ promotions: rows });
});

// ─── GET /api/promotions/admin — все покупки + сводка по выручке (admin) ─
router.get("/admin", requireAuth, async (req: AuthRequest, res: Response) => {
  // ленивая проверка — в пределах файла, без middleware (как в других admin-местах)
  const { usersTable } = await import("@workspace/db");
  const [u] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, req.userId!));
  if (u?.role !== "admin") {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  const rows = await db
    .select({
      id: listingPromotionsTable.id,
      listingId: listingPromotionsTable.listingId,
      listingTitle: listingsTable.title,
      ownerId: listingPromotionsTable.ownerId,
      type: listingPromotionsTable.type,
      plan: listingPromotionsTable.plan,
      priceRub: listingPromotionsTable.priceRub,
      validUntil: listingPromotionsTable.validUntil,
      paidAt: listingPromotionsTable.paidAt,
    })
    .from(listingPromotionsTable)
    .leftJoin(listingsTable, eq(listingsTable.id, listingPromotionsTable.listingId))
    .orderBy(desc(listingPromotionsTable.paidAt))
    .limit(500);

  const [{ total, count, activeNow }] = await db.select({
    total: sql<string>`COALESCE(SUM(${listingPromotionsTable.priceRub}), 0)`,
    count: sql<number>`COUNT(*)::int`,
    activeNow: sql<number>`SUM(CASE WHEN ${listingPromotionsTable.validUntil} > NOW() THEN 1 ELSE 0 END)::int`,
  }).from(listingPromotionsTable);

  res.json({
    promotions: rows,
    summary: {
      totalRub: Number(total ?? 0),
      count: count ?? 0,
      activeNow: activeNow ?? 0,
    },
  });
});

export default router;
