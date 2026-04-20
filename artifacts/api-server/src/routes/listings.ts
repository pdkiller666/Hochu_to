import { Router } from "express";
import { db, listingsTable, usersTable, categoriesTable, regionsTable, reviewsTable, bookingsTable } from "@workspace/db";
import { eq, and, gte, lte, like, sql, or, desc } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { CreateListingBody } from "@workspace/api-zod";
import fs from "fs";
import path from "path";
import { UPLOADS_DIR } from "../lib/uploadsDir.js";

const router = Router();

function deleteUploadedFiles(photos: string[]): void {
  for (const url of photos) {
    if (!url.startsWith("/uploads/")) continue;
    const filename = path.basename(url);
    if (!filename || filename.includes("..")) continue;
    const filePath = path.join(UPLOADS_DIR, filename);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // best-effort, ignore errors
    }
  }
}

function generateListingNumber(id: number): string {
  const year = new Date().getFullYear();
  return `ВТ-${year}-${String(id).padStart(6, "0")}`;
}

async function getListingWithDetails(id: number) {
  const [listing] = await db
    .select({
      id: listingsTable.id,
      listingNumber: listingsTable.listingNumber,
      title: listingsTable.title,
      description: listingsTable.description,
      pricePerDay: listingsTable.pricePerDay,
      deposit: listingsTable.deposit,
      itemCategory: listingsTable.itemCategory,
      maxProtectionLimit: listingsTable.maxProtectionLimit,
      requiresManualVerification: listingsTable.requiresManualVerification,
      ownerProtectionEnabled: listingsTable.ownerProtectionEnabled,
      categoryId: listingsTable.categoryId,
      categoryName: categoriesTable.name,
      regionId: listingsTable.regionId,
      regionName: regionsTable.name,
      city: listingsTable.city,
      lat: listingsTable.lat,
      lng: listingsTable.lng,
      meetingAddress: listingsTable.meetingAddress,
      photos: listingsTable.photos,
      isAvailable: listingsTable.isAvailable,
      ownerId: listingsTable.ownerId,
      ownerName: usersTable.name,
      ownerAvatar: usersTable.avatar,
      ownerPhone: usersTable.phone,
      createdAt: listingsTable.createdAt,
    })
    .from(listingsTable)
    .leftJoin(categoriesTable, eq(listingsTable.categoryId, categoriesTable.id))
    .leftJoin(regionsTable, eq(listingsTable.regionId, regionsTable.id))
    .leftJoin(usersTable, eq(listingsTable.ownerId, usersTable.id))
    .where(eq(listingsTable.id, id))
    .limit(1);

  return listing;
}

/** Вычисляет лимит защитного фонда по категории с учётом опыта владельца */
function calcMaxProtection(pricePerDay: number, itemCategory: string | null, completedDealsCount: number): number {
  const multipliers: Record<string, number> = { electronics: 60, tools: 30, leisure: 15 };
  const multiplier = multipliers[itemCategory ?? "tools"] ?? 30;
  const raw = pricePerDay * multiplier;
  return completedDealsCount < 3 ? Math.min(raw, 25_000) : raw;
}

