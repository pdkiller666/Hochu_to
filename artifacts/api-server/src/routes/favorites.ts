import { Router } from "express";
import { db, favoritesTable, listingsTable, usersTable, categoriesTable, regionsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { sql } from "drizzle-orm";
import { applyFavoritesCountDelta } from "../lib/listing-counters.js";

const router = Router();

// ─── GET /api/favorites — current user's favorited listings ──────────────────
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;

  const rows = await db
    .select({
      favoriteId: favoritesTable.id,
      createdAt: favoritesTable.createdAt,
      listing: listingsTable,
      categoryName: categoriesTable.name,
      regionName: regionsTable.name,
      ownerName: sql<string>`owner.name`,
      avgRating: sql<number | null>`(
        SELECT AVG(r.rating) FROM reviews r WHERE r.listing_id = ${listingsTable.id}
      )`,
    })
    .from(favoritesTable)
    .innerJoin(listingsTable, eq(favoritesTable.listingId, listingsTable.id))
    .leftJoin(categoriesTable, eq(listingsTable.categoryId, categoriesTable.id))
    .leftJoin(regionsTable, eq(listingsTable.regionId, regionsTable.id))
    .leftJoin(sql`${usersTable} AS owner`, sql`owner.id = ${listingsTable.ownerId}`)
    .where(eq(favoritesTable.userId, userId))
    .orderBy(favoritesTable.createdAt);

  res.json(rows.map(r => ({
    id: r.listing.id,
    favoriteId: r.favoriteId,
    favoritedAt: r.createdAt.toISOString(),
    title: r.listing.title,
    photos: r.listing.photos ?? [],
    pricePerDay: parseFloat(r.listing.pricePerDay as unknown as string),
    deposit: r.listing.deposit ? parseFloat(r.listing.deposit as unknown as string) : null,
    isAvailable: r.listing.isAvailable,
    categoryName: r.categoryName ?? undefined,
    regionName: r.regionName ?? undefined,
    city: r.listing.city ?? undefined,
    ownerName: r.ownerName ?? undefined,
    ownerId: r.listing.ownerId,
    rating: r.avgRating ? parseFloat(String(r.avgRating)) : null,
  })));
});

// ─── GET /api/favorites/ids — just the listing IDs the user has favorited ────
router.get("/ids", requireAuth, async (req: AuthRequest, res) => {
  const rows = await db
    .select({ listingId: favoritesTable.listingId })
    .from(favoritesTable)
    .where(eq(favoritesTable.userId, req.userId!));
  res.json(rows.map(r => r.listingId));
});

// ─── POST /api/favorites/:listingId — add to favorites ───────────────────────
router.post("/:listingId", requireAuth, async (req: AuthRequest, res) => {
  const listingId = parseInt(req.params.listingId as string);
  if (isNaN(listingId)) { res.status(400).json({ error: "invalid listing id" }); return; }

  try {
    const [row] = await db
      .insert(favoritesTable)
      .values({ userId: req.userId!, listingId })
      .onConflictDoNothing()
      .returning();
    // Stage 19e: инкремент только если действительно добавили (а не дубликат)
    if (row) {
      await applyFavoritesCountDelta(listingId, +1);
    }
    res.json({ success: true, favoriteId: row?.id ?? null });
  } catch {
    res.status(500).json({ error: "failed to add favorite" });
  }
});

// ─── DELETE /api/favorites/:listingId — remove from favorites ────────────────
router.delete("/:listingId", requireAuth, async (req: AuthRequest, res) => {
  const listingId = parseInt(req.params.listingId as string);
  if (isNaN(listingId)) { res.status(400).json({ error: "invalid listing id" }); return; }

  const deleted = await db
    .delete(favoritesTable)
    .where(and(eq(favoritesTable.userId, req.userId!), eq(favoritesTable.listingId, listingId)))
    .returning({ id: favoritesTable.id });
  // Stage 19e: декремент только если строка реально удалилась
  if (deleted.length > 0) {
    await applyFavoritesCountDelta(listingId, -1);
  }
  res.json({ success: true });
});

export default router;