router.get("/", async (req, res) => {
  const { category, region, minPrice, maxPrice, search, page = "1", limit = "12", sort = "new" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [eq(listingsTable.isAvailable, true)];

  if (category) {
    const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.slug, category)).limit(1);
    if (cat) conditions.push(eq(listingsTable.categoryId, cat.id));
  }

  if (region) {
    const [reg] = await db.select().from(regionsTable).where(eq(regionsTable.slug, region)).limit(1);
    if (reg) conditions.push(eq(listingsTable.regionId, reg.id));
  }

  if (minPrice) conditions.push(gte(listingsTable.pricePerDay, minPrice));
  if (maxPrice) conditions.push(lte(listingsTable.pricePerDay, maxPrice));
  if (search) conditions.push(
    or(
      like(listingsTable.title, `%${search}%`),
      like(listingsTable.description ?? sql`''`, `%${search}%`)
    )!
  );

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(listingsTable)
    .where(whereClause);

  const total = totalResult?.count ?? 0;

  const needsJsSorting = sort === "rating" || sort === "popular";

  const baseQuery = db
    .select({
      id: listingsTable.id,
      listingNumber: listingsTable.listingNumber,
      title: listingsTable.title,
      description: listingsTable.description,
      pricePerDay: listingsTable.pricePerDay,
      deposit: listingsTable.deposit,
      itemCategory: listingsTable.itemCategory,
      maxProtectionLimit: listingsTable.maxProtectionLimit,
      requiresManualVerification: listingsTable.requiresManualVerification,
      ownerProtectionEnabled: listingsTable.ownerProtectionEnabled,
      categoryId: listingsTable.categoryId,
      categoryName: categoriesTable.name,
      regionId: listingsTable.regionId,
      regionName: regionsTable.name,
      city: listingsTable.city,
      lat: listingsTable.lat,
      lng: listingsTable.lng,
      meetingAddress: listingsTable.meetingAddress,
      photos: listingsTable.photos,
      isAvailable: listingsTable.isAvailable,
      ownerId: listingsTable.ownerId,
      ownerName: usersTable.name,
      ownerAvatar: usersTable.avatar,
      ownerPhone: usersTable.phone,
      createdAt: listingsTable.createdAt,
    })
    .from(listingsTable)
    .leftJoin(categoriesTable, eq(listingsTable.categoryId, categoriesTable.id))
    .leftJoin(regionsTable, eq(listingsTable.regionId, regionsTable.id))
    .leftJoin(usersTable, eq(listingsTable.ownerId, usersTable.id))
    .where(whereClause);

  let rawListings;
  if (needsJsSorting) {
    rawListings = await (baseQuery as any).orderBy(desc(listingsTable.createdAt));
  } else if (sort === "price_asc") {
    rawListings = await (baseQuery as any).orderBy(sql`${listingsTable.pricePerDay}::numeric ASC`).limit(limitNum).offset(offset);
  } else if (sort === "price_desc") {
    rawListings = await (baseQuery as any).orderBy(sql`${listingsTable.pricePerDay}::numeric DESC`).limit(limitNum).offset(offset);
  } else {
    rawListings = await (baseQuery as any).orderBy(desc(listingsTable.createdAt)).limit(limitNum).offset(offset);
  }

  // Enrich with rating (and optionally booking count for popular sort)
  const listingsWithRating = await Promise.all(rawListings.map(async (l) => {
    const [ratingResult] = await db
      .select({
        avg: sql<number>`COALESCE(AVG(${reviewsTable.rating}), 0)::float`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(reviewsTable)
      .where(eq(reviewsTable.listingId, l.id));

    let bookingCount = 0;
    if (sort === "popular") {
      const [bookingResult] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(bookingsTable)
        .where(and(
          eq(bookingsTable.listingId, l.id),
          sql`${bookingsTable.status} IN ('confirmed','active','completed')`
        ));
      bookingCount = bookingResult?.count ?? 0;
    }

    return {
      ...l,
      pricePerDay: parseFloat(l.pricePerDay as unknown as string),
      deposit: l.deposit ? parseFloat(l.deposit as unknown as string) : undefined,
      createdAt: l.createdAt.toISOString(),
      rating: ratingResult?.avg ?? 0,
      reviewCount: ratingResult?.count ?? 0,
      bookingCount,
    };
  }));

  // Apply JS-based sorting for rating and popular
  let sortedListings = listingsWithRating;
  if (sort === "rating") {
    sortedListings = [...listingsWithRating].sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return b.reviewCount - a.reviewCount;
    });
    sortedListings = sortedListings.slice(offset, offset + limitNum);
  } else if (sort === "popular") {
    sortedListings = [...listingsWithRating].sort((a, b) => {
      if (b.bookingCount !== a.bookingCount) return b.bookingCount - a.bookingCount;
      return b.rating - a.rating;
    });
    sortedListings = sortedListings.slice(offset, offset + limitNum);
  }

  res.json({
    listings: sortedListings,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
  });
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const parsed = CreateListingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const { title, description, pricePerDay, categoryId, regionId, city, lat, lng, meetingAddress, photos, itemCategory, ownerProtectionEnabled, isAvailable } = parsed.data;

  // Загружаем кол-во завершённых сделок владельца для расчёта кепа фонда
  const [owner] = await db.select({ completedDealsCount: usersTable.completedDealsCount })
    .from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  const completedDeals = owner?.completedDealsCount ?? 0;

  const maxProtectionLimit = calcMaxProtection(pricePerDay, itemCategory ?? null, completedDeals);

  // Детектор аномальной цены (>3× от среднего по категории)
  const categoryAvg: Record<string, number> = { electronics: 2500, tools: 1000, leisure: 500 };
  const avg = categoryAvg[itemCategory ?? "tools"] ?? 1000;
  const requiresManualVerification = pricePerDay > avg * 3;

  const [listing] = await db.insert(listingsTable).values({
    title,
    description: description ?? null,
    pricePerDay: pricePerDay.toString(),
    categoryId,
    itemCategory: itemCategory ?? null,
    maxProtectionLimit,
    requiresManualVerification,
    regionId,
    city: city ?? null,
    lat: lat ?? null,
    lng: lng ?? null,
    meetingAddress: meetingAddress ?? null,
    ownerId: req.userId!,
    photos: photos ?? [],
    ownerProtectionEnabled: ownerProtectionEnabled !== false,
    isAvailable: isAvailable ?? true,
  }).returning();

  // Assign listing number
  const listingNumber = generateListingNumber(listing.id);
  await db.update(listingsTable).set({ listingNumber }).where(eq(listingsTable.id, listing.id));

  const full = await getListingWithDetails(listing.id);
  res.status(201).json({
    ...full,
    pricePerDay: parseFloat(full!.pricePerDay as unknown as string),
    deposit: full!.deposit ? parseFloat(full!.deposit as unknown as string) : undefined,
    createdAt: full!.createdAt.toISOString(),
  });
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "bad_request", message: "Неверный ID" });
    return;
  }

  const listing = await getListingWithDetails(id);
  if (!listing) {
    res.status(404).json({ error: "not_found", message: "Объявление не найдено" });
    return;
  }

  const reviews = await db
    .select({
      id: reviewsTable.id,
      listingId: reviewsTable.listingId,
      authorId: reviewsTable.authorId,
      authorName: usersTable.name,
      authorAvatar: usersTable.avatar,
      rating: reviewsTable.rating,
      text: reviewsTable.text,
      createdAt: reviewsTable.createdAt,
    })
    .from(reviewsTable)
    .leftJoin(usersTable, eq(reviewsTable.authorId, usersTable.id))
    .where(eq(reviewsTable.listingId, id))
    .orderBy(reviewsTable.createdAt);

  const [ratingResult] = await db
    .select({
      avg: sql<number>`COALESCE(AVG(${reviewsTable.rating}), 0)::float`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(reviewsTable)
    .where(eq(reviewsTable.listingId, id));

  res.json({
    ...listing,
    pricePerDay: parseFloat(listing.pricePerDay as unknown as string),
    deposit: listing.deposit ? parseFloat(listing.deposit as unknown as string) : undefined,
    createdAt: listing.createdAt.toISOString(),
    rating: ratingResult?.avg ?? 0,
    reviewCount: ratingResult?.count ?? 0,
    reviews: reviews.map(r => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      authorAvatar: r.authorAvatar ?? undefined,
      text: r.text ?? undefined,
    })),
  });
});

router.put("/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(listingsTable).where(eq(listingsTable.id, id)).limit(1);

  if (!existing) {
    res.status(404).json({ error: "not_found", message: "Объявление не найдено" });
    return;
  }

  if (existing.ownerId !== req.userId) {
    res.status(403).json({ error: "forbidden", message: "Нет доступа" });
    return;
  }

  const { title, description, pricePerDay, categoryId, regionId, city, lat, lng, meetingAddress, photos, itemCategory, ownerProtectionEnabled: ownerProt, isAvailable } = req.body;

  if (photos !== undefined && Array.isArray(existing.photos)) {
    const removed = (existing.photos as string[]).filter(p => !photos.includes(p));
    deleteUploadedFiles(removed);
  }

  // Пересчитываем лимит фонда при изменении цены или категории
  let newMaxProtection: number | undefined;
  if (pricePerDay !== undefined || itemCategory !== undefined) {
    const [owner] = await db.select({ completedDealsCount: usersTable.completedDealsCount })
      .from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    const completedDeals = owner?.completedDealsCount ?? 0;
    const ppd = pricePerDay ?? parseFloat(existing.pricePerDay as unknown as string);
    const cat = itemCategory ?? existing.itemCategory;
    newMaxProtection = calcMaxProtection(ppd, cat, completedDeals);
  }

  const categoryAvg: Record<string, number> = { electronics: 2500, tools: 1000, leisure: 500 };
  const ppd = pricePerDay ?? parseFloat(existing.pricePerDay as unknown as string);
  const cat = itemCategory ?? existing.itemCategory ?? "tools";
  const newRequiresVerification = ppd > (categoryAvg[cat] ?? 1000) * 3;

  await db.update(listingsTable).set({
    ...(title && { title }),
    ...(description !== undefined && { description }),
    ...(pricePerDay !== undefined && { pricePerDay: pricePerDay.toString() }),
    ...(categoryId && { categoryId }),
    ...(itemCategory !== undefined && { itemCategory }),
    ...(newMaxProtection !== undefined && { maxProtectionLimit: newMaxProtection }),
    requiresManualVerification: newRequiresVerification,
    ...(regionId && { regionId }),
    ...(city !== undefined && { city: city || null }),
    ...(lat !== undefined && { lat: lat ?? null }),
    ...(lng !== undefined && { lng: lng ?? null }),
    ...(meetingAddress !== undefined && { meetingAddress: meetingAddress || null }),
    ...(photos !== undefined && { photos }),
    ...(ownerProt !== undefined && { ownerProtectionEnabled: ownerProt }),
    ...(isAvailable !== undefined && { isAvailable }),
  }).where(eq(listingsTable.id, id));

  const updated = await getListingWithDetails(id);
  res.json({
    ...updated,
    pricePerDay: parseFloat(updated!.pricePerDay as unknown as string),
    deposit: updated!.deposit ? parseFloat(updated!.deposit as unknown as string) : undefined,
    createdAt: updated!.createdAt.toISOString(),
  });
});

router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(listingsTable).where(eq(listingsTable.id, id)).limit(1);

  if (!existing) {
    res.status(404).json({ error: "not_found", message: "Объявление не найдено" });
    return;
  }

  if (existing.ownerId !== req.userId) {
    res.status(403).json({ error: "forbidden", message: "Нет доступа" });
    return;
  }

  deleteUploadedFiles(existing.photos ?? []);
  await db.delete(listingsTable).where(eq(listingsTable.id, id));
  res.json({ success: true, message: "Объявление удалено" });
});

router.get("/:id/unavailable-dates", async (req, res) => {
  const id = parseInt(req.params.id);

  const bookings = await db
    .select({
      startDate: bookingsTable.startDate,
      endDate: bookingsTable.endDate,
      status: bookingsTable.status,
    })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.listingId, id),
        sql`${bookingsTable.status} IN ('pending', 'confirmed')`
      )
    );

  res.json(bookings);
});

router.get("/:id/reviews", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "bad_request" }); return; }

  const rows = await db
    .select({
      id: reviewsTable.id,
      reviewType: reviewsTable.reviewType,
      reviewerRole: reviewsTable.reviewerRole,
      listingId: reviewsTable.listingId,
      bookingId: reviewsTable.bookingId,
      bookingNumber: reviewsTable.bookingNumber,
      authorId: reviewsTable.authorId,
      authorName: usersTable.name,
      authorAvatar: usersTable.avatar,
      revieweeId: reviewsTable.revieweeId,
      rating: reviewsTable.rating,
      text: reviewsTable.text,
      responseText: reviewsTable.responseText,
      responseAt: reviewsTable.responseAt,
      createdAt: reviewsTable.createdAt,
    })
    .from(reviewsTable)
    .leftJoin(usersTable, eq(reviewsTable.authorId, usersTable.id))
    .where(and(eq(reviewsTable.listingId, id), eq(reviewsTable.reviewType, "listing")))
    .orderBy(sql`${reviewsTable.createdAt} DESC`);

  res.json(rows.map(r => ({
    id: r.id,
    reviewType: r.reviewType,
    reviewerRole: r.reviewerRole,
    listingId: r.listingId ?? undefined,
    bookingId: r.bookingId ?? undefined,
    bookingNumber: r.bookingNumber ?? undefined,
    authorId: r.authorId,
    authorName: r.authorName ?? "Пользователь",
    authorAvatar: r.authorAvatar ?? undefined,
    revieweeId: r.revieweeId ?? undefined,
    rating: r.rating,
    text: r.text ?? undefined,
    responseText: r.responseText ?? undefined,
    responseAt: r.responseAt ? r.responseAt.toISOString() : undefined,
    createdAt: r.createdAt.toISOString(),
  })));
});

export default router;
